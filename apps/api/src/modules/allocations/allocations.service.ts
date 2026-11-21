import pg from "pg";
import {
  AllocationsRepository,
  allocationsRepository,
} from "./allocations.repository.js";
import {
  reservationsRepository,
  ReservationsRepository,
} from "../reservations/reservations.repository.js";
import { roomsRepository, RoomsRepository } from "../rooms/rooms.repository.js";
import { withTransaction } from "../../config/database.js";
import { CreateAllocationInput } from "@hotel-pms/validations";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

export class AllocationsService {
  constructor(
    private readonly repo: AllocationsRepository = allocationsRepository,
    private readonly resRepo: ReservationsRepository = reservationsRepository,
    private readonly roomsRepo: RoomsRepository = roomsRepository,
  ) {}

  async allocateRoom(
    input: CreateAllocationInput,
    assignedBy?: string,
    externalClient?: pg.PoolClient,
  ) {
    const execute = async (client: pg.PoolClient) => {
      // 1. Verify reservation exists and is confirmed or checked_in
      const reservation = await this.resRepo.findReservationById(
        input.reservationId,
        client,
      );
      if (!reservation) {
        throw AppError.notFound(
          `Reservation with ID ${input.reservationId} not found`,
          ErrorCodes.RESERVATION_NOT_FOUND,
        );
      }

      if (
        reservation.status !== "confirmed" &&
        reservation.status !== "checked_in"
      ) {
        throw AppError.badRequest(
          `Cannot allocate room to reservation with status '${reservation.status}'. Only confirmed or checked-in reservations can be allocated.`,
          ErrorCodes.INVALID_RESERVATION_STATUS,
        );
      }

      // 2. Verify reservation has no existing active allocation
      const existingResAlloc =
        await this.repo.findActiveAllocationByReservationId(
          input.reservationId,
          client,
        );
      if (existingResAlloc) {
        throw AppError.conflict(
          `Reservation ${reservation.reservationNumber} already has an active room allocation`,
          ErrorCodes.RESERVATION_ALREADY_ALLOCATED,
        );
      }

      // 3. Verify room exists and is operational
      const room = await this.roomsRepo.findRoomById(input.roomId, client);
      if (!room) {
        throw AppError.notFound(
          `Room with ID ${input.roomId} not found`,
          ErrorCodes.ROOM_NOT_FOUND,
        );
      }

      if (room.maintenanceStatus !== "operational") {
        throw AppError.conflict(
          `Cannot allocate room ${room.roomNumber}: room maintenance status is '${room.maintenanceStatus}'`,
          ErrorCodes.ROOM_NOT_OPERATIONAL,
        );
      }

      // Range derived from reservation check-in and check-out dates
      const rangeStart = new Date(`${reservation.checkInDate}T14:00:00Z`);
      const rangeEnd = new Date(`${reservation.checkOutDate}T11:00:00Z`);

      // 4. Verify room has no overlapping active allocation
      const isOverlapping = await this.repo.hasOverlappingActiveAllocation(
        input.roomId,
        rangeStart,
        rangeEnd,
        undefined,
        client,
      );
      if (isOverlapping) {
        throw AppError.conflict(
          `Room ${room.roomNumber} already has an active allocation for the requested dates`,
          ErrorCodes.ROOM_ALREADY_ALLOCATED,
        );
      }

      // 5. Insert into room_allocations
      try {
        const allocation = await this.repo.createAllocation(
          {
            reservationId: input.reservationId,
            roomId: input.roomId,
            assignedRangeStart: rangeStart,
            assignedRangeEnd: rangeEnd,
            assignedBy: input.assignedBy || assignedBy || "staff",
            notes: input.notes,
          },
          client,
        );
        return allocation!;
      } catch (err: any) {
        if (err.code === "23P01") {
          throw AppError.conflict(
            `Room ${room.roomNumber} has an overlapping allocation constraint violation`,
            ErrorCodes.ROOM_ALREADY_ALLOCATED,
          );
        }
        if (err.code === "23505") {
          throw AppError.conflict(
            `Reservation ${reservation.reservationNumber} already has an allocation (unique constraint)`,
            ErrorCodes.RESERVATION_ALREADY_ALLOCATED,
          );
        }
        throw err;
      }
    };

    if (externalClient) {
      return execute(externalClient);
    }
    return withTransaction(execute);
  }

  async getAllocationById(id: string) {
    const allocation = await this.repo.findAllocationById(id);
    if (!allocation) {
      throw AppError.notFound(
        `Allocation with ID ${id} not found`,
        ErrorCodes.NOT_FOUND,
      );
    }
    return allocation;
  }

  async getActiveAllocationByReservationId(
    reservationId: string,
    client?: pg.PoolClient,
  ) {
    return this.repo.findActiveAllocationByReservationId(reservationId, client);
  }

  async cancelAllocation(id: string) {
    const allocation = await this.getAllocationById(id);
    if (allocation.releasedAt != null) {
      throw AppError.badRequest(
        `Allocation is already released`,
        ErrorCodes.BAD_REQUEST,
      );
    }

    const updated = await this.repo.updateAllocationStatus(id, "cancelled");
    return updated!;
  }
}

export const allocationsService = new AllocationsService();
