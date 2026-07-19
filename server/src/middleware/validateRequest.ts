import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from './errorHandler';

/** Validates req.body against a zod schema, replacing it with the parsed (typed, defaulted) value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError('Invalid request body', 400, result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
