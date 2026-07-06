import { randomUUID } from 'node:crypto';

import type {
  CodeSnapshot,
  CandidateSignals,
  DecisionEngineOutput,
  InterventionType,
  InterviewMode,
  InterviewSession,
  InterviewSessionSummary,
  InterviewerPersona,
  InterviewerStrictness,
  ScoreRubric,
  TranscriptEntry,
  UserProfile,
} from '@ai-interviewer/shared';

import { HttpError } from '../../shared/http-error.js';
import { findProblemById, pickRandomProblemForMode } from '../problems/problems.data.js';
import { calibrateFinalScores } from '../scoring/scoring.service.js';
import { createInterviewMemory, updateInterviewMemory } from './interview-memory.service.js';
import { createInterviewPlan, updateInterviewPlan } from './interview-plan.service.js';
import { sessionRepository } from './session.repository.js';

const BASELINE_SCORE = 0;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

const PERSONA_STYLE_SUMMARY: Record<InterviewerStrictness, string> = {
  'coffee-chat':
    'Warm, curious conversation partner running a relaxed coffee chat. Genuinely interested in your story, low ' +
    'pressure, laughs easily — but still gently steers things back if the conversation drifts too far off track.',
  standard:
    'Senior staff-level FAANG interviewer. Calm, precise, and economical with words. Lets candidates think in ' +
    'silence, intervenes only when it is pedagogically or evaluatively useful, and always grounds follow-ups in ' +
    'something the candidate just said or did.',
  strict:
    'Rigorous FAANG bar-raiser. Direct, exacting, and unsparing with vague or unjustified answers. Expects ' +
    'precision, presses hard on weak reasoning, and redirects off-topic answers immediately.',
};

export const interviewerPersonaFor = (strictness: InterviewerStrictness): InterviewerPersona => ({
  name: 'Alex Chen',
  styleSummary: PERSONA_STYLE_SUMMARY[strictness],
});

const baselineScores = (): ScoreRubric => ({
  communication: BASELINE_SCORE,
  problemSolving: BASELINE_SCORE,
  technicalDepth: BASELINE_SCORE,
  confidence: BASELINE_SCORE,
});

