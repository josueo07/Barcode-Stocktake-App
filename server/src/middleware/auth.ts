import type { Request, RequestHandler } from 'express';
import type { AuthUser, UserRole } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { authenticateToken } from '../services/auth.service';
import { AppError } from './errorHandler';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    authToken?: string;
  }
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Rejects the request with 401 unless it carries a valid, unexpired bearer token. */
export function requireAuth(db: AppDatabase): RequestHandler {
  return (req, _res, next) => {
    const token = readBearerToken(req.headers.authorization);
    const user = token ? authenticateToken(db, token) : null;
    if (!token || !user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    req.user = user;
    req.authToken = token;
    next();
  };
}

/** Must run after requireAuth. Rejects with 403 unless the user has one of the given roles. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to do this', 403));
      return;
    }
    next();
  };
}

export const supervisorOnly = requireRole('supervisor');

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError('Authentication required', 401);
  return req.user;
}
