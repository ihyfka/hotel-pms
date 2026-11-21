import {
  FrontDeskRepository,
  frontDeskRepository,
} from "./frontDesk.repository.js";
import {
  reservationsRepository,
  ReservationsRepository,
} from "../reservations/reservations.repository.js";
import {
  allocationsRepository,
  AllocationsRepository,
} from "../allocations/allocations.repository.js";
import { roomsRepository, RoomsRepository } from "../rooms/rooms.repository.js";
import {
  availabilityService,
  AvailabilityService,
} from "../availability/availability.service.js";
import { withTransaction } from "../../config/database.js";
import {
  CheckInInput,
  CheckOutInput,
  WalkInInput,
} from "@hotel-pms/validations";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

function generateReservationNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RSV-${randomPart}`;
}

export class FrontDeskService {
  constructor(
    private readonly repo: FrontDeskRepository = frontDeskRepository,
    private readonly resRepo: ReservationsRepository = reservationsRepository,
    private readonly allocRepo: AllocationsRepository = allocationsRepository,
    private readonly roomsRepo: RoomsRepository = roomsRepository,
    private readonly availService: AvailabilityService = availabilityService,
  ) {}

  async checkIn(input: CheckInInput, operator: string = "staff") {
    // 1. Verify reservation exists and status is confirmed
    const reservation = await this.resRepo.findReservationById(
      input.reservationId,
    );
    if (!reservation) {
      throw AppError.notFound(
        `Reservation with ID ${input.reservationId} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }

    if (reservation.status === "cancelled") {
      throw AppError.conflict(
        `Reservation ${reservation.reservationNumber} has been cancelled`,
        ErrorCodes.RESERVATION_CANCELLED,
      );
    }

    if (reservation.status === "checked_in") {
      throw AppError.conflict(
        `Reservation ${reservation.reservationNumber} is already checked in`,
        ErrorCodes.ALREADY_CHECKED_IN,
      );
    }

    if (reservation.status !== "confirmed") {
      throw AppError.badRequest(
        `Cannot check in reservation with status '${reservation.status}'. Only confirmed reservations can be checked in.`,
        ErrorCodes.INVALID_RESERVATION_STATUS,
      );
    }

    // 2. Verify allocation exists or auto-allocate
    let allocation = await this.allocRepo.findActiveAllocationByReservationId(
      input.reservationId,
    );
    let targetRoomId = input.roomId || allocation?.roomId;

    if (!allocation) {
      // Attempt auto-allocation
      const availableRooms = await this.availService.getAvailableRoomsForType(
        reservation.roomTypeId,
        reservation.checkInDate,
        reservation.checkOutDate,
      );

      if (availableRooms.length === 0) {
        throw AppError.conflict(
          `No available rooms found to allocate for reservation ${reservation.reservationNumber}`,
          ErrorCodes.NO_ROOMS_AVAILABLE,
        );
      }

      const assignedRoom = targetRoomId
        ? availableRooms.find((r) => r.id === targetRoomId)
        : availableRooms[0];

      if (!assignedRoom) {
        throw AppError.conflict(
          `Requested room is not available for auto-allocation`,
          ErrorCodes.NO_ROOMS_AVAILABLE,
        );
      }

      targetRoomId = assignedRoom.id;

      // Allocate the room
      allocation = await this.allocRepo.createAllocation({
        reservationId: reservation.id,
        roomId: targetRoomId,
        assignedRangeStart: new Date(`${reservation.checkInDate}T14:00:00Z`),
        assignedRangeEnd: new Date(`${reservation.checkOutDate}T11:00:00Z`),
        assignedBy: operator,
        notes: "Auto-allocated during check-in",
      });
    }

    if (!targetRoomId) {
      throw AppError.conflict(
        "Unable to determine physical room for check-in",
        ErrorCodes.NO_ROOMS_AVAILABLE,
      );
    }

    // 3. Verify room is vacant + (clean or inspected) + operational
    const room = await this.roomsRepo.findRoomById(targetRoomId);
    if (!room) {
      throw AppError.notFound(
        `Room with ID ${targetRoomId} not found`,
        ErrorCodes.ROOM_NOT_FOUND,
      );
    }

    if (room.maintenanceStatus !== "operational") {
      throw AppError.conflict(
        `Room ${room.roomNumber} is under maintenance (${room.maintenanceStatus})`,
        ErrorCodes.ROOM_NOT_OPERATIONAL,
      );
    }

    if (
      room.housekeepingStatus === "dirty" ||
      room.housekeepingStatus === "cleaning"
    ) {
      throw AppError.conflict(
        `Room ${room.roomNumber} is not ready (housekeeping status: ${room.housekeepingStatus})`,
        ErrorCodes.ROOM_NOT_READY,
      );
    }

    if (room.occupancyStatus === "occupied") {
      throw AppError.conflict(
        `Room ${room.roomNumber} is currently occupied`,
        ErrorCodes.ROOM_NOT_READY,
      );
    }

    // 4. BEGIN TRANSACTION
    return withTransaction(async (client) => {
      // a. reservation.status -> checked_in
      await this.repo.updateReservationStatus(
        reservation.id,
        "checked_in",
        client,
      );

      // b. room.occupancy_status -> occupied
      await this.repo.updateRoomStatuses(
        room.id,
        { occupancyStatus: "occupied" },
        client,
      );

      // c. room_status_history audit entry
      await this.repo.recordRoomStatusHistory(
        {
          roomId: room.id,
          prevOccupancy: room.occupancyStatus,
          newOccupancy: "occupied",
          prevHousekeeping: room.housekeepingStatus,
          newHousekeeping: room.housekeepingStatus,
          prevMaintenance: room.maintenanceStatus,
          newMaintenance: room.maintenanceStatus,
          changedBy: operator,
          reason: `Guest checked in (Reservation: ${reservation.reservationNumber})`,
        },
        client,
      );

      return {
        reservationId: reservation.id,
        roomId: room.id,
        roomNumber: room.roomNumber,
        status: "checked_in",
      };
    });
  }

  async checkOut(input: CheckOutInput, operator: string = "staff") {
    // 1. Verify reservation exists and status is checked_in
    const reservation = await this.resRepo.findReservationById(
      input.reservationId,
    );
    if (!reservation) {
      throw AppError.notFound(
        `Reservation with ID ${input.reservationId} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }

    if (reservation.status !== "checked_in") {
      throw AppError.badRequest(
        `Cannot check out reservation with status '${reservation.status}'. Only checked-in reservations can be checked out.`,
        ErrorCodes.INVALID_STATUS_TRANSITION,
      );
    }

    // 2. Fetch active allocation
    const allocation = await this.allocRepo.findActiveAllocationByReservationId(
      input.reservationId,
    );
    if (!allocation) {
      throw AppError.notFound(
        `No active room allocation found for reservation ${reservation.reservationNumber}`,
        ErrorCodes.NOT_FOUND,
      );
    }

    const room = await this.roomsRepo.findRoomById(allocation.roomId);
    if (!room) {
      throw AppError.notFound(
        `Room with ID ${allocation.roomId} not found`,
        ErrorCodes.ROOM_NOT_FOUND,
      );
    }

    // 3. BEGIN TRANSACTION
    return withTransaction(async (client) => {
      // a. reservation.status -> checked_out
      await this.repo.updateReservationStatus(
        reservation.id,
        "checked_out",
        client,
      );

      // b. allocation.status -> completed
      await this.repo.updateAllocationStatus(
        allocation.id,
        "completed",
        client,
      );

      // c. room.occupancy_status -> vacant, room.housekeeping_status -> dirty
      await this.repo.updateRoomStatuses(
        room.id,
        {
          occupancyStatus: "vacant",
          housekeepingStatus: "dirty",
        },
        client,
      );

      // d. room_status_history audit entry
      await this.repo.recordRoomStatusHistory(
        {
          roomId: room.id,
          prevOccupancy: room.occupancyStatus,
          newOccupancy: "vacant",
          prevHousekeeping: room.housekeepingStatus,
          newHousekeeping: "dirty",
          prevMaintenance: room.maintenanceStatus,
          newMaintenance: room.maintenanceStatus,
          changedBy: operator,
          reason: `Guest checked out (Reservation: ${reservation.reservationNumber})`,
        },
        client,
      );

      // e. housekeeping_tasks INSERT (auto-create cleaning task)
      const housekeepingTaskId = await this.repo.createHousekeepingTask(
        room.id,
        "normal",
        `Auto-created on checkout of reservation ${reservation.reservationNumber}`,
        client,
      );

      return {
        reservationId: reservation.id,
        roomId: room.id,
        status: "checked_out",
        housekeepingTaskId,
      };
    });
  }

  async walkIn(input: WalkInInput, operator: string = "staff") {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const checkInDate = input.checkInDate || today;
    const checkOutDate = input.checkOutDate || tomorrow;

    // 1. Verify room type exists
    const roomType = await this.roomsRepo.findRoomTypeById(input.roomTypeId);
    if (!roomType) {
      throw AppError.notFound(
        `Room type with ID ${input.roomTypeId} not found`,
        ErrorCodes.ROOM_TYPE_NOT_FOUND,
      );
    }

    // 2. Find available room
    const availableRooms = await this.availService.getAvailableRoomsForType(
      input.roomTypeId,
      checkInDate,
      checkOutDate,
    );

    if (availableRooms.length === 0) {
      throw AppError.conflict(
        `No rooms of type '${roomType.name}' available for walk-in`,
        ErrorCodes.NO_ROOMS_AVAILABLE,
      );
    }

    const assignedRoomCandidate = input.roomId
      ? availableRooms.find((r) => r.id === input.roomId)
      : availableRooms[0];

    if (!assignedRoomCandidate) {
      throw AppError.conflict(
        "Requested room is not available for check-in",
        ErrorCodes.NO_ROOMS_AVAILABLE,
      );
    }

    const room = await this.roomsRepo.findRoomById(assignedRoomCandidate.id);
    if (!room) {
      throw AppError.notFound(
        `Room with ID ${assignedRoomCandidate.id} not found`,
        ErrorCodes.ROOM_NOT_FOUND,
      );
    }

    if (room.maintenanceStatus !== "operational") {
      throw AppError.conflict(
        `Room ${room.roomNumber} is under maintenance`,
        ErrorCodes.ROOM_NOT_OPERATIONAL,
      );
    }

    if (
      room.housekeepingStatus === "dirty" ||
      room.housekeepingStatus === "cleaning"
    ) {
      throw AppError.conflict(
        `Room ${room.roomNumber} is not ready for check-in (status: ${room.housekeepingStatus})`,
        ErrorCodes.ROOM_NOT_READY,
      );
    }

    if (room.occupancyStatus === "occupied") {
      throw AppError.conflict(
        `Room ${room.roomNumber} is already occupied`,
        ErrorCodes.ROOM_NOT_READY,
      );
    }

    // Calculate nights & totalAmount
    const dIn = new Date(`${checkInDate}T00:00:00Z`);
    const dOut = new Date(`${checkOutDate}T00:00:00Z`);
    const nights = Math.max(
      1,
      Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const totalAmount = Number(
      ((roomType.baseRate ?? roomType.basePrice ?? 0) * nights).toFixed(2),
    );

    // 3. BEGIN TRANSACTION
    return withTransaction(async (client) => {
      // a. INSERT guest (or find existing by email)
      const guest = await this.resRepo.createGuest(
        {
          firstName: input.guest.firstName,
          lastName: input.guest.lastName,
          email: input.guest.email,
          phone: input.guest.phone,
        },
        client,
      );

      // b. INSERT reservation (status: checked_in)
      const reservationNumber = generateReservationNumber();
      const reservation = await this.resRepo.createReservation(
        {
          reservationNumber,
          guestId: guest.id,
          roomTypeId: input.roomTypeId,
          checkInDate,
          checkOutDate,
          status: "checked_in",
          adultCount: input.adultCount ?? 1,
          childCount: input.childCount ?? 0,
          specialRequests: input.specialRequests,
          totalAmount,
        },
        client,
      );

      // c. INSERT room_allocation
      await this.allocRepo.createAllocation(
        {
          reservationId: reservation.id,
          roomId: room.id,
          assignedRangeStart: new Date(`${checkInDate}T14:00:00Z`),
          assignedRangeEnd: new Date(`${checkOutDate}T11:00:00Z`),
          assignedBy: operator,
          notes: "Walk-in allocation",
        },
        client,
      );

      // d. room.occupancy_status -> occupied
      await this.repo.updateRoomStatuses(
        room.id,
        { occupancyStatus: "occupied" },
        client,
      );

      // e. room_status_history audit entry
      await this.repo.recordRoomStatusHistory(
        {
          roomId: room.id,
          prevOccupancy: room.occupancyStatus,
          newOccupancy: "occupied",
          prevHousekeeping: room.housekeepingStatus,
          newHousekeeping: room.housekeepingStatus,
          prevMaintenance: room.maintenanceStatus,
          newMaintenance: room.maintenanceStatus,
          changedBy: operator,
          reason: `Walk-in check-in (Reservation: ${reservationNumber})`,
        },
        client,
      );

      return {
        guestId: guest.id,
        reservationId: reservation.id,
        reservationNumber,
        roomId: room.id,
        roomNumber: room.roomNumber,
        status: "checked_in",
      };
    });
  }
}

export const frontDeskService = new FrontDeskService();
