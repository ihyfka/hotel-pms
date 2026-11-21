import { Router } from "express";
import { availabilityController } from "./availability.controller.js";

const router = Router();

// GET /api/v1/availability?check_in=2026-12-01&check_out=2026-12-05 (Public)
router.get("/availability", availabilityController.getAvailability);

export const availabilityRouter: Router = router;
