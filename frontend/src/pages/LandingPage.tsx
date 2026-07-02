import { ArrowRight, CheckCircle2, LineChart, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const pillars = [
  {
    title: 'Realistic practice',
    description:
      'A foundation ready for adaptive interview sessions, coding rounds, and voice flows.',
    icon: Sparkles,
  },
  {
    title: 'Evidence-based coaching',
    description: 'Designed for scoring, rubrics, history, and feedback without mixing concerns.',
    icon: LineChart,
  },
  {
    title: 'SaaS-ready core',
    description:
      'Clear boundaries for auth, persistence, analysis pipelines, and future AI services.',
    icon: ShieldCheck,
  },
];

export const LandingPage = () => (
  <>
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas">
      {/* Ambient gradient glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-48 right-[-8%] h-[620px] w-[620px] rounded-full bg-signal/25 blur-[150px]" />
        <div className="absolute bottom-[-25%] left-[-12%] h-[520px] w-[520px] rounded-full bg-amberline/15 blur-[150px]" />
      </div>

      {/* Faint grid texture, fading toward the edges */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 35% 35%, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 35% 35%, black 0%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      {/* Orbit rings, echoing the interviewer avatar's attentiveness ring */}
      <div
        className="pointer-events-none absolute right-[6%] top-1/2 hidden h-[520px] w-[520px] -translate-y-1/2 lg:block"
        aria-hidden="true"
      >
        <div className="absolute inset-0 rounded-full border border-signal/20" />
        <div className="absolute inset-[13%] rounded-full border border-signal/10" />
        <div className="absolute inset-[30%] rounded-full border border-amberline/15" />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-glow" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-signal">
            Production foundation
          </p>
          <h1 className="text-5xl font-bold leading-tight text-ink sm:text-6xl lg:text-7xl">
            AI Interviewer
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-graphite">
            A clean platform foundation for realistic mock interviews, candidate analysis, adaptive
            coaching, and interview history.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110"
            >
              Open dashboard
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a
              href="#foundation"
              className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-ink backdrop-blur transition hover:bg-white/10"
            >
              View foundation
            </a>
          </div>
        </div>
      </div>
    </section>

    <section id="foundation" className="border-y border-white/10 bg-surface py-16">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;

          return (
            <article
              key={pillar.title}
              className="rounded-md border border-white/10 bg-canvas/40 p-6 transition hover:border-signal/40"
            >
              <Icon className="mb-5 text-signal" size={26} aria-hidden="true" />
              <h2 className="text-xl font-semibold text-ink">{pillar.title}</h2>
              <p className="mt-3 leading-7 text-graphite">{pillar.description}</p>
            </article>
          );
        })}
      </div>
    </section>

    <section className="bg-canvas py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold text-ink">Built for the product that comes next</h2>
          <p className="mt-4 leading-8 text-graphite">
            The codebase starts with typed contracts, clear package boundaries, feature ownership,
            environment templates, and the smallest useful API surface.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['React + TypeScript', 'Express API', 'Shared contracts', 'PostgreSQL-ready'].map(
            (item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-md border border-white/10 bg-surface p-4"
              >
                <CheckCircle2 className="text-amberline" size={20} aria-hidden="true" />
                <span className="text-sm font-semibold text-ink">{item}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  </>
);
