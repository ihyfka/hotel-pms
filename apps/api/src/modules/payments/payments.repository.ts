import pg from "pg";
import { query } from "../../config/database.js";
import { Payment, PaymentDbRow, PaymentMethod } from "./payments.types.js";

export function mapPaymentRow(row: PaymentDbRow): Payment {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    reference: row.reference,
    notes: row.notes ?? undefined,
    recordedBy: row.recorded_by,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

export class PaymentsRepository {
  async findPaymentById(
    id: string,
    client?: pg.PoolClient,
  ): Promise<Payment | null> {
    const sql = `SELECT * FROM payments WHERE id = $1`;
    const res = client
      ? await client.query<PaymentDbRow>(sql, [id])
      : await query<PaymentDbRow>(sql, [id]);
    if (res.rows.length === 0) return null;
    return mapPaymentRow(res.rows[0]);
  }

  async findPaymentByReservationId(
    reservationId: string,
    client?: pg.PoolClient,
  ): Promise<Payment | null> {
    const sql = `SELECT * FROM payments WHERE reservation_id = $1`;
    const res = client
      ? await client.query<PaymentDbRow>(sql, [reservationId])
      : await query<PaymentDbRow>(sql, [reservationId]);
    if (res.rows.length === 0) return null;
    return mapPaymentRow(res.rows[0]);
  }

  async createPayment(
    data: {
      reservationId: string;
      amount: number;
      method: PaymentMethod;
      reference?: string;
      notes?: string;
      recordedBy: string;
    },
    client?: pg.PoolClient,
  ): Promise<Payment> {
    const sql = `
      INSERT INTO payments (
        reservation_id,
        amount,
        method,
        reference,
        notes,
        recorded_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'completed')
      RETURNING *;
    `;
    const params = [
      data.reservationId,
      data.amount,
      data.method,
      data.reference ?? null,
      data.notes ?? null,
      data.recordedBy,
    ];

    const res = client
      ? await client.query<PaymentDbRow>(sql, params)
      : await query<PaymentDbRow>(sql, params);

    return mapPaymentRow(res.rows[0]);
  }
}

export const paymentsRepository = new PaymentsRepository();
