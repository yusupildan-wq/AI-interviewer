import type {
  InterviewMode,
  InterviewSessionSummary,
  ProgressOverview,
  UserProfile,
} from '@ai-interviewer/shared';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CircleAlert,
  Trash2,
  Loader2,
  Play,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ApiError,
  deleteAllInterviews,
  deleteInterview,
  getProfile,
  getProgressOverview,
  listInterviewHistory,
} from '../lib/api';

const modeLabel: Record<InterviewMode, string> = {
  behavioral: 'Behavioral',
  coding: 'Coding',
  'system-design': 'System design',
  'resume-deep-dive': 'Resume deep dive',
};

const modeFilters: Array<InterviewMode | 'all'> = [
  'all',
  'coding',
  'system-design',
  'behavioral',
  'resume-deep-dive',
];

const averageScore = (scores: InterviewSessionSummary['scores']): number =>
  Math.round(
    (scores.communication + scores.problemSolving + scores.technicalDepth + scores.confidence) / 4,
  );

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const roleLabel = (profile: UserProfile): string =>
  `${profile.seniority.replace('-', ' ')} ${profile.targetRole.replace('-', ' ')}`;

const StatCard = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="rounded-md border border-white/10 bg-surface p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite">{label}</p>
    <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
    <p className="mt-2 text-sm text-graphite">{detail}</p>
  </div>
);

