import { Request, Response, NextFunction } from "express";
import {
  reservationsService,
  ReservationsService,
} from "./reservations.service.js";
import {
  frontDeskService,
  FrontDeskService,
} from "../frontDesk/frontDesk.service.js";
import {
  CreateReservationInput,
  UpdateReservationInput,
  QueryReservationsInput,
} from "@hotel-pms/validations";

export class ReservationsController {
  constructor(
    private readonly service: ReservationsService = reservationsService,
    private readonly fdService: FrontDeskService = frontDeskService,
  ) {}

  checkIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { roomId } = req.body || {};
      const operator = req.user?.email || req.user?.id || "staff";
      const result = await this.fdService.checkIn(
        { reservationId: id, roomId },
        operator,
      );

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
      const { id } = req.params;
      const operator = req.user?.email || req.user?.id || "staff";
      const result = await this.fdService.checkOut(
        { reservationId: id },
        operator,
      );

      return res.status(200).json({
        success: true,
        data: result,
        message: "Guest checked out successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  createReservation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const input = req.body as CreateReservationInput;
      const role = req.user?.role;
      const reservation = await this.service.createReservation(input, role);

      return res.status(201).json({
        success: true,
        data: reservation,
        message: "Reservation created successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  listReservations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = req.query as unknown as QueryReservationsInput;
      const result = await this.service.listReservations(query);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  };

  getReservationById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const reservation = await this.service.getReservationById(id);

      return res.status(200).json({
        success: true,
        data: reservation,
      });
    } catch (err) {
      next(err);
    }
  };

  updateReservation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateReservationInput;
      const updated = await this.service.updateReservation(id, input);

      return res.status(200).json({
        success: true,
        data: updated,
        message: "Reservation updated successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  cancelReservation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const cancelled = await this.service.cancelReservation(id);

      return res.status(200).json({
        success: true,
        data: cancelled,
        message: "Reservation cancelled successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  confirmReservation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const confirmed = await this.service.confirmReservation(id);

      return res.status(200).json({
        success: true,
        data: confirmed,
        message: "Reservation confirmed successfully",
      });
    } catch (err) {
      next(err);
    }
  };
}

export const reservationsController = new ReservationsController();
