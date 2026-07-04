import type {
  DecisionEngineInput,
  DecisionEngineOutput,
  InterviewMemory,
  InterviewPlan,
  Problem,
  RubricV2,
} from '@ai-interviewer/shared';

import {
  conversationFallbackMessage,
  looksLikeOnlyAQuestion,
  normalizeConversationDecision,
} from '../features/decision-engine/conversation-quality.js';
import {
  buildConversationChatMessages,
  extractConversationNotableMention,
} from '../features/decision-engine/conversation-engine.js';
import { env } from '../config/env.js';
import { buildDecisionEngineSystemPrompt } from '../features/decision-engine/prompt.js';

const bannedConversationPhrases = [
  'Yeah, I hear you. That feels like a real thing to sit with.',
  'Tell me a little more about that.',
  'Say a bit more about what you are thinking there.',
];

const zeroRubricV2 = (): RubricV2 => ({
  communication: 0,
  problemDecomposition: 0,
  algorithmicCorrectness: 0,
  complexityAnalysis: 0,
  debuggingAbility: 0,
  testingDiscipline: 0,
  tradeoffReasoning: 0,
  interviewerCollaboration: 0,
});

const openConversationProblem: Problem = {
  id: 'conversation-mode',
  mode: 'conversation',
  title: 'Open Conversation',
  prompt: 'A relaxed conversation with Alex.',
  difficulty: 'easy',
  category: 'conversation',
};

const basePlan: InterviewPlan = {
  currentStage: 'deep-dive',
  primaryFocus: 'natural conversation, active listening, and helpful context',
  targetRole: 'full-stack',
  seniority: 'mid-level',
  preferredLanguage: 'typescript',
  targetCompanies: [],
  weakAreas: [],
  milestones: [],
  coverage: {
    requirements: false,
    approach: false,
    complexity: false,
    edgeCases: false,
    tradeoffs: false,
    testing: false,
  },
  skillEstimate: 'on-track',
  nextProbe: 'Follow the latest thing the user said naturally.',
  updatedAt: '2026-07-03T00:00:00.000Z',
};

const baseMemory: InterviewMemory = {
  explainedConcepts: [],
  unresolvedConcerns: [],
  strengths: [],
  repeatedMistakes: [],
  notableMentions: [],
  nextBestProbe: 'Follow the latest thing the user said naturally.',
  rubricV2: zeroRubricV2(),
  evidence: [],
  updatedAt: '2026-07-03T00:00:00.000Z',
};

