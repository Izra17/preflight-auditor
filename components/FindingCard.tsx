'use client';

import { useState } from 'react';
import { SeverityBadge, StatusBadge } from './Badges';
import type { Finding } from '@/types/audit';

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
          <span className="text-xs text-ink-500">{finding.category}</span>
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(`${finding.title}\n${finding.description}\nRecommendation: ${finding.recommendation}`)}
          className="text-xs text-ink-500 hover:text-ink-200"
          title="Copy finding"
        >
          Copy
        </button>
      </div>

      <h3 className="mt-2.5 font-medium text-ink-50">{finding.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-300">{finding.description}</p>

      <p className="mt-2 text-sm text-ink-400">
        <span className="text-ink-500">Why it matters — </span>
        {finding.whyItMatters}
      </p>

      <div className="mt-3 flex items-center gap-4 text-xs">
        <button onClick={() => setOpen((o) => !o)} className="font-medium text-accent-bright hover:underline">
          {open ? 'Hide evidence' : `Show evidence (${finding.evidence.length})`}
        </button>
        <span className="text-ink-500">Confidence: {Math.round(finding.confidence * 100)}%</span>
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-ink-800 bg-ink-950 p-3">
          <ul className="space-y-1 font-mono text-xs text-ink-400">
            {finding.evidence.map((e, i) => (
              <li key={i}>· {e}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 rounded-md bg-accent/10 px-3 py-2 text-sm text-accent-bright">→ {finding.recommendation}</p>
    </div>
  );
}
