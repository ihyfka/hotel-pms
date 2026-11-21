import { describe, it, expect, vi, beforeEach } from "vitest";
import { AllocationsService } from "../../src/modules/allocations/allocations.service.js";
import { AllocationsRepository } from "../../src/modules/allocations/allocations.repository.js";
import { ReservationsRepository } from "../../src/modules/reservations/reservations.repository.js";
import { RoomsRepository } from "../../src/modules/rooms/rooms.repository.js";
import { RoomAllocation } from "../../src/modules/allocations/allocations.types.js";
import { Reservation } from "../../src/modules/reservations/reservations.types.js";
import { Room } from "../../src/modules/rooms/rooms.types.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

vi.mock("../../src/config/database.js", () => ({
  withTransaction: vi.fn((cb) => cb({} as any)),
  query: vi.fn(),
  pool: { query: vi.fn(), on: vi.fn() },
}));

describe("AllocationsService", () => {
  let mockRepo: AllocationsRepository;
  let mockResRepo: ReservationsRepository;
  let mockRoomsRepo: RoomsRepository;
  let service: AllocationsService;

  const sampleReservation: Reservation = {
    id: "res-1",
    reservationNumber: "RSV-XYZ98765",
    guestId: "guest-1",
    roomTypeId: "rt-1",
    checkInDate: "2026-12-01",
    checkOutDate: "2026-12-05",
    status: "confirmed",
    adultCount: 2,
    childCount: 0,
    totalAmount: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleRoom: Room = {
    id: "room-1",
    roomNumber: "101",
    roomTypeId: "rt-1",
    floor: 1,
    building: "Main",
    occupancyStatus: "vacant",
    housekeepingStatus: "clean",
    maintenanceStatus: "operational",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleAllocation: RoomAllocation = {
    id: "alloc-1",
    reservationId: sampleReservation.id,
    roomId: sampleRoom.id,
    assignedRangeStart: new Date("2026-12-01T14:00:00Z"),
    assignedRangeEnd: new Date("2026-12-05T11:00:00Z"),
    status: "active",
    assignedAt: new Date(),
    assignedBy: "front_desk",
  };

  beforeEach(() => {
    mockRepo = {
      findAllocationById: vi.fn(),
      findActiveAllocationByReservationId: vi.fn(),
      hasOverlappingActiveAllocation: vi.fn(),
      createAllocation: vi.fn(),
      updateAllocationStatus: vi.fn(),
    } as unknown as AllocationsRepository;

    mockResRepo = {
      findReservationById: vi.fn(),
    } as unknown as ReservationsRepository;

    mockRoomsRepo = {
      findRoomById: vi.fn(),
    } as unknown as RoomsRepository;

    service = new AllocationsService(mockRepo, mockResRepo, mockRoomsRepo);
  });

  describe("allocateRoom", () => {
    it("allocates a physical room to a confirmed reservation successfully", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findActiveAllocationByReservationId).mockResolvedValue(
        null,
      );
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);
      vi.mocked(mockRepo.hasOverlappingActiveAllocation).mockResolvedValue(
        false,
      );
      vi.mocked(mockRepo.createAllocation).mockResolvedValue(sampleAllocation);

      const result = await service.allocateRoom({
        reservationId: sampleReservation.id,
        roomId: sampleRoom.id,
      });

      expect(result).toEqual(sampleAllocation);
    });

    it("rejects allocation when reservation is already allocated", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findActiveAllocationByReservationId).mockResolvedValue(
        sampleAllocation,
      );

      await expect(
        service.allocateRoom({
          reservationId: sampleReservation.id,
          roomId: sampleRoom.id,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_ALREADY_ALLOCATED,
        statusCode: 409,
      });
    });

    it("rejects allocation when room is not operational", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findActiveAllocationByReservationId).mockResolvedValue(
        null,
      );
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        maintenanceStatus: "under_maintenance",
      });

      await expect(
        service.allocateRoom({
          reservationId: sampleReservation.id,
          roomId: sampleRoom.id,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_OPERATIONAL,
        statusCode: 409,
      });
    });

    it("rejects allocation when room has overlapping active allocation", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findActiveAllocationByReservationId).mockResolvedValue(
        null,
      );
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);
      vi.mocked(mockRepo.hasOverlappingActiveAllocation).mockResolvedValue(
        true,
      );

      await expect(
        service.allocateRoom({
          reservationId: sampleReservation.id,
          roomId: sampleRoom.id,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_ALREADY_ALLOCATED,
        statusCode: 409,
      });
    });

    it("rejects allocation when reservation is not found", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.allocateRoom({
          reservationId: "non-existent",
          roomId: sampleRoom.id,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects allocation when reservation is cancelled", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "cancelled",
      });

      await expect(
        service.allocateRoom({
          reservationId: sampleReservation.id,
          roomId: sampleRoom.id,
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RESERVATION_STATUS,
        statusCode: 400,
      });
    });

    it("rejects allocation when room is not found", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(mockRepo.findActiveAllocationByReservationId).mockResolvedValue(
        null,
      );
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(null);

      await expect(
        service.allocateRoom({
          reservationId: sampleReservation.id,
          roomId: "non-existent-room",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });
  });

  describe("cancelAllocation", () => {
    it("cancels an active allocation successfully", async () => {
      vi.mocked(mockRepo.findAllocationById).mockResolvedValue(
        sampleAllocation,
      );
      vi.mocked(mockRepo.updateAllocationStatus).mockResolvedValue({
        ...sampleAllocation,
        status: "cancelled",
      });

      const result = await service.cancelAllocation(sampleAllocation.id);
      expect(result.status).toBe("cancelled");
    });

    it("rejects cancellation when allocation is already cancelled", async () => {
      vi.mocked(mockRepo.findAllocationById).mockResolvedValue({
        ...sampleAllocation,
        releasedAt: new Date(),
      });

      await expect(
        service.cancelAllocation(sampleAllocation.id),
      ).rejects.toMatchObject({
        code: ErrorCodes.BAD_REQUEST,
        statusCode: 400,
      });
    });

    it("rejects cancellation when allocation is not found", async () => {
      vi.mocked(mockRepo.findAllocationById).mockResolvedValue(null);

      await expect(
        service.cancelAllocation("non-existent"),
      ).rejects.toMatchObject({
        code: ErrorCodes.NOT_FOUND,
        statusCode: 404,
      });
    });
  });

  describe("getAllocationById", () => {
    it("returns allocation when found", async () => {
      vi.mocked(mockRepo.findAllocationById).mockResolvedValue(
        sampleAllocation,
      );

      const result = await service.getAllocationById(sampleAllocation.id);
      expect(result).toEqual(sampleAllocation);
    });

    it("throws NOT_FOUND when allocation does not exist", async () => {
      vi.mocked(mockRepo.findAllocationById).mockResolvedValue(null);

      await expect(
        service.getAllocationById("non-existent"),
      ).rejects.toMatchObject({
        code: ErrorCodes.NOT_FOUND,
        statusCode: 404,
      });
    });
  });
});
