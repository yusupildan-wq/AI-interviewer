import { Activity, CalendarClock, Code2, FileText, Github, Mic, UserRound } from 'lucide-react';

const upcomingModules = [
  { label: 'Mock interviews', icon: CalendarClock },
  { label: 'Resume analysis', icon: FileText },
  { label: 'GitHub analysis', icon: Github },
  { label: 'Voice interviews', icon: Mic },
  { label: 'Live coding', icon: Code2 },
  { label: 'User profiles', icon: UserRound },
];

export const DashboardPage = () => (
  <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-4 border-b border-black/10 pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Dashboard</p>
        <h1 className="mt-3 text-4xl font-bold">Platform command center</h1>
        <p className="mt-4 max-w-2xl leading-8 text-graphite">
          The product surface is intentionally quiet for now. This page is ready to become the
          authenticated user home once sessions, scoring, and interview history arrive.
        </p>
      </div>
      <div className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold shadow-sm">
        <Activity className="text-signal" size={18} aria-hidden="true" />
        API health ready
      </div>
    </div>

    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {upcomingModules.map((module) => {
        const Icon = module.icon;

        return (
          <article key={module.label} className="rounded-md border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{module.label}</h2>
              <Icon className="text-signal" size={21} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-6 text-graphite">
              Reserved module boundary. Implementation belongs in a future feature slice.
            </p>
          </article>
        );
      })}
    </div>
  </section>
);
