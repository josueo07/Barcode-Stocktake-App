import { eq } from 'drizzle-orm';
import { stocktakeSessions } from '../src/db/schema';
import type { AppDatabase } from '../src/db/client';
import { createApp } from '../src/app';
import { createUser, login } from '../src/services/auth.service';
import type { UserRole } from '@barcode-stocktake/shared';
import { createTestDatabase } from './testDb';

export const TEST_PIN = 'test-pin-123';

/** Creates a user and returns an Authorization header object for supertest's `.set()`. */
export function signIn(db: AppDatabase, username: string, role: UserRole) {
  createUser(db, { username, displayName: username, role, pin: TEST_PIN });
  const result = login(db, username, TEST_PIN)!;
  return {
    header: { Authorization: `Bearer ${result.token}` },
    token: result.token,
    user: result.user,
  };
}

export function createTestApp() {
  const { db, sqlite } = createTestDatabase();
  const app = createApp({ db });
  const supervisor = signIn(db, 'supervisor', 'supervisor');
  const counter = signIn(db, 'counter', 'counter');
  /** Supervisor auth header — the default for existing tests that exercise every endpoint. */
  const auth = supervisor.header;
  return { app, db, sqlite, auth, supervisor, counter };
}

/** Starts a session directly in the database (scans are only counted in active sessions). */
export function activateSession(db: AppDatabase, sessionId: number) {
  db.update(stocktakeSessions)
    .set({ status: 'active' })
    .where(eq(stocktakeSessions.id, sessionId))
    .run();
}