const inputFor = (message: string, previousInterviewerMessage?: string): DecisionEngineInput => {
  const transcript = [
    {
      id: 'opening',
      role: 'interviewer' as const,
      content: previousInterviewerMessage ?? "Hey, I'm Alex. What's on your mind?",
      createdAt: '2026-07-03T00:00:00.000Z',
      interventionType: 'evaluate' as const,
    },
    {
      id: 'candidate',
      role: 'candidate' as const,
      content: message,
      createdAt: '2026-07-03T00:00:01.000Z',
    },
  ];

  return {
    mode: 'conversation',
    strictness: 'standard',
    problem: openConversationProblem,
    persona: {
      name: 'Alex Chen',
      styleSummary: 'Natural conversation partner.',
    },
    plan: basePlan,
    memory: baseMemory,
    transcript,
    currentCandidateMessage: message,
    elapsedMs: 1000,
    candidateSignals: {
      silenceMs: 0,
      messageLength: message.length,
      hedgingPhraseCount: 0,
      codeLinesChangedSinceLastTurn: 0,
      rapidEditCount: 0,
      asksClarifyingQuestion: message.endsWith('?'),
      mentionsComplexity: false,
      mentionsEdgeCases: false,
      mentionsTradeoffs: false,
      mentionsTesting: false,
    },
    previousInterventions: transcript.filter((entry) => entry.role === 'interviewer'),
  };
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertNoBannedPhrase = (message: string): void => {
  for (const phrase of bannedConversationPhrases) {
    assert(!message.includes(phrase), `Banned canned phrase returned: "${phrase}"`);
  }
};

const evalConversationFallbacks = (): void => {
  const stressReply = conversationFallbackMessage(inputFor('I am stressed about this whole app.'));
  assertNoBannedPhrase(stressReply);
  assert(!looksLikeOnlyAQuestion(stressReply), 'Stress fallback must not be question-only.');

  const appReply = conversationFallbackMessage(inputFor('The AI still feels too robotic.'));
  assertNoBannedPhrase(appReply);
  assert(!looksLikeOnlyAQuestion(appReply), 'Product feedback fallback must not be question-only.');

  const questionReply = conversationFallbackMessage(inputFor('Do you think this can become real?'));
  assertNoBannedPhrase(questionReply);
  assert(!looksLikeOnlyAQuestion(questionReply), 'Direct-question fallback must answer first.');
};

const evalNoImmediateRepeat = (): void => {
  const message = 'The AI still feels too robotic.';
  const first = conversationFallbackMessage(inputFor(message));
  const second = conversationFallbackMessage(inputFor(message, first));
  assert(first !== second, "Fallback must avoid repeating Alex's previous message.");
};

const evalConversationNormalization = (): void => {
  const questionOnlyDecision: DecisionEngineOutput = {
    shouldIntervene: true,
    interventionType: 'encourage',
    reason: 'model asked a naked question',
    messageToCandidate: 'What do you mean by that?',
    scoreImpact: {
      communication: 3,
      problemSolving: 3,
      technicalDepth: 3,
      confidence: 3,
    },
    notableMention: '',
  };

  const normalized = normalizeConversationDecision(
    questionOnlyDecision,
    inputFor('This still feels robotic.'),
  );
  assert(
    normalized.messageToCandidate !== questionOnlyDecision.messageToCandidate,
    'Question-only model reply should be prefixed with a real reaction.',
  );
  assert(
    !looksLikeOnlyAQuestion(normalized.messageToCandidate),
    'Normalized conversation reply must not remain question-only.',
  );
  assert(
    Object.values(normalized.scoreImpact).every((value) => value === 0),
    'Conversation mode must not score casual conversation.',
  );

  const silentDecision: DecisionEngineOutput = {
    ...questionOnlyDecision,
    shouldIntervene: false,
    interventionType: 'none',
    messageToCandidate: '',
  };
  const recovered = normalizeConversationDecision(silentDecision, inputFor('I am anxious today.'));
  assert(recovered.shouldIntervene, 'Conversation mode must recover from silent model output.');
  assert(recovered.messageToCandidate.length > 0, 'Recovered reply must say something.');
  assertNoBannedPhrase(recovered.messageToCandidate);
};

const evalPromptBoundaries = (): void => {
  const conversationPrompt = buildDecisionEngineSystemPrompt('standard', 'conversation');
  assert(
    conversationPrompt.includes('CONVERSATION MODE OVERRIDE'),
    'Conversation prompt must include the conversation override.',
  );
  assert(
    conversationPrompt.includes('Avoid question-only replies') &&
      conversationPrompt.includes('answer directly'),
    'Conversation prompt must explicitly ban question-only behavior and require direct answers.',
  );

  const codingPrompt = buildDecisionEngineSystemPrompt('standard', 'coding');
  assert(
    !codingPrompt.includes('CONVERSATION MODE OVERRIDE'),
    'Coding prompt must not include the conversation override.',
  );
};

const evalFastConversationPrompt = (): void => {
  const messages = buildConversationChatMessages(inputFor('I want this to feel like a real call.'));
  const system = messages[0]?.content ?? '';
  assert(
    system.includes('This is Conversation Mode, not an interview.'),
    'Fast conversation prompt must explicitly stay out of interview mode.',
  );
  assert(
    system.includes('Do not ask a question every turn.'),
    'Fast conversation prompt must avoid question-loop behavior.',
  );
  assert(
    system.includes('one or two spoken sentences'),
    'Fast conversation prompt must keep replies short enough for voice.',
  );
  assert(
    !system.includes('Respond with the decision JSON only'),
    'Fast conversation prompt must not use the structured interview JSON protocol.',
  );

  const userMessages = messages.filter((message) => message.role === 'user');
  assert(
    userMessages.filter((message) => message.content === 'I want this to feel like a real call.')
      .length === 1,
    'Fast conversation prompt must not duplicate the current user turn.',
  );
};

const evalConversationMentionExtraction = (): void => {
  assert(
    extractConversationNotableMention('My name is Ildan.') === 'name: Ildan',
    'Conversation mode should remember direct name introductions.',
  );
  assert(
    extractConversationNotableMention('I am building an AI interview practice app.').startsWith(
      'project:',
    ),
    'Conversation mode should remember project context.',
  );
  assert(
    extractConversationNotableMention('This app still feels too robotic.').startsWith(
      'product feedback:',
    ),
    'Conversation mode should remember product feedback.',
  );
};

const evalConversationLatencyBudget = (): void => {
  assert(
    env.conversationEngineTimeoutMs <= 2200,
    'Conversation fallback timeout must stay fast enough for a live call.',
  );
};

const evals = [
  ['conversation fallbacks are natural', evalConversationFallbacks],
  ['conversation fallbacks avoid immediate repeats', evalNoImmediateRepeat],
  ['conversation normalization prevents regressions', evalConversationNormalization],
  ['conversation prompt boundaries are correct', evalPromptBoundaries],
  ['fast conversation prompt stays human', evalFastConversationPrompt],
  ['conversation mention extraction remembers context', evalConversationMentionExtraction],
  ['conversation latency budget stays fast', evalConversationLatencyBudget],
] as const;

for (const [name, run] of evals) {
  run();
  console.log(`PASS ${name}`);
}

console.log(`\n${evals.length} decision-engine evals passed.`);
