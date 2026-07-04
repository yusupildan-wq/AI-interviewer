import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  TranscriptEntry,
} from '@ai-interviewer/shared';

import { env } from '../../config/env.js';
import { createChatCompletion, type OpenAiChatMessage } from '../llm/openai-client.js';
import {
  conversationFallbackMessage,
  normalizeConversationDecision,
  ZERO_SCORE_IMPACT,
} from './conversation-quality.js';

const MAX_CONVERSATION_TURNS = 8;

const transcriptRoleFor = (entry: TranscriptEntry): OpenAiChatMessage['role'] =>
  entry.role === 'interviewer' ? 'assistant' : 'user';

const formatMemory = (input: DecisionEngineInput): string => {
  const mentions = input.memory.notableMentions.slice(-4);
  if (mentions.length === 0) return 'No personal details yet.';
  return mentions.map((mention) => `- ${mention}`).join('\n');
};

export const buildConversationChatMessages = (input: DecisionEngineInput): OpenAiChatMessage[] => {
  const transcriptWithoutDuplicateCurrent =
    input.transcript.at(-1)?.role === 'candidate' &&
    input.transcript.at(-1)?.content === input.currentCandidateMessage
      ? input.transcript.slice(0, -1)
      : input.transcript;
  const recent = transcriptWithoutDuplicateCurrent.slice(-MAX_CONVERSATION_TURNS);
  const previousAlex = recent
    .slice()
    .reverse()
    .find((entry) => entry.role === 'interviewer')
    ?.content.trim();

  return [
    {
      role: 'system',
      content: `You are Alex Chen on a live video call.

This is Conversation Mode, not an interview.

Talk like a normal person:
- Reply directly to what the user just said.
- Do not ask a question every turn.
- Do not sound like a therapist, narrator, rubric, or chatbot.
- Keep it to one or two spoken sentences.
- If the user asks a direct question, answer it first.
- If you ask a question, include an actual reaction or thought first.
- Do not mention scoring, rubrics, constraints, coding tasks, or interview stages unless the user asks to practice.
- Do not repeat your previous wording.

Useful remembered context:
${formatMemory(input)}

Previous Alex message to avoid repeating:
${previousAlex ?? '(none)'}`,
    },
    ...recent.map((entry) => ({
      role: transcriptRoleFor(entry),
      content: entry.content,
    })),
    {
      role: 'user',
      content: input.currentCandidateMessage || '(The user did not say anything new.)',
    },
  ];
};

const fallbackDecision = (input: DecisionEngineInput, reason: string): DecisionEngineOutput => ({
  shouldIntervene: true,
  interventionType: 'encourage',
  reason,
  messageToCandidate: conversationFallbackMessage(input),
  scoreImpact: ZERO_SCORE_IMPACT,
  notableMention: extractConversationNotableMention(input.currentCandidateMessage),
});

export const extractConversationNotableMention = (message: string): string => {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  const directPatterns: Array<[RegExp, string]> = [
    [/\bmy name is ([a-z][a-z\s'-]{1,40})/i, 'name'],
    [/\bi work (?:at|for) ([a-z0-9][a-z0-9\s&.'-]{1,60})/i, 'workplace'],
    [/\bi(?:'m| am) studying ([a-z0-9][a-z0-9\s&.'-]{1,60})/i, 'studies'],
    [/\bi(?:'m| am) building ([a-z0-9][a-z0-9\s&.'-]{1,80})/i, 'project'],
    [/\bmy project is ([a-z0-9][a-z0-9\s&.'-]{1,80})/i, 'project'],
  ];

  for (const [pattern, label] of directPatterns) {
    const match = trimmed.match(pattern);
    const value = match?.[1]?.trim().replace(/[.!?]+$/, '');
    if (value) {
      return `${label}: ${value}`;
    }
  }

  if (/\b(stressed|anxious|worried|frustrated|tired|exhausted)\b/.test(lower)) {
    return `current concern: ${trimmed.slice(0, 90)}`;
  }

  if (/\b(ai interviewer|this app|the app|conversation mode|voice|robot)\b/.test(lower)) {
    return `product feedback: ${trimmed.slice(0, 90)}`;
  }

  return '';
};

export const runConversationDecision = async (
  input: DecisionEngineInput,
): Promise<DecisionEngineOutput> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  try {
    const controller = new AbortController();
    const responsePromise = createChatCompletion({
      model: env.decisionEngineModel,
      temperature: 0.8,
      maxCompletionTokens: 90,
      messages: buildConversationChatMessages(input),
      signal: controller.signal,
    });

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        resolve('timeout');
      }, env.conversationEngineTimeoutMs);
    });

    const result = await Promise.race([responsePromise, timeoutPromise]);

    if (result === 'timeout') {
      void responsePromise.catch(() => undefined);
      return fallbackDecision(input, 'Conversation engine timed out.');
    }

    const message = result.replace(/\s+/g, ' ').trim();
    return normalizeConversationDecision(
      {
        shouldIntervene: true,
        interventionType: 'encourage',
        reason: 'Fast conversation reply.',
        messageToCandidate: message,
        scoreImpact: ZERO_SCORE_IMPACT,
        notableMention: extractConversationNotableMention(input.currentCandidateMessage),
      },
      input,
    );
  } catch {
    return fallbackDecision(
      input,
      timedOut ? 'Conversation engine timed out.' : 'Conversation engine failed.',
    );
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
