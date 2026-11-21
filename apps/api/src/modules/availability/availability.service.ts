import {
  AvailabilityRepository,
  availabilityRepository,
} from "./availability.repository.js";
import { RoomTypeAvailability } from "./availability.types.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class AvailabilityService {
  constructor(
    private readonly repo: AvailabilityRepository = availabilityRepository,
  ) {}

  validateDateRange(
    checkIn?: string,
    checkOut?: string,
  ): { checkIn: string; checkOut: string; nights: number } {
    if (!checkIn || !checkOut) {
      throw AppError.badRequest(
        "Both check_in and check_out dates are required",
        ErrorCodes.MISSING_DATES,
      );
    }

    if (!DATE_REGEX.test(checkIn) || !DATE_REGEX.test(checkOut)) {
      throw AppError.unprocessable(
        "Invalid date format. Expected YYYY-MM-DD",
        ErrorCodes.INVALID_DATE_FORMAT,
      );
    }

    const dIn = new Date(`${checkIn}T00:00:00Z`);
    const dOut = new Date(`${checkOut}T00:00:00Z`);

    if (isNaN(dIn.getTime()) || isNaN(dOut.getTime())) {
      throw AppError.unprocessable(
        "Invalid date values",
        ErrorCodes.INVALID_DATE_FORMAT,
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (checkIn < todayStr) {
      throw AppError.badRequest(
        "Check-in date cannot be in the past",
        ErrorCodes.INVALID_DATE_RANGE,
      );
    }

    if (checkOut <= checkIn) {
      throw AppError.badRequest(
        "Check-out date must be after check-in date",
        ErrorCodes.INVALID_DATE_RANGE,
      );
    }

    const nights = Math.round(
      (dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { checkIn, checkOut, nights };
  }

  async getAvailability(
    checkInParam?: string,
    checkOutParam?: string,
  ): Promise<RoomTypeAvailability[]> {
    const { checkIn, checkOut, nights } = this.validateDateRange(
      checkInParam,
      checkOutParam,
    );
    const rows = await this.repo.findAvailableRoomTypes(checkIn, checkOut);

    return rows.map((row) => {
      const basePrice = Number(row.base_price);
      return {
        room_type_id: row.room_type_id,
        code: row.code,
        name: row.name,
        base_price: basePrice,
        capacity: row.capacity,
        amenities: Array.isArray(row.amenities)
          ? row.amenities
          : JSON.parse(
              typeof row.amenities === "string" ? row.amenities : "[]",
            ),
        available_count: Number(row.available_count),
        total_nights: nights,
        total_price: Number((basePrice * nights).toFixed(2)),
      };
    });
  }

  async isRoomTypeAvailable(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<boolean> {
    const count = await this.repo.countAvailableRoomsForType(
      roomTypeId,
      checkIn,
      checkOut,
    );
    return count > 0;
  }

  async getAvailableRoomsForType(
    roomTypeId: string,
    checkIn: string,
    checkOut: string,
  ) {
    return this.repo.findAvailableRoomsForType(roomTypeId, checkIn, checkOut);
  }
}

export const availabilityService = new AvailabilityService();
