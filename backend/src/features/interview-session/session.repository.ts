import type { InterviewSession, InterviewSessionSummary } from '@ai-interviewer/shared';
import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { interviewSessions } from '../../db/schema.js';
import { findProblemById } from '../problems/problems.data.js';
import { createInterviewMemory } from './interview-memory.service.js';
import { createInterviewPlan } from './interview-plan.service.js';

export interface SessionRepository {
  create(session: InterviewSession): Promise<InterviewSession>;
  findById(id: string): Promise<InterviewSession | undefined>;
  save(session: InterviewSession): Promise<InterviewSession>;
  listByUser(userId: string): Promise<InterviewSessionSummary[]>;
}

type InterviewSessionRow = typeof interviewSessions.$inferSelect;

/** Problem is stored by ID; the full (candidate-facing-safe-stripped) object is
 * reattached from the static problem bank on read, same as it was pre-persistence. */
const toInterviewSession = (row: InterviewSessionRow): InterviewSession => {
  const problem = findProblemById(row.problemId);
  if (!problem) {
    throw new Error(`Interview session ${row.id} references unknown problem ${row.problemId}`);
  }

  return {
    id: row.id,
    userId: row.userId,
    mode: row.mode,
    strictness: row.strictness,
    problem,
    persona: row.persona,
    plan: row.plan ?? createInterviewPlan(row.mode),
    memory: row.memory ?? createInterviewMemory(row.mode),
    status: row.status,
    transcript: row.transcript,
    codeHistory: row.codeHistory,
    scores: row.scores,
    interventionCount: row.interventionCount,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
  };
};

class PostgresSessionRepository implements SessionRepository {
  async create(session: InterviewSession): Promise<InterviewSession> {
    await db.insert(interviewSessions).values({
      id: session.id,
      userId: session.userId,
      mode: session.mode,
      strictness: session.strictness,
      problemId: session.problem.id,
      persona: session.persona,
      plan: session.plan,
      memory: session.memory,
      status: session.status,
      scores: session.scores,
      transcript: session.transcript,
      codeHistory: session.codeHistory,
      interventionCount: session.interventionCount,
      startedAt: new Date(session.startedAt),
      lastActivityAt: new Date(session.lastActivityAt),
    });

    return session;
  }

  async findById(id: string): Promise<InterviewSession | undefined> {
    const row = await db.query.interviewSessions.findFirst({
      where: eq(interviewSessions.id, id),
    });
    return row ? toInterviewSession(row) : undefined;
  }

  async save(session: InterviewSession): Promise<InterviewSession> {
    await db
      .update(interviewSessions)
      .set({
        status: session.status,
        plan: session.plan,
        memory: session.memory,
        scores: session.scores,
        transcript: session.transcript,
        codeHistory: session.codeHistory,
        interventionCount: session.interventionCount,
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
        lastActivityAt: new Date(session.lastActivityAt),
      })
      .where(eq(interviewSessions.id, session.id));

    return session;
  }

  async listByUser(userId: string): Promise<InterviewSessionSummary[]> {
    const rows = await db.query.interviewSessions.findMany({
      where: eq(interviewSessions.userId, userId),
      orderBy: desc(interviewSessions.startedAt),
    });

    return rows.map((row) => ({
      id: row.id,
      mode: row.mode,
      strictness: row.strictness,
      problemTitle: findProblemById(row.problemId)?.title ?? row.problemId,
      status: row.status,
      scores: row.scores,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString(),
    }));
  }
}

export const sessionRepository: SessionRepository = new PostgresSessionRepository();
