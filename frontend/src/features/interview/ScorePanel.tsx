import type { ScoreRubric } from '@ai-interviewer/shared';

const DIMENSIONS: { key: keyof ScoreRubric; label: string }[] = [
  { key: 'communication', label: 'Communication' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'technicalDepth', label: 'Technical Depth' },
  { key: 'confidence', label: 'Confidence' },
];

const barColor = (value: number): string => {
  if (value >= 70) return 'bg-signal';
  if (value >= 45) return 'bg-amberline';
  return 'bg-red-400';
};

const readLabel = (value: number): string => {
  if (value <= 1) return 'No signal';
  if (value < 15) return 'Very weak';
  if (value < 35) return 'Weak';
  if (value >= 75) return 'Strong';
  if (value >= 60) return 'Positive';
  if (value >= 45) return 'Neutral';
  return 'Concern';
};

export const ScorePanel = ({ scores }: { scores: ScoreRubric }) => (
  <div className="space-y-4 rounded-md border border-white/10 bg-surface p-4">
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">Live read</h2>
      <p className="mt-1 text-xs leading-5 text-graphite">
        Current signal from this session, not a final verdict.
      </p>
    </div>
    {DIMENSIONS.map((dimension) => {
      const value = scores[dimension.key];
      return (
        <div key={dimension.key}>
          <div className="flex items-center justify-between text-xs font-medium text-graphite">
            <span>{dimension.label}</span>
            <span className="font-semibold text-ink">
              {readLabel(value)} / {value}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slatewash">
            <div
              className={`h-full rounded-full transition-all ${barColor(value)}`}
              style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);
