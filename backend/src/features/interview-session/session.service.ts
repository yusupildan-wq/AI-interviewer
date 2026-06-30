import { randomUUID } from 'node:crypto';

import type {
  CodeSnapshot,
  InterventionType,
  InterviewMode,
  InterviewSession,
  InterviewerPersona,
  ScoreRubric,
  TranscriptEntry,
} from '@ai-interviewer/shared';

import { HttpError } from '../../shared/http-error.js';
import { findProblemById, pickRandomProblemForMode } from '../problems/problems.data.js';
import { sessionRepository } from './session.repository.js';

const BASELINE_SCORE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

export const interviewerPersona: InterviewerPersona = {
  name: 'Alex Chen',
  styleSummary:
    'Senior staff-level FAANG interviewer. Calm, precise, and economical with words. Lets candidates think in silence, ' +
    'intervenes only when it is pedagogically or evaluatively useful, and always grounds follow-ups in something the ' +
    'candidate just said or did.',
};

const baselineScores = (): ScoreRubric => ({
  communication: BASELINE_SCORE,
  problemSolving: BASELINE_SCORE,
  technicalDepth: BASELINE_SCORE,
  confidence: BASELINE_SCORE,
});

const openingMessageForMode = (mode: InterviewMode, title: string): string => {
  if (mode === 'coding') {
    return `Hi, I am Alex. We will work through ${title} together. Start by clarifying the requirements, then talk through your approach before you code.`;
  }

  if (mode === 'system-design') {
    return `Hi, I am Alex. For ${title}, start by clarifying scope and scale before you draw the architecture.`;
  }

  if (mode === 'behavioral') {
    return `Hi, I am Alex. I am looking for one specific example with your role, the tradeoffs, and the outcome.`;
  }

  return `Hi, I am Alex. Pick a project you know deeply. I will ask about the decisions you personally made.`;
};

const clampScore = (value: number): number => Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));

const countChangedLines = (previous: string | undefined, next: string): number => {
  const previousLines = previous?.split('\n') ?? [];
  const nextLines = next.split('\n');
  const length = Math.max(previousLines.length, nextLines.length);
  let changed = 0;
  for (let i = 0; i < length; i += 1) {
    if (previousLines[i] !== nextLines[i]) {
      changed += 1;
    }
  }
  return changed;
};

export const createSession = (mode: InterviewMode, problemId?: string): InterviewSession => {
  const problem = problemId ? findProblemById(problemId) : pickRandomProblemForMode(mode);

  if (!problem) {
    throw new HttpError(
      404,
      problemId ? `Unknown problem id: ${problemId}` : `No problems available for mode: ${mode}`,
    );
  }

  const now = new Date().toISOString();

  const session: InterviewSession = {
    id: randomUUID(),
    mode,
    problem,
    persona: interviewerPersona,
    status: 'active',
    transcript: [
      {
        id: randomUUID(),
        role: 'interviewer',
        content: openingMessageForMode(mode, problem.title),
        createdAt: now,
        interventionType: 'evaluate',
      },
    ],
    codeHistory: [],
    scores: baselineScores(),
    interventionCount: 1,
    startedAt: now,
    lastActivityAt: now,
  };

  return sessionRepository.create(session);
};

export const getSession = (sessionId: string): InterviewSession => {
  const session = sessionRepository.findById(sessionId);
  if (!session) {
    throw new HttpError(404, `Interview session not found: ${sessionId}`);
  }
  return session;
};

export const requireActiveSession = (sessionId: string): InterviewSession => {
  const session = getSession(sessionId);
  if (session.status !== 'active') {
    throw new HttpError(409, `Interview session is already completed: ${sessionId}`);
  }
  return session;
};

export const appendCandidateMessage = (
  sessionId: string,
  message: string,
  code: string | undefined,
): { session: InterviewSession; entry: TranscriptEntry; codeSnapshot?: CodeSnapshot } => {
  const session = requireActiveSession(sessionId);
  const now = new Date().toISOString();

  const entry: TranscriptEntry = {
    id: randomUUID(),
    role: 'candidate',
    content: message,
    createdAt: now,
  };
  session.transcript.push(entry);

  let codeSnapshot: CodeSnapshot | undefined;
  if (code !== undefined) {
    const previous = session.codeHistory.at(-1);
    codeSnapshot = {
      id: randomUUID(),
      code,
      language: session.mode === 'coding' ? 'javascript' : 'text',
      createdAt: now,
      linesChanged: countChangedLines(previous?.code, code),
    };
    session.codeHistory.push(codeSnapshot);
  }

  session.lastActivityAt = now;
  sessionRepository.save(session);

  return { session, entry, codeSnapshot };
};

export const appendInterviewerMessage = (
  sessionId: string,
  content: string,
  interventionType: InterventionType,
): { session: InterviewSession; entry: TranscriptEntry } => {
  const session = requireActiveSession(sessionId);
  const now = new Date().toISOString();

  const entry: TranscriptEntry = {
    id: randomUUID(),
    role: 'interviewer',
    content,
    createdAt: now,
    interventionType,
  };
  session.transcript.push(entry);
  session.interventionCount += 1;
  session.lastActivityAt = now;
  sessionRepository.save(session);

  return { session, entry };
};

export const applyScoreImpact = (sessionId: string, impact: ScoreRubric): InterviewSession => {
  const session = getSession(sessionId);
  session.scores = {
    communication: clampScore(session.scores.communication + impact.communication),
    problemSolving: clampScore(session.scores.problemSolving + impact.problemSolving),
    technicalDepth: clampScore(session.scores.technicalDepth + impact.technicalDepth),
    confidence: clampScore(session.scores.confidence + impact.confidence),
  };
  return sessionRepository.save(session);
};

export const endSession = (sessionId: string): InterviewSession => {
  const session = requireActiveSession(sessionId);
  session.status = 'completed';
  session.endedAt = new Date().toISOString();
  return sessionRepository.save(session);
};
