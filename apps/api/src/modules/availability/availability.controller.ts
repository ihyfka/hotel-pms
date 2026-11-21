import { Request, Response, NextFunction } from "express";
import {
  availabilityService,
  AvailabilityService,
} from "./availability.service.js";

export class AvailabilityController {
  constructor(
    private readonly service: AvailabilityService = availabilityService,
  ) {}

  getAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checkIn = (req.query.check_in || req.query.checkIn) as
        | string
        | undefined;
      const checkOut = (req.query.check_out || req.query.checkOut) as
        | string
        | undefined;

      const availability = await this.service.getAvailability(
        checkIn,
        checkOut,
      );
      return res.status(200).json(availability);
    } catch (err) {
      next(err);
    }
  };
}

export const availabilityController = new AvailabilityController();
