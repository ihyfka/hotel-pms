import { Router } from "express";
import { allocationsController } from "./allocations.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createAllocationSchema } from "@hotel-pms/validations";

const router = Router();
const allowedRoles = ["admin", "owner", "manager", "front_desk"];

router.use(authenticate, authorize(allowedRoles));

router.post(
  "/allocations",
  validate({ body: createAllocationSchema }),
  allocationsController.allocateRoom,
);

router.get("/allocations/:id", allocationsController.getAllocationById);

router.post("/allocations/:id/cancel", allocationsController.cancelAllocation);

export const allocationsRouter: Router = router;
