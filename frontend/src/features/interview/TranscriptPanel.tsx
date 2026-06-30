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

export const TranscriptPanel = ({ transcript, interviewerName }: { transcript: TranscriptEntry[]; interviewerName: string }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-md border border-white/10 bg-surface p-4">
      {transcript.length === 0 && (
        <p className="text-sm text-graphite">
          {interviewerName} is ready. Introduce yourself or start working on the problem.
        </p>
      )}
      {transcript.map((entry) => {
        const isInterviewer = entry.role === 'interviewer';
        const label = entry.interventionType ? interventionLabel[entry.interventionType] : undefined;
        return (
          <div key={entry.id} className={isInterviewer ? 'self-start' : 'self-end'}>
            <div
              className={[
                'max-w-md rounded-md px-3 py-2 text-sm leading-6',
                isInterviewer ? 'border border-white/5 bg-slatewash text-ink' : 'bg-signal text-canvas',
              ].join(' ')}
            >
              {isInterviewer && label && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-signal">{label}</p>
              )}
              <p className="whitespace-pre-wrap">{entry.content}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