const ScoreTrend = ({ overview }: { overview: ProgressOverview }) => {
  const maxScore = Math.max(100, ...overview.trend.map((point) => point.score));

  if (overview.trend.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-white/15 bg-surface/60 p-5 text-sm text-graphite">
        Finish an interview to start building your score trend.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Score trend</h2>
        <TrendingUp className="text-signal" size={20} aria-hidden="true" />
      </div>
      <div className="mt-6 flex h-44 items-end gap-2">
        {overview.trend.map((point) => (
          <Link
            key={point.sessionId}
            to={`/interview/${point.sessionId}/report`}
            className="group flex min-w-0 flex-1 flex-col items-center gap-2"
            title={`${point.problemTitle}: ${point.score}/100`}
          >
            <div className="flex h-32 w-full items-end rounded-sm bg-canvas">
              <div
                className="w-full rounded-sm bg-signal transition group-hover:brightness-110"
                style={{ height: `${Math.max(8, (point.score / maxScore) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-graphite">{point.score}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

const WeaknessPanel = ({ overview }: { overview: ProgressOverview }) => (
  <div className="rounded-md border border-white/10 bg-surface p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">Weakness tracker</h2>
      <CircleAlert className="text-amberline" size={20} aria-hidden="true" />
    </div>

    {overview.weakAreas.length === 0 ? (
      <p className="mt-4 text-sm leading-6 text-graphite">
        No repeated weak areas yet. Complete a few interviews and the evidence trail will start
        clustering patterns.
      </p>
    ) : (
      <div className="mt-4 space-y-3">
        {overview.weakAreas.map((area) => (
          <div key={area.label} className="rounded-md border border-white/10 bg-canvas/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ink">{area.label}</p>
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  area.severity === 'critical'
                    ? 'bg-red-500/15 text-red-300'
                    : 'bg-amberline/15 text-amberline',
                ].join(' ')}
              >
                {area.count}x
              </span>
            </div>
            {area.latestEvidence && (
              <p className="mt-2 text-sm leading-6 text-graphite">{area.latestEvidence}</p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

const PracticePlanPanel = ({ overview }: { overview: ProgressOverview }) => (
  <div className="rounded-md border border-white/10 bg-surface p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">Practice plan</h2>
      <Target className="text-signal" size={20} aria-hidden="true" />
    </div>
    <div className="mt-4 space-y-3">
      {overview.practicePlan.map((item) => (
        <div key={item.title} className="rounded-md border border-white/10 bg-canvas/40 p-3">
          <p className="font-semibold text-ink">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-graphite">{item.detail}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-signal">
            {item.source}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const HistoryTable = ({
  history,
  onDelete,
  deletingId,
}: {
  history: InterviewSessionSummary[];
  onDelete: (session: InterviewSessionSummary) => void;
  deletingId?: string;
}) => {
  const [filter, setFilter] = useState<InterviewMode | 'all'>('all');
  const filtered = useMemo(
    () => history.filter((session) => filter === 'all' || session.mode === filter),
    [filter, history],
  );

  return (
    <div className="rounded-md border border-white/10 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <h2 className="text-lg font-semibold text-ink">Interview history</h2>
        <div className="flex flex-wrap gap-2">
          {modeFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                filter === item
                  ? 'bg-signal text-canvas'
                  : 'bg-canvas text-graphite hover:bg-slatewash hover:text-ink',
              ].join(' ')}
            >
              {item === 'all' ? 'All' : modeLabel[item]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-5 text-sm text-graphite">No interviews match this filter yet.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {filtered.map((session) => {
            const to =
              session.status === 'completed'
                ? `/interview/${session.id}/report`
                : `/interview/${session.id}`;
            return (
              <li
                key={session.id}
                className="grid gap-3 p-4 transition hover:bg-slatewash md:grid-cols-[1fr_auto_auto_auto]"
              >
                <Link to={to} className="min-w-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{session.problemTitle}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.08em] text-graphite">
                      {modeLabel[session.mode]} / {session.strictness} /{' '}
                      {formatDate(session.startedAt)}
                    </p>
                  </div>
                </Link>
                <span
                  className={[
                    'w-fit rounded-full px-3 py-1 text-xs font-semibold md:self-center',
                    session.status === 'completed'
                      ? 'bg-signal/15 text-signal'
                      : 'bg-amberline/15 text-amberline',
                  ].join(' ')}
                >
                  {session.status === 'completed'
                    ? `${averageScore(session.scores)}/100`
                    : 'Continue'}
                </span>
                <Link
                  to={to}
                  className="hidden text-graphite transition hover:text-ink md:block md:self-center"
                  aria-label={`Open ${session.problemTitle}`}
                  title={`Open ${session.problemTitle}`}
                >
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(session)}
                  disabled={deletingId === session.id}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-400/25 bg-red-400/10 text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50 md:self-center"
                  aria-label={`Delete ${session.problemTitle}`}
                  title={`Delete ${session.problemTitle}`}
                >
                  {deletingId === session.id ? (
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                  ) : (
                    <Trash2 size={16} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const DashboardPage = () => {
  const [profile, setProfile] = useState<UserProfile>();
  const [overview, setOverview] = useState<ProgressOverview>();
  const [history, setHistory] = useState<InterviewSessionSummary[]>();
  const [error, setError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [isClearing, setIsClearing] = useState(false);

  const loadDashboard = useCallback((cancelledRef?: { current: boolean }) => {
    return Promise.all([getProfile(), getProgressOverview(), listInterviewHistory()]).then(
      ([loadedProfile, loadedOverview, loadedHistory]) => {
        if (cancelledRef?.current) return;
        setProfile(loadedProfile);
        setOverview(loadedOverview);
        setHistory(loadedHistory);
      },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cancelledRef = { current: false };

    loadDashboard(cancelledRef).catch((caught) => {
      if (!cancelled) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load dashboard.');
      }
    });

    return () => {
      cancelled = true;
      cancelledRef.current = true;
    };
  }, [loadDashboard]);

  const handleDeleteInterview = async (session: InterviewSessionSummary) => {
    const confirmed = window.confirm(`Delete "${session.problemTitle}" from your history?`);
    if (!confirmed) return;

    setDeletingId(session.id);
    setError(undefined);
    try {
      await deleteInterview(session.id);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not delete interview.');
    } finally {
      setDeletingId(undefined);
    }
  };

  const handleClearInterviews = async () => {
    const confirmed = window.confirm(
      'Delete every interview and report from your account? Your profile and login stay intact.',
    );
    if (!confirmed) return;

    setIsClearing(true);
    setError(undefined);
    try {
      await deleteAllInterviews();
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not clear interviews.');
    } finally {
      setIsClearing(false);
    }
  };

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm font-medium text-red-400">{error}</p>
      </section>
    );
  }

  if (!profile || !overview || !history) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-graphite">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
        Loading progress
      </div>
    );
  }

  const latestActive = overview.activeInterviews[0];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Dashboard</p>
          <h1 className="mt-3 text-4xl font-bold text-ink">Interview progress</h1>
          <p className="mt-3 max-w-2xl leading-7 text-graphite">
            Calibrated for a <span className="capitalize text-ink">{roleLabel(profile)}</span>.
            Track your sessions, repeated misses, score trend, and next drills.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearInterviews()}
              disabled={isClearing}
              className="inline-flex items-center gap-2 rounded-md border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing ? (
                <Loader2 className="animate-spin" size={16} aria-hidden="true" />
              ) : (
                <Trash2 size={16} aria-hidden="true" />
              )}
              Clean state
            </button>
          )}
          {latestActive && (
            <Link
              to={`/interview/${latestActive.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-amberline/30 bg-amberline/10 px-4 py-3 text-sm font-semibold text-amberline transition hover:bg-amberline/15"
            >
              <Play size={16} aria-hidden="true" />
              Continue interview
            </Link>
          )}
          <Link
            to="/interview/new"
            className="inline-flex items-center gap-2 rounded-md bg-signal px-4 py-3 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110"
          >
            Start new interview
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Completed"
          value={String(overview.completedCount)}
          detail={`${overview.activeCount} active`}
        />
        <StatCard
          label="Average"
          value={`${overview.averageScore}/100`}
          detail="Across completed interviews"
        />
        <StatCard label="Best" value={`${overview.bestScore}/100`} detail="Highest report score" />
        <StatCard
          label="Latest"
          value={overview.latestScore === undefined ? '--' : `${overview.latestScore}/100`}
          detail="Most recent completed round"
        />
        <StatCard
          label="Reports"
          value={String(overview.recentReports.length)}
          detail="Cached coaching reports"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ScoreTrend overview={overview} />
        <WeaknessPanel overview={overview} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <PracticePlanPanel overview={overview} />

        <div className="rounded-md border border-white/10 bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Recent reports</h2>
            <BarChart3 className="text-signal" size={20} aria-hidden="true" />
          </div>
          {overview.recentReports.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-graphite">
              Finish an interview and generate the report to see recent debriefs here.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {overview.recentReports.map((report) => (
                <Link
                  key={report.sessionId}
                  to={`/interview/${report.sessionId}/report`}
                  className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-canvas/40 p-3 transition hover:border-signal/40"
                >
                  <div>
                    <p className="font-semibold text-ink">{report.problemTitle}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.08em] text-graphite">
                      {modeLabel[report.mode]} / {formatDate(report.completedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal">
                    {report.overallScore}/100
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {overview.activeInterviews.length > 0 && (
        <div className="mt-6 rounded-md border border-white/10 bg-surface p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="text-amberline" size={20} aria-hidden="true" />
            <h2 className="text-lg font-semibold text-ink">Active interviews</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.activeInterviews.map((session) => (
              <Link
                key={session.id}
                to={`/interview/${session.id}`}
                className="rounded-md border border-white/10 bg-canvas/40 p-3 transition hover:border-amberline/40"
              >
                <p className="font-semibold text-ink">{session.problemTitle}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-graphite">
                  {modeLabel[session.mode]} / started {formatDate(session.startedAt)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <HistoryTable
          history={history}
          onDelete={(session) => void handleDeleteInterview(session)}
          deletingId={deletingId}
        />
      </div>
    </section>
  );
};
