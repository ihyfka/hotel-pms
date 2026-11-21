import { Router } from "express";
import { paymentsController } from "./payments.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createPaymentSchema } from "@hotel-pms/validations";

const router = Router();
const allowedRoles = ["admin", "owner", "manager", "front_desk"];

router.use(authenticate, authorize(allowedRoles));

router.post(
  "/payments",
  validate({ body: createPaymentSchema }),
  paymentsController.createPayment,
);

router.get(
  "/payments/reservation/:id",
  paymentsController.getPaymentByReservationId,
);

export const paymentsRouter: Router = router;
