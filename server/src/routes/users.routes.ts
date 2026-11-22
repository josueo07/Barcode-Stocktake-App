import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { UserSummary } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { users } from '../db/schema';
import { currentUser, supervisorOnly } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validateRequest';
import {
  MIN_PIN_LENGTH,
  assertNoOtherSupervisor,
  createUser,
  hashPin,
  revokeAllTokensForUser,
} from '../services/auth.service';

const roleSchema = z.enum(['supervisor', 'counter']);

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Usa letras, números, punto, guion o guion bajo'),
  displayName: z.string().trim().min(1).max(100),
  role: roleSchema,
  pin: z.string().min(MIN_PIN_LENGTH).max(128),
});

const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  pin: z.string().min(MIN_PIN_LENGTH).max(128).optional(),
});

function toSummary(row: typeof users.$inferSelect): UserSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
  };
}

/** User management. All routes are supervisor-only. */
export function createUsersRouter(db: AppDatabase): Router {
  const router = Router();
  router.use(supervisorOnly);

  router.get('/', (_req, res) => {
    res.json({ users: db.select().from(users).orderBy(users.displayName).all().map(toSummary) });
  });

  router.post('/', validateBody(createUserSchema), (req, res, next) => {
    try {
      const user = createUser(db, req.body as z.infer<typeof createUserSchema>);
      const row = db.select().from(users).where(eq(users.id, user.id)).get()!;
      res.status(201).json({ user: toSummary(row) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', validateBody(updateUserSchema), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const body = req.body as z.infer<typeof updateUserSchema>;
      const existing = db.select().from(users).where(eq(users.id, id)).get();
      if (!existing) throw new AppError(`No existe la persona ${id}.`, 404);

      const me = currentUser(req);
      if (me.id === id && (body.active === false || (body.role && body.role !== 'supervisor'))) {
        throw new AppError(
          'No puedes desactivar ni quitarte el rol de supervisor a ti mismo.',
          400,
        );
      }

      const becomesActiveSupervisor =
        (body.role ?? existing.role) === 'supervisor' && (body.active ?? existing.active);
      const wasActiveSupervisor = existing.role === 'supervisor' && existing.active;
      if (becomesActiveSupervisor && !wasActiveSupervisor) assertNoOtherSupervisor(db, id);

      const row = db
        .update(users)
        .set({
          displayName: body.displayName ?? existing.displayName,
          role: body.role ?? existing.role,
          active: body.active ?? existing.active,
          pinHash: body.pin ? hashPin(body.pin) : existing.pinHash,
        })
        .where(eq(users.id, id))
        .returning()
        .get();

      // Sign the user out everywhere when they're deactivated, demoted, or their PIN changes.
      if (body.active === false || body.pin || (body.role && body.role !== existing.role)) {
        revokeAllTokensForUser(db, id);
      }
      res.json({ user: toSummary(row) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
