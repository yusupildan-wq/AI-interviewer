import { Router } from 'express';

import { asyncHandler } from '../../shared/async-handler.js';
import type { AuthenticatedRequest } from '../auth/auth.middleware.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { getProgressOverview } from './progress.service.js';

export const progressRouter = Router();

progressRouter.use(requireAuth);

progressRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    response.json(await getProgressOverview(user.id));
  }),
);
