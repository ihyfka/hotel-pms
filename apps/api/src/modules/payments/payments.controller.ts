import { Request, Response, NextFunction } from "express";
import { paymentsService, PaymentsService } from "./payments.service.js";
import { CreatePaymentInput } from "@hotel-pms/validations";

export class PaymentsController {
  constructor(private readonly service: PaymentsService = paymentsService) {}

  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreatePaymentInput;
      const recordedBy = req.user?.email || req.user?.id || "staff";
      const payment = await this.service.createPayment(input, recordedBy);

      return res.status(201).json({
        success: true,
        data: payment,
        message: "Payment recorded successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  getPaymentByReservationId = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const payment = await this.service.getPaymentByReservationId(id);

      return res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const paymentsController = new PaymentsController();
