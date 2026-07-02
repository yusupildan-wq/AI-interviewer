import type { UpdateUserProfileRequest } from '@ai-interviewer/shared';
import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import type { AuthenticatedRequest } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { getOrCreateUserProfile, updateUserProfile } from './profile.service.js';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const profile = await getOrCreateUserProfile(user.id);
    response.json(profile);
  }),
);

profileRouter.put(
  '/',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const body = request.body as Partial<UpdateUserProfileRequest>;
    const profile = await updateUserProfile(user.id, body);
    response.json(profile);
  }),
);
