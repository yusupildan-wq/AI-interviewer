import { randomUUID } from 'node:crypto';

import type {
  CandidateSignals,
  DecisionEngineOutput,
  EvidenceSeverity,
  EvidenceType,
  InterviewEvidenceEvent,
  InterviewMemory,
  InterviewMode,
  RubricV2,
  TranscriptEntry,
} from '@ai-interviewer/shared';

const BASELINE = 0;
const MAX_EVIDENCE = 40;

const baselineRubricV2 = (): RubricV2 => ({
  communication: BASELINE,
  problemDecomposition: BASELINE,
  algorithmicCorrectness: BASELINE,
  complexityAnalysis: BASELINE,
  debuggingAbility: BASELINE,
  testingDiscipline: BASELINE,
  tradeoffReasoning: BASELINE,
  interviewerCollaboration: BASELINE,
});

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

const unique = (items: string[], limit = 10): string[] =>
  Array.from(new Set(items)).slice(0, limit);

const addRubricImpact = (rubric: RubricV2, impact: Partial<RubricV2>): RubricV2 => ({
  communication: clamp(rubric.communication + (impact.communication ?? 0)),
  problemDecomposition: clamp(rubric.problemDecomposition + (impact.problemDecomposition ?? 0)),
  algorithmicCorrectness: clamp(
    rubric.algorithmicCorrectness + (impact.algorithmicCorrectness ?? 0),
  ),
  complexityAnalysis: clamp(rubric.complexityAnalysis + (impact.complexityAnalysis ?? 0)),
  debuggingAbility: clamp(rubric.debuggingAbility + (impact.debuggingAbility ?? 0)),
  testingDiscipline: clamp(rubric.testingDiscipline + (impact.testingDiscipline ?? 0)),
  tradeoffReasoning: clamp(rubric.tradeoffReasoning + (impact.tradeoffReasoning ?? 0)),
  interviewerCollaboration: clamp(
    rubric.interviewerCollaboration + (impact.interviewerCollaboration ?? 0),
  ),
});

export const createInterviewMemory = (mode: InterviewMode): InterviewMemory => ({
  explainedConcepts: [],
  unresolvedConcerns: [],
  strengths: [],
  repeatedMistakes: [],
  notableMentions: [],
  nextBestProbe:
    mode === 'coding'
      ? 'Listen for assumptions, approach, complexity, and edge-case handling.'
      : 'Listen for specific decisions, constraints, tradeoffs, and measurable outcomes.',
  rubricV2: baselineRubricV2(),
  evidence: [],
  updatedAt: new Date().toISOString(),
});

const currentQuote = (transcript: TranscriptEntry[]): string =>
  transcript
    .slice()
    .reverse()
    .find((entry) => entry.role === 'candidate')
    ?.content.trim()
    .slice(0, 220) ?? '(candidate updated code without a spoken explanation)';

const event = (
  type: EvidenceType,
  severity: EvidenceSeverity,
  transcriptQuote: string,
  scoreImpact: Partial<RubricV2>,
  coachingNote: string,
): InterviewEvidenceEvent => ({
  id: randomUUID(),
  type,
  severity,
  transcriptQuote,
  scoreImpact,
  coachingNote,
  createdAt: new Date().toISOString(),
});

const decideNextProbe = (memory: InterviewMemory): string => {
  const concerns = memory.unresolvedConcerns;
  if (concerns.some((item) => item.toLowerCase().includes('complexity'))) {
    return 'Ask the candidate to justify the time and space complexity with the operations they chose.';
  }
  if (concerns.some((item) => item.toLowerCase().includes('edge'))) {
    return 'Probe a boundary case tied to the candidate solution rather than a generic edge case.';
  }
  if (concerns.some((item) => item.toLowerCase().includes('tradeoff'))) {
    return 'Ask why their chosen approach beats a realistic alternative.';
  }
  if (concerns.some((item) => item.toLowerCase().includes('test'))) {
    return 'Ask the candidate to dry-run the solution on one normal case and one boundary case.';
  }
  return memory.nextBestProbe;
};

