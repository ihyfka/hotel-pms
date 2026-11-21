import {
  ReservationsRepository,
  reservationsRepository,
} from "./reservations.repository.js";
import { roomsRepository, RoomsRepository } from "../rooms/rooms.repository.js";
import {
  availabilityService,
  AvailabilityService,
} from "../availability/availability.service.js";
import { Reservation, ReservationStatus } from "./reservations.types.js";
import {
  CreateReservationInput,
  UpdateReservationInput,
  QueryReservationsInput,
} from "@hotel-pms/validations";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";
import {
  parsePagination,
  buildPaginatedResponse,
} from "../../shared/utils/pagination.js";

function generateReservationNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RSV-${randomPart}`;
}

export class ReservationsService {
  constructor(
    private readonly repo: ReservationsRepository = reservationsRepository,
    private readonly roomsRepo: RoomsRepository = roomsRepository,
    private readonly availService: AvailabilityService = availabilityService,
  ) {}

  async createReservation(
    input: CreateReservationInput,
    role?: string,
  ): Promise<Reservation> {
    // 1. Verify guest exists
    const guest = await this.repo.findGuestById(input.guestId);
    if (!guest) {
      throw AppError.notFound(
        `Guest with ID ${input.guestId} not found`,
        ErrorCodes.GUEST_NOT_FOUND,
      );
    }

    // 2. Verify room type exists
    const roomType = await this.roomsRepo.findRoomTypeById(input.roomTypeId);
    if (!roomType) {
      throw AppError.notFound(
        `Room type with ID ${input.roomTypeId} not found`,
        ErrorCodes.ROOM_TYPE_NOT_FOUND,
      );
    }

    // 3. Check date range validity
    const dIn = new Date(`${input.checkInDate}T00:00:00Z`);
    const dOut = new Date(`${input.checkOutDate}T00:00:00Z`);
    if (isNaN(dIn.getTime()) || isNaN(dOut.getTime()) || dOut <= dIn) {
      throw AppError.badRequest(
        "Check-out date must be after check-in date",
        ErrorCodes.INVALID_DATE_RANGE,
      );
    }

    // 4. Check room type inventory availability for dates
    const isAvailable = await this.availService.isRoomTypeAvailable(
      input.roomTypeId,
      input.checkInDate,
      input.checkOutDate,
    );
    if (!isAvailable) {
      throw AppError.conflict(
        `No rooms of type '${roomType.name}' available for the selected dates`,
        ErrorCodes.ROOM_TYPE_UNAVAILABLE,
      );
    }

    // 5. Calculate total_amount = base_price * nights
    const nights = Math.round(
      (dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalAmount = Number(
      ((roomType.baseRate ?? roomType.basePrice ?? 0) * nights).toFixed(2),
    );

    // 6. Channel default status
    const isStaff = role === "admin" || role === "front_desk";
    const status: ReservationStatus = isStaff ? "confirmed" : "pending";

    // 7. Generate reservation number with single retry on collision
    let reservationNumber = generateReservationNumber();
    try {
      return await this.repo.createReservation({
        reservationNumber,
        guestId: input.guestId,
        roomTypeId: input.roomTypeId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        status,
        adultCount: input.adultCount ?? 1,
        childCount: input.childCount ?? 0,
        specialRequests: input.specialRequests,
        totalAmount,
      });
    } catch (err: any) {
      if (err.code === "23505" && err.detail?.includes("reservation_number")) {
        // Retry once on collision
        reservationNumber = generateReservationNumber();
        return await this.repo.createReservation({
          reservationNumber,
          guestId: input.guestId,
          roomTypeId: input.roomTypeId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          status,
          adultCount: input.adultCount ?? 1,
          childCount: input.childCount ?? 0,
          specialRequests: input.specialRequests,
          totalAmount,
        });
      }
      throw err;
    }
  }

  async getReservationById(id: string): Promise<Reservation> {
    const reservation = await this.repo.findReservationById(id);
    if (!reservation) {
      throw AppError.notFound(
        `Reservation with ID ${id} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }
    return reservation;
  }

  async listReservations(query: QueryReservationsInput) {
    const { page, limit, offset } = parsePagination({
      page: query.page,
      limit: query.limit,
    });

    const [data, total] = await Promise.all([
      this.repo.findReservations(query, offset, limit),
      this.repo.countReservations(query),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async updateReservation(
    id: string,
    input: UpdateReservationInput,
  ): Promise<Reservation> {
    const reservation = await this.getReservationById(id);

    if (
      reservation.status === "cancelled" ||
      reservation.status === "checked_out"
    ) {
      throw AppError.badRequest(
        `Cannot modify metadata of a ${reservation.status} reservation`,
        ErrorCodes.INVALID_STATUS_TRANSITION,
      );
    }

    const updated = await this.repo.updateReservationMetadata(id, input);
    if (!updated) {
      throw AppError.notFound(
        `Reservation with ID ${id} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }
    return updated;
  }

  async cancelReservation(id: string): Promise<Reservation> {
    const reservation = await this.getReservationById(id);

    if (reservation.status === "checked_in") {
      throw AppError.conflict(
        "Cannot cancel an active stay that is checked in",
        ErrorCodes.CANNOT_CANCEL_ACTIVE_STAY,
      );
    }

    if (reservation.status === "cancelled") {
      throw AppError.badRequest(
        "Reservation is already cancelled",
        ErrorCodes.INVALID_STATUS_TRANSITION,
      );
    }

    if (reservation.status === "checked_out") {
      throw AppError.badRequest(
        "Cannot cancel a checked_out reservation",
        ErrorCodes.INVALID_STATUS_TRANSITION,
      );
    }

    const updated = await this.repo.updateReservationStatus(id, "cancelled");
    if (!updated) {
      throw AppError.notFound(
        `Reservation with ID ${id} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }
    return updated;
  }

  async confirmReservation(id: string): Promise<Reservation> {
    const reservation = await this.getReservationById(id);

    if (reservation.status !== "pending") {
      throw AppError.badRequest(
        `Cannot confirm reservation with status '${reservation.status}'. Only 'pending' reservations can be confirmed.`,
        ErrorCodes.INVALID_STATUS_TRANSITION,
      );
    }

    const updated = await this.repo.updateReservationStatus(id, "confirmed");
    if (!updated) {
      throw AppError.notFound(
        `Reservation with ID ${id} not found`,
        ErrorCodes.RESERVATION_NOT_FOUND,
      );
    }
    return updated;
  }
}

export const reservationsService = new ReservationsService();
