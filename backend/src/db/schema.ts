import type {
  CodingLanguage,
  CodeSnapshot,
  CoachingIntelligence,
  HireRecommendation,
  InterviewMemory,
  InterviewMode,
  InterviewPlan,
  InterviewStatus,
  InterviewerPersona,
  InterviewerStrictness,
  ScoreRubric,
  SeniorityLevel,
  TargetRole,
  TranscriptEntry,
} from '@ai-interviewer/shared';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Opaque bearer tokens for authenticated sessions (not the interview domain concept). */
export const authSessions = pgTable('auth_sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetRole: text('target_role').$type<TargetRole>().notNull().default('full-stack'),
  seniority: text('seniority').$type<SeniorityLevel>().notNull().default('mid-level'),
  preferredLanguage: text('preferred_language')
    .$type<CodingLanguage>()
    .notNull()
    .default('typescript'),
  targetCompanies: jsonb('target_companies').$type<string[]>().notNull().default([]),
  weakAreas: jsonb('weak_areas').$type<string[]>().notNull().default([]),
  interviewGoal: text('interview_goal')
    .notNull()
    .default('Prepare for realistic technical interviews.'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Normalized at the boundary that's actually queried (a user's list of interviews).
 * Transcript and code history are stored as JSONB: they're always read as a whole
 * alongside their parent session, never queried independently, so normalizing them
 * into their own tables would add join complexity with no real benefit today.
 */
export const interviewSessions = pgTable('interview_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').$type<InterviewMode>().notNull(),
  strictness: text('strictness').$type<InterviewerStrictness>().notNull(),
  problemId: text('problem_id').notNull(),
  persona: jsonb('persona').$type<InterviewerPersona>().notNull(),
  plan: jsonb('plan').$type<InterviewPlan>(),
  memory: jsonb('memory').$type<InterviewMemory>(),
  status: text('status').$type<InterviewStatus>().notNull(),
  scores: jsonb('scores').$type<ScoreRubric>().notNull(),
  transcript: jsonb('transcript').$type<TranscriptEntry[]>().notNull().default([]),
  codeHistory: jsonb('code_history').$type<CodeSnapshot[]>().notNull().default([]),
  interventionCount: integer('intervention_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Cached so a report isn't regenerated (and re-billed) on every view. */
export const feedbackReports = pgTable('feedback_reports', {
  interviewSessionId: uuid('interview_session_id')
    .primaryKey()
    .references(() => interviewSessions.id, { onDelete: 'cascade' }),
  overallScore: integer('overall_score').notNull(),
  scores: jsonb('scores').$type<ScoreRubric>().notNull(),
  summary: text('summary').notNull(),
  strengths: jsonb('strengths').$type<string[]>().notNull(),
  growthAreas: jsonb('growth_areas').$type<string[]>().notNull(),
  notableMoments: jsonb('notable_moments').$type<{ quote: string; note: string }[]>().notNull(),
  recommendation: text('recommendation').$type<HireRecommendation>().notNull(),
  coaching: jsonb('coaching').$type<CoachingIntelligence>(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});
