import type { User } from '@ai-interviewer/shared';
import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../../shared/http-error.js';
import { getUserByToken } from './auth.service.js';

export const SESSION_COOKIE_NAME = 'ai_interviewer_session';

export interface AuthenticatedRequest extends Request {
  user: User;
}

export const requireAuth = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = request.signedCookies[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new HttpError(401, 'Sign in required.');
    }

    const user = await getUserByToken(token);
    if (!user) {
      throw new HttpError(401, 'Session expired. Sign in again.');
    }

    (request as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
};
