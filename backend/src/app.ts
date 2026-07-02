import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { authRouter } from './features/auth/auth.routes.js';
import { healthRouter } from './features/health/health.routes.js';
import { interviewSessionRouter } from './features/interview-session/interview-session.routes.js';
import { profileRouter } from './features/profile/profile.routes.js';
import { progressRouter } from './features/progress/progress.routes.js';
import { problemsRouter } from './features/problems/problems.routes.js';
import { voiceRouter } from './features/voice/voice.routes.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser(env.sessionSecret));

  app.get('/', (_request, response) => {
    response.json({
      name: 'AI Interviewer API',
      status: 'ready',
    });
  });

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/profile', profileRouter);
  app.use('/progress', progressRouter);
  app.use('/problems', problemsRouter);
  app.use('/interviews', interviewSessionRouter);
  app.use('/voice', voiceRouter);
  app.use(errorHandler);

  return app;
};
