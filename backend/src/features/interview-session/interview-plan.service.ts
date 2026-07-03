import type {
  CandidateSignals,
  InterviewMemory,
  InterviewMode,
  InterviewPlan,
  InterviewStage,
  SkillEstimate,
  TranscriptEntry,
  UserProfile,
} from '@ai-interviewer/shared';

const DEFAULT_PROFILE: Pick<
  UserProfile,
  'targetRole' | 'seniority' | 'preferredLanguage' | 'targetCompanies' | 'weakAreas'
> = {
  targetRole: 'full-stack',
  seniority: 'mid-level',
  preferredLanguage: 'typescript',
  targetCompanies: [],
  weakAreas: [],
};

const focusForMode = (mode: InterviewMode): string => {
  if (mode === 'coding') return 'reasoning out loud, correctness, complexity, and edge cases';
  if (mode === 'system-design') return 'requirements, scale, tradeoffs, and failure modes';
  if (mode === 'behavioral')
    return 'specific examples, ownership, tradeoffs, and measurable impact';
  return 'technical ownership, decision quality, and depth on real project details';
};

const milestonesForMode = (mode: InterviewMode): string[] => {
  if (mode === 'coding') {
    return [
      'Clarify requirements and constraints',
      'State approach and complexity',
      'Implement or walk through solution',
      'Test edge cases',
      'Reflect on alternatives',
    ];
  }
  if (mode === 'system-design') {
    return [
      'Clarify product scope and scale',
      'Define APIs and data model',
      'Choose storage and caching strategy',
      'Identify bottlenecks and failure modes',
      'Discuss tradeoffs and evolution',
    ];
  }
  if (mode === 'behavioral') {
    return [
      'Anchor one specific situation',
      'Clarify personal role and stakes',
      'Explain actions and tradeoffs',
      'Name measurable outcome',
      'Reflect on learning',
    ];
  }
  return [
    'Select a meaningful project',
    'Clarify personal ownership',
    'Explain technical decisions',
    'Defend tradeoffs and failures',
    'Reflect on what would change today',
  ];
};

const initialProbeForMode = (mode: InterviewMode): string => {
  if (mode === 'coding')
    return 'Listen for clarification before approach; probe complexity if omitted.';
  if (mode === 'system-design') return 'Listen for scope and scale before architecture choices.';
  if (mode === 'behavioral') return 'Listen for a concrete STAR story rather than general claims.';
  return 'Listen for personal ownership and the decisions the candidate personally made.';
};

export const createInterviewPlan = (mode: InterviewMode, profile?: UserProfile): InterviewPlan => {
  const source = profile ?? DEFAULT_PROFILE;
  const weakAreas = source.weakAreas.length > 0 ? source.weakAreas : [];

  return {
    currentStage: 'opening',
    primaryFocus:
      weakAreas.length > 0
        ? `${focusForMode(mode)}; especially ${weakAreas.slice(0, 3).join(', ')}`
        : focusForMode(mode),
    targetRole: source.targetRole,
    seniority: source.seniority,
    preferredLanguage: source.preferredLanguage,
    targetCompanies: source.targetCompanies,
    weakAreas,
    milestones: milestonesForMode(mode),
    coverage: {
      requirements: false,
      approach: false,
      complexity: false,
      edgeCases: false,
      tradeoffs: false,
      testing: false,
    },
    skillEstimate: 'on-track',
    nextProbe: initialProbeForMode(mode),
    updatedAt: new Date().toISOString(),
  };
};

/** Cheap, deterministic read on how the candidate is doing so far — no LLM call needed.
 * Based on the qualitative signals already accumulated in memory (not raw rubric scores,
 * which are clamped at a 0 floor and can't distinguish "struggling" from "no signal yet"). */
const estimateSkill = (
  memory: Pick<InterviewMemory, 'strengths' | 'unresolvedConcerns' | 'repeatedMistakes'>,
): SkillEstimate => {
  const positiveSignal = memory.strengths.length;
  const negativeSignal = memory.unresolvedConcerns.length + memory.repeatedMistakes.length;

  if (memory.repeatedMistakes.length >= 2 || negativeSignal - positiveSignal >= 2) {
    return 'building-confidence';
  }
  if (positiveSignal - negativeSignal >= 3) {
    return 'strong';
  }
  return 'on-track';
};