const openingMessageForMode = (
  mode: InterviewMode,
  title: string,
  strictness: InterviewerStrictness,
  profile?: UserProfile,
): string => {
  if (mode === 'conversation') {
    return `Hey, I'm Alex. No interview question this time - just a normal conversation. What's on your mind?`;
  }

  const targetContext = profile
    ? ` I will calibrate this for a ${profile.seniority} ${profile.targetRole} interview${
        profile.targetCompanies.length > 0
          ? ` with ${profile.targetCompanies.slice(0, 2).join(' / ')} expectations in mind`
          : ''
      }.`
    : '';
  const goalContext =
    profile?.interviewGoal &&
    profile.interviewGoal !== 'Prepare for realistic technical interviews.'
      ? ` Your goal is: ${profile.interviewGoal}`
      : '';
  const context = `${targetContext}${goalContext}`;

  if (strictness === 'coffee-chat') {
    if (mode === 'coding') {
      return `Hey, I'm Alex! Nothing formal here — let's just talk through ${title} together like we're figuring it out over coffee. Walk me through how you'd think about it.`;
    }
    if (mode === 'system-design') {
      return `Hey, I'm Alex. Let's chat through ${title} casually — no whiteboard pressure, just talk me through how you'd approach it.`;
    }
    if (mode === 'behavioral') {
      return `Hey, I'm Alex! This is just a chat — tell me about something you worked on that stuck with you.`;
    }
    return `Hey, I'm Alex. Pick a project you're proud of and just tell me about it — I'll jump in with questions as we go.`;
  }

  if (strictness === 'strict') {
    if (mode === 'coding') {
      return `I'm Alex. We're solving ${title}.${context} Clarify the requirements, state your approach and its complexity, then implement it. I will push on every assumption.`;
    }
    if (mode === 'system-design') {
      return `I'm Alex. Design ${title}. Start with scale and constraints — I expect numbers, not guesses.`;
    }
    if (mode === 'behavioral') {
      return `I'm Alex. Give me one specific example: your role, the tradeoffs you weighed, and the measurable outcome. Generalities will not hold up.`;
    }
    return `I'm Alex. Pick the project you know most deeply. I will go line by line into the decisions you personally made.`;
  }

  if (mode === 'coding') {
    return `Hi, I am Alex. We will work through ${title} together.${context} Start by clarifying the requirements, then talk through your approach before you code.`;
  }

  if (mode === 'system-design') {
    return `Hi, I am Alex. For ${title}, start by clarifying scope and scale before you draw the architecture.${context}`;
  }

  if (mode === 'behavioral') {
    return `Hi, I am Alex.${context} I am looking for one specific example with your role, the tradeoffs, and the outcome.`;
  }

  return `Hi, I am Alex.${context} Pick a project you know deeply. I will ask about the decisions you personally made.`;
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

export const createSession = async (
  userId: string,
  mode: InterviewMode,
  problemId?: string,
  strictness: InterviewerStrictness = 'standard',
  profile?: UserProfile,
): Promise<InterviewSession> => {
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
    userId,
    mode,
    strictness,
    problem,
    persona: interviewerPersonaFor(strictness),
    plan: createInterviewPlan(mode, profile),
    memory: createInterviewMemory(mode),
    status: 'active',
    transcript: [
      {
        id: randomUUID(),
        role: 'interviewer',
        content: openingMessageForMode(mode, problem.title, strictness, profile),
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

export const getSession = async (sessionId: string): Promise<InterviewSession> => {
  const session = await sessionRepository.findById(sessionId);
  if (!session) {
    throw new HttpError(404, `Interview session not found: ${sessionId}`);
  }
  return session;
};

export const requireActiveSession = async (sessionId: string): Promise<InterviewSession> => {
  const session = await getSession(sessionId);
  if (session.status !== 'active') {
    throw new HttpError(409, `Interview session is already completed: ${sessionId}`);
  }
  return session;
};

export const listSessionsForUser = (userId: string): Promise<InterviewSessionSummary[]> =>
  sessionRepository.listByUser(userId);

export const deleteSessionForUser = async (sessionId: string, userId: string): Promise<void> => {
  const deleted = await sessionRepository.deleteByIdForUser(sessionId, userId);
  if (!deleted) {
    throw new HttpError(404, `Interview session not found: ${sessionId}`);
  }
};

export const deleteAllSessionsForUser = (userId: string): Promise<number> =>
  sessionRepository.deleteAllForUser(userId);

export const appendCandidateMessage = async (
  sessionId: string,
  message: string,
  code: string | undefined,
): Promise<{ session: InterviewSession; entry: TranscriptEntry; codeSnapshot?: CodeSnapshot }> => {
  const session = await requireActiveSession(sessionId);
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
  await sessionRepository.save(session);

  return { session, entry, codeSnapshot };
};

export const applyCandidateSignalsToPlan = async (
  sessionId: string,
  signals: CandidateSignals,
  currentCode: string | undefined,
): Promise<InterviewSession> => {
  const session = await requireActiveSession(sessionId);
  session.plan = updateInterviewPlan(
    session.plan,
    session.mode,
    session.transcript,
    signals,
    currentCode,
    session.memory,
  );
  return sessionRepository.save(session);
};

export const appendInterviewerMessage = async (
  sessionId: string,
  content: string,
  interventionType: InterventionType,
): Promise<{ session: InterviewSession; entry: TranscriptEntry }> => {
  const session = await requireActiveSession(sessionId);
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
  await sessionRepository.save(session);

  return { session, entry };
};

export const applyInterviewMemoryUpdate = async (
  sessionId: string,
  signals: CandidateSignals,
  decision: DecisionEngineOutput,
  currentCode: string | undefined,
): Promise<InterviewSession> => {
  const session = await requireActiveSession(sessionId);
  const nextMemory = updateInterviewMemory(
    session.memory,
    session.mode,
    session.transcript,
    signals,
    decision,
    currentCode,
  );

  if (nextMemory === session.memory) {
    return session;
  }

  session.memory = nextMemory;
  return sessionRepository.save(session);
};

export const hasScoreImpact = (impact: ScoreRubric): boolean =>
  Object.values(impact).some((value) => value !== 0);

export const applyScoreImpact = async (
  sessionId: string,
  impact: ScoreRubric,
): Promise<InterviewSession> => {
  const session = await getSession(sessionId);
  session.scores = {
    communication: clampScore(session.scores.communication + impact.communication),
    problemSolving: clampScore(session.scores.problemSolving + impact.problemSolving),
    technicalDepth: clampScore(session.scores.technicalDepth + impact.technicalDepth),
    confidence: clampScore(session.scores.confidence + impact.confidence),
  };
  return sessionRepository.save(session);
};

export const endSession = async (sessionId: string): Promise<InterviewSession> => {
  const session = await getSession(sessionId);

  if (session.status === 'completed') {
    return session;
  }

  session.status = 'completed';
  session.endedAt = new Date().toISOString();
  session.scores = calibrateFinalScores(session);
  return sessionRepository.save(session);
};
