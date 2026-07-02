import type { FeedbackReport } from '@ai-interviewer/shared';
import { eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { feedbackReports } from '../../db/schema.js';
import { createFallbackCoachingIntelligence } from './coaching-intelligence.service.js';

type FeedbackReportRow = typeof feedbackReports.$inferSelect;

const toFeedbackReport = (row: FeedbackReportRow): FeedbackReport => ({
  sessionId: row.interviewSessionId,
  generatedAt: row.generatedAt.toISOString(),
  overallScore: row.overallScore,
  scores: row.scores,
  summary: row.summary,
  strengths: row.strengths,
  growthAreas: row.growthAreas,
  notableMoments: row.notableMoments,
  recommendation: row.recommendation,
  coaching: row.coaching ?? createFallbackCoachingIntelligence(),
});

export const findCachedFeedbackReport = async (
  sessionId: string,
): Promise<FeedbackReport | undefined> => {
  const row = await db.query.feedbackReports.findFirst({
    where: eq(feedbackReports.interviewSessionId, sessionId),
  });
  return row ? toFeedbackReport(row) : undefined;
};

export const saveFeedbackReport = async (report: FeedbackReport): Promise<void> => {
  const values = {
    interviewSessionId: report.sessionId,
    overallScore: report.overallScore,
    scores: report.scores,
    summary: report.summary,
    strengths: report.strengths,
    growthAreas: report.growthAreas,
    notableMoments: report.notableMoments,
    recommendation: report.recommendation,
    coaching: report.coaching,
    generatedAt: new Date(report.generatedAt),
  };

  await db
    .insert(feedbackReports)
    .values(values)
    .onConflictDoUpdate({ target: feedbackReports.interviewSessionId, set: values });
};
