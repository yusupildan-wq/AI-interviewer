import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  ScoreRubric,
} from '@ai-interviewer/shared';

export const ZERO_SCORE_IMPACT: ScoreRubric = {
  communication: 0,
  problemSolving: 0,
  technicalDepth: 0,
  confidence: 0,
};

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

export const conversationFallbackMessage = (input: DecisionEngineInput): string => {
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

export const looksLikeOnlyAQuestion = (message: string): boolean => {
  const trimmed = message.trim();
  if (!trimmed.endsWith('?')) return false;
  return !/[.!]/.test(trimmed.replace(/\?+$/, ''));
};

export const normalizeConversationDecision = (
  decision: DecisionEngineOutput,
  input: DecisionEngineInput,
): DecisionEngineOutput => {
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
};