export const updateInterviewMemory = (
  memory: InterviewMemory,
  mode: InterviewMode,
  transcript: TranscriptEntry[],
  signals: CandidateSignals,
  decision: DecisionEngineOutput,
  currentCode: string | undefined,
): InterviewMemory => {
  const quote = currentQuote(transcript);
  const generated: InterviewEvidenceEvent[] = [];
  const strengths = [...memory.strengths];
  const concerns = [...memory.unresolvedConcerns];
  const explained = [...memory.explainedConcepts];
  const mistakes = [...memory.repeatedMistakes];
  let rubric = memory.rubricV2;

  const add = (
    type: EvidenceType,
    severity: EvidenceSeverity,
    impact: Partial<RubricV2>,
    note: string,
  ) => {
    const evidence = event(type, severity, quote, impact, note);
    generated.push(evidence);
    rubric = addRubricImpact(rubric, impact);
  };

  if (signals.asksClarifyingQuestion) {
    strengths.push('Clarifies requirements before committing to an answer');
    explained.push('requirements and assumptions');
    add(
      'requirement-clarification',
      'positive',
      { problemDecomposition: 2, interviewerCollaboration: 2, communication: 1 },
      'Good interview signal: the candidate tried to establish scope before solving.',
    );
  }

  if (signals.mentionsComplexity) {
    strengths.push('Discusses complexity explicitly');
    explained.push('complexity analysis');
    add(
      'complexity-analysis',
      'positive',
      { complexityAnalysis: 3 },
      'The candidate brought up performance instead of waiting to be prompted.',
    );
  } else if (
    mode === 'coding' &&
    transcript.filter((entry) => entry.role === 'candidate').length >= 3
  ) {
    concerns.push('Complexity has not been justified yet');
    mistakes.push('Missing complexity analysis');
    add(
      'complexity-analysis',
      'concern',
      { complexityAnalysis: -2, algorithmicCorrectness: -1 },
      'They have not yet justified time and space complexity for the proposed work.',
    );
  }

  if (signals.mentionsEdgeCases) {
    strengths.push('Names edge cases or failure modes');
    explained.push('edge cases');
    add(
      'edge-case-awareness',
      'positive',
      { algorithmicCorrectness: 2, testingDiscipline: 1 },
      'The candidate checked beyond the happy path.',
    );
  } else if (
    mode === 'coding' &&
    Boolean(currentCode?.trim()) &&
    decision.interventionType === 'deepen'
  ) {
    concerns.push('Edge cases are still under-tested');
    add(
      'edge-case-awareness',
      'concern',
      { algorithmicCorrectness: -1, testingDiscipline: -2 },
      'The implementation has not been validated against boundary cases yet.',
    );
  }

  if (signals.mentionsTradeoffs) {
    strengths.push('Compares alternatives and tradeoffs');
    explained.push('tradeoffs');
    add(
      'tradeoff-reasoning',
      'positive',
      { tradeoffReasoning: 3, communication: 1 },
      'The candidate explained why one option is preferable to another.',
    );
  } else if (decision.interventionType === 'challenge') {
    concerns.push('Tradeoff reasoning needs more depth');
    add(
      'tradeoff-reasoning',
      'concern',
      { tradeoffReasoning: -2 },
      'Alex had to challenge the candidate to defend their choice against alternatives.',
    );
  }

  if (signals.mentionsTesting) {
    strengths.push('Verifies the answer with tests or dry-runs');
    explained.push('testing strategy');
    add(
      'testing-discipline',
      'positive',
      { testingDiscipline: 3, debuggingAbility: 1 },
      'The candidate showed how the solution would be validated.',
    );
  } else if (mode === 'coding' && Boolean(currentCode?.trim()) && transcript.length >= 6) {
    concerns.push('Testing or dry-run is missing');
    add(
      'testing-discipline',
      'concern',
      { testingDiscipline: -2 },
      'There is code or a solution path, but no clear verification step yet.',
    );
  }

  if (signals.hedgingPhraseCount >= 3) {
    concerns.push('Answer contains repeated hedging without resolution');
    mistakes.push('Unresolved uncertainty');
    add(
      'communication-signal',
      'concern',
      { communication: -1, interviewerCollaboration: -1 },
      'Uncertainty is fine, but it should be resolved into a decision or explicit assumption.',
    );
  }

  if (decision.shouldIntervene && decision.interventionType !== 'encourage') {
    const severity: EvidenceSeverity =
      decision.interventionType === 'pushback' ? 'critical' : 'concern';
    concerns.push(decision.reason || `Alex intervened with ${decision.interventionType}`);
    add(
      decision.interventionType === 'pushback' ? 'interviewer-pushback' : 'unresolved-concern',
      severity,
      {
        communication: Math.min(0, decision.scoreImpact.communication),
        problemDecomposition: Math.min(0, decision.scoreImpact.problemSolving),
        algorithmicCorrectness: Math.min(0, decision.scoreImpact.technicalDepth),
        interviewerCollaboration: decision.interventionType === 'redirect' ? -2 : 0,
      },
      decision.reason || 'Alex needed to intervene because a claim needed more support.',
    );
  } else if (decision.interventionType === 'encourage') {
    strengths.push('Maintained useful forward progress');
  }

  const evidence = [...memory.evidence, ...generated].slice(-MAX_EVIDENCE);
  const notableMentions = decision.notableMention
    ? unique([...memory.notableMentions, decision.notableMention], 8)
    : memory.notableMentions;
  const nextMemory: InterviewMemory = {
    explainedConcepts: unique(explained),
    unresolvedConcerns: unique(concerns),
    strengths: unique(strengths),
    repeatedMistakes: unique(mistakes),
    notableMentions,
    nextBestProbe: memory.nextBestProbe,
    rubricV2: rubric,
    evidence,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...nextMemory,
    nextBestProbe: decideNextProbe(nextMemory),
  };
};
