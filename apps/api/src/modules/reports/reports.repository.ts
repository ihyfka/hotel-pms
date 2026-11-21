import { query } from "../../config/database.js";
import { ArrivalsReportItem, DeparturesReportItem } from "./reports.types.js";

export class ReportsRepository {
  async getDailyRevenue(date: string): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(amount), 0)::numeric(10, 2) AS total_revenue
      FROM payments
      WHERE status = 'completed'
        AND paid_at::date = $1::date;
    `;
    const res = await query<{ total_revenue: string | number }>(sql, [date]);
    return Number(res.rows[0]?.total_revenue ?? 0);
  }

  async getOccupiedRoomCount(date: string): Promise<number> {
    const sql = `
      SELECT COUNT(DISTINCT room_id)::int AS occupied_count
      FROM room_allocations
      WHERE status IN ('active', 'completed')
        AND assigned_range_start < ($1 || ' 23:59:59Z')::timestamptz
        AND assigned_range_end > ($1 || ' 00:00:00Z')::timestamptz;
    `;
    const res = await query<{ occupied_count: number }>(sql, [date]);
    return res.rows[0]?.occupied_count ?? 0;
  }

  async getArrivals(date: string): Promise<ArrivalsReportItem[]> {
    const sql = `
      SELECT
        (g.first_name || ' ' || g.last_name) AS guest_name,
        r.reservation_number,
        rt.name AS room_type,
        rm.room_number AS allocated_room_number,
        r.special_requests
      FROM reservations r
      JOIN guests g ON r.guest_id = g.id
      JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN room_allocations ra ON ra.reservation_id = r.id AND ra.status = 'active'
      LEFT JOIN rooms rm ON ra.room_id = rm.id
      WHERE r.check_in_date = $1::date
        AND r.status IN ('confirmed', 'checked_in')
      ORDER BY r.created_at ASC;
    `;
    const res = await query<ArrivalsReportItem>(sql, [date]);
    return res.rows.map((row) => ({
      guest_name: row.guest_name,
      reservation_number: row.reservation_number,
      room_type: row.room_type,
      allocated_room_number: row.allocated_room_number ?? null,
      special_requests: row.special_requests ?? null,
    }));
  }

  async getDepartures(date: string): Promise<DeparturesReportItem[]> {
    const sql = `
      SELECT
        (g.first_name || ' ' || g.last_name) AS guest_name,
        r.reservation_number,
        COALESCE(rm.room_number, 'Unassigned') AS room_number,
        r.total_amount,
        CASE WHEN p.id IS NOT NULL AND p.status = 'completed' THEN 'paid' ELSE 'unpaid' END AS payment_status
      FROM reservations r
      JOIN guests g ON r.guest_id = g.id
      LEFT JOIN room_allocations ra ON ra.reservation_id = r.id
      LEFT JOIN rooms rm ON ra.room_id = rm.id
      LEFT JOIN payments p ON p.reservation_id = r.id AND p.status = 'completed'
      WHERE r.check_out_date = $1::date
        AND r.status = 'checked_in'
      ORDER BY r.created_at ASC;
    `;
    const res = await query<{
      guest_name: string;
      reservation_number: string;
      room_number: string;
      total_amount: string | number;
      payment_status: "paid" | "unpaid";
    }>(sql, [date]);

    return res.rows.map((row) => ({
      guest_name: row.guest_name,
      reservation_number: row.reservation_number,
      room_number: row.room_number,
      total_amount: Number(row.total_amount),
      payment_status: row.payment_status,
    }));
  }
}

export const reportsRepository = new ReportsRepository();
