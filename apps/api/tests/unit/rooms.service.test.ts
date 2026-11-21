import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomsService } from "../../src/modules/rooms/rooms.service.js";
import { RoomsRepository } from "../../src/modules/rooms/rooms.repository.js";
import { Room, RoomType } from "../../src/modules/rooms/rooms.types.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

describe("RoomsService - Business Rules & State Transitions", () => {
  let mockRepo: RoomsRepository;
  let service: RoomsService;

  const sampleRoomType: RoomType = {
    id: "11111111-1111-1111-1111-111111111111",
    code: "DBL",
    name: "Standard Double",
    basePrice: 120,
    capacity: 2,
    amenities: ["WiFi"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleVacantCleanRoom: Room = {
    id: "22222222-2222-2222-2222-222222222222",
    roomNumber: "101",
    roomTypeId: sampleRoomType.id,
    floor: 1,
    building: "Main",
    occupancyStatus: "vacant",
    housekeepingStatus: "inspected",
    maintenanceStatus: "operational",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findRooms: vi.fn(),
      countRooms: vi.fn(),
      findRoomById: vi.fn(),
      findRoomByNumber: vi.fn(),
      createRoom: vi.fn(),
      updateRoom: vi.fn(),
      updateRoomStatusWithHistory: vi.fn(),
      findStatusHistoryByRoomId: vi.fn(),
      getRoomOperationalSummary: vi.fn(),
      findRoomsForBoard: vi.fn(),
      findRoomTypes: vi.fn(),
      findRoomTypeById: vi.fn(),
      findRoomTypeByCode: vi.fn(),
      createRoomType: vi.fn(),
    } as unknown as RoomsRepository;

    service = new RoomsService(mockRepo);
  });

  describe("createRoom", () => {
    it("creates a room successfully when room number is unique and room type exists", async () => {
      vi.mocked(mockRepo.findRoomTypeById).mockResolvedValue(sampleRoomType);
      vi.mocked(mockRepo.findRoomByNumber).mockResolvedValue(null);
      vi.mocked(mockRepo.createRoom).mockResolvedValue(sampleVacantCleanRoom);

      const result = await service.createRoom({
        roomNumber: "101",
        roomTypeId: sampleRoomType.id,
        floor: 1,
        building: "Main",
      });

      expect(result.roomNumber).toBe("101");
      expect(mockRepo.createRoom).toHaveBeenCalledWith({
        roomNumber: "101",
        roomTypeId: sampleRoomType.id,
        floor: 1,
        building: "Main",
      });
    });

    it("throws error if room type does not exist", async () => {
      vi.mocked(mockRepo.findRoomTypeById).mockResolvedValue(null);

      await expect(
        service.createRoom({
          roomNumber: "101",
          roomTypeId: "non-existent-type",
          floor: 1,
          building: "Main",
        }),
      ).rejects.toThrow(AppError);
    });

    it("throws conflict error if room number is already taken", async () => {
      vi.mocked(mockRepo.findRoomTypeById).mockResolvedValue(sampleRoomType);
      vi.mocked(mockRepo.findRoomByNumber).mockResolvedValue(
        sampleVacantCleanRoom,
      );

      await expect(
        service.createRoom({
          roomNumber: "101",
          roomTypeId: sampleRoomType.id,
          floor: 1,
          building: "Main",
        }),
      ).rejects.toThrow(AppError);
    });
  });

  describe("getRoomById and getRoomByNumber", () => {
    it("returns room by id when found", async () => {
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(sampleVacantCleanRoom);
      const result = await service.getRoomById(sampleVacantCleanRoom.id);
      expect(result).toEqual(sampleVacantCleanRoom);
    });

    it("throws ROOM_NOT_FOUND when room id does not exist", async () => {
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(null);
      await expect(service.getRoomById("non-existent")).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("returns room by number when found", async () => {
      vi.mocked(mockRepo.findRoomByNumber).mockResolvedValue(
        sampleVacantCleanRoom,
      );
      const result = await service.getRoomByNumber("101");
      expect(result).toEqual(sampleVacantCleanRoom);
    });

    it("throws ROOM_NOT_FOUND when room number does not exist", async () => {
      vi.mocked(mockRepo.findRoomByNumber).mockResolvedValue(null);
      await expect(service.getRoomByNumber("999")).rejects.toMatchObject({
        code: ErrorCodes.ROOM_NOT_FOUND,
        statusCode: 404,
      });
    });
  });

  describe("updateRoom", () => {
    it("updates room details successfully", async () => {
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(sampleVacantCleanRoom);
      vi.mocked(mockRepo.findRoomTypeById).mockResolvedValue(sampleRoomType);
      const updated = { ...sampleVacantCleanRoom, floor: 2 };
      vi.mocked(mockRepo.updateRoom).mockResolvedValue(updated);

      const result = await service.updateRoom(sampleVacantCleanRoom.id, {
        floor: 2,
        roomTypeId: sampleRoomType.id,
      });
      expect(result.floor).toBe(2);
    });

    it("throws ROOM_TYPE_NOT_FOUND if room type does not exist on update", async () => {
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(sampleVacantCleanRoom);
      vi.mocked(mockRepo.findRoomTypeById).mockResolvedValue(null);

      await expect(
        service.updateRoom(sampleVacantCleanRoom.id, {
          roomTypeId: "invalid-type",
        }),
      ).rejects.toMatchObject({
        code: ErrorCodes.ROOM_TYPE_NOT_FOUND,
        statusCode: 400,
      });
    });
  });

  describe("updateRoomStatus - Multi-dimensional State Rules", () => {
    it("allows check-in (vacant -> occupied) if room is inspected and operational", async () => {
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(sampleVacantCleanRoom);
      vi.mocked(mockRepo.updateRoomStatusWithHistory).mockImplementation(
        async (_id, current, updates) => ({
          ...current,
          ...updates,
        }),
      );

      const updated = await service.updateRoomStatus(
        sampleVacantCleanRoom.id,
        { occupancyStatus: "occupied" },
        "reception-agent",
      );

      expect(updated.occupancyStatus).toBe("occupied");
      expect(mockRepo.updateRoomStatusWithHistory).toHaveBeenCalledWith(
        sampleVacantCleanRoom.id,
        sampleVacantCleanRoom,
        { occupancyStatus: "occupied" },
        "reception-agent",
        undefined,
      );
    });

    it("blocks check-in if room is dirty", async () => {
      const dirtyRoom: Room = {
        ...sampleVacantCleanRoom,
        housekeepingStatus: "dirty",
      };
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(dirtyRoom);

      await expect(
        service.updateRoomStatus(dirtyRoom.id, { occupancyStatus: "occupied" }),
      ).rejects.toThrow("must be inspected or clean");
    });

    it("blocks check-in if room is under maintenance", async () => {
      const maintenanceRoom: Room = {
        ...sampleVacantCleanRoom,
        maintenanceStatus: "under_maintenance",
      };
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(maintenanceRoom);

      await expect(
        service.updateRoomStatus(maintenanceRoom.id, {
          occupancyStatus: "occupied",
        }),
      ).rejects.toThrow("room maintenance status is 'under_maintenance'");
    });

    it("blocks check-in if room is out of service", async () => {
      const oosRoom: Room = {
        ...sampleVacantCleanRoom,
        maintenanceStatus: "out_of_service",
      };
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(oosRoom);

      await expect(
        service.updateRoomStatus(oosRoom.id, { occupancyStatus: "occupied" }),
      ).rejects.toThrow("room maintenance status is 'out_of_service'");
    });

    it("automatically transitions housekeeping to dirty on check-out (occupied -> vacant)", async () => {
      const occupiedRoom: Room = {
        ...sampleVacantCleanRoom,
        occupancyStatus: "occupied",
        housekeepingStatus: "clean",
      };
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(occupiedRoom);
      vi.mocked(mockRepo.updateRoomStatusWithHistory).mockImplementation(
        async (_id, current, updates) => ({
          ...current,
          ...updates,
        }),
      );

      const updated = await service.updateRoomStatus(
        occupiedRoom.id,
        { occupancyStatus: "vacant" },
        "reception",
      );

      expect(updated.occupancyStatus).toBe("vacant");
      expect(mockRepo.updateRoomStatusWithHistory).toHaveBeenCalledWith(
        occupiedRoom.id,
        occupiedRoom,
        { occupancyStatus: "vacant", housekeepingStatus: "dirty" },
        "reception",
        undefined,
      );
    });

    it("prevents putting an occupied room into out_of_service or under_maintenance", async () => {
      const occupiedRoom: Room = {
        ...sampleVacantCleanRoom,
        occupancyStatus: "occupied",
      };
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(occupiedRoom);

      await expect(
        service.updateRoomStatus(occupiedRoom.id, {
          maintenanceStatus: "out_of_service",
        }),
      ).rejects.toThrow(
        "Cannot place room 101 into 'out_of_service' while occupied",
      );

      await expect(
        service.updateRoomStatus(occupiedRoom.id, {
          maintenanceStatus: "under_maintenance",
        }),
      ).rejects.toThrow(
        "Cannot place room 101 into 'under_maintenance' while occupied",
      );
    });

    it("prevents marking a room inspected if maintenance is not operational", async () => {
      const brokenRoom: Room = {
        ...sampleVacantCleanRoom,
        housekeepingStatus: "clean",
        maintenanceStatus: "under_maintenance",
      };
      vi.mocked(mockRepo.findRoomById).mockResolvedValue(brokenRoom);

      await expect(
        service.updateRoomStatus(brokenRoom.id, {
          housekeepingStatus: "inspected",
        }),
      ).rejects.toThrow(
        "Cannot mark room 101 as 'inspected' while maintenance is 'under_maintenance'",
      );
    });
  });

  describe("getRoomBoard", () => {
    it("aggregates room board data and summaries correctly", async () => {
      vi.mocked(mockRepo.getRoomOperationalSummary).mockResolvedValue({
        totalRooms: 10,
        vacant: 8,
        occupied: 2,
        clean: 2,
        dirty: 2,
        cleaning: 1,
        inspected: 5,
        operational: 9,
        underMaintenance: 1,
        outOfService: 0,
        availableForCheckIn: 5,
      });

      vi.mocked(mockRepo.findRoomsForBoard).mockResolvedValue([
        { floor: 1, rooms: [sampleVacantCleanRoom] },
      ]);

      const board = await service.getRoomBoard();
      expect(board.summary.totalRooms).toBe(10);
      expect(board.summary.availableForCheckIn).toBe(5);
      expect(board.floors).toHaveLength(1);
      expect(board.floors[0].floor).toBe(1);
    });
  });
});
