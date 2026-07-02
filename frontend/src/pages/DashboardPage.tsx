import type { InterviewMode, InterviewSessionSummary, UserProfile } from '@ai-interviewer/shared';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Code2,
  FileText,
  Github,
  Loader2,
  Mic,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError, getProfile, listInterviewHistory } from '../lib/api';

const upcomingModules = [
  { label: 'Mock interviews', icon: CalendarClock, to: '/interview/new' },
  { label: 'Resume analysis', icon: FileText },
  { label: 'GitHub analysis', icon: Github },
  { label: 'Voice interviews', icon: Mic },
  { label: 'Live coding', icon: Code2, to: '/interview/new' },
  { label: 'User profile', icon: UserRound, to: '/profile' },
];

const modeLabel: Record<InterviewMode, string> = {
  behavioral: 'Behavioral',
  coding: 'Coding',
  'system-design': 'System design',
  'resume-deep-dive': 'Resume deep dive',
};

const averageScore = (scores: InterviewSessionSummary['scores']): number =>
  Math.round(
    (scores.communication + scores.problemSolving + scores.technicalDepth + scores.confidence) / 4,
  );

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const roleLabel = (profile: UserProfile): string =>
  `${profile.seniority.replace('-', ' ')} ${profile.targetRole.replace('-', ' ')}`;

const recommendedSession = (profile: UserProfile): { label: string; detail: string } => {
  if (profile.weakAreas.some((area) => /system|scale|design/i.test(area))) {
    return {
      label: 'System design',
      detail: 'Practice scope, scale, bottlenecks, and tradeoffs.',
    };
  }
  if (profile.weakAreas.some((area) => /behavior|story|leadership|communication/i.test(area))) {
    return {
      label: 'Behavioral',
      detail: 'Sharpen specific stories with role, tradeoffs, and outcomes.',
    };
  }
  if (profile.weakAreas.some((area) => /resume|project|github/i.test(area))) {
    return {
      label: 'Resume deep dive',
      detail: 'Go deep on technical ownership and project decisions.',
    };
  }
  return {
    label: 'Coding',
    detail: `Use ${profile.preferredLanguage} and talk through complexity before implementation.`,
  };
};

const ProfileSummary = () => {
  const [profile, setProfile] = useState<UserProfile>();

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) return null;

  const recommendation = recommendedSession(profile);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
      <div className="rounded-md border border-white/10 bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">
          Current target
        </p>
        <h2 className="mt-2 text-xl font-bold capitalize text-ink">{roleLabel(profile)}</h2>
        <p className="mt-2 text-sm leading-6 text-graphite">{profile.interviewGoal}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.targetCompanies.map((company) => (
            <span
              key={company}
              className="rounded-full bg-slatewash px-3 py-1 text-xs text-graphite"
            >
              {company}
            </span>
          ))}
          {profile.weakAreas.map((area) => (
            <span
              key={area}
              className="rounded-full bg-amberline/10 px-3 py-1 text-xs text-amberline"
            >
              {area}
            </span>
          ))}
        </div>
      </div>
      <Link
        to="/interview/new"
        className="rounded-md border border-signal/30 bg-signal/10 p-5 transition hover:bg-signal/15 md:w-80"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">
          Recommended next
        </p>
        <h2 className="mt-2 text-xl font-bold text-ink">{recommendation.label}</h2>
        <p className="mt-2 text-sm leading-6 text-graphite">{recommendation.detail}</p>
      </Link>
    </div>
  );
};

const InterviewHistorySection = () => {
  const [history, setHistory] = useState<InterviewSessionSummary[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    listInterviewHistory()
      .then((sessions) => {
        if (!cancelled) setHistory(sessions);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught.message : 'Could not load interview history.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="mt-4 text-sm font-medium text-red-400">{error}</p>;
  }

  if (!history) {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-graphite">
        <Loader2 className="animate-spin" size={16} aria-hidden="true" />
        Loading interview history…
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="mt-4 rounded-md border border-dashed border-white/15 bg-surface/60 p-5 text-sm text-graphite">
        No interviews yet. Start your first mock interview to see it here.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-md border border-white/10 bg-surface">
      {history.map((session) => {
        const to =
          session.status === 'completed'
            ? `/interview/${session.id}/report`
            : `/interview/${session.id}`;
        return (
          <li key={session.id}>
            <Link
              to={to}
              className="flex flex-col gap-2 p-4 transition hover:bg-slatewash sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-ink">{session.problemTitle}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-graphite">
                  {modeLabel[session.mode]} · {session.strictness} · {formatDate(session.startedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    session.status === 'completed'
                      ? 'rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal'
                      : 'rounded-full bg-amberline/15 px-3 py-1 text-xs font-semibold text-amberline'
                  }
                >
                  {session.status === 'completed'
                    ? `Score ${averageScore(session.scores)}/10`
                    : 'In progress'}
                </span>
                <ArrowRight className="text-graphite" size={16} aria-hidden="true" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export const DashboardPage = () => (
  <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Dashboard</p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Platform command center</h1>
        <p className="mt-4 max-w-2xl leading-8 text-graphite">
          Your interview history lives here, alongside the modules that are live today and the ones
          still on the roadmap.
        </p>
      </div>
      <Link
        to="/interview/new"
        className="inline-flex w-fit items-center gap-2 rounded-md bg-signal px-4 py-3 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110"
      >
        Start a mock interview
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>

    <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
      <Activity className="text-signal" size={18} aria-hidden="true" />
      API health ready
    </div>

    <ProfileSummary />

    <div className="mt-10">
      <h2 className="text-lg font-semibold text-ink">Interview history</h2>
      <InterviewHistorySection />
    </div>

    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {upcomingModules.map((module) => {
        const Icon = module.icon;
        const content = (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">{module.label}</h2>
              <Icon className="text-signal" size={21} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-6 text-graphite">
              {module.to
                ? 'Live now. Click to begin.'
                : 'Reserved module boundary. Implementation belongs in a future feature slice.'}
            </p>
          </>
        );

        if (module.to) {
          return (
            <Link
              key={module.label}
              to={module.to}
              className="rounded-md border border-white/10 bg-surface p-5 transition hover:border-signal/40 hover:shadow-glow"
            >
              {content}
            </Link>
          );
        }

        return (
          <article
            key={module.label}
            className="rounded-md border border-white/10 bg-surface/60 p-5"
          >
            {content}
          </article>
        );
      })}
    </div>
  </section>
);
