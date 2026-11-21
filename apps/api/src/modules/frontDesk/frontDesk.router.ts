import { Router } from "express";
import { frontDeskController } from "./frontDesk.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  checkInSchema,
  checkOutSchema,
  walkInSchema,
} from "@hotel-pms/validations";

const router = Router();
const allowedRoles = ["admin", "owner", "manager", "front_desk"];

router.use(authenticate, authorize(allowedRoles));

router.post(
  "/front-desk/check-in",
  validate({ body: checkInSchema }),
  frontDeskController.checkIn,
);

router.post(
  "/front-desk/check-out",
  validate({ body: checkOutSchema }),
  frontDeskController.checkOut,
);

router.post(
  "/front-desk/walk-in",
  validate({ body: walkInSchema }),
  frontDeskController.walkIn,
);

export const frontDeskRouter: Router = router;
