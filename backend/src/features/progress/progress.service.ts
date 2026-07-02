import type {
  EvidenceSeverity,
  InterviewSessionSummary,
  PracticePlanItem,
  ProgressOverview,
  ProgressWeakArea,
  RecentReportSummary,
} from '@ai-interviewer/shared';
import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { feedbackReports, interviewSessions } from '../../db/schema.js';
import { findProblemById } from '../problems/problems.data.js';
import { createInterviewMemory } from '../interview-session/interview-memory.service.js';

const averageVisibleScore = (scores: {
  communication: number;
  problemSolving: number;
  technicalDepth: number;
  confidence: number;
}): number =>
  Math.round(
    (scores.communication + scores.problemSolving + scores.technicalDepth + scores.confidence) / 4,
  );

const severityRank: Record<EvidenceSeverity, number> = {
  positive: 0,
  neutral: 1,
  concern: 2,
  critical: 3,
};

const toSessionSummary = (row: typeof interviewSessions.$inferSelect): InterviewSessionSummary => ({
  id: row.id,
  mode: row.mode,
  strictness: row.strictness,
  problemTitle: findProblemById(row.problemId)?.title ?? row.problemId,
  status: row.status,
  scores: row.scores,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString(),
});

const humanizeWeakArea = (type: string): string =>
  type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const drillForWeakArea = (area: ProgressWeakArea): PracticePlanItem => {
  const lower = area.label.toLowerCase();
  if (lower.includes('complexity')) {
    return {
      title: 'Complexity justification drill',
      detail:
        'Solve two medium problems and explain the operation that makes each time and space bound true.',
      source: `${area.count} evidence signals`,
    };
  }
  if (lower.includes('edge')) {
    return {
      title: 'Boundary-case dry run',
      detail:
        'For each solution, test empty input, single item, duplicates, max size, and one invalid state.',
      source: `${area.count} evidence signals`,
    };
  }
  if (lower.includes('testing')) {
    return {
      title: 'Testing discipline block',
      detail:
        'End every practice answer with one normal walkthrough and one edge-case walkthrough out loud.',
      source: `${area.count} evidence signals`,
    };
  }
  if (lower.includes('tradeoff')) {
    return {
      title: 'Tradeoff comparison drill',
      detail:
        'Name the approach you rejected, the cost that made you reject it, and when it would become better.',
      source: `${area.count} evidence signals`,
    };
  }
  if (lower.includes('requirement')) {
    return {
      title: 'Clarification-first reps',
      detail:
        'Spend the first 90 seconds of five problems only on assumptions, inputs, outputs, and constraints.',
      source: `${area.count} evidence signals`,
    };
  }
  return {
    title: `${area.label} review`,
    detail:
      area.latestEvidence ??
      'Review the related report evidence and redo that section under a timer.',
    source: `${area.count} evidence signals`,
  };
};

export const getProgressOverview = async (userId: string): Promise<ProgressOverview> => {
  const rows = await db
    .select({
      session: interviewSessions,
      report: feedbackReports,
    })
    .from(interviewSessions)
    .leftJoin(feedbackReports, eq(feedbackReports.interviewSessionId, interviewSessions.id))
    .where(eq(interviewSessions.userId, userId))
    .orderBy(desc(interviewSessions.startedAt));

  const activeInterviews = rows
    .filter(({ session }) => session.status === 'active')
    .map(({ session }) => toSessionSummary(session));

  const completed = rows.filter(({ session }) => session.status === 'completed');
  const reports = completed
    .filter((row): row is typeof row & { report: NonNullable<(typeof row)['report']> } =>
      Boolean(row.report),
    )
    .sort(
      (a, b) => new Date(b.report.generatedAt).getTime() - new Date(a.report.generatedAt).getTime(),
    );

  const scoredCompleted = completed.map(({ session, report }) => ({
    session,
    score: report?.overallScore ?? averageVisibleScore(session.scores),
  }));
  const scores = scoredCompleted.map((item) => item.score);

  const recentReports: RecentReportSummary[] = reports.slice(0, 5).map(({ session, report }) => ({
    sessionId: session.id,
    problemTitle: findProblemById(session.problemId)?.title ?? session.problemId,
    mode: session.mode,
    completedAt: session.endedAt?.toISOString() ?? report.generatedAt.toISOString(),
    overallScore: report.overallScore,
    recommendation: report.recommendation,
  }));

  const weakAreaMap = new Map<
    string,
    { label: string; count: number; severity: EvidenceSeverity; latestEvidence?: string }
  >();
  for (const { session, report } of completed) {
    const memory = session.memory ?? createInterviewMemory(session.mode);
    const evidence = [...memory.evidence, ...(report?.coaching?.evidence ?? [])].filter(
      (item) => item.severity === 'concern' || item.severity === 'critical',
    );

    for (const item of evidence) {
      const label = humanizeWeakArea(item.type);
      const current = weakAreaMap.get(label);
      if (!current) {
        weakAreaMap.set(label, {
          label,
          count: 1,
          severity: item.severity,
          latestEvidence: item.coachingNote,
        });
        continue;
      }
      current.count += 1;
      if (severityRank[item.severity] > severityRank[current.severity]) {
        current.severity = item.severity;
      }
      current.latestEvidence = item.coachingNote;
    }
  }

  const weakAreas = Array.from(weakAreaMap.values())
    .sort((a, b) => b.count - a.count || severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 5);

  const practicePlan =
    weakAreas.length > 0
      ? weakAreas.slice(0, 4).map(drillForWeakArea)
      : [
          {
            title: 'Baseline mock interview',
            detail:
              'Complete one coding interview and one system-design interview to create your first trend line.',
            source: 'No repeated weaknesses yet',
          },
        ];

  return {
    completedCount: completed.length,
    activeCount: activeInterviews.length,
    averageScore:
      scores.length > 0
        ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
        : 0,
    bestScore: scores.length > 0 ? Math.max(...scores) : 0,
    latestScore: scoredCompleted[0]?.score,
    trend: scoredCompleted
      .slice()
      .reverse()
      .slice(-10)
      .map(({ session, score }) => ({
        sessionId: session.id,
        date: session.endedAt?.toISOString() ?? session.startedAt.toISOString(),
        score,
        problemTitle: findProblemById(session.problemId)?.title ?? session.problemId,
      })),
    recentReports,
    activeInterviews,
    weakAreas,
    practicePlan,
  };
};
