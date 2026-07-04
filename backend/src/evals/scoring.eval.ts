import type {
  InterviewMemory,
  InterviewPlan,
  InterviewSession,
  RubricV2,
} from '@ai-interviewer/shared';

import { calibrateFinalScores, computeOverallScore } from '../features/scoring/scoring.service.js';

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

const basePlan: InterviewPlan = {
  currentStage: 'opening',
  primaryFocus: 'reasoning out loud, correctness, complexity, and edge cases',
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
  skillEstimate: 'building-confidence',
  nextProbe: 'Ask for the first useful approach.',
  updatedAt: '2026-07-03T00:00:00.000Z',
};

const baseMemory: InterviewMemory = {
  explainedConcepts: [],
  unresolvedConcerns: [],
  strengths: [],
  repeatedMistakes: [],
  notableMentions: [],
  nextBestProbe: 'Ask for the first useful approach.',
  rubricV2: zeroRubricV2(),
  evidence: [],
  updatedAt: '2026-07-03T00:00:00.000Z',
};

const sessionWithCandidateAnswer = (candidateAnswer: string): InterviewSession => ({
  id: 'session-1',
  userId: 'user-1',
  mode: 'coding',
  strictness: 'standard',
  problem: {
    id: 'lru-cache',
    mode: 'coding',
    title: 'LRU Cache',
    prompt: 'Design an LRU cache.',
    difficulty: 'medium',
    category: 'data structures',
  },
  persona: {
    name: 'Alex Chen',
    styleSummary: 'Senior technical interviewer.',
  },
  plan: basePlan,
  memory: baseMemory,
  status: 'completed',
  transcript: [
    {
      id: 'opening',
      role: 'interviewer',
      content: 'Walk me through your approach.',
      createdAt: '2026-07-03T00:00:00.000Z',
      interventionType: 'evaluate',
    },
    {
      id: 'candidate',
      role: 'candidate',
      content: candidateAnswer,
      createdAt: '2026-07-03T00:00:01.000Z',
    },
  ],
  codeHistory: [],
  scores: {
    communication: 50,
    problemSolving: 50,
    technicalDepth: 50,
    confidence: 50,
  },
  interventionCount: 1,
  startedAt: '2026-07-03T00:00:00.000Z',
  endedAt: '2026-07-03T00:00:02.000Z',
  lastActivityAt: '2026-07-03T00:00:01.000Z',
});

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const evalTinyAnswerCannotLookAverage = (): void => {
  const calibrated = calibrateFinalScores(sessionWithCandidateAnswer('I would use a map.'));
  const overall = computeOverallScore(calibrated);

  assert(overall <= 1, `Tiny one-turn answer should score near zero, got ${overall}.`);
  assert(
    Object.values(calibrated).every((score) => score <= 1),
    `Tiny one-turn answer leaked inflated dimension scores: ${JSON.stringify(calibrated)}.`,
  );
};

const evalShortAnswerGetsSevereCap = (): void => {
  const calibrated = calibrateFinalScores(
    sessionWithCandidateAnswer(
      'I would use a hash map and a linked list, then move keys around when they are used.',
    ),
  );
  const overall = computeOverallScore(calibrated);

  assert(overall <= 8, `Short shallow answer should remain severely capped, got ${overall}.`);
};

const evals = [
  ['tiny answers cannot look average', evalTinyAnswerCannotLookAverage],
  ['short shallow answers stay severely capped', evalShortAnswerGetsSevereCap],
] as const;

for (const [name, run] of evals) {
  run();
  console.log(`PASS ${name}`);
}

console.log(`\n${evals.length} scoring evals passed.`);
