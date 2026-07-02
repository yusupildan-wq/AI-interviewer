import type { FeedbackReport, HireRecommendation, InterviewSession } from '@ai-interviewer/shared';
import Groq from 'groq-sdk';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import { getGroqClient } from '../llm/groq-client.js';
import { computeOverallScore, deriveRecommendationFromScore } from '../scoring/scoring.service.js';
import { buildCoachingIntelligence } from './coaching-intelligence.service.js';
import { feedbackReportJsonSchema } from './feedback.schema.js';
import { FEEDBACK_SYSTEM_PROMPT, buildFeedbackUserPrompt } from './feedback.prompt.js';

const RECOMMENDATIONS: HireRecommendation[] = [
  'strong-hire',
  'hire',
  'lean-hire',
  'no-hire',
  'strong-no-hire',
];

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

export const generateFeedbackReport = async (
  session: InterviewSession,
): Promise<FeedbackReport> => {
  const client = getGroqClient();
  const overallScore = computeOverallScore(session.scores);

  let response;
  try {
    response = await client.chat.completions.create({
      model: env.decisionEngineModel,
      // Reasoning tokens count against this budget before the JSON answer is emitted, and
      // a too-tight limit causes the model to run out of room and return an empty/invalid
      // completion (Groq error code json_validate_failed). Kept well under the account's
      // 8000 TPM cap alongside the full-transcript prompt this call sends — see
      // reasoning_effort below, which is the main lever for keeping reasoning-token usage
      // predictable ("high" reliably blows the TPM budget on a prompt this size).
      max_completion_tokens: 4096,
      temperature: 0.4,
      reasoning_effort: 'medium',
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
      throw new HttpError(
        502,
        `Feedback report generation failed (${caught.status}): ${caught.message}`,
      );
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
    coaching: buildCoachingIntelligence(session),
  };
};

export const answerFeedbackFollowUp = async (
  session: InterviewSession,
  report: FeedbackReport,
  question: string,
): Promise<string> => {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Question is required.');
  }

  const client = getGroqClient();
  const transcript = session.transcript
    .map((entry) => `[${entry.role}] ${entry.content}`)
    .join('\n')
    .slice(-8000);

  try {
    const response = await client.chat.completions.create({
      model: env.decisionEngineModel,
      max_completion_tokens: 900,
      temperature: 0.35,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content:
            'You are Alex, the same interviewer from the completed mock interview. Answer follow-up questions about the debrief directly, honestly, and conversationally. Be specific, concise, and coaching-oriented. Do not reopen the interview or ask a new interview question.',
        },
        {
          role: 'user',
          content: `## Interview
Mode: ${session.mode}
Problem: ${session.problem.title}

## Report summary
Score: ${report.overallScore}/100
Recommendation: ${report.recommendation}
Summary: ${report.summary}
Strengths:
${report.strengths.map((item) => `- ${item}`).join('\n')}
Growth areas:
${report.growthAreas.map((item) => `- ${item}`).join('\n')}
Coaching drills:
${report.coaching.nextDrills.map((item) => `- ${item}`).join('\n')}

Rubric v2:
- Communication: ${session.memory.rubricV2.communication}
- Problem decomposition: ${session.memory.rubricV2.problemDecomposition}
- Algorithmic correctness: ${session.memory.rubricV2.algorithmicCorrectness}
- Complexity analysis: ${session.memory.rubricV2.complexityAnalysis}
- Debugging ability: ${session.memory.rubricV2.debuggingAbility}
- Testing discipline: ${session.memory.rubricV2.testingDiscipline}
- Tradeoff reasoning: ${session.memory.rubricV2.tradeoffReasoning}
- Interviewer collaboration: ${session.memory.rubricV2.interviewerCollaboration}

Evidence:
${
  session.memory.evidence.length > 0
    ? session.memory.evidence
        .slice(-8)
        .map(
          (item) =>
            `- ${item.severity} ${item.type}: "${item.transcriptQuote}" -> ${item.coachingNote}`,
        )
        .join('\n')
    : '(no structured evidence captured)'
}

## Transcript excerpt
${transcript || '(empty transcript)'}

## Candidate follow-up question
${trimmed}`,
        },
      ],
    });

    const answer = response.choices[0]?.message.content?.trim();
    if (!answer) {
      throw new HttpError(502, 'Follow-up answer returned no content.');
    }
    return answer;
  } catch (caught) {
    if (caught instanceof Groq.APIError) {
      throw new HttpError(502, `Feedback follow-up failed (${caught.status}): ${caught.message}`);
    }
    throw caught;
  }
};
