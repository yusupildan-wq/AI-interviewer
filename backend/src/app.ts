import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { healthRouter } from './features/health/health.routes.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
    }),
  );
  app.use(express.json());

  app.get('/', (_request, response) => {
    response.json({
      name: 'AI Interviewer API',
      status: 'ready',
    });
  });

  app.use('/health', healthRouter);
  app.use(errorHandler);

  return app;
};
