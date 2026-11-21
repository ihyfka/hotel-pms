import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const logData = {
      method,
      path: originalUrl,
      statusCode,
      duration: `${duration}ms`,
    };

    if (statusCode >= 500) {
      logger.error(logData, "HTTP Request Error");
    } else if (statusCode >= 400) {
      logger.warn(logData, "HTTP Client Error");
    } else {
      logger.info(logData, "HTTP Request");
    }
  });

  next();
}
