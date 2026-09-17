import type { RiskScoreBreakdown } from '@/types/audit';

const LABELS: Record<string, string> = {
  TRACKING: 'Tracking Integrity',
  ATTRIBUTION: 'Attribution Risk',
  TECHNICAL: 'Technical Health',
  UX: 'UX / Performance',
  PRIVACY: 'Privacy'
};

export function CategoryCards({ breakdown }: { breakdown: RiskScoreBreakdown[] }) {
  const categories = breakdown.filter((b) => b.category !== 'OVERALL');
  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {categories.map((b) => (
        <div key={b.category} className="rounded-lg border border-ink-800 bg-ink-900/60 p-4">
          <p className="text-xs text-ink-500">{LABELS[b.category] ?? b.category}</p>
          <p className={`mono-tabular mt-1 text-2xl font-semibold ${b.score >= 80 ? 'text-severity-pass' : b.score >= 50 ? 'text-severity-high' : 'text-severity-critical'}`}>
            {b.score}
          </p>
        </div>
      ))}
    </div>
  );
}
