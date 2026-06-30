import type { ScoreRubric, TranscriptEntry } from '@ai-interviewer/shared';
import Editor from '@monaco-editor/react';
import { Keyboard, Loader2, Mic, Send, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import {
  ApiError,
  type CandidateInterviewSession,
  endInterview,
  getInterview,
  submitTurn,
  synthesizeSpeech,
  transcribeAudio,
} from '../../lib/api';
import { InterviewerAvatar, type AvatarState } from './InterviewerAvatar';
import { ProblemPanel } from './ProblemPanel';
import { ScorePanel } from './ScorePanel';
import { TranscriptPanel } from './TranscriptPanel';

const CODE_STARTER = '// Talk through your approach, then write your solution here.\n';

export const InterviewRoomPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<CandidateInterviewSession | undefined>();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [scores, setScores] = useState<ScoreRubric | undefined>();
  const [code, setCode] = useState(CODE_STARTER);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [showTypedFallback, setShowTypedFallback] = useState(false);
  const [typedMessage, setTypedMessage] = useState('');

  const recorder = useVoiceRecorder();
  const player = useAudioPlayer();
  const browserVoice = useSpeechSynthesis();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getInterview(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        setSession(loaded);
        setTranscript(loaded.transcript);
        setScores(loaded.scores);
        setIsLoading(false);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof ApiError ? caught.message : 'Could not load this interview.');
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isCoding = session?.mode === 'coding';
  const isBusy = isProcessing || recorder.isRecording;

  const sendTurn = async (text: string) => {
    if (!sessionId) return;
    setIsProcessing(true);

    try {
      const result = await submitTurn(sessionId, {
        message: text,
        code: isCoding ? code : undefined,
      });

      setTranscript((previous) => {
        const next = [...previous, result.transcriptEntry];
        if (result.interventionEntry) {
          next.push(result.interventionEntry);
        }
        return next;
      });
      setScores(result.scores);

      if (result.interventionEntry?.content) {
        try {
          // Prefer the higher-quality Groq voice; fall back to the browser's
          // built-in speech synthesis if that call fails (e.g. pending model
          // access on the Groq account) so the interviewer still speaks.
          const audioBlob = await synthesizeSpeech(result.interventionEntry.content);
          await player.play(audioBlob);
        } catch {
          try {
            await browserVoice.speak(result.interventionEntry.content);
          } catch {
            // Both voice paths failed — not fatal, the message is still visible
            // in the transcript, so the candidate can keep going.
          }
        }
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The interviewer could not respond. Try again.');
      // The backend persists the candidate's turn before the decision engine runs, so a
      // failure here still leaves the message recorded server-side. Re-sync from the
      // session instead of silently dropping it.
      try {
        const refreshed = await getInterview(sessionId);
        setTranscript(refreshed.transcript);
        setScores(refreshed.scores);
      } catch {
        // ignore — surfaced error above already covers this
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicToggle = async () => {
    if (recorder.isRecording) {
      const blob = await recorder.stop();
      if (!blob) return;

      setIsProcessing(true);
      setError(undefined);
      try {
        const { text } = await transcribeAudio(blob);
        if (!text.trim()) {
          setError("Didn't catch that — try again.");
          setIsProcessing(false);
          return;
        }
        await sendTurn(text);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not transcribe that — try again.');
        setIsProcessing(false);
      }
      return;
    }

    setError(undefined);
    await recorder.start();
  };

  const handleTypedSubmit = async () => {
    const outgoing = typedMessage.trim();
    if (!outgoing || isBusy) return;
    setTypedMessage('');
    await sendTurn(outgoing);
  };

  const handleEnd = async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    try {
      await endInterview(sessionId);
      navigate(`/interview/${sessionId}/report`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not end the interview.');
      setIsEnding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-graphite">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-graphite">{error ?? 'Interview session not found.'}</p>
      </div>
    );
  }

  const isSpeaking = player.isSpeaking || browserVoice.isSpeaking;
  const avatarState: AvatarState = recorder.isRecording
    ? 'listening'
    : isSpeaking
      ? 'speaking'
      : isProcessing
        ? 'thinking'
        : 'idle';

  const combinedError = error ?? recorder.error;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">{session.mode.replace('-', ' ')}</p>
          <p className="text-sm text-graphite">Interviewer: {session.persona.name}</p>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          disabled={isEnding}
          className="rounded-md border border-white/15 bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:border-white/25 hover:bg-slatewash disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEnding ? 'Ending…' : 'End interview'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr_320px]">
        <div className="space-y-4 lg:order-1">
          <ProblemPanel problem={session.problem} />
        </div>

        <div className="flex flex-col gap-4 lg:order-2">
          {isCoding && (
            <div className="h-72 overflow-hidden rounded-md border border-white/10">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                value={code}
                onChange={(value) => setCode(value ?? '')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 13 }}
              />
            </div>
          )}

          <InterviewerAvatar name={session.persona.name} state={avatarState} audioLevel={player.level} />

          <div className="h-72 flex-1">
            <TranscriptPanel transcript={transcript} interviewerName={session.persona.name} />
          </div>

          {combinedError && <p className="text-sm font-medium text-red-400">{combinedError}</p>}

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void handleMicToggle()}
              disabled={isProcessing}
              aria-label={recorder.isRecording ? 'Stop recording' : 'Start talking'}
              className={[
                'inline-flex h-16 w-16 items-center justify-center rounded-full text-canvas shadow-glow transition disabled:cursor-not-allowed disabled:opacity-50',
                recorder.isRecording ? 'animate-pulse bg-red-400' : 'bg-signal hover:brightness-110',
              ].join(' ')}
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" size={24} aria-hidden="true" />
              ) : recorder.isRecording ? (
                <Square size={22} aria-hidden="true" />
              ) : (
                <Mic size={24} aria-hidden="true" />
              )}
            </button>
            <p className="text-xs text-graphite">
              {recorder.isRecording
                ? 'Tap to stop and send'
                : isProcessing
                  ? 'Alex is responding…'
                  : 'Tap to talk'}
            </p>

            <button
              type="button"
              onClick={() => setShowTypedFallback((value) => !value)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-graphite transition hover:text-ink"
            >
              <Keyboard size={13} aria-hidden="true" />
              {showTypedFallback ? 'Hide typing' : 'Type instead'}
            </button>
          </div>

          {showTypedFallback && (
            <div className="flex items-end gap-2">
              <textarea
                value={typedMessage}
                onChange={(event) => setTypedMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleTypedSubmit();
                  }
                }}
                placeholder="Type your response…"
                rows={2}
                className="flex-1 resize-none rounded-md border border-white/15 bg-surface p-3 text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleTypedSubmit()}
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} aria-hidden="true" />
                Send
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:order-3">{scores && <ScorePanel scores={scores} />}</div>
      </div>
    </section>
  );
};
