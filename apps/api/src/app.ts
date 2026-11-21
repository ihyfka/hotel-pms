import express, { Express, Response, Request } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { checkDatabaseHealth } from "./config/database.js";
import { roomsRouter } from "./modules/rooms/rooms.router.js";
import { availabilityRouter } from "./modules/availability/availability.router.js";
import { reservationsRouter } from "./modules/reservations/reservations.router.js";
import { allocationsRouter } from "./modules/allocations/allocations.router.js";
import { frontDeskRouter } from "./modules/frontDesk/frontDesk.router.js";
import { paymentsRouter } from "./modules/payments/payments.router.js";
import { reportsRouter } from "./modules/reports/reports.router.js";
import { authRouter } from "./modules/auth/auth.router.js";

export function createApp(): Express {
  const app = express();

  // Security & Standard Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(requestLogger);

  // Health Checks
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "healthy" });
  });

  app.get("/health/ready", async (_req: Request, res: Response) => {
    const isDbHealthy = await checkDatabaseHealth();
    if (!isDbHealthy) {
      return res.status(503).json({
        status: "unavailable",
      });
    }
    return res.status(200).json({
      status: "ready",
    });
  });

  // API v1 Routes
  app.use("/api/v1", roomsRouter);
  app.use("/api/v1", availabilityRouter);
  app.use("/api/v1", reservationsRouter);
  app.use("/api/v1", allocationsRouter);
  app.use("/api/v1", frontDeskRouter);
  app.use("/api/v1", paymentsRouter);
  app.use("/api/v1", reportsRouter);
  app.use("/api/v1", authRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
