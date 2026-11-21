import pg from "pg";
import { query } from "../../config/database.js";
import { Reservation, Guest, ReservationStatus } from "./reservations.types.js";
import { ReservationDbRow, GuestDbRow } from "./reservations.types.js";
import { QueryReservationsInput } from "@hotel-pms/validations";

export function mapGuestRow(row: GuestDbRow): Guest {
  return {
    id: row.id,
    name: row.name ?? [row.first_name, row.last_name].filter(Boolean).join(" "),
    email: row.email ?? null,
    phone: row.phone ?? null,
    idNumber: row.id_number ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapReservationRow(row: ReservationDbRow): Reservation {
  const checkIn =
    typeof row.check_in_date === "string"
      ? row.check_in_date.slice(0, 10)
      : new Date(row.check_in_date).toISOString().slice(0, 10);
  const checkOut =
    typeof row.check_out_date === "string"
      ? row.check_out_date.slice(0, 10)
      : new Date(row.check_out_date).toISOString().slice(0, 10);

  const reservation: Reservation = {
    id: row.id,
    reservationNumber: row.reservation_number,
    guestId: row.guest_id,
    roomTypeId: row.room_type_id,
    source: "walk_in",
    checkInDate: checkIn,
    checkOutDate: checkOut,
    status: row.status,
    adultCount: row.adult_count,
    childCount: row.child_count,
    specialRequests: row.special_requests ?? null,
    totalAmount: Number(row.total_amount),
    amountPaid: 0,
    balanceDue: Number(row.total_amount),
    paymentReference: null,
    expiresAt: null,
    confirmedAt: null,
    checkedInAt: null,
    checkedOutAt: null,
    cancelledAt: null,
    cancellationReason: null,
    noShowAt: null,
    refundAmount: null,
    refundedAt: null,
    refundedBy: null,
    createdBy: "system",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.guest_email) {
    reservation.guest = {
      id: row.guest_id,
      name: [row.guest_first_name, row.guest_last_name]
        .filter(Boolean)
        .join(" "),
      email: row.guest_email,
      phone: row.guest_phone ?? null,
      idNumber: null,
      notes: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  if (row.type_code && row.type_name) {
    reservation.roomType = {
      id: row.room_type_id,
      code: row.type_code,
      name: row.type_name,
      basePrice: Number(row.type_base_price),
      baseRate: Number(row.type_base_price),
      capacity: row.type_capacity ?? 2,
      physicalRoomCount: row.type_capacity ?? 0,
      overbookingAllowance: 0,
      amenities: Array.isArray(row.type_amenities)
        ? row.type_amenities
        : JSON.parse(
            typeof row.type_amenities === "string" ? row.type_amenities : "[]",
          ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return reservation;
}

const SELECT_RESERVATIONS_SQL = `
  SELECT
    r.*,
    g.first_name AS guest_first_name,
    g.last_name AS guest_last_name,
    g.email AS guest_email,
    g.phone AS guest_phone,
    rt.code AS type_code,
    rt.name AS type_name,
    rt.base_price AS type_base_price,
    rt.capacity AS type_capacity,
    rt.amenities AS type_amenities
  FROM reservations r
  JOIN guests g ON r.guest_id = g.id
  JOIN room_types rt ON r.room_type_id = rt.id
`;

export class ReservationsRepository {
  async findReservationById(
    id: string,
    client?: pg.PoolClient,
  ): Promise<Reservation | null> {
    const sql = `${SELECT_RESERVATIONS_SQL} WHERE r.id = $1`;
    const res = client
      ? await client.query<ReservationDbRow>(sql, [id])
      : await query<ReservationDbRow>(sql, [id]);

    if (res.rows.length === 0) return null;
    return mapReservationRow(res.rows[0]);
  }

  async findReservationByNumber(
    reservationNumber: string,
  ): Promise<Reservation | null> {
    const sql = `${SELECT_RESERVATIONS_SQL} WHERE r.reservation_number = $1`;
    const res = await query<ReservationDbRow>(sql, [reservationNumber]);
    if (res.rows.length === 0) return null;
    return mapReservationRow(res.rows[0]);
  }

  async findGuestById(
    id: string,
    client?: pg.PoolClient,
  ): Promise<Guest | null> {
    const sql = `SELECT * FROM guests WHERE id = $1`;
    const res = client
      ? await client.query<GuestDbRow>(sql, [id])
      : await query<GuestDbRow>(sql, [id]);
    if (res.rows.length === 0) return null;
    return mapGuestRow(res.rows[0]);
  }

  async findGuestByEmail(
    email: string,
    client?: pg.PoolClient,
  ): Promise<Guest | null> {
    const sql = `SELECT * FROM guests WHERE LOWER(email) = LOWER($1)`;
    const res = client
      ? await client.query<GuestDbRow>(sql, [email])
      : await query<GuestDbRow>(sql, [email]);
    if (res.rows.length === 0) return null;
    return mapGuestRow(res.rows[0]);
  }

  async createGuest(
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    },
    client?: pg.PoolClient,
  ): Promise<Guest> {
    const sql = `
      INSERT INTO guests (first_name, last_name, email, phone)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = COALESCE(EXCLUDED.phone, guests.phone),
        updated_at = NOW()
      RETURNING *;
    `;
    const params = [
      data.firstName,
      data.lastName,
      data.email,
      data.phone ?? null,
    ];
    const res = client
      ? await client.query<GuestDbRow>(sql, params)
      : await query<GuestDbRow>(sql, params);
    return mapGuestRow(res.rows[0]);
  }

  async createReservation(
    data: {
      reservationNumber: string;
      guestId: string;
      roomTypeId: string;
      checkInDate: string;
      checkOutDate: string;
      status: ReservationStatus;
      adultCount: number;
      childCount: number;
      specialRequests?: string;
      totalAmount: number;
    },
    client?: pg.PoolClient,
  ): Promise<Reservation> {
    const sql = `
      INSERT INTO reservations (
        reservation_number,
        guest_id,
        room_type_id,
        check_in_date,
        check_out_date,
        status,
        adult_count,
        child_count,
        special_requests,
        total_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const params = [
      data.reservationNumber,
      data.guestId,
      data.roomTypeId,
      data.checkInDate,
      data.checkOutDate,
      data.status,
      data.adultCount,
      data.childCount,
      data.specialRequests ?? null,
      data.totalAmount,
    ];

    const res = client
      ? await client.query<ReservationDbRow>(sql, params)
      : await query<ReservationDbRow>(sql, params);

    return this.findReservationById(
      res.rows[0].id,
      client,
    ) as Promise<Reservation>;
  }

  async updateReservationStatus(
    id: string,
    status: ReservationStatus,
    client?: pg.PoolClient,
  ): Promise<Reservation | null> {
    const sql = `
      UPDATE reservations
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client
      ? await client.query<ReservationDbRow>(sql, [id, status])
      : await query<ReservationDbRow>(sql, [id, status]);

    if (res.rows.length === 0) return null;
    return this.findReservationById(id, client);
  }

  async updateReservationMetadata(
    id: string,
    data: {
      adultCount?: number;
      childCount?: number;
      specialRequests?: string;
    },
    client?: pg.PoolClient,
  ): Promise<Reservation | null> {
    const sets: string[] = ["updated_at = NOW()"];
    const params: any[] = [id];
    let idx = 2;

    if (data.adultCount !== undefined) {
      sets.push(`adult_count = $${idx++}`);
      params.push(data.adultCount);
    }
    if (data.childCount !== undefined) {
      sets.push(`child_count = $${idx++}`);
      params.push(data.childCount);
    }
    if (data.specialRequests !== undefined) {
      sets.push(`special_requests = $${idx++}`);
      params.push(data.specialRequests);
    }

    const sql = `
      UPDATE reservations
      SET ${sets.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;
    const res = client
      ? await client.query<ReservationDbRow>(sql, params)
      : await query<ReservationDbRow>(sql, params);

    if (res.rows.length === 0) return null;
    return this.findReservationById(id, client);
  }

  async findReservations(
    filter: QueryReservationsInput,
    offset: number,
    limit: number,
  ): Promise<Reservation[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`r.status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter.guestId) {
      conditions.push(`r.guest_id = $${idx++}`);
      params.push(filter.guestId);
    }
    if (filter.roomTypeId) {
      conditions.push(`r.room_type_id = $${idx++}`);
      params.push(filter.roomTypeId);
    }
    if (filter.checkInDate) {
      conditions.push(`r.check_in_date = $${idx++}`);
      params.push(filter.checkInDate);
    }
    if (filter.checkOutDate) {
      conditions.push(`r.check_out_date = $${idx++}`);
      params.push(filter.checkOutDate);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      ${SELECT_RESERVATIONS_SQL}
      ${where}
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const res = await query<ReservationDbRow>(sql, params);
    return res.rows.map(mapReservationRow);
  }

  async countReservations(filter: QueryReservationsInput): Promise<number> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter.guestId) {
      conditions.push(`guest_id = $${idx++}`);
      params.push(filter.guestId);
    }
    if (filter.roomTypeId) {
      conditions.push(`room_type_id = $${idx++}`);
      params.push(filter.roomTypeId);
    }
    if (filter.checkInDate) {
      conditions.push(`check_in_date = $${idx++}`);
      params.push(filter.checkInDate);
    }
    if (filter.checkOutDate) {
      conditions.push(`check_out_date = $${idx++}`);
      params.push(filter.checkOutDate);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT COUNT(*)::int AS count FROM reservations ${where};`;
    const res = await query<{ count: number }>(sql, params);
    return res.rows[0]?.count ?? 0;
  }
}

export const reservationsRepository = new ReservationsRepository();
