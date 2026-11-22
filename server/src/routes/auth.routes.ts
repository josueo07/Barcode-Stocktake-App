import { Router } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validateRequest';
import { LoginThrottle, login, normalizeUsername, revokeToken } from '../services/auth.service';

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

  router.post('/logout', requireAuth(db), (req, res) => {
    if (req.authToken) revokeToken(db, req.authToken);
    res.status(204).end();
  });

  return router;
}
