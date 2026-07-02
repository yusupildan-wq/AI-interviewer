import type {
  FeedbackReport,
  InterviewMode,
  InterviewStage,
  InterviewerStrictness,
  ScoreRubric,
  TranscriptEntry,
} from '@ai-interviewer/shared';
import Editor from '@monaco-editor/react';
import {
  Activity,
  BookOpenText,
  Clock3,
  Code2,
  Keyboard,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  PanelRightClose,
  PhoneOff,
  Send,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import {
  ApiError,
  askFeedbackFollowUp,
  type CandidateInterviewSession,
  endInterview,
  getFeedbackReport,
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

const MODE_LABEL: Record<InterviewMode, string> = {
  behavioral: 'Behavioral',
  coding: 'Live coding',
  'system-design': 'System design',
  'resume-deep-dive': 'Resume deep dive',
};

const STRICTNESS_LABEL: Record<InterviewerStrictness, string> = {
  'coffee-chat': 'Coffee chat',
  standard: 'Standard',
  strict: 'Strict',
};

type SidePanel = 'problem' | 'code' | 'transcript' | 'score';
type DebriefState = 'idle' | 'generating' | 'speaking' | 'ready' | 'answering';
type DebriefMessage = { role: 'candidate' | 'interviewer'; content: string };

const formatElapsed = (startedAt: string): string => {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );
  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const STAGE_LABEL: Record<InterviewStage, string> = {
  opening: 'Opening',
  clarification: 'Clarification',
  approach: 'Approach',
  implementation: 'Implementation',
  'deep-dive': 'Deep dive',
  'edge-cases': 'Edge cases',
  'wrap-up': 'Wrap-up',
};

const interviewerStatus = (state: AvatarState): string => {
  if (state === 'listening') return 'Listening';
  if (state === 'thinking') return 'Reviewing';
  if (state === 'speaking') return 'Speaking';
  return 'Ready';
};

const latestInterviewerMessage = (transcript: TranscriptEntry[]): TranscriptEntry | undefined =>
  transcript
    .slice()
    .reverse()
    .find((entry) => entry.role === 'interviewer');

const buildSpokenDebrief = (report: FeedbackReport): string => {
  const strengths = report.strengths.slice(0, 2).join(' Also, ');
  const growthAreas = report.growthAreas.slice(0, 2).join(' The next thing to improve is ');
  const drills = report.coaching.nextDrills.slice(0, 2).join(' Then, ');

  return [
    `Now that the interview has concluded, here is your debrief.`,
    `Overall, I scored this at ${report.overallScore} out of 100, with a ${report.recommendation.replaceAll('-', ' ')} recommendation.`,
    report.summary,
    strengths ? `What you did well: ${strengths}.` : '',
    growthAreas ? `What I would improve first: ${growthAreas}.` : '',
    `The main coaching focus is ${report.coaching.primaryFocus}.`,
    drills ? `For practice: ${drills}.` : '',
    `You can ask me follow-up questions about the feedback now.`,
  ]
    .filter(Boolean)
    .join(' ');
};

export const InterviewRoomPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<CandidateInterviewSession | undefined>();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [scores, setScores] = useState<ScoreRubric | undefined>();
  const [code, setCode] = useState(CODE_STARTER);
  const [elapsed, setElapsed] = useState('00:00');
  const [activePanel, setActivePanel] = useState<SidePanel | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);
  const [debriefState, setDebriefState] = useState<DebriefState>('idle');
  const [debriefReport, setDebriefReport] = useState<FeedbackReport | undefined>();
  const [debriefMessages, setDebriefMessages] = useState<DebriefMessage[]>([]);
  const [debriefQuestion, setDebriefQuestion] = useState('');

  const [showTypedFallback, setShowTypedFallback] = useState(false);
  const [typedMessage, setTypedMessage] = useState('');

  const recorder = useVoiceRecorder();
  const player = useAudioPlayer();
  const isSpeaking = player.isSpeaking;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getInterview(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        setSession(loaded);
        setTranscript(loaded.transcript);
        setScores(loaded.scores);
        setElapsed(formatElapsed(loaded.startedAt));
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

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setElapsed(formatElapsed(session.startedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  const isCoding = session?.mode === 'coding';
  const isDebriefLocked =
    debriefState === 'generating' || debriefState === 'speaking' || debriefState === 'answering';
  const isBusy = isProcessing || isDebriefLocked;

  const sendTurn = useCallback(
    async (text: string) => {
      if (!sessionId) return;
      player.stop();
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
        setSession((previous) => (previous ? { ...previous, plan: result.plan } : previous));
        setIsProcessing(false);

        if (result.interventionEntry?.content) {
          try {
            const audioBlob = await synthesizeSpeech(result.interventionEntry.content);
            await player.play(audioBlob);
          } catch (caught) {
            setError(
              caught instanceof ApiError
                ? caught.message
                : 'High-quality interviewer voice is unavailable.',
            );
          }
        }
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'The interviewer could not respond. Try again.',
        );
        try {
          const refreshed = await getInterview(sessionId);
          setTranscript(refreshed.transcript);
          setScores(refreshed.scores);
        } catch {
          // The visible error above is enough context for the candidate.
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [code, isCoding, player, sessionId],
  );

  const handleVoiceBlob = useCallback(
    async (blob: Blob | undefined) => {
      if (!blob || isProcessing || isDebriefLocked || debriefReport) return;

      setIsProcessing(true);
      setError(undefined);
      try {
        const { text } = await transcribeAudio(blob);
        if (!text.trim()) {
          setError("Didn't catch that. Try again.");
          setIsProcessing(false);
          return;
        }
        await sendTurn(text);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Could not transcribe that. Try again.',
        );
        setIsProcessing(false);
      }
    },
    [debriefReport, isDebriefLocked, isProcessing, sendTurn],
  );

  useEffect(() => {
    if (
      !session ||
      !autoListenEnabled ||
      showTypedFallback ||
      isProcessing ||
      isEnding ||
      isDebriefLocked ||
      debriefReport ||
      recorder.isRecording ||
      recorder.error
    ) {
      return;
    }

    void recorder.start({
      autoStop: true,
      onAutoStop: handleVoiceBlob,
      onSpeechStart: isSpeaking ? player.stop : undefined,
      speechThreshold: isSpeaking ? 0.055 : undefined,
    });
  }, [
    autoListenEnabled,
    debriefReport,
    handleVoiceBlob,
    isDebriefLocked,
    isEnding,
    isProcessing,
    isSpeaking,
    player.stop,
    recorder,
    session,
    showTypedFallback,
  ]);

  const handleMicToggle = async () => {
    setError(undefined);
    if (autoListenEnabled || recorder.isRecording) {
      setAutoListenEnabled(false);
      if (recorder.isRecording) {
        await recorder.stop();
      }
      return;
    }

    setAutoListenEnabled(true);
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
    setDebriefState('generating');
    setAutoListenEnabled(false);
    player.stop();
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
      const completed = await endInterview(sessionId);
      setSession(completed);
      const report = await getFeedbackReport(sessionId);
      setDebriefReport(report);
      const spokenDebrief = buildSpokenDebrief(report);
      setDebriefMessages([{ role: 'interviewer', content: spokenDebrief }]);

      try {
        setDebriefState('speaking');
        const audioBlob = await synthesizeSpeech(spokenDebrief);
        await player.play(audioBlob);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Could not play the spoken debrief.',
        );
      }

      setDebriefState('ready');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not end the interview.');
      setDebriefState('idle');
      setIsEnding(false);
    }
  };

  const handleDebriefFollowUp = async () => {
    const question = debriefQuestion.trim();
    if (!sessionId || !question || debriefState !== 'ready') return;

    setDebriefQuestion('');
    setDebriefState('answering');
    setError(undefined);
    setDebriefMessages((previous) => [...previous, { role: 'candidate', content: question }]);

    try {
      const { answer } = await askFeedbackFollowUp(sessionId, { question });
      setDebriefMessages((previous) => [...previous, { role: 'interviewer', content: answer }]);
      try {
        const audioBlob = await synthesizeSpeech(answer);
        await player.play(audioBlob);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Could not play the follow-up answer.',
        );
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not answer that follow-up question.',
      );
    } finally {
      setDebriefState('ready');
    }
  };

  const avatarState: AvatarState = recorder.isRecording
    ? 'listening'
    : isSpeaking
      ? 'speaking'
      : isProcessing || debriefState === 'generating' || debriefState === 'answering'
        ? 'thinking'
        : 'idle';

  const combinedError = error ?? recorder.error;
  const latestPrompt = latestInterviewerMessage(transcript);

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

  const panelButtons: {
    id: SidePanel;
    label: string;
    icon: typeof BookOpenText;
    disabled?: boolean;
  }[] = [
    { id: 'problem', label: 'Problem', icon: BookOpenText },
    { id: 'code', label: 'Code', icon: Code2, disabled: !isCoding },
    { id: 'transcript', label: 'Transcript', icon: MessageSquareText },
    { id: 'score', label: 'Read', icon: Activity },
  ];

  return (
    <section className="interview-room mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-surface/80 px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-signal/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-signal">
              Live interview
            </span>
            <span className="rounded-full bg-slatewash px-2.5 py-1 text-[11px] font-semibold text-graphite">
              {MODE_LABEL[session.mode]}
            </span>
            <span className="rounded-full bg-amberline/10 px-2.5 py-1 text-[11px] font-semibold text-amberline">
              {STRICTNESS_LABEL[session.strictness]}
            </span>
            <span className="rounded-full bg-slatewash px-2.5 py-1 text-[11px] font-semibold text-graphite">
              {STAGE_LABEL[session.plan.currentStage]}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-canvas px-3 py-2 text-ink sm:inline-flex">
            <Clock3 size={16} aria-hidden="true" />
            <span className="font-mono">{elapsed}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-canvas px-3 py-2 text-graphite">
            <span className="h-2 w-2 rounded-full bg-signal" />
            {interviewerStatus(avatarState)}
          </div>
        </div>
      </div>

      <div className="interview-call-grid">
        <div className="interview-call-stage rounded-md border border-white/10 bg-black">
          <InterviewerAvatar
            name={session.persona.name}
            state={avatarState}
            audioLevel={player.level}
            className="h-full min-h-[560px] border-0"
          />

          <div className="pointer-events-none absolute left-4 top-4 max-w-xl rounded-md bg-canvas/70 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">
              {session.persona.name}
            </p>
            <h1 className="mt-1 truncate text-xl font-bold text-ink">{session.problem.title}</h1>
            <p className="mt-1 line-clamp-2 text-sm text-graphite">{session.plan.primaryFocus}</p>
          </div>

          {latestPrompt && (
            <div className="pointer-events-none absolute bottom-24 left-4 max-w-[420px] rounded-md border border-white/10 bg-canvas/70 px-3 py-2 shadow-2xl backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-signal">
                Latest from Alex
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink">{latestPrompt.content}</p>
            </div>
          )}

          {combinedError && (
            <div className="absolute left-4 right-4 top-24 rounded-md border border-red-400/30 bg-red-400/15 px-4 py-3 text-sm font-medium text-red-100 backdrop-blur">
              {combinedError}
            </div>
          )}

          {debriefReport && (
            <div className="absolute bottom-24 left-4 right-4 max-h-[52%] overflow-hidden rounded-md border border-signal/30 bg-canvas/90 shadow-2xl backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">
                    Interview debrief
                  </p>
                  <p className="mt-1 text-sm text-graphite">
                    {debriefState === 'speaking'
                      ? 'Alex is giving the final read. Hold follow-ups until he finishes.'
                      : 'Ask follow-up questions about the feedback.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/interview/${session.id}/report`)}
                  className="rounded-md border border-white/10 bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:bg-slatewash"
                >
                  Full report
                </button>
              </div>

              <div className="max-h-56 space-y-3 overflow-y-auto px-4 py-3">
                {debriefMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={[
                      'rounded-md px-3 py-2 text-sm leading-6',
                      message.role === 'interviewer'
                        ? 'bg-surface text-ink'
                        : 'ml-auto max-w-[85%] bg-signal/15 text-signal',
                    ].join(' ')}
                  >
                    {message.content}
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={debriefQuestion}
                    onChange={(event) => setDebriefQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleDebriefFollowUp();
                      }
                    }}
                    disabled={debriefState !== 'ready'}
                    placeholder={
                      debriefState === 'ready'
                        ? 'Ask Alex about your score, mistakes, or what to practice next.'
                        : 'Wait for Alex to finish speaking.'
                    }
                    rows={2}
                    className="flex-1 resize-none rounded-md border border-white/15 bg-black/40 p-3 text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDebriefFollowUp()}
                    disabled={debriefState !== 'ready' || !debriefQuestion.trim()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {debriefState === 'answering' ? (
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                    Ask
                  </button>
                </div>
              </div>
            </div>
          )}

          {showTypedFallback && !debriefReport && (
            <div className="absolute bottom-24 left-4 right-4 rounded-md border border-white/10 bg-surface/95 p-3 shadow-2xl backdrop-blur">
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
                  placeholder="Type your response if you cannot use the mic."
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-white/15 bg-canvas p-3 text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
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
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-canvas/80 px-4 py-3 shadow-2xl backdrop-blur">
            <button
              type="button"
              onClick={() => setShowTypedFallback((value) => !value)}
              disabled={Boolean(debriefReport)}
              className={[
                'inline-flex h-11 w-11 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40',
                showTypedFallback
                  ? 'border-signal bg-signal/15 text-signal'
                  : 'border-white/10 bg-white/5 text-graphite hover:text-ink',
              ].join(' ')}
              aria-label={showTypedFallback ? 'Hide typing fallback' : 'Type instead'}
              title={showTypedFallback ? 'Hide typing fallback' : 'Type instead'}
            >
              <Keyboard size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleMicToggle()}
              disabled={isProcessing || Boolean(debriefReport)}
              aria-label={autoListenEnabled ? 'Mute microphone' : 'Unmute microphone'}
              title={autoListenEnabled ? 'Mute microphone' : 'Unmute microphone'}
              className={[
                'inline-flex h-14 w-14 items-center justify-center rounded-full text-canvas shadow-glow transition disabled:cursor-not-allowed disabled:opacity-50',
                autoListenEnabled ? 'bg-signal hover:brightness-110' : 'bg-red-400',
              ].join(' ')}
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" size={24} aria-hidden="true" />
              ) : autoListenEnabled ? (
                <Mic size={24} aria-hidden="true" />
              ) : (
                <MicOff size={24} aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={handleEnd}
              disabled={isEnding || Boolean(debriefReport)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-400/30 bg-red-400/15 text-red-200 transition hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="End interview"
              title="End interview"
            >
              {isEnding ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <PhoneOff size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {activePanel && (
          <aside className="h-full min-h-[560px] w-full overflow-hidden rounded-md border border-white/10 bg-surface xl:w-[440px]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {activePanel === 'problem' && 'Problem'}
                {activePanel === 'code' && 'Code workspace'}
                {activePanel === 'transcript' && 'Transcript'}
                {activePanel === 'score' && 'Live read'}
              </h2>
              <button
                type="button"
                onClick={() => setActivePanel(undefined)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-graphite transition hover:bg-slatewash hover:text-ink"
                aria-label="Close panel"
                title="Close panel"
              >
                <PanelRightClose size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="h-[calc(100%-57px)] overflow-y-auto p-4">
              {activePanel === 'problem' && <ProblemPanel problem={session.problem} />}

              {activePanel === 'code' && isCoding && (
                <div className="h-full min-h-[560px] overflow-hidden rounded-md border border-white/10">
                  <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    value={code}
                    onChange={(value) => setCode(value ?? '')}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineHeight: 22,
                      padding: { top: 16 },
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              )}

              {activePanel === 'transcript' && (
                <div className="h-full min-h-[560px]">
                  <TranscriptPanel transcript={transcript} interviewerName={session.persona.name} />
                </div>
              )}

              {activePanel === 'score' && scores && <ScorePanel scores={scores} />}
            </div>
          </aside>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-surface/80 px-3 py-2">
        {panelButtons.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePanel(isActive ? undefined : item.id)}
              disabled={item.disabled}
              className={[
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                isActive
                  ? 'bg-signal text-canvas'
                  : 'bg-canvas text-graphite hover:bg-slatewash hover:text-ink',
              ].join(' ')}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
        <div className="ml-2 hidden items-center gap-1.5 text-xs text-graphite md:flex">
          {autoListenEnabled ? (
            <Mic size={13} aria-hidden="true" />
          ) : (
            <MicOff size={13} aria-hidden="true" />
          )}
          {autoListenEnabled ? (recorder.isRecording ? 'Listening' : 'Auto mic') : 'Muted'}
        </div>
      </div>
    </section>
  );
};
