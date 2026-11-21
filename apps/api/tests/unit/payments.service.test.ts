import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository.js";
import { ReservationsRepository } from "../../src/modules/reservations/reservations.repository.js";
import { Payment } from "../../src/modules/payments/payments.types.js";
import { Reservation } from "../../src/modules/reservations/reservations.types.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

describe("PaymentsService", () => {
  let mockRepo: PaymentsRepository;
  let mockResRepo: ReservationsRepository;
  let service: PaymentsService;

  const sampleReservation: Reservation = {
    id: "res-1",
    reservationNumber: "RSV-PAY12345",
    guestId: "guest-1",
    roomTypeId: "rt-1",
    checkInDate: "2026-12-01",
    checkOutDate: "2026-12-04",
    status: "checked_in",
    adultCount: 1,
    childCount: 0,
    totalAmount: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const samplePayment: Payment = {
    id: "pay-1",
    reservationId: sampleReservation.id,
    amount: 300,
    method: "card",
    status: "completed",
    recordedBy: "staff-1",
    paidAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findPaymentById: vi.fn(),
      findPaymentByReservationId: vi.fn(),
      createPayment: vi.fn(),
    } as unknown as PaymentsRepository;

    mockResRepo = {
      findReservationById: vi.fn(),
    } as unknown as ReservationsRepository;

    service = new PaymentsService(mockRepo, mockResRepo);
  });

  describe("createPayment", () => {
    it("creates payment successfully when amount matches reservation total", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findPaymentByReservationId).mockResolvedValue(null);
      vi.mocked(mockRepo.createPayment).mockResolvedValue(samplePayment);

      const result = await service.createPayment(
        {
          reservationId: sampleReservation.id,
          amount: 300,
          method: "card",
        },
        "staff-1",
      );

      expect(result).toEqual(samplePayment);
    });

    it("rejects payment if already recorded with PAYMENT_ALREADY_EXISTS", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findPaymentByReservationId).mockResolvedValue(
        samplePayment,
      );

      await expect(
        service.createPayment({
          reservationId: sampleReservation.id,
          amount: 300,
          method: "card",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.PAYMENT_ALREADY_EXISTS,
        statusCode: 409,
      });
    });

    it("rejects payment if amount does not match totalAmount with INVALID_PAYMENT_AMOUNT", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findPaymentByReservationId).mockResolvedValue(null);

      await expect(
        service.createPayment({
          reservationId: sampleReservation.id,
          amount: 150, // Partial payment not allowed in V1
          method: "cash",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_PAYMENT_AMOUNT,
        statusCode: 400,
      });
    });

    it("rejects payment if reservation does not exist with RESERVATION_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.createPayment({
          reservationId: "non-existent",
          amount: 300,
          method: "card",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("handles unique constraint error 23505 as PAYMENT_ALREADY_EXISTS", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findPaymentByReservationId).mockResolvedValue(null);
      const err: any = new Error("duplicate key");
      err.code = "23505";
      vi.mocked(mockRepo.createPayment).mockRejectedValue(err);

      await expect(
        service.createPayment({
          reservationId: sampleReservation.id,
          amount: 300,
          method: "card",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.PAYMENT_ALREADY_EXISTS,
        statusCode: 409,
      });
    });
  });

  describe("getPaymentByReservationId", () => {
    it("returns payment for a reservation", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findPaymentByReservationId).mockResolvedValue(
        samplePayment,
      );

      const result = await service.getPaymentByReservationId(
        sampleReservation.id,
      );
      expect(result).toEqual(samplePayment);
    });

    it("throws RESERVATION_NOT_FOUND when reservation does not exist", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.getPaymentByReservationId("non-existent"),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("throws PAYMENT_NOT_FOUND when payment does not exist", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findPaymentByReservationId).mockResolvedValue(null);

      await expect(
        service.getPaymentByReservationId(sampleReservation.id),
      ).rejects.toMatchObject({
        code: ErrorCodes.PAYMENT_NOT_FOUND,
        statusCode: 404,
      });
    });
  });
});
