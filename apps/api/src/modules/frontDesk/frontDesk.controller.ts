import { Request, Response, NextFunction } from "express";
import { frontDeskService, FrontDeskService } from "./frontDesk.service.js";
import {
  CheckInInput,
  CheckOutInput,
  WalkInInput,
} from "@hotel-pms/validations";

export class FrontDeskController {
  constructor(private readonly service: FrontDeskService = frontDeskService) {}

  checkIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CheckInInput;
      const operator = req.user?.email || req.user?.id || "front_desk";
      const result = await this.service.checkIn(input, operator);

      return res.status(200).json({
        success: true,
        data: result,
        message: "Guest checked in successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  checkOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CheckOutInput;
      const operator = req.user?.email || req.user?.id || "front_desk";
      const result = await this.service.checkOut(input, operator);

      return res.status(200).json({
        success: true,
        data: result,
        message: "Guest checked out successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  walkIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as WalkInInput;
      const operator = req.user?.email || req.user?.id || "front_desk";
      const result = await this.service.walkIn(input, operator);

      return res.status(201).json({
        success: true,
        data: result,
        message: "Walk-in guest checked in successfully",
      });
    } catch (err) {
      next(err);
    }
  };
}

export const frontDeskController = new FrontDeskController();
