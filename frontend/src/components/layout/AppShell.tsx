import { BrainCircuit, LayoutDashboard } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-ink text-canvas' : 'text-graphite hover:bg-slatewash hover:text-ink',
  ].join(' ');

export const AppShell = () => (
  <div className="min-h-screen bg-canvas text-ink">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex items-center gap-3 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-signal text-canvas shadow-glow">
            <BrainCircuit size={20} aria-hidden="true" />
          </span>
          <span>AI Interviewer</span>
        </NavLink>

        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard size={17} aria-hidden="true" />
            <span>Dashboard</span>
          </NavLink>
        </nav>
      </div>
    </header>

    <main>
      <Outlet />
    </main>
  </div>
);
