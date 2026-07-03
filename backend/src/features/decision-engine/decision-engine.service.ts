import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  InterventionType,
  ScoreRubric,
} from '@ai-interviewer/shared';
import Groq from 'groq-sdk';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import { getGroqClient } from '../llm/groq-client.js';
import { decisionEngineJsonSchema } from './decision-engine.schema.js';
import { buildDecisionEngineSystemPrompt, buildDecisionEngineUserPrompt } from './prompt.js';

const INTERVENTION_TYPES: InterventionType[] = [
  'clarify',
  'pushback',
  'hint',
  'redirect',
  'challenge',
  'deepen',
  'encourage',
  'evaluate',
  'none',
];

const MAX_SCORE_DELTA = 5;

const clampDelta = (value: unknown): number => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(-MAX_SCORE_DELTA, Math.min(MAX_SCORE_DELTA, Math.round(num)));
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Defensive parse: structured outputs guarantee schema-valid JSON, but we still
 * validate shape before trusting it, since this drives candidate-facing messaging. */
const parseDecisionOutput = (raw: string): DecisionEngineOutput => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(502, 'Interviewer Decision Engine returned malformed JSON.');
  }

  if (!isPlainObject(parsed)) {
    throw new HttpError(502, 'Interviewer Decision Engine response was not a JSON object.');
  }

  const interventionType = INTERVENTION_TYPES.includes(parsed.interventionType as InterventionType)
    ? (parsed.interventionType as InterventionType)
    : 'none';
  const shouldIntervene = Boolean(parsed.shouldIntervene) && interventionType !== 'none';

  const rawScoreImpact = isPlainObject(parsed.scoreImpact) ? parsed.scoreImpact : {};
  const scoreImpact: ScoreRubric = {
    communication: clampDelta(rawScoreImpact.communication),
    problemSolving: clampDelta(rawScoreImpact.problemSolving),
    technicalDepth: clampDelta(rawScoreImpact.technicalDepth),
    confidence: clampDelta(rawScoreImpact.confidence),
  };

  return {
    shouldIntervene,
    interventionType: shouldIntervene ? interventionType : 'none',
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    messageToCandidate:
      shouldIntervene && typeof parsed.messageToCandidate === 'string'
        ? parsed.messageToCandidate
        : '',
    scoreImpact,
  };
};

export const runDecisionEngine = async (
  input: DecisionEngineInput,
): Promise<DecisionEngineOutput> => {
  const client = getGroqClient();

  let response;
  try {
    response = await client.chat.completions.create({
      model: env.decisionEngineModel,
      // Reasoning tokens count against this budget before the JSON answer is emitted, and
      // a too-tight limit causes the model to run out of room and return an empty/invalid
      // completion (Groq error code json_validate_failed). Kept well under the account's
      // 8000 TPM cap alongside the ~3-4k token system+user prompt — see reasoning_effort
      // below, which is the main lever for keeping reasoning-token usage predictable.
      max_completion_tokens: 900,
      // Higher than a typical extraction task on purpose: the whole point is to sound
      // like a real person, not the same templated phrasing every turn.
      temperature: 0.45,
      reasoning_effort: env.decisionEngineReasoningEffort as 'low' | 'medium' | 'high',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'interviewer_decision',
          schema: decisionEngineJsonSchema,
          strict: true,
        },
      },
      messages: [
        { role: 'system', content: buildDecisionEngineSystemPrompt(input.strictness) },
        { role: 'user', content: buildDecisionEngineUserPrompt(input) },
      ],
    });
  } catch (caught) {
    if (caught instanceof Groq.APIError) {
      throw new HttpError(
        502,
        `Interviewer Decision Engine request failed (${caught.status}): ${caught.message}`,
      );
    }
    throw caught;
  }

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new HttpError(502, 'Interviewer Decision Engine returned no content.');
  }

  return parseDecisionOutput(content);
};
