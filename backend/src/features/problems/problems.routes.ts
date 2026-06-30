import type { InterviewMode } from '@ai-interviewer/shared';
import { Router } from 'express';

import { candidateSafeProblem, findProblemsByMode, problems } from './problems.data.js';

export const problemsRouter = Router();

problemsRouter.get('/', (request, response) => {
  const mode = request.query.mode as InterviewMode | undefined;
  const results = mode ? findProblemsByMode(mode) : problems;
  response.json(results.map(candidateSafeProblem));
});
