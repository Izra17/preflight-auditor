'use client';

import { useMemo, useState } from 'react';
import { FindingCard } from './FindingCard';
import type { Finding, FindingCategory, Severity } from '@/types/audit';
import clsx from 'clsx';

const SEVERITY_FILTERS: (Severity | 'ALL' | 'PASSED')[] = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'PASSED'];
const CATEGORY_FILTERS: (FindingCategory | 'ALL')[] = ['ALL', 'TRACKING', 'ATTRIBUTION', 'TECHNICAL', 'UX', 'PRIVACY'];

export function FindingsExplorer({ findings }: { findings: Finding[] }) {
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]>('ALL');
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]>('ALL');

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (severity === 'PASSED' && f.status !== 'PASS') return false;
      if (severity !== 'ALL' && severity !== 'PASSED' && f.severity !== severity) return false;
      if (severity === 'ALL' && f.status === 'PASS') return false; // default view hides passes for signal density
      if (category !== 'ALL' && f.category !== category) return false;
      return true;
    });
  }, [findings, severity, category]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SEVERITY_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              severity === s ? 'border-accent bg-accent/15 text-accent-bright' : 'border-ink-700 text-ink-400 hover:text-ink-100'
            )}
          >
            {s === 'PASSED' ? 'Passed' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-800" />
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              category === c ? 'border-accent bg-accent/15 text-accent-bright' : 'border-ink-700 text-ink-400 hover:text-ink-100'
            )}
          >
            {c.charAt(0) + c.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-800 p-6 text-center text-sm text-ink-500">
          No findings match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered
            .sort((a, b) => rank(b.severity) - rank(a.severity))
            .map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
        </div>
      )}
    </div>
  );
}

function rank(s: string) {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 }[s] ?? 0;
}
