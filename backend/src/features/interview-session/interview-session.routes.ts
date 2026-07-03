import type {
  CreateInterviewRequest,
  DecisionEngineInput,
  FeedbackFollowUpRequest,
  InterviewMode,
  InterviewSession,
  InterviewerStrictness,
  SubmitTurnRequest,
  SubmitTurnResponse,
  TranscriptEntry,
} from '@ai-interviewer/shared';
import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import type { AuthenticatedRequest } from '../auth/auth.middleware.js';
import { runDecisionEngine } from '../decision-engine/decision-engine.service.js';
import { computeCandidateSignals } from '../decision-engine/signals.js';
import { findCachedFeedbackReport, saveFeedbackReport } from '../feedback/feedback.repository.js';
import { answerFeedbackFollowUp, generateFeedbackReport } from '../feedback/feedback.service.js';
import { getOrCreateUserProfile } from '../profile/profile.service.js';
import { candidateSafeProblem } from '../problems/problems.data.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { HttpError } from '../../shared/http-error.js';
import { requireParam } from '../../shared/require-param.js';
import {
  appendCandidateMessage,
  appendInterviewerMessage,
  applyCandidateSignalsToPlan,
  applyInterviewMemoryUpdate,
  applyScoreImpact,
  createSession,
  deleteAllSessionsForUser,
  deleteSessionForUser,
  endSession,
  getSession,
  listSessionsForUser,
} from './session.service.js';

const VALID_MODES: InterviewMode[] = [
  'behavioral',
  'coding',
  'system-design',
  'resume-deep-dive',
  'conversation',
];
const VALID_STRICTNESS: InterviewerStrictness[] = ['coffee-chat', 'standard', 'strict'];

const toCandidateSession = (session: InterviewSession) => ({
  ...session,
  problem: candidateSafeProblem(session.problem),
});

/** Ownership check: a session ID is guessable-random but not secret, so every
 * route that operates on one must confirm it belongs to the calling user. */
const requireOwnedSession = async (
  sessionId: string,
  userId: string,
): Promise<InterviewSession> => {
  const session = await getSession(sessionId);
  if (session.userId !== userId) {
    throw new HttpError(404, `Interview session not found: ${sessionId}`);
  }
  return session;
};

export const interviewSessionRouter = Router();

interviewSessionRouter.use(requireAuth);

interviewSessionRouter.get(
  '/',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const sessions = await listSessionsForUser(user.id);
    response.json(sessions);
  }),
);

interviewSessionRouter.post(
  '/',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const body = request.body as Partial<CreateInterviewRequest>;

    if (!body.mode || !VALID_MODES.includes(body.mode)) {
      throw new HttpError(400, `mode must be one of: ${VALID_MODES.join(', ')}`);
    }

    if (body.strictness && !VALID_STRICTNESS.includes(body.strictness)) {
      throw new HttpError(400, `strictness must be one of: ${VALID_STRICTNESS.join(', ')}`);
    }

    const profile = await getOrCreateUserProfile(user.id);
    const session = await createSession(
      user.id,
      body.mode,
      body.problemId,
      body.strictness,
      profile,
    );
    response.status(201).json(toCandidateSession(session));
  }),
);

interviewSessionRouter.delete(
  '/',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const deletedCount = await deleteAllSessionsForUser(user.id);
    response.json({ deletedCount });
  }),
);

interviewSessionRouter.get(
  '/:id',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const session = await requireOwnedSession(requireParam(request.params.id, 'id'), user.id);
    response.json(toCandidateSession(session));
  }),
);

interviewSessionRouter.delete(
  '/:id',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const sessionId = requireParam(request.params.id, 'id');
    await deleteSessionForUser(sessionId, user.id);
    response.status(204).send();
  }),
);

