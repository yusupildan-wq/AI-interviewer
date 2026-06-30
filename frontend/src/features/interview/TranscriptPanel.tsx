import type { TranscriptEntry } from '@ai-interviewer/shared';
import { useEffect, useRef } from 'react';

const interventionLabel: Record<string, string> = {
  clarify: 'Clarifying',
  pushback: 'Pushback',
  hint: 'Hint',
  redirect: 'Redirect',
  challenge: 'Challenge',
  deepen: 'Deepening',
  encourage: 'Encouragement',
  evaluate: 'Evaluating',
};

const speakerLabel = (entry: TranscriptEntry, interviewerName: string): string => {
  if (entry.role === 'interviewer') return interviewerName;
  if (entry.role === 'system') return 'System';
  return 'You';
};

const formatTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

export const TranscriptPanel = ({
  transcript,
  interviewerName,
}: {
  transcript: TranscriptEntry[];
  interviewerName: string;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-white/10 bg-surface">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Interview transcript</h2>
          <p className="text-xs text-graphite">Live conversation record</p>
        </div>
        <span className="rounded-full bg-slatewash px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-graphite">
          {transcript.length} turns
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {transcript.length === 0 && (
          <p className="text-sm text-graphite">
            {interviewerName} is ready. Introduce yourself or start working on the problem.
          </p>
        )}
        {transcript.map((entry) => {
          const isInterviewer = entry.role === 'interviewer';
          const label = entry.interventionType
            ? interventionLabel[entry.interventionType]
            : undefined;
          return (
            <div key={entry.id} className={isInterviewer ? 'self-start' : 'self-end'}>
              <div
                className={[
                  'mb-1 flex items-center gap-2 text-[11px] font-medium text-graphite',
                  isInterviewer ? 'justify-start' : 'justify-end',
                ].join(' ')}
              >
                <span>{speakerLabel(entry, interviewerName)}</span>
                <span>{formatTime(entry.createdAt)}</span>
              </div>
              <div
                className={[
                  'max-w-xl rounded-md px-3 py-2 text-sm leading-6 shadow-sm',
                  isInterviewer
                    ? 'border border-white/10 bg-[#1a1d22] text-ink'
                    : 'border border-signal/25 bg-signal/15 text-ink',
                ].join(' ')}
              >
                {isInterviewer && label && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-signal">
                    {label}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{entry.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
