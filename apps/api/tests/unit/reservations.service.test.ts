import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReservationsService } from "../../src/modules/reservations/reservations.service.js";
import { ReservationsRepository } from "../../src/modules/reservations/reservations.repository.js";
import { RoomsRepository } from "../../src/modules/rooms/rooms.repository.js";
import { AvailabilityService } from "../../src/modules/availability/availability.service.js";
import {
  Reservation,
  Guest,
} from "../../src/modules/reservations/reservations.types.js";
import { RoomType } from "../../src/modules/rooms/rooms.types.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

describe("ReservationsService", () => {
  let mockRepo: ReservationsRepository;
  let mockRoomsRepo: RoomsRepository;
  let mockAvailService: AvailabilityService;
  let service: ReservationsService;

  const sampleGuest: Guest = {
    id: "guest-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "+1234567890",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleRoomType: RoomType = {
    id: "rt-1",
    code: "DLX",
    name: "Deluxe Suite",
    basePrice: 200,
    capacity: 2,
    amenities: ["WiFi"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleReservation: Reservation = {
    id: "res-1",
    reservationNumber: "RSV-ABC12345",
    guestId: sampleGuest.id,
    roomTypeId: sampleRoomType.id,
    checkInDate: "2026-12-01",
    checkOutDate: "2026-12-04",
    status: "confirmed",
    adultCount: 2,
    childCount: 0,
    totalAmount: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findReservationById: vi.fn(),
      findReservationByNumber: vi.fn(),
      findReservations: vi.fn(),
      countReservations: vi.fn(),
      findGuestById: vi.fn(),
      findGuestByEmail: vi.fn(),
      createGuest: vi.fn(),
      createReservation: vi.fn(),
      updateReservationStatus: vi.fn(),
      updateReservationMetadata: vi.fn(),
    } as unknown as ReservationsRepository;

    mockRoomsRepo = {
      findRoomTypeById: vi.fn(),
    } as unknown as RoomsRepository;

    mockAvailService = {
      isRoomTypeAvailable: vi.fn(),
    } as unknown as AvailabilityService;

    service = new ReservationsService(
      mockRepo,
      mockRoomsRepo,
      mockAvailService,
    );
  });

  describe("createReservation", () => {
    it("creates reservation with confirmed status for staff and calculates total amount", async () => {
      vi.mocked(mockRepo.findGuestById).mockResolvedValue(sampleGuest);
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.isRoomTypeAvailable).mockResolvedValue(true);
      vi.mocked(mockRepo.createReservation).mockResolvedValue(
        sampleReservation,
      );

      const result = await service.createReservation(
        {
          guestId: sampleGuest.id,
          roomTypeId: sampleRoomType.id,
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          adultCount: 2,
        },
        "front_desk",
      );

      expect(result).toEqual(sampleReservation);
      expect(mockRepo.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          guestId: sampleGuest.id,
          roomTypeId: sampleRoomType.id,
          status: "confirmed",
          totalAmount: 600, // 200 * 3 nights
        }),
      );
    });

    it("throws GUEST_NOT_FOUND when guest does not exist", async () => {
      vi.mocked(mockRepo.findGuestById).mockResolvedValue(null);

      await expect(
        service.createReservation({
          guestId: "non-existent",
          roomTypeId: sampleRoomType.id,
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          adultCount: 1,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.GUEST_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("throws ROOM_TYPE_NOT_FOUND when room type does not exist", async () => {
      vi.mocked(mockRepo.findGuestById).mockResolvedValue(sampleGuest);
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(null);

      await expect(
        service.createReservation({
          guestId: sampleGuest.id,
          roomTypeId: "non-existent-type",
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          adultCount: 1,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_TYPE_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("throws INVALID_DATE_RANGE when check-out date is before or equal to check-in", async () => {
      vi.mocked(mockRepo.findGuestById).mockResolvedValue(sampleGuest);
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );

      await expect(
        service.createReservation({
          guestId: sampleGuest.id,
          roomTypeId: sampleRoomType.id,
          checkInDate: "2026-12-05",
          checkOutDate: "2026-12-01",
          adultCount: 1,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_DATE_RANGE,
        statusCode: 400,
      });
    });

    it("creates reservation with pending status for non-staff channels", async () => {
      vi.mocked(mockRepo.findGuestById).mockResolvedValue(sampleGuest);
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.isRoomTypeAvailable).mockResolvedValue(true);
      const pendingRes = { ...sampleReservation, status: "pending" as const };
      vi.mocked(mockRepo.createReservation).mockResolvedValue(pendingRes);

      const result = await service.createReservation(
        {
          guestId: sampleGuest.id,
          roomTypeId: sampleRoomType.id,
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          adultCount: 1,
        },
        "guest",
      );

      expect(result.status).toBe("pending");
      expect(mockRepo.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending" }),
      );
    });

    it("throws ROOM_TYPE_UNAVAILABLE when inventory is not available", async () => {
      vi.mocked(mockRepo.findGuestById).mockResolvedValue(sampleGuest);
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.isRoomTypeAvailable).mockResolvedValue(false);

      await expect(
        service.createReservation({
          guestId: sampleGuest.id,
          roomTypeId: sampleRoomType.id,
          checkInDate: "2026-12-01",
          checkOutDate: "2026-12-04",
          adultCount: 1,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_TYPE_UNAVAILABLE,
        statusCode: 409,
      });
    });
  });

  describe("confirmReservation", () => {
    it("confirms a pending reservation successfully", async () => {
      const pendingRes: Reservation = {
        ...sampleReservation,
        status: "pending",
      };
      const confirmedRes: Reservation = {
        ...sampleReservation,
        status: "confirmed",
      };

      vi.mocked(mockRepo.findReservationById).mockResolvedValue(pendingRes);
      vi.mocked(mockRepo.updateReservationStatus).mockResolvedValue(
        confirmedRes,
      );

      const result = await service.confirmReservation(pendingRes.id);
      expect(result.status).toBe("confirmed");
    });

    it("rejects confirmation if reservation is not pending", async () => {
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );

      await expect(
        service.confirmReservation(sampleReservation.id),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        statusCode: 400,
      });
    });
  });

  describe("cancelReservation", () => {
    it("cancels a confirmed reservation successfully", async () => {
      const cancelledRes: Reservation = {
        ...sampleReservation,
        status: "cancelled",
      };
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.updateReservationStatus).mockResolvedValue(
        cancelledRes,
      );

      const result = await service.cancelReservation(sampleReservation.id);
      expect(result.status).toBe("cancelled");
    });

    it("rejects cancellation of an active checked_in stay with CANNOT_CANCEL_ACTIVE_STAY", async () => {
      const checkedInRes: Reservation = {
        ...sampleReservation,
        status: "checked_in",
      };
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(checkedInRes);

      await expect(
        service.cancelReservation(checkedInRes.id),
      ).rejects.toMatchObject({
        code: ErrorCodes.CANNOT_CANCEL_ACTIVE_STAY,
        statusCode: 409,
      });
    });

    it("rejects cancellation when already cancelled", async () => {
      const cancelledRes: Reservation = {
        ...sampleReservation,
        status: "cancelled",
      };
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(cancelledRes);

      await expect(
        service.cancelReservation(cancelledRes.id),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        statusCode: 400,
      });
    });

    it("rejects cancellation when already checked_out", async () => {
      const checkedOutRes: Reservation = {
        ...sampleReservation,
        status: "checked_out",
      };
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(checkedOutRes);

      await expect(
        service.cancelReservation(checkedOutRes.id),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        statusCode: 400,
      });
    });
  });

  describe("getReservationById", () => {
    it("returns reservation when found", async () => {
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );

      const result = await service.getReservationById(sampleReservation.id);
      expect(result).toEqual(sampleReservation);
    });

    it("throws RESERVATION_NOT_FOUND when reservation does not exist", async () => {
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.getReservationById("non-existent"),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });
  });

  describe("updateReservation", () => {
    it("updates reservation metadata successfully", async () => {
      vi.mocked(mockRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      const updatedRes = {
        ...sampleReservation,
        specialRequests: "Updated request",
      };
      vi.mocked(mockRepo.updateReservationMetadata).mockResolvedValue(
        updatedRes,
      );

      const result = await service.updateReservation(sampleReservation.id, {
        specialRequests: "Updated request",
      });
      expect(result.specialRequests).toBe("Updated request");
    });

    it("rejects updating cancelled reservation with INVALID_STATUS_TRANSITION", async () => {
      vi.mocked(mockRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "cancelled",
      });

      await expect(
        service.updateReservation(sampleReservation.id, {
          specialRequests: "Test",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        statusCode: 400,
      });
    });
  });
});
