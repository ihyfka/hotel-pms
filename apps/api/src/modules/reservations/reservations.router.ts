import { Router } from "express";
import { reservationsController } from "./reservations.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createReservationSchema,
  updateReservationSchema,
  queryReservationsSchema,
} from "@hotel-pms/validations";

const router = Router();
const allowedRoles = ["admin", "owner", "manager", "front_desk"];

router.use(authenticate, authorize(allowedRoles));

router.post(
  "/reservations",
  validate({ body: createReservationSchema }),
  reservationsController.createReservation,
);

router.get(
  "/reservations",
  validate({ query: queryReservationsSchema }),
  reservationsController.listReservations,
);

router.get("/reservations/:id", reservationsController.getReservationById);

router.patch(
  "/reservations/:id",
  validate({ body: updateReservationSchema }),
  reservationsController.updateReservation,
);

router.post(
  "/reservations/:id/cancel",
  reservationsController.cancelReservation,
);

router.post(
  "/reservations/:id/confirm",
  reservationsController.confirmReservation,
);

router.post("/reservations/:id/check-in", reservationsController.checkIn);

router.post("/reservations/:id/check-out", reservationsController.checkOut);

export const reservationsRouter: Router = router;
