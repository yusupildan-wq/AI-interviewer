import { ArrowRight, CheckCircle2, LineChart, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import heroImage from '../assets/interview-hero.png';

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
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <img
        src={heroImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#f8faf9] via-[#f8faf9]/88 to-[#f8faf9]/18" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-signal">
            Production foundation
          </p>
          <h1 className="text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
            AI Interviewer
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-graphite">
            A clean platform foundation for realistic mock interviews, candidate analysis, adaptive
            coaching, and interview history.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-graphite"
            >
              Open dashboard
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a
              href="#foundation"
              className="inline-flex items-center justify-center rounded-md border border-black/15 bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              View foundation
            </a>
          </div>
        </div>
      </div>
    </section>

    <section id="foundation" className="border-y border-black/10 bg-white py-16">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;

          return (
            <article key={pillar.title} className="rounded-md border border-black/10 p-6">
              <Icon className="mb-5 text-signal" size={26} aria-hidden="true" />
              <h2 className="text-xl font-semibold">{pillar.title}</h2>
              <p className="mt-3 leading-7 text-graphite">{pillar.description}</p>
            </article>
          );
        })}
      </div>
    </section>

    <section className="bg-[#f8faf9] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold">Built for the product that comes next</h2>
          <p className="mt-4 leading-8 text-graphite">
            The codebase starts with typed contracts, clear package boundaries, feature ownership,
            environment templates, and the smallest useful API surface.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['React + TypeScript', 'Express API', 'Shared contracts', 'PostgreSQL-ready'].map(
            (item) => (
              <div key={item} className="flex items-center gap-3 rounded-md bg-white p-4 shadow-sm">
                <CheckCircle2 className="text-amberline" size={20} aria-hidden="true" />
                <span className="text-sm font-semibold">{item}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  </>
);
