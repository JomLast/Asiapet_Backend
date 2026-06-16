import { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@shared/types';

/** Tagged error class used throughout the app for predictable HTTP responses. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Central error-handling middleware — must be mounted LAST in Express. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ApiError = {
      error: err.errorCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown / unhandled errors
  console.error('[error]', err);
  const body: ApiError = {
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  };
  res.status(500).json(body);
}
