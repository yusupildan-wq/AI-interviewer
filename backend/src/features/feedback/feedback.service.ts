import type { FeedbackReport, HireRecommendation, InterviewSession } from '@ai-interviewer/shared';
import Groq from 'groq-sdk';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import { getGroqClient } from '../llm/groq-client.js';
import { computeOverallScore, deriveRecommendationFromScore } from '../scoring/scoring.service.js';
import { feedbackReportJsonSchema } from './feedback.schema.js';
import { FEEDBACK_SYSTEM_PROMPT, buildFeedbackUserPrompt } from './feedback.prompt.js';

const RECOMMENDATIONS: HireRecommendation[] = ['strong-hire', 'hire', 'lean-hire', 'no-hire', 'strong-no-hire'];

interface RawFeedback {
  summary?: unknown;
  strengths?: unknown;
  growthAreas?: unknown;
  notableMoments?: unknown;
  recommendation?: unknown;
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asMoments = (value: unknown): FeedbackReport['notableMoments'] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      quote: typeof item.quote === 'string' ? item.quote : '',
      note: typeof item.note === 'string' ? item.note : '',
    }))
    .filter((moment) => moment.quote.length > 0);
};

export const generateFeedbackReport = async (session: InterviewSession): Promise<FeedbackReport> => {
  const client = getGroqClient();
  const overallScore = computeOverallScore(session.scores);

  let response;
  try {
    response = await client.chat.completions.create({
      model: env.decisionEngineModel,
      // Generous headroom: reasoning tokens count against this budget before the JSON
      // answer is emitted, and a too-tight limit causes the model to run out of room
      // and return an empty/invalid completion (Groq error code json_validate_failed).
      max_completion_tokens: 4096,
      temperature: 0.4,
      reasoning_effort: 'high',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'feedback_report', schema: feedbackReportJsonSchema, strict: true },
      },
      messages: [
        { role: 'system', content: FEEDBACK_SYSTEM_PROMPT },
        { role: 'user', content: buildFeedbackUserPrompt(session) },
      ],
    });
  } catch (caught) {
    if (caught instanceof Groq.APIError) {
      throw new HttpError(502, `Feedback report generation failed (${caught.status}): ${caught.message}`);
    }
    throw caught;
  }

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new HttpError(502, 'Feedback report generation returned no content.');
  }

  let raw: RawFeedback;
  try {
    raw = JSON.parse(content) as RawFeedback;
  } catch {
    throw new HttpError(502, 'Feedback report generation returned malformed JSON.');
  }

  const recommendation = RECOMMENDATIONS.includes(raw.recommendation as HireRecommendation)
    ? (raw.recommendation as HireRecommendation)
    : deriveRecommendationFromScore(overallScore);

  return {
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    overallScore,
    scores: session.scores,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    strengths: asStringArray(raw.strengths),
    growthAreas: asStringArray(raw.growthAreas),
    notableMoments: asMoments(raw.notableMoments),
    recommendation,
  };
};
