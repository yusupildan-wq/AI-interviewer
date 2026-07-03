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

export type InterviewMode =
  'behavioral' | 'coding' | 'system-design' | 'resume-deep-dive' | 'conversation';

/**
 * How hard the interviewer pushes — independent of interview mode. Mode is "what
 * kind of interview"; strictness is "how much pressure". Coffee Chat still redirects
 * a candidate who wanders off-topic, just later and much more gently than Strict.
 */
export type InterviewerStrictness = 'coffee-chat' | 'standard' | 'strict';

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

export interface RubricV2 {
  communication: number;
  problemDecomposition: number;
  algorithmicCorrectness: number;
  complexityAnalysis: number;
  debuggingAbility: number;
  testingDiscipline: number;
  tradeoffReasoning: number;
  interviewerCollaboration: number;
}

export type EvidenceType =
  | 'requirement-clarification'
  | 'approach-quality'
  | 'complexity-analysis'
  | 'edge-case-awareness'
  | 'tradeoff-reasoning'
  | 'testing-discipline'
  | 'debugging-recovery'
  | 'communication-signal'
  | 'interviewer-pushback'
  | 'unresolved-concern';

export type EvidenceSeverity = 'positive' | 'neutral' | 'concern' | 'critical';

export interface InterviewEvidenceEvent {
  id: string;
  type: EvidenceType;
  severity: EvidenceSeverity;
  transcriptQuote: string;
  scoreImpact: Partial<RubricV2>;
  coachingNote: string;
  createdAt: string;
}

export interface InterviewMemory {
  explainedConcepts: string[];
  unresolvedConcerns: string[];
  strengths: string[];
  repeatedMistakes: string[];
  /** Open-ended, non-technical or personal things the candidate mentioned in passing
   * (a prior internship, a specific technology, a hobby) that the interviewer should be
   * able to reference by name later, the way a real interviewer remembers a conversation. */
  notableMentions: string[];
  nextBestProbe: string;
  rubricV2: RubricV2;
  evidence: InterviewEvidenceEvent[];
  updatedAt: string;
}

export interface CandidateSignals {
  silenceMs: number;
  messageLength: number;
  hedgingPhraseCount: number;
  codeLinesChangedSinceLastTurn: number;
  rapidEditCount: number;
  asksClarifyingQuestion: boolean;
  mentionsComplexity: boolean;
  mentionsEdgeCases: boolean;
  mentionsTradeoffs: boolean;
  mentionsTesting: boolean;
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
  strictness: InterviewerStrictness;
  problem: Problem;
  persona: InterviewerPersona;
  plan: InterviewPlan;
  memory: InterviewMemory;
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
  /** A short phrase capturing something worth remembering long-term from this turn (a
   * technology, project, or personal detail) — empty string when nothing new stands out.
   * Extracted by the same call, at no extra latency cost, rather than a separate pass. */
  notableMention: string;
}

export type InterviewStatus = 'active' | 'completed';

export type InterviewStage =
  | 'opening'
  | 'clarification'
  | 'approach'
  | 'implementation'
  | 'deep-dive'
  | 'edge-cases'
  | 'wrap-up';

export interface InterviewPlanCoverage {
  requirements: boolean;
  approach: boolean;
  complexity: boolean;
  edgeCases: boolean;
  tradeoffs: boolean;
  testing: boolean;
}

/** Coarse, heuristically-derived read on how the candidate is doing so far, used to
 * scale question difficulty up or down the way a real interviewer would. */
export type SkillEstimate = 'building-confidence' | 'on-track' | 'strong';

export interface InterviewPlan {
  currentStage: InterviewStage;
  primaryFocus: string;
  targetRole: TargetRole;
  seniority: SeniorityLevel;
  preferredLanguage: CodingLanguage;
  targetCompanies: string[];
  weakAreas: string[];
  milestones: string[];
  coverage: InterviewPlanCoverage;
  skillEstimate: SkillEstimate;
  nextProbe: string;
  updatedAt: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  mode: InterviewMode;
  strictness: InterviewerStrictness;
  problem: Problem;
  persona: InterviewerPersona;
  plan: InterviewPlan;
  memory: InterviewMemory;
  status: InterviewStatus;
  transcript: TranscriptEntry[];
  codeHistory: CodeSnapshot[];
  scores: ScoreRubric;
  interventionCount: number;
  startedAt: string;
  endedAt?: string;
  lastActivityAt: string;
}

