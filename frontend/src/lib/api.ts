import type {
  AuthResponse,
  CreateInterviewRequest,
  FeedbackFollowUpRequest,
  FeedbackFollowUpResponse,
  FeedbackReport,
  InterviewMode,
  InterviewSession,
  InterviewSessionSummary,
  LoginRequest,
  Problem,
  ProgressOverview,
  SignupRequest,
  SubmitTurnRequest,
  SubmitTurnResponse,
  TranscribeAudioResponse,
  UpdateUserProfileRequest,
  UserProfile,
} from '@ai-interviewer/shared';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000';

/** The backend strips interviewer-only fields before a problem reaches the client. */
export type CandidateProblem = Omit<Problem, 'idealApproachNotes' | 'followUpAreas'>;
export type CandidateInterviewSession = Omit<InterviewSession, 'problem'> & {
  problem: CandidateProblem;
};

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

const parseErrorBody = async (response: Response): Promise<string | undefined> => {
  const body = (await response.json().catch(() => undefined)) as
    { error?: { message?: string } } | undefined;
  return body?.error?.message;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ApiError(response.status, message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signup = (body: SignupRequest): Promise<AuthResponse> =>
  request('/auth/signup', { method: 'POST', body: JSON.stringify(body) });

export const login = (body: LoginRequest): Promise<AuthResponse> =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(body) });

export const logout = (): Promise<void> => request('/auth/logout', { method: 'POST' });

export const getCurrentUser = (): Promise<AuthResponse> => request('/auth/me');

/** Local-only convenience: signs in as a fixed seeded dev account. The backend refuses this in production. */
export const devLogin = (): Promise<AuthResponse> => request('/auth/dev-login', { method: 'POST' });

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getProfile = (): Promise<UserProfile> => request('/profile');

export const updateProfile = (body: UpdateUserProfileRequest): Promise<UserProfile> =>
  request('/profile', { method: 'PUT', body: JSON.stringify(body) });

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export const listProblems = (mode?: InterviewMode): Promise<CandidateProblem[]> =>
  request(`/problems${mode ? `?mode=${mode}` : ''}`);

export const listInterviewHistory = (): Promise<InterviewSessionSummary[]> =>
  request('/interviews');

export const getProgressOverview = (): Promise<ProgressOverview> => request('/progress');

export const deleteInterview = (sessionId: string): Promise<void> =>
  request(`/interviews/${sessionId}`, { method: 'DELETE' });

export const deleteAllInterviews = (): Promise<{ deletedCount: number }> =>
  request('/interviews', { method: 'DELETE' });

export const createInterview = (body: CreateInterviewRequest): Promise<CandidateInterviewSession> =>
  request('/interviews', { method: 'POST', body: JSON.stringify(body) });

export const getInterview = (sessionId: string): Promise<CandidateInterviewSession> =>
  request(`/interviews/${sessionId}`);

export const submitTurn = (
  sessionId: string,
  body: SubmitTurnRequest,
): Promise<SubmitTurnResponse> =>
  request(`/interviews/${sessionId}/turns`, { method: 'POST', body: JSON.stringify(body) });

export const endInterview = (sessionId: string): Promise<CandidateInterviewSession> =>
  request(`/interviews/${sessionId}/end`, { method: 'POST' });

export const getFeedbackReport = (sessionId: string): Promise<FeedbackReport> =>
  request(`/interviews/${sessionId}/report`);

export const askFeedbackFollowUp = (
  sessionId: string,
  body: FeedbackFollowUpRequest,
): Promise<FeedbackFollowUpResponse> =>
  request(`/interviews/${sessionId}/report/follow-up`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const transcribeAudio = async (audio: Blob): Promise<TranscribeAudioResponse> => {
  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': audio.type || 'audio/webm' },
    body: audio,
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ApiError(
      response.status,
      message ?? `Transcription failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<TranscribeAudioResponse>;
};

export const synthesizeSpeech = async (text: string, signal?: AbortSignal): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}/voice/speak`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ApiError(
      response.status,
      message ?? `Speech synthesis failed with status ${response.status}`,
    );
  }

  return response.blob();
};

export { ApiError };
