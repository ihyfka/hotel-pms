import { describe, it, expect, vi, beforeEach } from "vitest";
import { FrontDeskService } from "../../src/modules/frontDesk/frontDesk.service.js";
import { FrontDeskRepository } from "../../src/modules/frontDesk/frontDesk.repository.js";
import { ReservationsRepository } from "../../src/modules/reservations/reservations.repository.js";
import { AllocationsRepository } from "../../src/modules/allocations/allocations.repository.js";
import { RoomsRepository } from "../../src/modules/rooms/rooms.repository.js";
import { AvailabilityService } from "../../src/modules/availability/availability.service.js";
import { Reservation } from "../../src/modules/reservations/reservations.types.js";
import { RoomAllocation } from "../../src/modules/allocations/allocations.types.js";
import { Room, RoomType } from "../../src/modules/rooms/rooms.types.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

vi.mock("../../src/config/database.js", () => ({
  withTransaction: vi.fn(async (cb) => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ id: "task-1" }] }),
    };
    return cb(mockClient);
  }),
  query: vi.fn(),
  pool: { query: vi.fn(), on: vi.fn() },
}));

describe("FrontDeskService", () => {
  let mockRepo: FrontDeskRepository;
  let mockResRepo: ReservationsRepository;
  let mockAllocRepo: AllocationsRepository;
  let mockRoomsRepo: RoomsRepository;
  let mockAvailService: AvailabilityService;
  let service: FrontDeskService;

  const sampleRoomType: RoomType = {
    id: "rt-1",
    code: "DLX",
    name: "Deluxe Suite",
    basePrice: 150,
    capacity: 2,
    amenities: ["WiFi"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleRoom: Room = {
    id: "room-1",
    roomNumber: "101",
    roomTypeId: sampleRoomType.id,
    floor: 1,
    building: "Main",
    occupancyStatus: "vacant",
    housekeepingStatus: "clean",
    maintenanceStatus: "operational",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleReservation: Reservation = {
    id: "res-1",
    reservationNumber: "RSV-FD123456",
    guestId: "guest-1",
    roomTypeId: sampleRoomType.id,
    checkInDate: "2026-12-01",
    checkOutDate: "2026-12-04",
    status: "confirmed",
    adultCount: 1,
    childCount: 0,
    totalAmount: 450,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleAllocation: RoomAllocation = {
    id: "alloc-1",
    reservationId: sampleReservation.id,
    roomId: sampleRoom.id,
    assignedRangeStart: new Date("2026-12-01T14:00:00Z"),
    assignedRangeEnd: new Date("2026-12-04T11:00:00Z"),
    status: "active",
    assignedAt: new Date(),
    assignedBy: "staff",
  };

  beforeEach(() => {
    mockRepo = {
      updateReservationStatus: vi.fn(),
      updateAllocationStatus: vi.fn(),
      updateRoomStatuses: vi.fn(),
      recordRoomStatusHistory: vi.fn(),
      createHousekeepingTask: vi.fn().mockResolvedValue("task-auto-1"),
    } as unknown as FrontDeskRepository;

    mockResRepo = {
      findReservationById: vi.fn(),
      createGuest: vi.fn(),
      createReservation: vi.fn(),
    } as unknown as ReservationsRepository;

    mockAllocRepo = {
      findActiveAllocationByReservationId: vi.fn(),
      createAllocation: vi.fn(),
    } as unknown as AllocationsRepository;

    mockRoomsRepo = {
      findRoomById: vi.fn(),
      findRoomTypeById: vi.fn(),
    } as unknown as RoomsRepository;

    mockAvailService = {
      getAvailableRoomsForType: vi.fn(),
    } as unknown as AvailabilityService;

    service = new FrontDeskService(
      mockRepo,
      mockResRepo,
      mockAllocRepo,
      mockRoomsRepo,
      mockAvailService,
    );
  });

  describe("checkIn", () => {
    it("checks in a guest successfully when room is pre-allocated and clean", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);

      const result = await service.checkIn({
        reservationId: sampleReservation.id,
      });

      expect(result).toEqual({
        reservationId: sampleReservation.id,
        roomId: sampleRoom.id,
        roomNumber: sampleRoom.roomNumber,
        status: "checked_in",
      });
      expect(mockRepo.updateReservationStatus).toHaveBeenCalledWith(
        sampleReservation.id,
        "checked_in",
        expect.anything(),
      );
      expect(mockRepo.updateRoomStatuses).toHaveBeenCalledWith(
        sampleRoom.id,
        { occupancyStatus: "occupied" },
        expect.anything(),
      );
    });

    it("auto-allocates an available room if no allocation exists at check-in", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(null);
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockAllocRepo.createAllocation).mockResolvedValue(
        sampleAllocation,
      );
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);

      const result = await service.checkIn({
        reservationId: sampleReservation.id,
      });

      expect(result.status).toBe("checked_in");
      expect(mockAllocRepo.createAllocation).toHaveBeenCalled();
    });

    it("rejects check-in if reservation is cancelled with RESERVATION_CANCELLED", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "cancelled",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_CANCELLED,
        statusCode: 409,
      });
    });

    it("rejects check-in if reservation is already checked in with ALREADY_CHECKED_IN", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "checked_in",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ALREADY_CHECKED_IN,
        statusCode: 409,
      });
    });

    it("rejects check-in if room is dirty or cleaning with ROOM_NOT_READY", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        housekeepingStatus: "dirty",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });

    it("rejects check-in if room is under maintenance with ROOM_NOT_OPERATIONAL", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        maintenanceStatus: "under_maintenance",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_OPERATIONAL,
        statusCode: 409,
      });
    });

    it("rejects check-in if reservation is not found with RESERVATION_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.checkIn({ reservationId: "non-existent" }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-in if reservation is not confirmed with INVALID_RESERVATION_STATUS", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "pending",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RESERVATION_STATUS,
        statusCode: 400,
      });
    });

    it("rejects check-in if auto-allocation finds no rooms available", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(null);
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue(
        [],
      );

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.NO_ROOMS_AVAILABLE,
        statusCode: 409,
      });
    });

    it("rejects check-in if target room is not found with ROOM_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(null);

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-in if room is already occupied with ROOM_NOT_READY", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        occupancyStatus: "occupied",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });

    it("rejects check-in if reservation is not found with RESERVATION_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.checkIn({ reservationId: "non-existent" }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-in if reservation is not confirmed with INVALID_RESERVATION_STATUS", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "pending",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_RESERVATION_STATUS,
        statusCode: 400,
      });
    });

    it("rejects check-in if auto-allocation finds no rooms available", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(null);
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue(
        [],
      );

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.NO_ROOMS_AVAILABLE,
        statusCode: 409,
      });
    });

    it("rejects check-in if target room is not found with ROOM_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(null);

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-in if room is already occupied with ROOM_NOT_READY", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        sampleReservation,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        occupancyStatus: "occupied",
      });

      await expect(
        service.checkIn({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });
  });

  describe("checkOut", () => {
    it("checks out guest, sets room vacant and dirty, completes allocation, and creates housekeeping task", async () => {
      const checkedInRes: Reservation = {
        ...sampleReservation,
        status: "checked_in",
      };
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(
        checkedInRes,
      );
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);

      const result = await service.checkOut({ reservationId: checkedInRes.id });

      expect(result.status).toBe("checked_out");
      expect(mockRepo.updateReservationStatus).toHaveBeenCalledWith(
        checkedInRes.id,
        "checked_out",
        expect.anything(),
      );
      expect(mockRepo.updateAllocationStatus).toHaveBeenCalledWith(
        sampleAllocation.id,
        "completed",
        expect.anything(),
      );
      expect(mockRepo.updateRoomStatuses).toHaveBeenCalledWith(
        sampleRoom.id,
        { occupancyStatus: "vacant", housekeepingStatus: "dirty" },
        expect.anything(),
      );
      expect(mockRepo.createHousekeepingTask).toHaveBeenCalledWith(
        sampleRoom.id,
        "normal",
        expect.stringContaining("Auto-created on checkout"),
        expect.anything(),
      );
    });

    it("rejects check-out if reservation is not found with RESERVATION_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.checkOut({ reservationId: "non-existent" }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-out if reservation is not checked_in with INVALID_STATUS_TRANSITION", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "confirmed",
      });

      await expect(
        service.checkOut({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        statusCode: 400,
      });
    });

    it("rejects check-out if no active allocation is found with NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "checked_in",
      });
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(null);

      await expect(
        service.checkOut({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-out if room is not found with ROOM_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "checked_in",
      });
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(null);

      await expect(
        service.checkOut({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-out if reservation is not found with RESERVATION_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue(null);

      await expect(
        service.checkOut({ reservationId: "non-existent" }),
      ).rejects.toMatchObject({
        code: ErrorCodes.RESERVATION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-out if reservation is not checked_in with INVALID_STATUS_TRANSITION", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "confirmed",
      });

      await expect(
        service.checkOut({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        statusCode: 400,
      });
    });

    it("rejects check-out if no active allocation is found with NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "checked_in",
      });
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(null);

      await expect(
        service.checkOut({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects check-out if room is not found with ROOM_NOT_FOUND", async () => {
      vi.mocked(mockResRepo.findReservationById).mockResolvedValue({
        ...sampleReservation,
        status: "checked_in",
      });
      vi.mocked(
        mockAllocRepo.findActiveAllocationByReservationId,
      ).mockResolvedValue(sampleAllocation);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(null);

      await expect(
        service.checkOut({ reservationId: sampleReservation.id }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });
  });

  describe("walkIn", () => {
    const walkInInput = {
      guest: {
        firstName: "Alice",
        lastName: "Walker",
        email: "alice.walker@example.com",
        phone: "+1555123456",
      },
      roomTypeId: sampleRoomType.id,
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-03",
      adultCount: 2,
    };

    it("performs walk-in registration, creates reservation, allocates room, and checks in", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);
      vi.mocked(mockResRepo.createGuest).mockResolvedValue({
        id: "guest-walk-1",
        firstName: walkInInput.guest.firstName,
        lastName: walkInInput.guest.lastName,
        email: walkInInput.guest.email,
        phone: walkInInput.guest.phone,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockResRepo.createReservation).mockResolvedValue({
        ...sampleReservation,
        id: "res-walk-1",
        reservationNumber: "RSV-WALK1234",
        status: "checked_in",
      });

      const result = await service.walkIn(walkInInput);

      expect(result.status).toBe("checked_in");
      expect(result.guestId).toBe("guest-walk-1");
      expect(result.reservationId).toBe("res-walk-1");
      expect(result.roomId).toBe(sampleRoom.id);
      expect(mockAllocRepo.createAllocation).toHaveBeenCalled();
      expect(mockRepo.updateRoomStatuses).toHaveBeenCalledWith(
        sampleRoom.id,
        { occupancyStatus: "occupied" },
        expect.anything(),
      );
    });

    it("rejects walk-in if room type not found with ROOM_TYPE_NOT_FOUND", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(null);

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_TYPE_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects walk-in if no rooms available for type with NO_ROOMS_AVAILABLE", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue(
        [],
      );

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.NO_ROOMS_AVAILABLE,
        statusCode: 409,
      });
    });

    it("rejects walk-in if specific requested room is not available", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);

      await expect(
        service.walkIn({ ...walkInInput, roomId: "room-different" }),
      ).rejects.toMatchObject({
        code: ErrorCodes.NO_ROOMS_AVAILABLE,
        statusCode: 409,
      });
    });

    it("rejects walk-in if room is under maintenance with ROOM_NOT_OPERATIONAL", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        maintenanceStatus: "under_maintenance",
      });

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_OPERATIONAL,
        statusCode: 409,
      });
    });

    it("rejects walk-in if room is dirty with ROOM_NOT_READY", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        housekeepingStatus: "dirty",
      });

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });

    it("rejects walk-in if room is currently occupied with ROOM_NOT_READY", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        occupancyStatus: "occupied",
      });

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });
  });

  describe("walkIn", () => {
    const walkInInput = {
      guest: {
        firstName: "Alice",
        lastName: "Walker",
        email: "alice.walker@example.com",
        phone: "+1555123456",
      },
      roomTypeId: sampleRoomType.id,
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-03",
      adultCount: 2,
    };

    it("performs walk-in registration, creates reservation, allocates room, and checks in", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue(sampleRoom);
      vi.mocked(mockResRepo.createGuest).mockResolvedValue({
        id: "guest-walk-1",
        firstName: walkInInput.guest.firstName,
        lastName: walkInInput.guest.lastName,
        email: walkInInput.guest.email,
        phone: walkInInput.guest.phone,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockResRepo.createReservation).mockResolvedValue({
        ...sampleReservation,
        id: "res-walk-1",
        reservationNumber: "RSV-WALK1234",
        status: "checked_in",
      });

      const result = await service.walkIn(walkInInput);

      expect(result.status).toBe("checked_in");
      expect(result.guestId).toBe("guest-walk-1");
      expect(result.reservationId).toBe("res-walk-1");
      expect(result.roomId).toBe(sampleRoom.id);
      expect(mockAllocRepo.createAllocation).toHaveBeenCalled();
      expect(mockRepo.updateRoomStatuses).toHaveBeenCalledWith(
        sampleRoom.id,
        { occupancyStatus: "occupied" },
        expect.anything(),
      );
    });

    it("rejects walk-in if room type not found with ROOM_TYPE_NOT_FOUND", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(null);

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_TYPE_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("rejects walk-in if no rooms available for type with NO_ROOMS_AVAILABLE", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue(
        [],
      );

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.NO_ROOMS_AVAILABLE,
        statusCode: 409,
      });
    });

    it("rejects walk-in if specific requested room is not available", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);

      await expect(
        service.walkIn({ ...walkInInput, roomId: "room-different" }),
      ).rejects.toMatchObject({
        code: ErrorCodes.NO_ROOMS_AVAILABLE,
        statusCode: 409,
      });
    });

    it("rejects walk-in if room is under maintenance with ROOM_NOT_OPERATIONAL", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        maintenanceStatus: "under_maintenance",
      });

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_OPERATIONAL,
        statusCode: 409,
      });
    });

    it("rejects walk-in if room is dirty with ROOM_NOT_READY", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        housekeepingStatus: "dirty",
      });

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });

    it("rejects walk-in if room is currently occupied with ROOM_NOT_READY", async () => {
      vi.mocked(mockRoomsRepo.findRoomTypeById).mockResolvedValue(
        sampleRoomType,
      );
      vi.mocked(mockAvailService.getAvailableRoomsForType).mockResolvedValue([
        sampleRoom,
      ]);
      vi.mocked(mockRoomsRepo.findRoomById).mockResolvedValue({
        ...sampleRoom,
        occupancyStatus: "occupied",
      });

      await expect(service.walkIn(walkInInput)).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_READY,
        statusCode: 409,
      });
    });
  });
});
