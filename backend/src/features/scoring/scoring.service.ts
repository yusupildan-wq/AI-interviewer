import type { HireRecommendation, ScoreRubric } from '@ai-interviewer/shared';

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
