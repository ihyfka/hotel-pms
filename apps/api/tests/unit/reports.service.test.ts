import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportsService } from "../../src/modules/reports/reports.service.js";
import { ReportsRepository } from "../../src/modules/reports/reports.repository.js";
import { ErrorCodes } from "../../src/shared/errors/errorCodes.js";

describe("ReportsService", () => {
  let mockRepo: ReportsRepository;
  let service: ReportsService;

  beforeEach(() => {
    mockRepo = {
      getDailyRevenue: vi.fn(),
      getOccupiedRoomCount: vi.fn(),
      getArrivals: vi.fn(),
      getDepartures: vi.fn(),
    } as unknown as ReportsRepository;

    service = new ReportsService(mockRepo);
  });

  describe("getAdr", () => {
    it("calculates Average Daily Rate correctly", async () => {
      vi.mocked(mockRepo.getDailyRevenue).mockResolvedValue(1200);
      vi.mocked(mockRepo.getOccupiedRoomCount).mockResolvedValue(8);

      const result = await service.getAdr("2026-11-15");

      expect(result).toEqual({
        date: "2026-11-15",
        adr: 150, // 1200 / 8
        occupied_rooms: 8,
        total_revenue: 1200,
      });
    });

    it("returns adr = 0 when occupied rooms is 0", async () => {
      vi.mocked(mockRepo.getDailyRevenue).mockResolvedValue(0);
      vi.mocked(mockRepo.getOccupiedRoomCount).mockResolvedValue(0);

      const result = await service.getAdr("2026-11-15");
      expect(result.adr).toBe(0);
    });

    it("throws INVALID_DATE_FORMAT when date is malformed", async () => {
      await expect(service.getAdr("not-a-date")).rejects.toMatchObject({
        code: ErrorCodes.INVALID_DATE_FORMAT,
        statusCode: 422,
      });
    });
  });

  describe("getArrivals", () => {
    it("returns arrivals list", async () => {
      const sampleArrivals = [
        {
          guest_name: "John Doe",
          reservation_number: "RSV-ARR12345",
          room_type: "Deluxe",
          allocated_room_number: "101",
          special_requests: "Quiet room",
        },
      ];
      vi.mocked(mockRepo.getArrivals).mockResolvedValue(sampleArrivals);

      const result = await service.getArrivals("2026-11-15");
      expect(result).toEqual(sampleArrivals);
    });

    it("defaults to today date when dateParam is omitted", async () => {
      vi.mocked(mockRepo.getArrivals).mockResolvedValue([]);
      const result = await service.getArrivals();
      expect(Array.isArray(result)).toBe(true);
      expect(mockRepo.getArrivals).toHaveBeenCalled();
    });

    it("throws INVALID_DATE_FORMAT when date is malformed", async () => {
      await expect(service.getArrivals("bad-date")).rejects.toMatchObject({
        code: ErrorCodes.INVALID_DATE_FORMAT,
        statusCode: 422,
      });
    });
  });

  describe("getDepartures", () => {
    it("returns departures list", async () => {
      const sampleDepartures = [
        {
          guest_name: "Jane Smith",
          reservation_number: "RSV-DEP12345",
          room_number: "202",
          total_amount: 500,
          payment_status: "paid" as const,
        },
      ];
      vi.mocked(mockRepo.getDepartures).mockResolvedValue(sampleDepartures);

      const result = await service.getDepartures("2026-11-15");
      expect(result).toEqual(sampleDepartures);
    });

    it("defaults to today date when dateParam is omitted", async () => {
      vi.mocked(mockRepo.getDepartures).mockResolvedValue([]);
      const result = await service.getDepartures();
      expect(Array.isArray(result)).toBe(true);
      expect(mockRepo.getDepartures).toHaveBeenCalled();
    });

    it("throws INVALID_DATE_FORMAT when date is malformed", async () => {
      await expect(service.getDepartures("bad-date")).rejects.toMatchObject({
        code: ErrorCodes.INVALID_DATE_FORMAT,
        statusCode: 422,
      });
    });
  });
});
