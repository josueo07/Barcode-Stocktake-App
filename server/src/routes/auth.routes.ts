import { Router } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validateRequest';
import { and, eq, sql } from 'drizzle-orm';
import type { ProfileStats } from '@barcode-stocktake/shared';
import { scanEvents, users } from '../db/schema';
import {
  LoginThrottle,
  MIN_PIN_LENGTH,
  hashPin,
  login,
  normalizeUsername,
  revokeOtherTokens,
  revokeToken,
  toAuthUser,
  verifyPin,
} from '../services/auth.service';

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  pin: z.string().min(1).max(128),
});

export function createAuthRouter(db: AppDatabase, throttle = new LoginThrottle()): Router {
  const router = Router();

  router.post('/login', validateBody(loginSchema), (req, res, next) => {
    const { username, pin } = req.body as z.infer<typeof loginSchema>;
    const key = normalizeUsername(username);
    if (throttle.isLocked(key)) {
      next(new AppError('Demasiados intentos fallidos. Intenta de nuevo en unos minutos.', 429));
      return;
    }
    const result = login(db, username, pin);
    if (!result) {
      throttle.recordFailure(key);
      next(new AppError('Usuario o PIN incorrecto.', 401));
      return;
    }
    throttle.recordSuccess(key);
    res.json(result);
  });

  router.get('/me', requireAuth(db), (req, res) => {
    res.json({ user: req.user });
  });

  // Profile: every user (supervisor or counter) can see their own data and change their PIN.
  router.patch(
    '/me',
    requireAuth(db),
    validateBody(z.object({ displayName: z.string().trim().min(1).max(100) })),
    (req, res) => {
      const row = db
        .update(users)
        .set({ displayName: (req.body as { displayName: string }).displayName })
        .where(eq(users.id, req.user!.id))
        .returning()
        .get();
      res.json({ user: toAuthUser(row) });
    },
  );

  router.post(
    '/me/pin',
    requireAuth(db),
    validateBody(
      z.object({
        currentPin: z.string().min(1).max(128),
        newPin: z.string().min(MIN_PIN_LENGTH).max(128),
      }),
    ),
    (req, res, next) => {
      const { currentPin, newPin } = req.body as { currentPin: string; newPin: string };
      const row = db.select().from(users).where(eq(users.id, req.user!.id)).get()!;
      if (!verifyPin(currentPin, row.pinHash)) {
        next(new AppError('El PIN actual no es correcto.', 400));
        return;
      }
      db.update(users)
        .set({ pinHash: hashPin(newPin) })
        .where(eq(users.id, row.id))
        .run();
      // Other phones signed in as this person must log in again with the new PIN.
      revokeOtherTokens(db, row.id, req.authToken!);
      res.status(204).end();
    },
  );

  router.get('/me/stats', requireAuth(db), (req, res) => {
    const mine = and(eq(scanEvents.userId, req.user!.id), eq(scanEvents.late, false));
    const totals = db
      .select({
        scans: sql<number>`count(*)`,
        units: sql<number>`coalesce(sum(${scanEvents.quantity}), 0)`,
        sessions: sql<number>`count(distinct ${scanEvents.sessionId})`,
        lastScanAt: sql<string | null>`max(${scanEvents.scannedAt})`,
      })
      .from(scanEvents)
      .where(mine)
      .get();
    const stats: ProfileStats = {
      scans: totals?.scans ?? 0,
      units: totals?.units ?? 0,
      sessions: totals?.sessions ?? 0,
      lastScanAt: totals?.lastScanAt ?? null,
    };
    res.json({ stats });
  });

  router.post('/logout', requireAuth(db), (req, res) => {
    if (req.authToken) revokeToken(db, req.authToken);
    res.status(204).end();
  });

  return router;
}
