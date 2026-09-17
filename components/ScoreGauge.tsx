import { ReadinessPill } from './Badges';
import type { ReadinessStatus } from '@/types/audit';

export function ScoreGauge({ score, status }: { score: number; status: ReadinessStatus }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#2fb872' : score >= 50 ? '#f5a623' : '#e5484d';

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1f2530" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="mono-tabular text-3xl font-semibold text-ink-50">{score}</span>
          <span className="text-xs text-ink-400">/ 100</span>
        </div>
      </div>
      <div>
        <ReadinessPill status={status} size="lg" />
        <p className="mt-2 max-w-xs text-sm text-ink-400">Readiness score reflects weighted, deterministic penalties from findings below.</p>
      </div>
    </div>
  );
}
