import { NextFunction, Request, Response } from "express";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}

const buckets = new Map<string, number[]>();

export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    keyPrefix = "rl",
    message = "Too many requests, please try again later.",
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "test" && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== "true") {
      return next();
    }

    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;

    const timestamps = buckets.get(key) ?? [];
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= max) {
      const oldest = validTimestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        code: "TOO_MANY_REQUESTS",
        message,
        retryAfterSeconds,
      });
    }

    validTimestamps.push(now);
    buckets.set(key, validTimestamps);

    if (buckets.size > 5000) {
      for (const [k, list] of buckets.entries()) {
        const active = list.filter((ts) => now - ts < windowMs);
        if (active.length === 0) {
          buckets.delete(k);
        } else {
          buckets.set(k, active);
        }
      }
    }

    return next();
  };
};
