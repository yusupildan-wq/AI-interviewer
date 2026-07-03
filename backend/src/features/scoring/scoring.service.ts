import type { HireRecommendation, InterviewSession, ScoreRubric } from '@ai-interviewer/shared';

/**
 * Weighted blend used to roll the four live-reasoning dimensions into a single
 * overall score for reporting. Technical depth and problem solving are
 * weighted heaviest, matching how FAANG-style debriefs are typically framed.
 */
const RUBRIC_WEIGHTS: ScoreRubric = {
  communication: 0.2,
  problemSolving: 0.3,
  technicalDepth: 0.35,
  confidence: 0.15,
};

const clampScore = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

const CANDIDATE_CONTENT_WORD = /[a-zA-Z0-9_]+/g;
const NON_STARTER_CODE_LINE = /^(?!\s*\/\/\s*talk through your approach)(?!\s*$).+/i;

const countWords = (text: string): number => text.match(CANDIDATE_CONTENT_WORD)?.length ?? 0;

const countCoverage = (coverage: InterviewSession['plan']['coverage']): number =>
  Object.values(coverage).filter(Boolean).length;

const countSubmittedCodeLines = (session: InterviewSession): number => {
  const latestCode = session.codeHistory.at(-1)?.code ?? '';
  return latestCode.split('\n').filter((line) => NON_STARTER_CODE_LINE.test(line)).length;
};

const evidenceMetricsForSession = (session: InterviewSession) => {
  const candidateEntries = session.transcript.filter(
    (entry) => entry.role === 'candidate' && entry.content.trim().length > 0,
  );
  const wordCount = candidateEntries.reduce((total, entry) => total + countWords(entry.content), 0);
  const positiveEvidence = session.memory.evidence.filter((item) => item.severity === 'positive');
  const concernEvidence = session.memory.evidence.filter((item) => item.severity === 'concern');
  const criticalEvidence = session.memory.evidence.filter((item) => item.severity === 'critical');

  return {
    candidateTurns: candidateEntries.length,
    wordCount,
    coverageCount: countCoverage(session.plan.coverage),
    codeLines: countSubmittedCodeLines(session),
    positiveEvidenceCount: positiveEvidence.length,
    concernEvidenceCount: concernEvidence.length,
    criticalEvidenceCount: criticalEvidence.length,
  };
};

const evidenceCapForSession = (session: InterviewSession): number => {
  const metrics = evidenceMetricsForSession(session);

  if (metrics.candidateTurns === 0 || metrics.wordCount < 8) return 0;
  if (metrics.candidateTurns <= 1 || metrics.wordCount < 30) return 1;
  if (metrics.wordCount < 75 && metrics.codeLines < 3 && metrics.coverageCount <= 1) return 8;
  if (metrics.wordCount < 150 && metrics.codeLines < 8 && metrics.coverageCount <= 2) return 18;
  if (metrics.coverageCount <= 1 && metrics.codeLines < 8 && metrics.positiveEvidenceCount === 0) {
    return 25;
  }
  if (metrics.coverageCount <= 2 && metrics.codeLines < 12) return 40;
  if (metrics.coverageCount <= 3 && metrics.positiveEvidenceCount < 2) return 55;

  return 100;
};

const deriveEvidenceScores = (session: InterviewSession): ScoreRubric => {
  const metrics = evidenceMetricsForSession(session);
  const wordScore = Math.min(28, metrics.wordCount / 14);
  const turnScore = Math.min(12, metrics.candidateTurns * 2);
  const coverageScore = metrics.coverageCount * 8;
  const codeScore = Math.min(22, metrics.codeLines * 1.8);
  const positiveScore = Math.min(28, metrics.positiveEvidenceCount * 5);
  const penalty = metrics.concernEvidenceCount * 4 + metrics.criticalEvidenceCount * 9;

  return {
    communication: clampScore(wordScore + turnScore + positiveScore * 0.7 - penalty * 0.8),
    problemSolving: clampScore(
      coverageScore + turnScore + positiveScore + codeScore * 0.5 - penalty,
    ),
    technicalDepth: clampScore(coverageScore * 0.8 + codeScore + positiveScore - penalty),
    confidence: clampScore(wordScore * 0.45 + coverageScore * 0.6 + positiveScore - penalty * 0.8),
  };
};

export const calibrateFinalScores = (session: InterviewSession): ScoreRubric => {
  const cap = evidenceCapForSession(session);
  const evidenceScores = deriveEvidenceScores(session);

  return {
    communication: clampScore(
      Math.min(Math.max(session.scores.communication, evidenceScores.communication), cap),
    ),
    problemSolving: clampScore(
      Math.min(Math.max(session.scores.problemSolving, evidenceScores.problemSolving), cap),
    ),
    technicalDepth: clampScore(
      Math.min(Math.max(session.scores.technicalDepth, evidenceScores.technicalDepth), cap),
    ),
    confidence: clampScore(
      Math.min(Math.max(session.scores.confidence, evidenceScores.confidence), cap),
    ),
  };
};

export const computeOverallScore = (scores: ScoreRubric): number => {
  const weighted =
    scores.communication * RUBRIC_WEIGHTS.communication +
    scores.problemSolving * RUBRIC_WEIGHTS.problemSolving +
    scores.technicalDepth * RUBRIC_WEIGHTS.technicalDepth +
    scores.confidence * RUBRIC_WEIGHTS.confidence;

  return Math.round(weighted);
};

export const deriveRecommendationFromScore = (overallScore: number): HireRecommendation => {
  if (overallScore >= 85) return 'strong-hire';
  if (overallScore >= 70) return 'hire';
  if (overallScore >= 55) return 'lean-hire';
  if (overallScore >= 35) return 'no-hire';
  return 'strong-no-hire';
};
