import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger';

/** Thrown deliberately by services/controllers for expected failure cases (validation, 404s, conflicts). */
export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, err.message);
    }
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { message: 'Internal server error' } });
};