export type HireRecommendation =
  'strong-hire' | 'hire' | 'lean-hire' | 'no-hire' | 'strong-no-hire';

export interface FeedbackReportMoment {
  quote: string;
  note: string;
}

export type CoachingCoverageKey = keyof InterviewPlanCoverage;

export type CoachingCoverageStatus = 'covered' | 'partial' | 'missed';

export interface CoachingCoverageItem {
  key: CoachingCoverageKey;
  label: string;
  status: CoachingCoverageStatus;
  note: string;
}

export interface CoachingIntelligence {
  stageReached: InterviewStage;
  primaryFocus: string;
  coverage: CoachingCoverageItem[];
  evidence: InterviewEvidenceEvent[];
  nextProbe: string;
  nextDrills: string[];
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
  coaching: CoachingIntelligence;
}

// ---------------------------------------------------------------------------
// Auth domain
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

// ---------------------------------------------------------------------------
// Profile domain
// ---------------------------------------------------------------------------

export type TargetRole =
  'frontend' | 'backend' | 'full-stack' | 'mobile' | 'ml-ai' | 'data' | 'devops' | 'security';

export type SeniorityLevel = 'intern' | 'new-grad' | 'mid-level' | 'senior' | 'staff';

export type CodingLanguage =
  'javascript' | 'typescript' | 'python' | 'java' | 'csharp' | 'cpp' | 'go' | 'rust';

export interface UserProfile {
  userId: string;
  targetRole: TargetRole;
  seniority: SeniorityLevel;
  preferredLanguage: CodingLanguage;
  targetCompanies: string[];
  weakAreas: string[];
  interviewGoal: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserProfileRequest {
  targetRole?: TargetRole;
  seniority?: SeniorityLevel;
  preferredLanguage?: CodingLanguage;
  targetCompanies?: string[];
  weakAreas?: string[];
  interviewGoal?: string;
}

// ---------------------------------------------------------------------------
// API request/response contracts
// ---------------------------------------------------------------------------

export interface CreateInterviewRequest {
  mode: InterviewMode;
  strictness?: InterviewerStrictness;
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
  plan: InterviewPlan;
}

export interface TranscribeAudioResponse {
  text: string;
}

export interface SynthesizeSpeechRequest {
  text: string;
}

export interface FeedbackFollowUpRequest {
  question: string;
}

export interface FeedbackFollowUpResponse {
  answer: string;
}

/** Lightweight row for interview history lists — avoids shipping full transcripts. */
export interface InterviewSessionSummary {
  id: string;
  mode: InterviewMode;
  strictness: InterviewerStrictness;
  problemTitle: string;
  status: InterviewStatus;
  scores: ScoreRubric;
  startedAt: string;
  endedAt?: string;
}

export interface ProgressTrendPoint {
  sessionId: string;
  date: string;
  score: number;
  problemTitle: string;
}

export interface ProgressWeakArea {
  label: string;
  count: number;
  severity: EvidenceSeverity;
  latestEvidence?: string;
}

export interface PracticePlanItem {
  title: string;
  detail: string;
  source: string;
}

export interface RecentReportSummary {
  sessionId: string;
  problemTitle: string;
  mode: InterviewMode;
  completedAt: string;
  overallScore: number;
  recommendation: HireRecommendation;
}

export interface ProgressOverview {
  completedCount: number;
  activeCount: number;
  averageScore: number;
  bestScore: number;
  latestScore?: number;
  trend: ProgressTrendPoint[];
  recentReports: RecentReportSummary[];
  activeInterviews: InterviewSessionSummary[];
  weakAreas: ProgressWeakArea[];
  practicePlan: PracticePlanItem[];
}
