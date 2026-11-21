import { ReportsRepository, reportsRepository } from "./reports.repository.js";
import {
  AdrReport,
  ArrivalsReportItem,
  DeparturesReportItem,
} from "./reports.types.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class ReportsService {
  constructor(private readonly repo: ReportsRepository = reportsRepository) {}

  private resolveDate(dateParam?: string): string {
    if (!dateParam) {
      return new Date().toISOString().slice(0, 10);
    }

    if (!DATE_REGEX.test(dateParam) || isNaN(Date.parse(dateParam))) {
      throw AppError.unprocessable(
        "Invalid date format. Expected YYYY-MM-DD",
        ErrorCodes.INVALID_DATE_FORMAT,
      );
    }

    return dateParam;
  }

  async getAdr(dateParam?: string): Promise<AdrReport> {
    const date = this.resolveDate(dateParam);
    const [totalRevenue, occupiedRooms] = await Promise.all([
      this.repo.getDailyRevenue(date),
      this.repo.getOccupiedRoomCount(date),
    ]);

    const adr =
      occupiedRooms > 0 ? Number((totalRevenue / occupiedRooms).toFixed(2)) : 0;

    return {
      date,
      adr,
      occupied_rooms: occupiedRooms,
      total_revenue: totalRevenue,
    };
  }

  async getArrivals(dateParam?: string): Promise<ArrivalsReportItem[]> {
    const date = this.resolveDate(dateParam);
    return this.repo.getArrivals(date);
  }

  async getDepartures(dateParam?: string): Promise<DeparturesReportItem[]> {
    const date = this.resolveDate(dateParam);
    return this.repo.getDepartures(date);
  }
}

export const reportsService = new ReportsService();
