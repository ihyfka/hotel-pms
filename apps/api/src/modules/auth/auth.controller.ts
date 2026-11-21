import { Request, Response, NextFunction } from "express";
import { authService, AuthService } from "./auth.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ErrorCodes } from "../../shared/errors/errorCodes.js";

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body;
      if (!email) {
        throw AppError.badRequest(
          "Email is required for login",
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const result = await this.service.login(email, password, role);

      return res.status(200).json({
        success: true,
        data: result,
        message: "Authentication successful",
      });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw AppError.unauthorized(
          "Not authenticated",
          ErrorCodes.UNAUTHORIZED,
        );
      }

      return res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const authController = new AuthController();