const hasCandidateTurns = (transcript: TranscriptEntry[]): boolean =>
  transcript.some((entry) => entry.role === 'candidate');

const countCandidateTurns = (transcript: TranscriptEntry[]): number =>
  transcript.filter((entry) => entry.role === 'candidate').length;

const inferStage = (
  mode: InterviewMode,
  transcript: TranscriptEntry[],
  coverage: InterviewPlan['coverage'],
  hasCode: boolean,
): InterviewStage => {
  const candidateTurns = countCandidateTurns(transcript);

  if (!hasCandidateTurns(transcript)) return 'opening';
  if (!coverage.requirements && candidateTurns <= 2) return 'clarification';
  if (!coverage.approach && candidateTurns <= 3) return 'approach';

  // Checked before the mode-specific branches below, which would otherwise always
  // claim coding (once code exists) and system-design (once approach is covered)
  // interviews permanently, making "wrap-up" structurally unreachable for either.
  const substantiallyCovered =
    coverage.approach &&
    coverage.edgeCases &&
    (mode !== 'coding' || coverage.testing) &&
    (mode === 'behavioral' || coverage.tradeoffs || coverage.complexity);
  if (substantiallyCovered && candidateTurns >= 5) return 'wrap-up';
  if (candidateTurns >= 9) return 'wrap-up';

  if (mode === 'coding' && hasCode) return coverage.edgeCases ? 'deep-dive' : 'implementation';
  if (mode === 'system-design' && coverage.approach)
    return coverage.tradeoffs ? 'deep-dive' : 'approach';
  return coverage.edgeCases || coverage.tradeoffs ? 'deep-dive' : 'approach';
};

const chooseNextProbe = (
  mode: InterviewMode,
  coverage: InterviewPlan['coverage'],
  stage: InterviewStage,
): string => {
  if (!coverage.requirements)
    return 'Ask for explicit assumptions or requirements if the next turn skips them.';
  if (!coverage.approach) return 'Ask the candidate to commit to an approach and why it fits.';
  if (!coverage.complexity && mode === 'coding') return 'Probe time and space complexity.';
  if (!coverage.tradeoffs && mode !== 'behavioral')
    return 'Probe why this option beats a realistic alternative.';
  if (!coverage.edgeCases) return 'Probe edge cases or failure modes tied to the candidate answer.';
  if (!coverage.testing && mode === 'coding')
    return 'Ask how they would test or dry-run the solution.';
  if (stage === 'wrap-up')
    return 'Ask them to trace through the solution with one concrete example, then ask if they have any questions for you.';
  return 'Deepen the most specific claim the candidate just made.';
};

export const updateInterviewPlan = (
  plan: InterviewPlan,
  mode: InterviewMode,
  transcript: TranscriptEntry[],
  signals: CandidateSignals,
  currentCode: string | undefined,
  memory: Pick<InterviewMemory, 'strengths' | 'unresolvedConcerns' | 'repeatedMistakes'>,
): InterviewPlan => {
  const message = transcript.at(-1)?.content.toLowerCase() ?? '';
  const hasCode = Boolean(currentCode?.trim());

  const coverage: InterviewPlan['coverage'] = {
    requirements:
      plan.coverage.requirements ||
      signals.asksClarifyingQuestion ||
      /\bassum|requirement|constraint|input|output|scope|scale\b/.test(message),
    approach:
      plan.coverage.approach ||
      /\bapproach|use|build|design|implement|algorithm|hash|cache|queue|database|api\b/.test(
        message,
      ),
    complexity: plan.coverage.complexity || signals.mentionsComplexity,
    edgeCases: plan.coverage.edgeCases || signals.mentionsEdgeCases,
    tradeoffs: plan.coverage.tradeoffs || signals.mentionsTradeoffs,
    testing: plan.coverage.testing || signals.mentionsTesting,
  };

  const currentStage = inferStage(mode, transcript, coverage, hasCode);

  return {
    ...plan,
    currentStage,
    coverage,
    skillEstimate: estimateSkill(memory),
    nextProbe: chooseNextProbe(mode, coverage, currentStage),
    updatedAt: new Date().toISOString(),
  };
};
