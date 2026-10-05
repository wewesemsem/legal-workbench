export type AuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT";

export class AppError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly status: number;

  constructor(code: AuthorizationErrorCode, message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function unauthenticated(message = "Authentication required") {
  return new AppError("UNAUTHENTICATED", message, 401);
}

export function forbidden(message = "You are not allowed to access this resource") {
  return new AppError("FORBIDDEN", message, 403);
}

export function notFound(message = "Resource not found") {
  return new AppError("NOT_FOUND", message, 404);
}

export function validationError(message: string) {
  return new AppError("VALIDATION_ERROR", message, 400);
}

export function rateLimited(message = "Too many attempts. Please try again later.") {
  return new AppError("RATE_LIMITED", message, 429);
}

export function conflict(message: string) {
  return new AppError("CONFLICT", message, 409);
}
