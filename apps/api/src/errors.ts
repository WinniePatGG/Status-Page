import type { FastifyError } from "fastify";
import type { ApiErrorBody } from "@status-page/shared";

export class HttpError extends Error {
  code: string;
  override message: string;
  statusCode: number;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: unknown,
  ) {
    super(message);
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
  }
}
export const errors = {
  notFound: (message = "Not found") => new HttpError("NOT_FOUND", message, 404),
  badRequest: (message = "Bad request", details?: unknown) =>
    new HttpError("BAD_REQUEST", message, 400, details),
  unauthorized: (message = "Unauthorized") =>
    new HttpError("UNAUTHORIZED", message, 401),
  forbidden: (message = "Forbidden") =>
    new HttpError("FORBIDDEN", message, 403),
  conflict: (message = "Conflict", details?: unknown) =>
    new HttpError("CONFLICT", message, 409, details),
  internal: (message = "Internal server error", details?: unknown) =>
    new HttpError("INTERNAL_ERROR", message, 500, details),
};

export function formatError(
  error: FastifyError | HttpError,
  requestId?: string,
): ApiErrorBody {
  if (error instanceof HttpError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  const err = error as any;
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
      ...(process.env.NODE_ENV !== "production" && err.stack
        ? { details: { stack: err.stack, requestId } }
        : {}),
    },
  };
}
