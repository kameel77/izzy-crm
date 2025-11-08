export type HttpErrorOptions = {
  status: number;
  message: string;
  code?: string;
  meta?: Record<string, unknown>;
  retryAfterSeconds?: number;
};

type HttpErrorShape = Error & {
  status?: number;
  code?: string;
  meta?: Record<string, unknown>;
  retryAfterSeconds?: number;
};

export const createHttpError = ({
  status,
  message,
  code,
  meta,
  retryAfterSeconds,
}: HttpErrorOptions) => {
  const error = new Error(message) as HttpErrorShape;
  error.status = status;
  if (code) {
    error.code = code;
  }
  if (meta) {
    error.meta = meta;
  }
  if (typeof retryAfterSeconds === "number") {
    error.retryAfterSeconds = retryAfterSeconds;
  }
  return error;
};