interviewSessionRouter.post(
  '/:id/turns',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const sessionId = requireParam(request.params.id, 'id');
    const body = request.body as Partial<SubmitTurnRequest>;
    const message = typeof body.message === 'string' ? body.message : '';
    const code = typeof body.code === 'string' ? body.code : undefined;

    if (!message && code === undefined) {
      throw new HttpError(400, 'Request must include a message and/or code.');
    }

    const sessionBeforeTurn = await requireOwnedSession(sessionId, user.id);
    if (sessionBeforeTurn.status !== 'active') {
      throw new HttpError(409, `Interview session is already completed: ${sessionId}`);
    }
    const previousActivityAt = sessionBeforeTurn.lastActivityAt;

    const {
      session: sessionAfterCandidateTurn,
      entry,
      codeSnapshot,
    } = await appendCandidateMessage(sessionId, message, code);

    const candidateSignals = computeCandidateSignals({
      previousActivityAt,
      codeHistory: sessionAfterCandidateTurn.codeHistory,
      message,
      latestCodeSnapshot: codeSnapshot,
    });
    const sessionAfterPlanUpdate = await applyCandidateSignalsToPlan(
      sessionId,
      candidateSignals,
      code,
    );

    const elapsedMs = Date.now() - new Date(sessionAfterPlanUpdate.startedAt).getTime();
    const previousInterventions: TranscriptEntry[] = sessionAfterPlanUpdate.transcript.filter(
      (item) => item.role === 'interviewer',
    );

    const decisionInput: DecisionEngineInput = {
      mode: sessionAfterPlanUpdate.mode,
      strictness: sessionAfterPlanUpdate.strictness,
      problem: sessionAfterPlanUpdate.problem,
      persona: sessionAfterPlanUpdate.persona,
      plan: sessionAfterPlanUpdate.plan,
      memory: sessionAfterPlanUpdate.memory,
      transcript: sessionAfterPlanUpdate.transcript,
      currentCandidateMessage: message,
      currentCode: code,
      elapsedMs,
      candidateSignals,
      previousInterventions,
    };

    const decision = await runDecisionEngine(decisionInput);

    const sessionAfterScoring = await applyScoreImpact(sessionId, decision.scoreImpact);

    let interventionEntry: TranscriptEntry | undefined;
    if (decision.shouldIntervene && decision.messageToCandidate) {
      interventionEntry = (
        await appendInterviewerMessage(
          sessionId,
          decision.messageToCandidate,
          decision.interventionType,
        )
      ).entry;
    }

    await applyInterviewMemoryUpdate(sessionId, candidateSignals, decision, code);

    const result: SubmitTurnResponse = {
      transcriptEntry: entry,
      interventionEntry,
      decision,
      scores: sessionAfterScoring.scores,
      plan: sessionAfterPlanUpdate.plan,
    };

    response.json(result);
  }),
);

interviewSessionRouter.post(
  '/:id/end',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const sessionId = requireParam(request.params.id, 'id');
    await requireOwnedSession(sessionId, user.id);
    const session = await endSession(sessionId);
    response.json(toCandidateSession(session));
  }),
);

interviewSessionRouter.get(
  '/:id/report',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const sessionId = requireParam(request.params.id, 'id');
    const session = await requireOwnedSession(sessionId, user.id);

    if (session.status !== 'completed') {
      throw new HttpError(409, 'End the interview before requesting a feedback report.');
    }

    const cached = await findCachedFeedbackReport(sessionId);
    if (cached) {
      response.json(cached);
      return;
    }

    const report = await generateFeedbackReport(session);
    await saveFeedbackReport(report);
    response.json(report);
  }),
);

interviewSessionRouter.post(
  '/:id/report/follow-up',
  asyncHandler(async (request, response) => {
    const { user } = request as AuthenticatedRequest;
    const sessionId = requireParam(request.params.id, 'id');
    const body = request.body as Partial<FeedbackFollowUpRequest>;
    const question = typeof body.question === 'string' ? body.question : '';

    const session = await requireOwnedSession(sessionId, user.id);
    if (session.status !== 'completed') {
      throw new HttpError(409, 'End the interview before asking report follow-up questions.');
    }

    let report = await findCachedFeedbackReport(sessionId);
    if (!report) {
      report = await generateFeedbackReport(session);
      await saveFeedbackReport(report);
    }

    const answer = await answerFeedbackFollowUp(session, report, question);
    response.json({ answer });
  }),
);
