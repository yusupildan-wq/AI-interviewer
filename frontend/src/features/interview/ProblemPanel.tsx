import type { CandidateProblem } from '../../lib/api';

const difficultyColor: Record<CandidateProblem['difficulty'], string> = {
  easy: 'text-signal',
  medium: 'text-amberline',
  hard: 'text-red-400',
};

export const ProblemPanel = ({ problem }: { problem: CandidateProblem }) => (
  <div className="space-y-4 rounded-md border border-white/10 bg-surface p-5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">{problem.category}</p>
      <h1 className="mt-1 text-xl font-bold text-ink">{problem.title}</h1>
      <p className={`mt-1 text-xs font-semibold capitalize ${difficultyColor[problem.difficulty]}`}>
        {problem.difficulty}
      </p>
    </div>

    <p className="whitespace-pre-wrap text-sm leading-6 text-graphite">{problem.prompt}</p>

    {problem.constraints && problem.constraints.length > 0 && (
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite">Constraints</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-graphite">
          {problem.constraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ul>
      </div>
    )}

    {problem.examples && problem.examples.length > 0 && (
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite">Examples</h2>
        <div className="mt-2 space-y-2">
          {problem.examples.map((example) => (
            <div key={example.input} className="rounded-md border border-white/5 bg-slatewash p-3 font-mono text-xs text-ink">
              <p>Input: {example.input}</p>
              <p>Output: {example.output}</p>
              {example.explanation && <p className="mt-1 text-graphite">{example.explanation}</p>}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
