import pg from "pg";
import { query } from "../../config/database.js";
import { RoomAllocation, RoomAllocationDbRow } from "./allocations.types.js";

export function mapAllocationRow(row: RoomAllocationDbRow): RoomAllocation & {
  room?: { roomNumber: string; floor: number; building: string };
  reservation?: {
    reservationNumber: string;
    checkInDate: string;
    checkOutDate: string;
  };
} {
  const allocation: RoomAllocation & {
    room?: { roomNumber: string; floor: number; building: string };
    reservation?: {
      reservationNumber: string;
      checkInDate: string;
      checkOutDate: string;
    };
  } = {
    id: row.id,
    reservationId: row.reservation_id,
    roomId: row.room_id,
    assignedAt: new Date(row.assigned_at),
    assignedBy: row.assigned_by,
    releasedAt: row.released_at ? new Date(row.released_at) : null,
    releasedBy: row.released_by ?? null,
    notes: row.notes ?? undefined,
  };

  if (row.room_number) {
    allocation.room = {
      roomNumber: row.room_number,
      floor: row.room_floor ?? 0,
      building: row.room_building ?? "",
    };
  }

  if (row.reservation_number) {
    allocation.reservation = {
      reservationNumber: row.reservation_number,
      checkInDate:
        typeof row.check_in_date === "string"
          ? row.check_in_date.slice(0, 10)
          : new Date(row.check_in_date || "").toISOString().slice(0, 10),
      checkOutDate:
        typeof row.check_out_date === "string"
          ? row.check_out_date.slice(0, 10)
          : new Date(row.check_out_date || "").toISOString().slice(0, 10),
    };
  }

  return allocation;
}

const SELECT_ALLOCATIONS_SQL = `
  SELECT
    ra.*,
    rm.room_number,
    rm.floor AS room_floor,
    rm.building AS room_building,
    r.reservation_number,
    r.check_in_date,
    r.check_out_date
  FROM room_allocations ra
  JOIN rooms rm ON ra.room_id = rm.id
  JOIN reservations r ON ra.reservation_id = r.id
`;

export class AllocationsRepository {
  async findAllocationById(id: string, client?: pg.PoolClient) {
    const sql = `${SELECT_ALLOCATIONS_SQL} WHERE ra.id = $1`;
    const res = client
      ? await client.query<RoomAllocationDbRow>(sql, [id])
      : await query<RoomAllocationDbRow>(sql, [id]);
    if (res.rows.length === 0) return null;
    return mapAllocationRow(res.rows[0]);
  }

  async findActiveAllocationByReservationId(
    reservationId: string,
    client?: pg.PoolClient,
  ) {
    const sql = `${SELECT_ALLOCATIONS_SQL} WHERE ra.reservation_id = $1 AND ra.status = 'active'`;
    const res = client
      ? await client.query<RoomAllocationDbRow>(sql, [reservationId])
      : await query<RoomAllocationDbRow>(sql, [reservationId]);
    if (res.rows.length === 0) return null;
    return mapAllocationRow(res.rows[0]);
  }

  async hasOverlappingActiveAllocation(
    roomId: string,
    start: Date,
    end: Date,
    excludeAllocationId?: string,
    client?: pg.PoolClient,
  ): Promise<boolean> {
    const conditions = [
      `room_id = $1`,
      `status = 'active'`,
      `assigned_range_start < $3`,
      `assigned_range_end > $2`,
    ];
    const params: any[] = [roomId, start.toISOString(), end.toISOString()];

    if (excludeAllocationId) {
      conditions.push(`id != $4`);
      params.push(excludeAllocationId);
    }

    const sql = `SELECT 1 FROM room_allocations WHERE ${conditions.join(" AND ")} LIMIT 1;`;
    const res = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows.length > 0;
  }

  async createAllocation(
    data: {
      reservationId: string;
      roomId: string;
      assignedRangeStart: Date;
      assignedRangeEnd: Date;
      assignedBy?: string;
      notes?: string;
    },
    client?: pg.PoolClient,
  ) {
    const sql = `
      INSERT INTO room_allocations (
        reservation_id,
        room_id,
        assigned_range_start,
        assigned_range_end,
        status,
        assigned_by,
        notes
      ) VALUES ($1, $2, $3, $4, 'active', $5, $6)
      RETURNING *;
    `;
    const params = [
      data.reservationId,
      data.roomId,
      data.assignedRangeStart.toISOString(),
      data.assignedRangeEnd.toISOString(),
      data.assignedBy ?? null,
      data.notes ?? null,
    ];

    const res = client
      ? await client.query<RoomAllocationDbRow>(sql, params)
      : await query<RoomAllocationDbRow>(sql, params);

    return this.findAllocationById(res.rows[0].id, client);
  }

  async releaseAllocation(
    id: string,
    releasedBy: string,
    client?: pg.PoolClient,
  ) {
    const sql = `
      UPDATE room_allocations
      SET released_at = NOW(), released_by = $2
      WHERE id = $1
        AND released_at IS NULL
      RETURNING *;
    `;
    const res = client
      ? await client.query<RoomAllocationDbRow>(sql, [id, releasedBy])
      : await query<RoomAllocationDbRow>(sql, [id, releasedBy]);

    if (res.rows.length === 0) return null;
    return this.findAllocationById(id, client);
  }

  async updateAllocationStatus(
    id: string,
    status: "cancelled" | "completed",
    client?: pg.PoolClient,
  ) {
    void status;
    return this.releaseAllocation(id, "system", client);
  }
}

export const allocationsRepository = new AllocationsRepository();
