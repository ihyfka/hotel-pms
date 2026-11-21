import { Request, Response, NextFunction } from "express";
import { ZodError, flattenError } from "zod";
import { AppError } from "../shared/errors/AppError.js";
import { ErrorCodes } from "../shared/errors/errorCodes.js";
import { logger } from "../config/logger.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Handled AppError
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode, details: err.details },
      err.message,
    );
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Zod Validation Error
  if (
    err instanceof ZodError ||
    err.name === "ZodError" ||
    Array.isArray((err as any).issues)
  ) {
    const zodErr = err as ZodError;
    logger.warn({ issues: zodErr.issues }, "Request validation failed");
    return res.status(422).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Invalid request data",
        details: flattenError(zodErr),
      },
    });
  }

  // PostgreSQL Errors
  const pgErr = err as any;
  if (pgErr.code === "23505") {
    // Unique violation
    return res.status(409).json({
      success: false,
      error: {
        code: ErrorCodes.CONFLICT,
        message: "A resource with this identifier already exists",
        details: pgErr.detail,
      },
    });
  }

  if (pgErr.code === "23503") {
    // Foreign key violation
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCodes.BAD_REQUEST,
        message: "Referenced entity does not exist",
        details: pgErr.detail,
      },
    });
  }

  if (pgErr.code === "23P01") {
    // Postgres exclusion violation (double booking / overlapping range)
    return res.status(409).json({
      success: false,
      error: {
        code: ErrorCodes.ROOM_ALREADY_ALLOCATED,
        message:
          "Room is already allocated for overlapping dates (exclusion constraint violation)",
        details: pgErr.detail,
      },
    });
  }

  // Unexpected internal server error
  logger.error({ err }, "Unhandled application error");
  return res.status(500).json({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    },
  });
}
