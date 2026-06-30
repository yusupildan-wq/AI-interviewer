import type { CandidateSignals, CodeSnapshot } from '@ai-interviewer/shared';

const HEDGING_PHRASES = [
  'i think',
  'i guess',
  'maybe',
  'sort of',
  'kind of',
  'not sure',
  'probably',
  'i dont know',
  "i don't know",
  'um,',
  'umm',
  'uh,',
];

const COMPLEXITY_PHRASES = [
  'time complexity',
  'space complexity',
  'big o',
  'o(n',
  'o(1)',
  'o(log',
  'asymptotic',
];

const EDGE_CASE_PHRASES = [
  'edge case',
  'what if',
  'empty array',
  'empty list',
  'null',
  'duplicate',
  'negative number',
  'overflow',
  'corner case',
];

const countPhraseOccurrences = (text: string, phrases: string[]): number => {
  const normalized = text.toLowerCase();
  return phrases.reduce((count, phrase) => (normalized.includes(phrase) ? count + 1 : count), 0);
};

const containsAnyPhrase = (text: string, phrases: string[]): boolean => {
  const normalized = text.toLowerCase();
  return phrases.some((phrase) => normalized.includes(phrase));
};

const RAPID_EDIT_WINDOW_MS = 60_000;

const countRapidEdits = (codeHistory: CodeSnapshot[], now: number): number =>
  codeHistory.filter(
    (snapshot) => now - new Date(snapshot.createdAt).getTime() <= RAPID_EDIT_WINDOW_MS,
  ).length;

export interface ComputeCandidateSignalsParams {
  /** session.lastActivityAt captured BEFORE this turn was appended. */
  previousActivityAt: string;
  /** session.codeHistory AFTER this turn's snapshot (if any) was appended. */
  codeHistory: CodeSnapshot[];
  message: string;
  latestCodeSnapshot: CodeSnapshot | undefined;
}

export const computeCandidateSignals = ({
  previousActivityAt,
  codeHistory,
  message,
  latestCodeSnapshot,
}: ComputeCandidateSignalsParams): CandidateSignals => {
  const now = Date.now();
  const previousActivityMs = new Date(previousActivityAt).getTime();

  return {
    silenceMs: Math.max(0, now - previousActivityMs),
    messageLength: message.length,
    hedgingPhraseCount: countPhraseOccurrences(message, HEDGING_PHRASES),
    codeLinesChangedSinceLastTurn: latestCodeSnapshot?.linesChanged ?? 0,
    rapidEditCount: countRapidEdits(codeHistory, now),
    mentionsComplexity: containsAnyPhrase(message, COMPLEXITY_PHRASES),
    mentionsEdgeCases: containsAnyPhrase(message, EDGE_CASE_PHRASES),
  };
};
