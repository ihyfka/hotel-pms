import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors/AppError.js";
import { ErrorCodes } from "../shared/errors/errorCodes.js";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: string;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      AppError.unauthorized(
        "Missing or invalid Authorization header",
        ErrorCodes.UNAUTHORIZED,
      ),
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    return next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return next(
        AppError.unauthorized("Token expired", ErrorCodes.UNAUTHORIZED),
      );
    }
    return next(
      AppError.unauthorized(
        "Invalid authentication token",
        ErrorCodes.UNAUTHORIZED,
      ),
    );
  }
}

/**
 * Optional authentication middleware for endpoints accessible publicly or with extra features when authenticated.
 */
export function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
  } catch {
    // Ignore invalid tokens on optional auth
  }
  return next();
}
