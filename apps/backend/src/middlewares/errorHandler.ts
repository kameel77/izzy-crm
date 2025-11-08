import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

type ErrorWithStatus = Error & {
  status?: number;
  code?: string;
  meta?: unknown;
  retryAfterSeconds?: number;
};

export const errorHandler = (
  err: ErrorWithStatus,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: err.issues });
  }

  const status = err.status ?? 500;
  const message = status === 500 ? "Internal server error" : err.message;

  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  if (typeof err.retryAfterSeconds === "number") {
    res.setHeader("Retry-After", String(err.retryAfterSeconds));
  }

  const payload: { message: string; code?: string; details?: unknown } = { message };
  if (err.code) {
    payload.code = err.code;
  }

  if (typeof err.meta !== "undefined") {
    payload.details = err.meta;
  }

  return res.status(status).json(payload);
};
