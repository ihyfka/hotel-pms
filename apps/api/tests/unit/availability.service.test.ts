import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvailabilityService } from "../../src/modules/availability/availability.service.js";
import { AvailabilityRepository } from "../../src/modules/availability/availability.repository.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

describe("AvailabilityService", () => {
  let mockRepo: AvailabilityRepository;
  let service: AvailabilityService;

  beforeEach(() => {
    mockRepo = {
      findAvailableRoomTypes: vi.fn(),
      countAvailableRoomsForType: vi.fn(),
      findAvailableRoomsForType: vi.fn(),
    } as unknown as AvailabilityRepository;

    service = new AvailabilityService(mockRepo);
  });

  describe("Validation & Date Handling", () => {
    it("throws MISSING_DATES when check_in or check_out is missing", () => {
      expect(() =>
        service.validateDateRange(undefined, "2026-12-05"),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.MISSING_DATES,
          statusCode: 400,
        }),
      );

      expect(() =>
        service.validateDateRange("2026-12-01", undefined),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.MISSING_DATES,
          statusCode: 400,
        }),
      );
    });

    it("throws INVALID_DATE_FORMAT when date format is invalid", () => {
      expect(() =>
        service.validateDateRange("01-12-2026", "2026-12-05"),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.INVALID_DATE_FORMAT,
          statusCode: 422,
        }),
      );

      expect(() =>
        service.validateDateRange("2026-12-01", "not-a-date"),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.INVALID_DATE_FORMAT,
          statusCode: 422,
        }),
      );
    });

    it("throws INVALID_DATE_RANGE when check_out is before or equal to check_in", () => {
      expect(() =>
        service.validateDateRange("2026-12-05", "2026-12-01"),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.INVALID_DATE_RANGE,
          statusCode: 400,
        }),
      );

      expect(() =>
        service.validateDateRange("2026-12-05", "2026-12-05"),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.INVALID_DATE_RANGE,
          statusCode: 400,
        }),
      );
    });

    it("throws INVALID_DATE_RANGE when check_in is in the past", () => {
      expect(() =>
        service.validateDateRange("2020-01-01", "2020-01-05"),
      ).toThrowError(
        expect.objectContaining({
          code: ErrorCodes.INVALID_DATE_RANGE,
          statusCode: 400,
        }),
      );
    });
  });

  describe("getAvailability", () => {
    it("returns calculated room type availability with total nights and total price", async () => {
      vi.mocked(mockRepo.findAvailableRoomTypes).mockResolvedValue([
        {
          room_type_id: "rt-1",
          code: "DLX",
          name: "Deluxe Ocean View",
          base_price: "195.00",
          capacity: 2,
          amenities: ["Ocean View", "Balcony"],
          available_count: 3,
        },
      ]);

      const result = await service.getAvailability("2026-12-01", "2026-12-05");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        room_type_id: "rt-1",
        code: "DLX",
        name: "Deluxe Ocean View",
        base_price: 195,
        capacity: 2,
        amenities: ["Ocean View", "Balcony"],
        available_count: 3,
        total_nights: 4,
        total_price: 780,
      });
    });

    it("returns empty array when no rooms are available", async () => {
      vi.mocked(mockRepo.findAvailableRoomTypes).mockResolvedValue([]);

      const result = await service.getAvailability("2026-12-01", "2026-12-05");
      expect(result).toEqual([]);
    });
  });
});
