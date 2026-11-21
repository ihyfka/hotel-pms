import { Request, Response, NextFunction } from "express";
import {
  allocationsService,
  AllocationsService,
} from "./allocations.service.js";
import { CreateAllocationInput } from "@hotel-pms/validations";

export class AllocationsController {
  constructor(
    private readonly service: AllocationsService = allocationsService,
  ) {}

  allocateRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreateAllocationInput;
      const assignedBy = req.user?.email || req.user?.id || "staff";
      const allocation = await this.service.allocateRoom(input, assignedBy);

      return res.status(201).json({
        success: true,
        data: allocation,
        message: "Room allocated successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  getAllocationById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const allocation = await this.service.getAllocationById(id);

      return res.status(200).json({
        success: true,
        data: allocation,
      });
    } catch (err) {
      next(err);
    }
  };

  cancelAllocation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const cancelled = await this.service.cancelAllocation(id);

      return res.status(200).json({
        success: true,
        data: cancelled,
        message: "Allocation cancelled successfully",
      });
    } catch (err) {
      next(err);
    }
  };
}

export const allocationsController = new AllocationsController();
