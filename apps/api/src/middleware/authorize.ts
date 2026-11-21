import { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/AppError.js";
import { ErrorCodes } from "../shared/errors/errorCodes.js";

export function authorize(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        AppError.unauthorized(
          "Authentication required",
          ErrorCodes.UNAUTHORIZED,
        ),
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          "You are not authorized to access this resource",
          ErrorCodes.FORBIDDEN,
        ),
      );
    }

    return next();
  };
}
