export type HttpErrorOptions = {
  status: number;
  message: string;
  code?: string;
};

export const createHttpError = ({ status, message, code }: HttpErrorOptions) => {
  const error = new Error(message) as Error & { status?: number; code?: string };
  error.status = status;
  if (code) {
    error.code = code;
  }
  return error;
};
