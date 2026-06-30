import {
  Activity,
  ArrowRight,
  CalendarClock,
  Code2,
  FileText,
  Github,
  Mic,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const upcomingModules = [
  { label: 'Mock interviews', icon: CalendarClock, to: '/interview/new' },
  { label: 'Resume analysis', icon: FileText },
  { label: 'GitHub analysis', icon: Github },
  { label: 'Voice interviews', icon: Mic },
  { label: 'Live coding', icon: Code2, to: '/interview/new' },
  { label: 'User profiles', icon: UserRound },
];

export const DashboardPage = () => (
  <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Dashboard</p>
        <h1 className="mt-3 text-4xl font-bold text-ink">Platform command center</h1>
        <p className="mt-4 max-w-2xl leading-8 text-graphite">
          The product surface is intentionally quiet for now. This page is ready to become the
          authenticated user home once sessions, scoring, and interview history arrive.
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

    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
