export type HealthStatus = {
  status: 'ok';
  service: 'ai-interviewer-api';
  timestamp: string;
  uptimeSeconds: number;
};

export const APP_NAME = 'AI Interviewer';

// ---------------------------------------------------------------------------
// Interview domain
// ---------------------------------------------------------------------------

export type InterviewMode = 'behavioral' | 'coding' | 'system-design' | 'resume-deep-dive';

export type InterventionType =
  | 'clarify'
  | 'pushback'
  | 'hint'
  | 'redirect'
  | 'challenge'
  | 'deepen'
  | 'encourage'
  | 'evaluate'
  | 'none';

export type SpeakerRole = 'candidate' | 'interviewer' | 'system';

export interface TranscriptEntry {
  id: string;
  role: SpeakerRole;
  content: string;
  createdAt: string;
  interventionType?: InterventionType;
}

export interface CodeSnapshot {
  id: string;
  code: string;
  language: string;
  createdAt: string;
  linesChanged: number;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

export interface Problem {
  id: string;
  mode: InterviewMode;
  title: string;
  prompt: string;
  difficulty: ProblemDifficulty;
  category: string;
  constraints?: string[];
  examples?: ProblemExample[];
  /** Interviewer-only context, never shown to the candidate. */
  idealApproachNotes?: string;
  /** Tradeoffs, edge cases, and follow-ups the interviewer should probe for. */
  followUpAreas?: string[];
}

export interface ScoreRubric {
  communication: number;
  problemSolving: number;
  technicalDepth: number;
  confidence: number;
}

export interface CandidateSignals {
  silenceMs: number;
  messageLength: number;
  hedgingPhraseCount: number;
  codeLinesChangedSinceLastTurn: number;
  rapidEditCount: number;
  mentionsComplexity: boolean;
  mentionsEdgeCases: boolean;
}

export interface InterviewerPersona {
  name: string;
  styleSummary: string;
}

/**
 * Inputs and output shape match the Interviewer Decision Engine spec exactly:
 * the engine runs on every candidate turn and decides whether/how to intervene.
 */
export interface DecisionEngineInput {
  mode: InterviewMode;
  problem: Problem;
  persona: InterviewerPersona;
  transcript: TranscriptEntry[];
  currentCandidateMessage: string;
  currentCode?: string;
  elapsedMs: number;
  candidateSignals: CandidateSignals;
  previousInterventions: TranscriptEntry[];
}

export interface DecisionEngineOutput {
  shouldIntervene: boolean;
  interventionType: InterventionType;
  reason: string;
  messageToCandidate: string;
  scoreImpact: ScoreRubric;
}

export type InterviewStatus = 'active' | 'completed';

export interface InterviewSession {
  id: string;
  mode: InterviewMode;
  problem: Problem;
  persona: InterviewerPersona;
  status: InterviewStatus;
  transcript: TranscriptEntry[];
  codeHistory: CodeSnapshot[];
  scores: ScoreRubric;
  interventionCount: number;
  startedAt: string;
  endedAt?: string;
  lastActivityAt: string;
}

export type HireRecommendation = 'strong-hire' | 'hire' | 'lean-hire' | 'no-hire' | 'strong-no-hire';

export interface FeedbackReportMoment {
  quote: string;
  note: string;
}

export interface FeedbackReport {
  sessionId: string;
  generatedAt: string;
  overallScore: number;
  scores: ScoreRubric;
  summary: string;
  strengths: string[];
  growthAreas: string[];
  notableMoments: FeedbackReportMoment[];
  recommendation: HireRecommendation;
}

// ---------------------------------------------------------------------------
// API request/response contracts
// ---------------------------------------------------------------------------

export interface CreateInterviewRequest {
  mode: InterviewMode;
  problemId?: string;
}

export interface SubmitTurnRequest {
  message: string;
  code?: string;
}

export interface SubmitTurnResponse {
  transcriptEntry: TranscriptEntry;
  interventionEntry?: TranscriptEntry;
  decision: DecisionEngineOutput;
  scores: ScoreRubric;
}

export interface TranscribeAudioResponse {
  text: string;
}

export interface SynthesizeSpeechRequest {
  text: string;
}
