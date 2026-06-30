import type {
  CreateInterviewRequest,
  DecisionEngineInput,
  InterviewMode,
  InterviewSession,
  SubmitTurnRequest,
  SubmitTurnResponse,
  TranscriptEntry,
} from '@ai-interviewer/shared';
import { Router } from 'express';

import { runDecisionEngine } from '../decision-engine/decision-engine.service.js';
import { computeCandidateSignals } from '../decision-engine/signals.js';
import { generateFeedbackReport } from '../feedback/feedback.service.js';
import { candidateSafeProblem } from '../problems/problems.data.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { HttpError } from '../../shared/http-error.js';
import { requireParam } from '../../shared/require-param.js';
import {
  appendCandidateMessage,
  appendInterviewerMessage,
  applyScoreImpact,
  createSession,
  endSession,
  getSession,
  requireActiveSession,
} from './session.service.js';

const VALID_MODES: InterviewMode[] = ['behavioral', 'coding', 'system-design', 'resume-deep-dive'];

const toCandidateSession = (session: InterviewSession) => ({
  ...session,
  problem: candidateSafeProblem(session.problem),
});

export const interviewSessionRouter = Router();

interviewSessionRouter.post('/', (request, response) => {
  const body = request.body as Partial<CreateInterviewRequest>;

  if (!body.mode || !VALID_MODES.includes(body.mode)) {
    throw new HttpError(400, `mode must be one of: ${VALID_MODES.join(', ')}`);
  }

  const session = createSession(body.mode, body.problemId);
  response.status(201).json(toCandidateSession(session));
});

interviewSessionRouter.get('/:id', (request, response) => {
  const session = getSession(requireParam(request.params.id, 'id'));
  response.json(toCandidateSession(session));
});

interviewSessionRouter.post(
  '/:id/turns',
  asyncHandler(async (request, response) => {
    const sessionId = requireParam(request.params.id, 'id');
    const body = request.body as Partial<SubmitTurnRequest>;
    const message = typeof body.message === 'string' ? body.message : '';
    const code = typeof body.code === 'string' ? body.code : undefined;

    if (!message && code === undefined) {
      throw new HttpError(400, 'Request must include a message and/or code.');
    }

    const sessionBeforeTurn = requireActiveSession(sessionId);
    const previousActivityAt = sessionBeforeTurn.lastActivityAt;

    const {
      session: sessionAfterCandidateTurn,
      entry,
      codeSnapshot,
    } = appendCandidateMessage(sessionId, message, code);

    const candidateSignals = computeCandidateSignals({
      previousActivityAt,
      codeHistory: sessionAfterCandidateTurn.codeHistory,
      message,
      latestCodeSnapshot: codeSnapshot,
    });

    const elapsedMs = Date.now() - new Date(sessionAfterCandidateTurn.startedAt).getTime();
    const previousInterventions: TranscriptEntry[] = sessionAfterCandidateTurn.transcript.filter(
      (item) => item.role === 'interviewer',
    );

    const decisionInput: DecisionEngineInput = {
      mode: sessionAfterCandidateTurn.mode,
      problem: sessionAfterCandidateTurn.problem,
      persona: sessionAfterCandidateTurn.persona,
      transcript: sessionAfterCandidateTurn.transcript,
      currentCandidateMessage: message,
      currentCode: code,
      elapsedMs,
      candidateSignals,
      previousInterventions,
    };

    const decision = await runDecisionEngine(decisionInput);

    const sessionAfterScoring = applyScoreImpact(sessionId, decision.scoreImpact);

    let interventionEntry: TranscriptEntry | undefined;
    if (decision.shouldIntervene && decision.messageToCandidate) {
      interventionEntry = appendInterviewerMessage(
        sessionId,
        decision.messageToCandidate,
        decision.interventionType,
      ).entry;
    }

    const result: SubmitTurnResponse = {
      transcriptEntry: entry,
      interventionEntry,
      decision,
      scores: sessionAfterScoring.scores,
    };

    response.json(result);
  }),
);

interviewSessionRouter.post('/:id/end', (request, response) => {
  const session = endSession(requireParam(request.params.id, 'id'));
  response.json(toCandidateSession(session));
});

interviewSessionRouter.get(
  '/:id/report',
  asyncHandler(async (request, response) => {
    const session = getSession(requireParam(request.params.id, 'id'));

    if (session.status !== 'completed') {
      throw new HttpError(409, 'End the interview before requesting a feedback report.');
    }

    const report = await generateFeedbackReport(session);
    response.json(report);
  }),
);
