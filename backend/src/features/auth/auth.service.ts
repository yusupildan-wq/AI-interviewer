import { randomBytes } from 'node:crypto';

import type { User } from '@ai-interviewer/shared';
import { eq } from 'drizzle-orm';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { authSessions, users } from '../../db/schema.js';
import { HttpError } from '../../shared/http-error.js';
import { hashPassword, verifyPassword } from './password.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const toUser = (row: typeof users.$inferSelect): User => ({
  id: row.id,
  email: row.email,
  name: row.name ?? undefined,
  createdAt: row.createdAt.toISOString(),
});

export const signUp = async (email: string, password: string, name?: string): Promise<User> => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) {
    throw new HttpError(409, 'An account with that email already exists.');
  }

  const passwordHash = await hashPassword(password);
  const trimmedName = name?.trim();

  const [row] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, name: trimmedName || null })
    .returning();

  if (!row) {
    throw new HttpError(500, 'Could not create account.');
  }

  return toUser(row);
};

export const logIn = async (email: string, password: string): Promise<User> => {
  const normalizedEmail = email.trim().toLowerCase();

  const row = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (!row) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const isValid = await verifyPassword(password, row.passwordHash);
  if (!isValid) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  return toUser(row);
};

const DEV_USER_EMAIL = 'dev@local.test';
const DEV_USER_PASSWORD = 'dev-local-password';

/** Local-only convenience: seeds (or reuses) a fixed dev account so the app is usable without signing up. */
export const ensureDevUser = async (): Promise<User> => {
  const existing = await db.query.users.findFirst({ where: eq(users.email, DEV_USER_EMAIL) });
  if (existing) {
    return toUser(existing);
  }

  const passwordHash = await hashPassword(DEV_USER_PASSWORD);
  const [row] = await db
    .insert(users)
    .values({ email: DEV_USER_EMAIL, passwordHash, name: 'Dev User' })
    .returning();

  if (!row) {
    throw new HttpError(500, 'Could not create dev account.');
  }

  return toUser(row);
};

export const createAuthSession = async (
  userId: string,
): Promise<{ token: string; expiresAt: Date }> => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.sessionTtlMs);

  await db.insert(authSessions).values({ id: token, userId, expiresAt });

  return { token, expiresAt };
};

export const getUserByToken = async (token: string): Promise<User | undefined> => {
  const rows = await db
    .select({ user: users, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(eq(authSessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return undefined;
  }

  return toUser(row.user);
};

export const deleteAuthSession = async (token: string): Promise<void> => {
  await db.delete(authSessions).where(eq(authSessions.id, token));
};
