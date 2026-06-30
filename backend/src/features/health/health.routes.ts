import type { HealthStatus } from '@ai-interviewer/shared';
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  const payload: HealthStatus = {
    status: 'ok',
    service: 'ai-interviewer-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };

  response.json(payload);
});
