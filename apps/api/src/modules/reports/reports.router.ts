import { Router } from "express";
import { reportsController } from "./reports.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { reportDateQuerySchema } from "@hotel-pms/validations";

const router = Router();
const allowedRoles = ["admin", "owner", "manager"];

router.use(authenticate, authorize(allowedRoles));

router.get(
  "/reports/adr",
  validate({ query: reportDateQuerySchema }),
  reportsController.getAdr,
);

router.get(
  "/reports/arrivals",
  validate({ query: reportDateQuerySchema }),
  reportsController.getArrivals,
);

router.get(
  "/reports/departures",
  validate({ query: reportDateQuerySchema }),
  reportsController.getDepartures,
);

export const reportsRouter: Router = router;
