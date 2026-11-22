import crypto from 'node:crypto';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import type { AuthUser, UserRole } from '@barcode-stocktake/shared';
import type { AppDatabase } from '../db/client';
import { authTokens, users } from '../db/schema';
import { AppError } from '../middleware/errorHandler';

/** How long a login stays valid. Long enough to cover a full overnight count. */
export const TOKEN_TTL_MS = 16 * 60 * 60 * 1000;
export const MIN_PIN_LENGTH = 6;

const SCRYPT_KEYLEN = 32;

type UserRow = typeof users.$inferSelect;

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  role: UserRole;
  pin: string;
}

export function createUser(db: AppDatabase, input: CreateUserInput): AuthUser {
  if (input.pin.length < MIN_PIN_LENGTH) {
    throw new AppError(`El PIN debe tener al menos ${MIN_PIN_LENGTH} caracteres.`, 400);
  }
  if (input.role === 'supervisor') assertNoOtherSupervisor(db);
  const username = normalizeUsername(input.username);
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    throw new AppError(`Ya existe el usuario "${username}".`, 409);
  }
  const row = db
    .insert(users)
    .values({
      username,
      displayName: input.displayName.trim(),
      role: input.role,
      pinHash: hashPin(input.pin),
    })
    .returning()
    .get();
  return toAuthUser(row);
}

/**
 * The pharmacy runs each count with exactly one supervisor and any number of counters.
 * Throws 409 if another active supervisor exists (pass the id being changed to ignore it).
 */
export function assertNoOtherSupervisor(db: AppDatabase, exceptUserId?: number): void {
  const other = db
    .select()
    .from(users)
    .where(and(eq(users.role, 'supervisor'), eq(users.active, true)))
    .all()
    .find((u) => u.id !== exceptUserId);
  if (other) {
    throw new AppError(
      `Ya hay un supervisor (${other.displayName}). Solo puede haber uno; añade a esta persona como contador.`,
      409,
    );
  }
}

/** Revokes every token of a user except the one given (e.g. after changing their own PIN). */
export function revokeOtherTokens(db: AppDatabase, userId: number, keepToken: string): void {
  db.delete(authTokens)
    .where(and(eq(authTokens.userId, userId), ne(authTokens.tokenHash, hashToken(keepToken))))
    .run();
}

/** Checks credentials and issues a new bearer token. Returns null on any failure. */
export function login(
  db: AppDatabase,
  username: string,
  pin: string,
  now = new Date(),
): { token: string; user: AuthUser; expiresAt: string } | null {
  const row = db
    .select()
    .from(users)
    .where(eq(users.username, normalizeUsername(username)))
    .get();
  // Always run a hash comparison so response time doesn't reveal whether the user exists.
  const ok = verifyPin(pin, row?.pinHash ?? hashPin('dummy-pin-for-timing'));
  if (!row || !row.active || !ok) return null;

  // Opportunistically clear expired tokens.
  db.delete(authTokens).where(lt(authTokens.expiresAt, now.toISOString())).run();

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();
  db.insert(authTokens)
    .values({ tokenHash: hashToken(token), userId: row.id, expiresAt })
    .run();
  return { token, user: toAuthUser(row), expiresAt };
}

/** Resolves a bearer token to its active user, or null if invalid, expired, or deactivated. */
export function authenticateToken(
  db: AppDatabase,
  token: string,
  now = new Date(),
): AuthUser | null {
  const found = db
    .select({ user: users })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .where(
      and(eq(authTokens.tokenHash, hashToken(token)), gt(authTokens.expiresAt, now.toISOString())),
    )
    .get();
  if (!found || !found.user.active) return null;
  return toAuthUser(found.user);
}

export function revokeToken(db: AppDatabase, token: string): void {
  db.delete(authTokens)
    .where(eq(authTokens.tokenHash, hashToken(token)))
    .run();
}

export function revokeAllTokensForUser(db: AppDatabase, userId: number): void {
  db.delete(authTokens).where(eq(authTokens.userId, userId)).run();
}

/**
 * Small in-memory brute-force guard: after MAX_FAILURES failed logins for the same
 * username, further attempts are refused until LOCK_MS has passed.
 */
export class LoginThrottle {
  private failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private readonly maxFailures = 5,
    private readonly lockMs = 5 * 60 * 1000,
  ) {}

  isLocked(key: string, now = Date.now()): boolean {
    const entry = this.failures.get(key);
    return !!entry && entry.lockedUntil > now;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.failures.get(key) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= this.maxFailures) {
      entry.lockedUntil = now + this.lockMs;
      entry.count = 0;
    }
    this.failures.set(key, entry);
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }
}
