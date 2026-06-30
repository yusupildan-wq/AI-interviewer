import type {
  CreateInterviewRequest,
  FeedbackReport,
  InterviewMode,
  InterviewSession,
  Problem,
  SubmitTurnRequest,
  SubmitTurnResponse,
  TranscribeAudioResponse,
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

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { error?: { message?: string } } | undefined;
    throw new ApiError(
      response.status,
      body?.error?.message ?? `Request failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
};

export const listProblems = (mode?: InterviewMode): Promise<CandidateProblem[]> =>
  request(`/problems${mode ? `?mode=${mode}` : ''}`);

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

export const transcribeAudio = async (audio: Blob): Promise<TranscribeAudioResponse> => {
  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm' },
    body: audio,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { error?: { message?: string } } | undefined;
    throw new ApiError(
      response.status,
      body?.error?.message ?? `Transcription failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<TranscribeAudioResponse>;
};

export const synthesizeSpeech = async (text: string): Promise<Blob> => {
  const response = await fetch(`${API_BASE_URL}/voice/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as
      { error?: { message?: string } } | undefined;
    throw new ApiError(
      response.status,
      body?.error?.message ?? `Speech synthesis failed with status ${response.status}`,
    );
  }

  return response.blob();
};

export { ApiError };
