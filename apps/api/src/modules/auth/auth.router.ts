import { Router } from "express";
import { authController } from "./auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.post("/auth/login", authController.login);
router.get("/auth/me", authenticate, authController.me);

export const authRouter: Router = router;
