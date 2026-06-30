import type { InterviewMode } from '@ai-interviewer/shared';
import { Briefcase, Code2, MessageSquareText, Network } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError, createInterview, listProblems, type CandidateProblem } from '../../lib/api';

const MODES: { value: InterviewMode; label: string; description: string; icon: typeof Code2 }[] = [
  {
    value: 'coding',
    label: 'Coding',
    description: 'Live coding with a real-time editor and complexity follow-ups.',
    icon: Code2,
  },
  {
    value: 'behavioral',
    label: 'Behavioral',
    description: 'STAR-style stories probed for specificity and ownership.',
    icon: MessageSquareText,
  },
  {
    value: 'system-design',
    label: 'System Design',
    description: 'Open-ended architecture with scale and tradeoff pressure-testing.',
    icon: Network,
  },
  {
    value: 'resume-deep-dive',
    label: 'Resume Deep Dive',
    description: 'Goes deep on a project you bring up — justify every choice.',
    icon: Briefcase,
  },
];

export const NewInterviewPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<InterviewMode>('coding');
  const [problems, setProblems] = useState<CandidateProblem[]>([]);
  const [problemId, setProblemId] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setProblemId('');
    listProblems(mode)
      .then((results) => {
        if (!cancelled) {
          setProblems(results);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProblems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleStart = async () => {
    setIsStarting(true);
    setError(undefined);
    try {
      const session = await createInterview({ mode, problemId: problemId || undefined });
      navigate(`/interview/${session.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start the interview. Try again.');
      setIsStarting(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">New interview</p>
      <h1 className="mt-3 text-4xl font-bold text-ink">Choose how you want to be interviewed</h1>
      <p className="mt-4 max-w-2xl leading-7 text-graphite">
        Alex Chen, your interviewer, will run the session like a real FAANG loop: mostly listening, speaking only
        when it matters.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {MODES.map((option) => {
          const Icon = option.icon;
          const isSelected = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={[
                'rounded-md border p-5 text-left transition',
                isSelected
                  ? 'border-signal bg-surface shadow-glow'
                  : 'border-white/10 bg-surface/60 hover:border-white/20',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <Icon className={isSelected ? 'text-signal' : 'text-graphite'} size={22} aria-hidden="true" />
                {isSelected && <span className="text-xs font-semibold text-signal">Selected</span>}
              </div>
              <h2 className="mt-4 font-semibold text-ink">{option.label}</h2>
              <p className="mt-2 text-sm leading-6 text-graphite">{option.description}</p>
            </button>
          );
        })}
      </div>

      {problems.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-signal">Pick a problem</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setProblemId('')}
              className={[
                'rounded-md border p-4 text-left text-sm transition',
                problemId === ''
                  ? 'border-signal bg-surface shadow-glow'
                  : 'border-white/10 bg-surface/60 hover:border-white/20',
              ].join(' ')}
            >
              <span className="font-semibold text-ink">Surprise me</span>
              <p className="mt-1 text-graphite">A random problem for this mode.</p>
            </button>
            {problems.map((problem) => (
              <button
                key={problem.id}
                type="button"
                onClick={() => setProblemId(problem.id)}
                className={[
                  'rounded-md border p-4 text-left text-sm transition',
                  problemId === problem.id
                    ? 'border-signal bg-surface shadow-glow'
                    : 'border-white/10 bg-surface/60 hover:border-white/20',
                ].join(' ')}
              >
                <span className="font-semibold text-ink">{problem.title}</span>
                <p className="mt-1 text-graphite">
                  {problem.difficulty} &middot; {problem.category}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-6 text-sm font-medium text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleStart}
        disabled={isStarting}
        className="mt-8 inline-flex items-center justify-center rounded-md bg-signal px-6 py-3 text-sm font-semibold text-canvas shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isStarting ? 'Starting…' : 'Start interview'}
      </button>
    </section>
  );
};
