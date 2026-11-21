import { RoomsRepository, roomsRepository } from "./rooms.repository.js";
import {
  Room,
  RoomType,
  RoomStatusHistory,
  RoomBoardFilter,
  RoomBoardData,
  OccupancyStatus,
  HousekeepingStatus,
  MaintenanceStatus,
} from "./rooms.types.js";
import {
  CreateRoomInput,
  UpdateRoomInput,
  UpdateRoomStatusInput,
  QueryRoomsInput,
  CreateRoomTypeInput,
} from "./rooms.schemas.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";
import {
  parsePagination,
  buildPaginatedResponse,
} from "../../shared/utils/pagination.js";

export class RoomsService {
  constructor(private readonly repo: RoomsRepository = roomsRepository) {}

  async listRooms(query: QueryRoomsInput) {
    const { page, limit, offset } = parsePagination({
      page: query.page,
      limit: query.limit,
    });

    const [rooms, total] = await Promise.all([
      this.repo.findRooms(query, offset, limit),
      this.repo.countRooms(query),
    ]);

    return buildPaginatedResponse(rooms, total, page, limit);
  }

  async getRoomById(id: string): Promise<Room> {
    const room = await this.repo.findRoomById(id);
    if (!room) {
      throw AppError.notFound(
        `Room with ID ${id} not found`,
        ErrorCodes.ROOM_NOT_FOUND,
      );
    }
    return room;
  }

  async getRoomByNumber(roomNumber: string): Promise<Room> {
    const room = await this.repo.findRoomByNumber(roomNumber);
    if (!room) {
      throw AppError.notFound(
        `Room number ${roomNumber} not found`,
        ErrorCodes.ROOM_NOT_FOUND,
      );
    }
    return room;
  }

  async createRoom(input: CreateRoomInput): Promise<Room> {
    // 1. Verify room type exists
    const roomType = await this.repo.findRoomTypeById(input.roomTypeId);
    if (!roomType) {
      throw AppError.badRequest(
        `Room type with ID ${input.roomTypeId} does not exist`,
        ErrorCodes.ROOM_TYPE_NOT_FOUND,
      );
    }

    // 2. Check room number uniqueness
    const existing = await this.repo.findRoomByNumber(input.roomNumber);
    if (existing) {
      throw AppError.conflict(
        `Room number ${input.roomNumber} already exists`,
        ErrorCodes.ROOM_ALREADY_EXISTS,
      );
    }

    return this.repo.createRoom(input);
  }

  async updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
    const room = await this.getRoomById(id);

    if (input.roomTypeId) {
      const roomType = await this.repo.findRoomTypeById(input.roomTypeId);
      if (!roomType) {
        throw AppError.badRequest(
          `Room type with ID ${input.roomTypeId} does not exist`,
          ErrorCodes.ROOM_TYPE_NOT_FOUND,
        );
      }
    }

