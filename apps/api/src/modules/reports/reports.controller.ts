import { Request, Response, NextFunction } from "express";
import { reportsService, ReportsService } from "./reports.service.js";

export class ReportsController {
  constructor(private readonly service: ReportsService = reportsService) {}

  getAdr = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date as string | undefined;
      const report = await this.service.getAdr(date);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  };

  getArrivals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date as string | undefined;
      const report = await this.service.getArrivals(date);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  };

  getDepartures = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date as string | undefined;
      const report = await this.service.getDepartures(date);

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const reportsController = new ReportsController();
