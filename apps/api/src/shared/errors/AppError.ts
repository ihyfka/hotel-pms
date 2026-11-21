import { ErrorCode, ErrorCodes } from "./errorCodes.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(
    message: string,
    code: ErrorCode = ErrorCodes.BAD_REQUEST,
    details?: unknown,
  ) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(
    message: string = "Unauthorized",
    code: ErrorCode = ErrorCodes.UNAUTHORIZED,
  ) {
    return new AppError(message, 401, code);
  }

  static forbidden(
    message: string = "Forbidden",
    code: ErrorCode = ErrorCodes.FORBIDDEN,
  ) {
    return new AppError(message, 403, code);
  }

  static notFound(
    message: string = "Resource not found",
    code: ErrorCode = ErrorCodes.NOT_FOUND,
  ) {
    return new AppError(message, 404, code);
  }

  static conflict(
    message: string,
    code: ErrorCode = ErrorCodes.CONFLICT,
    details?: unknown,
  ) {
    return new AppError(message, 409, code, details);
  }

  static unprocessable(
    message: string,
    code: ErrorCode = ErrorCodes.VALIDATION_ERROR,
    details?: unknown,
  ) {
    return new AppError(message, 422, code, details);
  }

  static internal(message: string = "An unexpected error occurred") {
    return new AppError(message, 500, ErrorCodes.INTERNAL_SERVER_ERROR);
  }
}
