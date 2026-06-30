import type { InterviewSession } from '@ai-interviewer/shared';

/**
 * In-memory session store. Swap for a Postgres-backed repository behind this
 * same interface once persistence is introduced — callers depend only on
 * these methods, not on the storage mechanism.
 */
export interface SessionRepository {
  create(session: InterviewSession): InterviewSession;
  findById(id: string): InterviewSession | undefined;
  save(session: InterviewSession): InterviewSession;
}

class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, InterviewSession>();

  create(session: InterviewSession): InterviewSession {
    this.sessions.set(session.id, session);
    return session;
  }

  findById(id: string): InterviewSession | undefined {
    return this.sessions.get(id);
  }

  save(session: InterviewSession): InterviewSession {
    this.sessions.set(session.id, session);
    return session;
  }
}

export const sessionRepository: SessionRepository = new InMemorySessionRepository();
