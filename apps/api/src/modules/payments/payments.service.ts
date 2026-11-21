import {
  PaymentsRepository,
  paymentsRepository,
} from "./payments.repository.js";
import {
  reservationsRepository,
  ReservationsRepository,
} from "../reservations/reservations.repository.js";
import { Payment } from "./payments.types.js";
import { CreatePaymentInput } from "@hotel-pms/validations";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository = paymentsRepository,
    private readonly resRepo: ReservationsRepository = reservationsRepository,
  ) {}

  async createPayment(
    input: CreatePaymentInput,
    recordedBy: string = "staff",
  ): Promise<Payment> {
    // 1. Verify reservation exists
    const reservation = await this.resRepo.findReservationById(
      input.reservationId,
    );
    if (!reservation) {
      throw AppError.notFound(
        `Reservation with ID ${input.reservationId} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }

    // 2. Check if payment already exists
    const existingPayment = await this.repo.findPaymentByReservationId(
      input.reservationId,
    );
    if (existingPayment) {
      throw AppError.conflict(
        `Payment has already been recorded for reservation ${reservation.reservationNumber}`,
        ErrorCodes.PAYMENT_ALREADY_EXISTS,
      );
    }

    // 3. Amount must match reservation total_amount in V1
    if (Math.abs(input.amount - reservation.totalAmount) > 0.01) {
      throw AppError.badRequest(
        `Payment amount (${input.amount}) must exactly match reservation total amount (${reservation.totalAmount})`,
        ErrorCodes.INVALID_PAYMENT_AMOUNT,
      );
    }

    // 4. Create payment
    try {
      return await this.repo.createPayment({
        reservationId: input.reservationId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
        recordedBy,
      });
    } catch (err: any) {
      if (err.code === "23505") {
        throw AppError.conflict(
          `Payment already recorded for this reservation`,
          ErrorCodes.PAYMENT_ALREADY_EXISTS,
        );
      }
      throw err;
    }
  }

  async getPaymentByReservationId(reservationId: string): Promise<Payment> {
    const reservation = await this.resRepo.findReservationById(reservationId);
    if (!reservation) {
      throw AppError.notFound(
        `Reservation with ID ${reservationId} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }

    const payment = await this.repo.findPaymentByReservationId(reservationId);
    if (!payment) {
      throw AppError.notFound(
        `No payment found for reservation ${reservation.reservationNumber}`,
        ErrorCodes.PAYMENT_NOT_FOUND,
      );
    }

    return payment;
  }
}

export const paymentsService = new PaymentsService();
