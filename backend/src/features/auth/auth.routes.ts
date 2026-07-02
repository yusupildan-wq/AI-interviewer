import type { AuthResponse, LoginRequest, SignupRequest } from '@ai-interviewer/shared';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { HttpError } from '../../shared/http-error.js';
import { requireAuth, SESSION_COOKIE_NAME } from './auth.middleware.js';
import type { AuthenticatedRequest } from './auth.middleware.js';
import {
  createAuthSession,
  deleteAuthSession,
  ensureDevUser,
  logIn,
  signUp,
} from './auth.service.js';

export const authRouter = Router();

const cookieOptions = (expiresAt?: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
  signed: true,
  ...(expiresAt ? { expires: expiresAt } : {}),
});

authRouter.post(
  '/signup',
  asyncHandler(async (request, response) => {
    const body = request.body as Partial<SignupRequest>;
    if (!body.email || !body.password) {
      throw new HttpError(400, 'Email and password are required.');
    }

    const user = await signUp(body.email, body.password, body.name);
    const { token, expiresAt } = await createAuthSession(user.id);

    response.cookie(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
    const result: AuthResponse = { user };
    response.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (request, response) => {
    const body = request.body as Partial<LoginRequest>;
    if (!body.email || !body.password) {
      throw new HttpError(400, 'Email and password are required.');
    }

    const user = await logIn(body.email, body.password);
    const { token, expiresAt } = await createAuthSession(user.id);

    response.cookie(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
    const result: AuthResponse = { user };
    response.json(result);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (request, response) => {
    const token = request.signedCookies[SESSION_COOKIE_NAME] as string | undefined;
    if (token) {
      await deleteAuthSession(token);
    }
    response.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
    response.status(204).send();
  }),
);

authRouter.get('/me', requireAuth, (request, response) => {
  const result: AuthResponse = { user: (request as AuthenticatedRequest).user };
  response.json(result);
});

// Local-only convenience: signs in as a fixed seeded account so the app is usable without a
// signup flow while developing. Never mounted in production (see env.nodeEnv guard below).
if (env.nodeEnv !== 'production') {
  authRouter.post(
    '/dev-login',
    asyncHandler(async (_request, response) => {
      const user = await ensureDevUser();
      const { token, expiresAt } = await createAuthSession(user.id);

      response.cookie(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
      const result: AuthResponse = { user };
      response.json(result);
    }),
  );
}
