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

const hashText = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const lastInterviewerMessage = (input: DecisionEngineInput): string =>
  input.transcript
    .slice()
    .reverse()
    .find((entry) => entry.role === 'interviewer')
    ?.content.trim() ?? '';

const chooseDifferentReply = (options: string[], previous: string, seed: string): string => {
  const ordered = [...options];
  const fallback = ordered[0] ?? 'Yeah, I get what you mean.';
  const offset = hashText(seed) % ordered.length;
  for (let index = 0; index < ordered.length; index += 1) {
    const candidate = ordered[(offset + index) % ordered.length] ?? fallback;
    if (candidate !== previous) {
      return candidate;
    }
  }
  return fallback;
};

const conversationFallbackMessage = (input: DecisionEngineInput): string => {
  const message = input.currentCandidateMessage.trim();
  const lower = message.toLowerCase();
  const previous = lastInterviewerMessage(input);

  if (message.endsWith('?')) {
    return chooseDifferentReply(
      [
        'My quick take: yes, but the details matter a lot there.',
        'I think there is a real point in that. The short version is that it depends on what you are optimizing for.',
        'Yeah, that is a fair question. I would think about it in terms of what actually changes for the person using it.',
      ],
      previous,
      message,
    );
  }

  if (/\b(stress|stressed|anxious|anxiety|tired|exhausted|worried|frustrated|mad)\b/.test(lower)) {
    return chooseDifferentReply(
      [
        'Yeah, that sounds genuinely draining.',
        'I get why that would stick with you. That kind of pressure wears people down fast.',
        'Honestly, that is a pretty normal reaction to a rough situation.',
      ],
      previous,
      message,
    );
  }

  if (/\b(app|project|feature|interviewer|robot|voice|conversation|ai)\b/.test(lower)) {
    return chooseDifferentReply(
      [
        'Yeah, for this product the human feel is basically the whole game.',
        'That makes sense. The moment it feels scripted, the illusion breaks.',
        'I agree with the direction. It has to feel like someone is actually present, not running a checklist.',
      ],
      previous,
      message,
    );
  }

  return chooseDifferentReply(
    [
      'Yeah, I get what you mean.',
      'That makes sense.',
      'Right, I am with you.',
      'Yeah, that tracks.',
      'I hear you.',
    ],
    previous,
    message,
  );
};

const looksLikeOnlyAQuestion = (message: string): boolean => {
  const trimmed = message.trim();
  if (!trimmed.endsWith('?')) return false;
  return !/[.!]/.test(trimmed.replace(/\?+$/, ''));
};

/** Genuine safety net only: used if the real decision engine call times out or errors,
 * never as a routine substitute for it. Every normal turn goes through the real model so
 * replies stay grounded in what the candidate actually said. */
const timeoutDecision = (input: DecisionEngineInput): DecisionEngineOutput => {
  const message = input.currentCandidateMessage.trim();
  const signals = input.candidateSignals;

  if (input.mode === 'conversation') {
    return {
      shouldIntervene: true,
      interventionType: 'encourage',
      reason: 'Conversation mode timeout; keep the call moving with a short natural reply.',
      messageToCandidate: conversationFallbackMessage(input),
      scoreImpact: ZERO_SCORE_IMPACT,
      notableMention: '',
    };
  }

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
        { role: 'system', content: buildDecisionEngineSystemPrompt(input.strictness, input.mode) },
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

  const decision = parseDecisionOutput(content);
  if (input.mode === 'conversation') {
    if (!decision.shouldIntervene || !decision.messageToCandidate.trim()) {
      return {
        shouldIntervene: true,
        interventionType: 'encourage',
        reason: 'Conversation mode should respond to normal user speech.',
        messageToCandidate: conversationFallbackMessage(input),
        scoreImpact: ZERO_SCORE_IMPACT,
        notableMention: decision.notableMention,
      };
    }
    return {
      ...decision,
      messageToCandidate: looksLikeOnlyAQuestion(decision.messageToCandidate)
        ? `${conversationFallbackMessage(input)} ${decision.messageToCandidate}`
        : decision.messageToCandidate,
      scoreImpact: ZERO_SCORE_IMPACT,
    };
  }
  return decision;
};
