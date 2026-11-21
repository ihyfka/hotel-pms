import { query } from "../../config/database.js";
import { AvailabilityDbRow } from "./availability.types.js";

export class AvailabilityRepository {
  async findAvailableRoomTypes(
    checkIn: string,
    checkOut: string,
  ): Promise<AvailabilityDbRow[]> {
    const sql = `
      SELECT
        rt.id AS room_type_id,
        rt.code,
        rt.name,
        rt.base_price,
        rt.capacity,
        rt.amenities,
        COUNT(r.id)::int AS available_count
      FROM room_types rt
      JOIN rooms r ON r.room_type_id = rt.id
      WHERE r.maintenance_status = 'operational'
        AND NOT EXISTS (
          SELECT 1 FROM room_allocations ra
          WHERE ra.room_id = r.id
            AND ra.status = 'active'
            AND ra.assigned_range_start < ($2 || 'T11:00:00Z')::timestamptz
            AND ra.assigned_range_end > ($1 || 'T14:00:00Z')::timestamptz
        )
      GROUP BY rt.id, rt.code, rt.name, rt.base_price, rt.capacity, rt.amenities
      HAVING COUNT(r.id) > 0
      ORDER BY rt.base_price ASC;
    `;

    const res = await query<AvailabilityDbRow>(sql, [checkIn, checkOut]);
    return res.rows;
  }

  async countAvailableRoomsForType(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(r.id)::int AS available_count
      FROM rooms r
      WHERE r.room_type_id = $1
        AND r.maintenance_status = 'operational'
        AND NOT EXISTS (
          SELECT 1 FROM room_allocations ra
          WHERE ra.room_id = r.id
            AND ra.status = 'active'
            AND ra.assigned_range_start < ($3 || 'T11:00:00Z')::timestamptz
            AND ra.assigned_range_end > ($2 || 'T14:00:00Z')::timestamptz
        );
    `;

    const res = await query<{ available_count: number }>(sql, [
      roomTypeId,
      checkIn,
      checkOut,
    ]);
    return res.rows[0]?.available_count ?? 0;
  }

  async findAvailableRoomsForType(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<
    { id: string; room_number: string; floor: number; building: string }[]
  > {
    const sql = `
      SELECT r.id, r.room_number, r.floor, r.building
      FROM rooms r
      WHERE r.room_type_id = $1
        AND r.maintenance_status = 'operational'
        AND NOT EXISTS (
          SELECT 1 FROM room_allocations ra
          WHERE ra.room_id = r.id
            AND ra.status = 'active'
            AND ra.assigned_range_start < ($3 || 'T11:00:00Z')::timestamptz
            AND ra.assigned_range_end > ($2 || 'T14:00:00Z')::timestamptz
        )
      ORDER BY r.floor ASC, r.room_number ASC;
    `;

    const res = await query<{
      id: string;
      room_number: string;
      floor: number;
      building: string;
    }>(sql, [roomTypeId, checkIn, checkOut]);
    return res.rows;
  }
}

export const availabilityRepository = new AvailabilityRepository();
