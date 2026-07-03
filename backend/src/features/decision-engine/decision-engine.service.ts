import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  InterventionType,
  ScoreRubric,
} from '@ai-interviewer/shared';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import { createStructuredChatCompletion } from '../llm/openai-client.js';
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

const ZERO_SCORE_IMPACT: ScoreRubric = {
  communication: 0,
  problemSolving: 0,
  technicalDepth: 0,
  confidence: 0,
};

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
    notableMention: typeof parsed.notableMention === 'string' ? parsed.notableMention.trim() : '',
  };
};

const hasTechnicalContent = (message: string): boolean =>
  /\b(approach|assume|constraint|complexity|edge|test|tradeoff|hash|map|list|cache|node|pointer|array|object|database|api|queue|stack|get|put|evict|capacity)\b/i.test(
    message,
  );

/** Genuine safety net only: used if the real decision engine call times out or errors,
 * never as a routine substitute for it. Every normal turn goes through the real model so
 * replies stay grounded in what the candidate actually said. */
const timeoutDecision = (input: DecisionEngineInput): DecisionEngineOutput => {
  const message = input.currentCandidateMessage.trim();
  const signals = input.candidateSignals;

  if (signals.asksClarifyingQuestion || message.endsWith('?')) {
    return {
      shouldIntervene: true,
      interventionType: 'encourage',
      reason: 'Decision engine timed out; answer the clarification quickly and keep momentum.',
      messageToCandidate: 'Good question. State the assumption you would make, and keep going.',
      scoreImpact: ZERO_SCORE_IMPACT,
      notableMention: '',
    };
  }

  if (signals.hedgingPhraseCount >= 3 && !hasTechnicalContent(message)) {
    return {
      shouldIntervene: true,
      interventionType: 'redirect',
      reason: 'Decision engine timed out while candidate sounded stuck; give a short nudge.',
      messageToCandidate: 'Let us make it concrete. What approach do you want to commit to first?',
      scoreImpact: ZERO_SCORE_IMPACT,
      notableMention: '',
    };
  }

  return {
    shouldIntervene: true,
    interventionType: 'deepen',
    reason: 'Decision engine timed out; respond with a short follow-up instead of stalling.',
    messageToCandidate:
      input.mode === 'coding'
        ? 'Got it. Keep going. What is the next step in your approach?'
        : 'Got it. What is the next decision you would make from there?',
    scoreImpact: ZERO_SCORE_IMPACT,
    notableMention: '',
  };
};

export const runDecisionEngine = async (
  input: DecisionEngineInput,
): Promise<DecisionEngineOutput> => {
  let content: string;
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    const responsePromise = createStructuredChatCompletion({
      model: env.decisionEngineModel,
      // Higher than a typical extraction task on purpose: the whole point is to sound
      // like a real person, not the same templated phrasing every turn.
      temperature: 0.7,
      // A tight cap on top of the prompt's own brevity instruction — generation time
      // scales directly with completion length, and this is on the reply-latency
      // critical path (the TTS call that follows can't start until this returns).
      maxCompletionTokens: 300,
      jsonSchemaName: 'interviewer_decision',
      jsonSchema: decisionEngineJsonSchema,
      messages: [
        { role: 'system', content: buildDecisionEngineSystemPrompt(input.strictness) },
        { role: 'user', content: buildDecisionEngineUserPrompt(input) },
      ],
      signal: controller.signal,
    });

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        resolve('timeout');
      }, env.decisionEngineTimeoutMs);
    });

    const result = await Promise.race([responsePromise, timeoutPromise]);

    if (result === 'timeout') {
      void responsePromise.catch(() => undefined);
      return timeoutDecision(input);
    }

    content = result;
  } catch (caught) {
    if (timedOut) {
      return timeoutDecision(input);
    }
    throw caught;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  return parseDecisionOutput(content);
};
