import type { FeedbackReport } from '@ai-interviewer/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError, getFeedbackReport } from '../../lib/api';
import { ScorePanel } from './ScorePanel';

const recommendationStyle: Record<FeedbackReport['recommendation'], string> = {
  'strong-hire': 'bg-signal/15 text-signal',
  hire: 'bg-signal/15 text-signal',
  'lean-hire': 'bg-amberline/15 text-amberline',
  'no-hire': 'bg-red-500/15 text-red-400',
  'strong-no-hire': 'bg-red-500/15 text-red-400',
};

const recommendationLabel: Record<FeedbackReport['recommendation'], string> = {
  'strong-hire': 'Strong hire',
  hire: 'Hire',
  'lean-hire': 'Lean hire',
  'no-hire': 'No hire',
  'strong-no-hire': 'Strong no hire',
};

export const FeedbackReportPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<FeedbackReport | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getFeedbackReport(sessionId)
      .then((loaded) => {
        if (!cancelled) {
          setReport(loaded);
          setIsLoading(false);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught.message : 'Could not generate the feedback report.',
          );
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-graphite">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
        <p className="text-sm">Writing the debrief…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-graphite">{error ?? 'Report not available yet.'}</p>
        <Link to="/interview/new" className="mt-4 inline-block text-sm font-semibold text-signal">
          Start a new interview
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">
        Feedback report
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-4xl font-bold text-ink">{report.overallScore}/100</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${recommendationStyle[report.recommendation]}`}
        >
          {recommendationLabel[report.recommendation]}
        </span>
      </div>

      <p className="mt-6 max-w-3xl leading-7 text-graphite">{report.summary}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">
              Strengths
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-graphite">
              {report.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-amberline">
              Growth areas
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-graphite">
              {report.growthAreas.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {report.notableMoments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-graphite">
                Notable moments
              </h2>
              <div className="mt-3 space-y-3">
                {report.notableMoments.map((moment) => (
                  <blockquote
                    key={moment.quote}
                    className="rounded-md border-l-4 border-signal/40 bg-surface p-4"
                  >
                    <p className="text-sm italic text-ink">&ldquo;{moment.quote}&rdquo;</p>
                    <p className="mt-2 text-xs text-graphite">{moment.note}</p>
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <ScorePanel scores={report.scores} />
          <Link
            to="/interview/new"
            className="block rounded-md bg-signal px-4 py-3 text-center text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110"
          >
            Start another interview
          </Link>
        </div>
      </div>
    </section>
  );
};