    const updated = await this.repo.updateRoom(id, input);
    if (!updated) {
      throw AppError.notFound(
        `Room with ID ${id} not found`,
        ErrorCodes.ROOM_NOT_FOUND,
      );
    }
    return updated;
  }

  /**
   * Enforces business rules and state transition validation across the 3 independent dimensions:
   * 1. Occupancy (vacant, occupied)
   * 2. Housekeeping (clean, dirty, cleaning, inspected)
   * 3. Maintenance (operational, under_maintenance, out_of_service)
   */
  async updateRoomStatus(
    id: string,
    input: UpdateRoomStatusInput,
    operator?: string,
  ): Promise<Room> {
    const currentRoom = await this.getRoomById(id);
    const {
      occupancyStatus,
      housekeepingStatus,
      maintenanceStatus,
      reason,
      changedBy,
    } = input as typeof input & {
      maintenanceStatus?:
        | "operational"
        | "under_maintenance"
        | "out_of_service";
    };
    const actor = changedBy || operator || "system";

    const updates: {
      occupancyStatus?: OccupancyStatus;
      housekeepingStatus?: HousekeepingStatus;
      maintenanceStatus?: MaintenanceStatus;
    } = {};

    // 1. Maintenance Status Transition Rules
    if (
      maintenanceStatus &&
      maintenanceStatus !== currentRoom.maintenanceStatus
    ) {
      if (
        (maintenanceStatus === "out_of_service" ||
          maintenanceStatus === "under_maintenance") &&
        currentRoom.occupancyStatus === "occupied"
      ) {
        throw AppError.badRequest(
          `Cannot place room ${currentRoom.roomNumber} into '${maintenanceStatus}' while occupied. Reassign or check out the guest first.`,
          ErrorCodes.INVALID_ROOM_STATUS_TRANSITION,
        );
      }

      // If returning to operational from maintenance, housekeeping should be flagged dirty for inspection/cleaning
      if (
        maintenanceStatus === "operational" &&
        currentRoom.maintenanceStatus !== "operational" &&
        !housekeepingStatus
      ) {
        updates.housekeepingStatus = "dirty";
      }

      updates.maintenanceStatus = maintenanceStatus;
    }

    const targetMaintenance =
      updates.maintenanceStatus ?? currentRoom.maintenanceStatus;

    // 2. Occupancy Status Transition Rules
    if (occupancyStatus && occupancyStatus !== currentRoom.occupancyStatus) {
      if (occupancyStatus === "occupied") {
        // Transition: Check-in (vacant -> occupied)
        if (targetMaintenance !== "operational") {
          throw AppError.badRequest(
            `Cannot check in guest to room ${currentRoom.roomNumber}: room maintenance status is '${targetMaintenance}'`,
            ErrorCodes.ROOM_NOT_AVAILABLE_FOR_CHECK_IN,
          );
        }

        const effectiveHousekeeping =
          housekeepingStatus ?? currentRoom.housekeepingStatus;
        if (
          effectiveHousekeeping === "dirty" ||
          effectiveHousekeeping === "cleaning"
        ) {
          throw AppError.badRequest(
            `Cannot check in guest to room ${currentRoom.roomNumber}: room is '${effectiveHousekeeping}' and must be inspected or clean`,
            ErrorCodes.ROOM_NOT_AVAILABLE_FOR_CHECK_IN,
          );
        }

        updates.occupancyStatus = "occupied";
      } else if (occupancyStatus === "vacant") {
        // Transition: Check-out (occupied -> vacant)
        updates.occupancyStatus = "vacant";

        // Real-world hotel automation: Checking out automatically turns room housekeeping to 'dirty'
        if (!housekeepingStatus) {
          updates.housekeepingStatus = "dirty";
        }
      }
    }

    // 3. Housekeeping Status Transition Rules
    if (housekeepingStatus) {
      if (
        housekeepingStatus === "inspected" &&
        targetMaintenance !== "operational"
      ) {
        throw AppError.badRequest(
          `Cannot mark room ${currentRoom.roomNumber} as 'inspected' while maintenance is '${targetMaintenance}'`,
          ErrorCodes.INVALID_ROOM_STATUS_TRANSITION,
        );
      }

      if (housekeepingStatus !== currentRoom.housekeepingStatus) {
        updates.housekeepingStatus = housekeepingStatus;
      }
    }

    // If no changes needed
    if (
      updates.occupancyStatus === undefined &&
      updates.housekeepingStatus === undefined &&
      updates.maintenanceStatus === undefined
    ) {
      return currentRoom;
    }

    return this.repo.updateRoomStatusWithHistory(
      id,
      currentRoom,
      updates,
      actor,
      reason,
    );
  }

  async getRoomStatusHistory(
    id: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<RoomStatusHistory[]> {
    await this.getRoomById(id); // Ensure room exists
    return this.repo.findStatusHistoryByRoomId(id, limit, offset);
  }

  async getRoomBoard(filter: RoomBoardFilter = {}): Promise<RoomBoardData> {
    const [summary, floors] = await Promise.all([
      this.repo.getRoomOperationalSummary(),
      this.repo.findRoomsForBoard(filter),
    ]);

    return {
      summary,
      floors,
    };
  }

  // Room Types
  async listRoomTypes(): Promise<RoomType[]> {
    return this.repo.findRoomTypes();
  }

  async getRoomTypeById(id: string): Promise<RoomType> {
    const type = await this.repo.findRoomTypeById(id);
    if (!type) {
      throw AppError.notFound(
        `Room type with ID ${id} not found`,
        ErrorCodes.ROOM_TYPE_NOT_FOUND,
      );
    }
    return type;
  }

  async createRoomType(input: CreateRoomTypeInput): Promise<RoomType> {
    const existing = await this.repo.findRoomTypeByCode(input.code);
    if (existing) {
      throw AppError.conflict(
        `Room type code ${input.code} already exists`,
        ErrorCodes.ROOM_TYPE_ALREADY_EXISTS,
      );
    }
    return this.repo.createRoomType(input);
  }
}

export const roomsService = new RoomsService();
