import { readFileSync } from 'node:fs';

import {
  AI_BACKCHANNEL_DELAY_MS,
  type CandidateSignals,
  CONVERSATION_SILENCE_TURN_MS,
  type DecisionEngineOutput,
  INTERVIEW_SILENCE_TURN_MS,
  RECORDER_SILENCE_TURN_MS,
  TTS_FALLBACK_TIMEOUT_MS,
  isLikelySpeakerEcho,
} from '@ai-interviewer/shared';

import {
  createInterviewMemory,
  updateInterviewMemory,
} from '../features/interview-session/interview-memory.service.js';
import { hasScoreImpact } from '../features/interview-session/session.service.js';

const audioPlayerSource = readFileSync(
  new URL('../../../frontend/src/hooks/useAudioPlayer.ts', import.meta.url),
  'utf8',
);

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const evalTurnTakingLatencyBudgets = (): void => {
  assert(
    CONVERSATION_SILENCE_TURN_MS <= 700,
    'Conversation mode must finalize speech quickly after the user stops talking.',
  );
  assert(
    INTERVIEW_SILENCE_TURN_MS <= 900,
    'Interview mode speech finalization must stay below one second.',
  );
  assert(
    RECORDER_SILENCE_TURN_MS <= 900,
    'Recorder fallback silence detection must stay below one second.',
  );
  assert(
    CONVERSATION_SILENCE_TURN_MS < INTERVIEW_SILENCE_TURN_MS,
    'Conversation mode should be faster than structured interview mode.',
  );
  assert(
    AI_BACKCHANNEL_DELAY_MS <= 800,
    'Alex should acknowledge the user quickly if the full response is not ready yet.',
  );
  assert(
    TTS_FALLBACK_TIMEOUT_MS <= 1500,
    'High-quality TTS must fall back quickly enough to avoid dead air.',
  );
};

const evalEchoFilteringRejectsAlex = (): void => {
  const alex =
    'Yep, I can hear you. Whenever you are ready, go ahead and walk me through your thinking on the LRU cache.';
  const echoed = 'I can hear you whenever you are ready walk me through your thinking';

  assert(isLikelySpeakerEcho(echoed, alex), "Alex's own speech should be treated as echo.");
};

const evalEchoFilteringAllowsInterruptions = (): void => {
  const alex =
    'Yep, I can hear you. Whenever you are ready, go ahead and walk me through your thinking on the LRU cache.';
  const interruption =
    'Actually pause for a second, I want to switch into conversation mode and ask about the app speed.';

  assert(
    !isLikelySpeakerEcho(interruption, alex),
    'A real candidate interruption must not be discarded as echo.',
  );
};

const zeroDecision: DecisionEngineOutput = {
  shouldIntervene: false,
  interventionType: 'encourage',
  reason: 'Nothing to add.',
  messageToCandidate: '',
  scoreImpact: {
    communication: 0,
    problemSolving: 0,
    technicalDepth: 0,
    confidence: 0,
  },
  notableMention: '',
};

const neutralSignals: CandidateSignals = {
  silenceMs: 0,
  messageLength: 0,
  hedgingPhraseCount: 0,
  codeLinesChangedSinceLastTurn: 0,
  rapidEditCount: 0,
  asksClarifyingQuestion: false,
  mentionsComplexity: false,
  mentionsEdgeCases: false,
  mentionsTradeoffs: false,
  mentionsTesting: false,
};

const evalNoOpTurnsAvoidPersistenceWork = (): void => {
  assert(!hasScoreImpact(zeroDecision.scoreImpact), 'Zero-impact turns must skip score writes.');
  assert(
    hasScoreImpact({ ...zeroDecision.scoreImpact, communication: 1 }),
    'Non-zero score impact must still persist scoring.',
  );

  const memory = createInterviewMemory('conversation');
  const nextMemory = updateInterviewMemory(
    memory,
    'conversation',
    [],
    neutralSignals,
    zeroDecision,
    undefined,
  );

  assert(
    nextMemory === memory,
    'Conversation memory should not be rewritten when there is no new notable mention.',
  );
};

const evalBrowserSpeechEventsAreGenerationGuarded = (): void => {
  assert(
    audioPlayerSource.includes('speechGenerationRef'),
    'Browser speech fallback must track generations so stale events cannot corrupt call state.',
  );
  assert(
    (audioPlayerSource.match(/speechGeneration !== speechGenerationRef\.current/g) ?? []).length >=
      3,
    'Browser speech start/end/error handlers must ignore stale canceled utterance events.',
  );
};

const evals = [
  ['turn-taking latency budgets stay fast', evalTurnTakingLatencyBudgets],
  ['echo filtering rejects Alex playback', evalEchoFilteringRejectsAlex],
  ['echo filtering allows real interruptions', evalEchoFilteringAllowsInterruptions],
  ['no-op turns avoid persistence work', evalNoOpTurnsAvoidPersistenceWork],
  ['browser speech events are generation guarded', evalBrowserSpeechEventsAreGenerationGuarded],
] as const;

for (const [name, run] of evals) {
  run();
  console.log(`PASS ${name}`);
}

console.log(`\n${evals.length} realtime-call evals passed.`);
