import type {
  CoachingCoverageItem,
  CoachingCoverageKey,
  CoachingIntelligence,
  InterviewSession,
} from '@ai-interviewer/shared';

const COVERAGE_NOTES: Record<
  CoachingCoverageKey,
  {
    label: string;
    covered: string;
    missed: string;
    drill: string;
  }
> = {
  requirements: {
    label: 'Requirements',
    covered: 'You established scope before jumping into the answer.',
    missed: 'You need to make assumptions and constraints explicit before solving.',
    drill:
      'Run 5 problems where the first 90 seconds are only clarifying questions and assumptions.',
  },
  approach: {
    label: 'Approach',
    covered: 'You gave the interviewer a path to evaluate before execution.',
    missed: 'You need to commit to an approach and explain why it fits the problem.',
    drill:
      'Practice giving a brute force approach, optimized approach, and decision rationale in under 3 minutes.',
  },
  complexity: {
    label: 'Complexity',
    covered: 'You discussed performance instead of only describing mechanics.',
    missed: 'You need to state time and space complexity without being prompted.',
    drill:
      'After every coding solution, say time complexity, space complexity, and the input variable driving each one.',
  },
  edgeCases: {
    label: 'Edge cases',
    covered: 'You considered failure modes and boundary cases.',
    missed: 'You need to test the answer against boundaries and weird inputs.',
    drill:
      'For each practice problem, list empty input, single item, duplicate, max-size, and invalid-state cases.',
  },
  tradeoffs: {
    label: 'Tradeoffs',
    covered: 'You compared options instead of presenting one answer as obvious.',
    missed: 'You need to explain why your choice beats at least one realistic alternative.',
    drill: 'Practice naming one rejected alternative and the cost that made you reject it.',
  },
  testing: {
    label: 'Testing',
    covered: 'You showed how you would verify the solution.',
    missed: 'You need to dry-run or test the solution before calling it done.',
    drill:
      'Close each implementation by walking through one normal case and one edge case out loud.',
  },
};

const COVERAGE_KEYS: CoachingCoverageKey[] = [
  'requirements',
  'approach',
  'complexity',
  'edgeCases',
  'tradeoffs',
  'testing',
];

const unique = (items: string[]): string[] => Array.from(new Set(items));

export const createFallbackCoachingIntelligence = (): CoachingIntelligence => ({
  stageReached: 'wrap-up',
  primaryFocus: 'Review the interview and convert the feedback into a focused practice plan.',
  coverage: [],
  evidence: [],
  nextProbe: 'Review one missed area and retry the interview with a tighter answer structure.',
  nextDrills: [
    'Redo this interview and narrate requirements, approach, complexity, and tests out loud.',
  ],
});

export const buildCoachingIntelligence = (session: InterviewSession): CoachingIntelligence => {
  const coverage: CoachingCoverageItem[] = COVERAGE_KEYS.map((key) => {
    const covered = session.plan.coverage[key];
    const notes = COVERAGE_NOTES[key];

    return {
      key,
      label: notes.label,
      status: covered ? 'covered' : 'missed',
      note: covered ? notes.covered : notes.missed,
    };
  });

  const missedDrills = COVERAGE_KEYS.filter((key) => !session.plan.coverage[key]).map(
    (key) => COVERAGE_NOTES[key].drill,
  );
  const weakAreaDrills = session.plan.weakAreas.map(
    (area) =>
      `Run one timed mini-round focused only on ${area}, then compare your answer against the rubric.`,
  );
  const nextDrills = unique([...missedDrills, ...weakAreaDrills]).slice(0, 5);

  return {
    stageReached: session.plan.currentStage,
    primaryFocus: session.plan.primaryFocus,
    coverage,
    evidence: session.memory.evidence.slice(-8).reverse(),
    nextProbe: session.plan.nextProbe,
    nextDrills:
      nextDrills.length > 0
        ? nextDrills
        : ['Repeat this problem with a stricter timer and explain each decision before coding.'],
  };
};
