import type { AiInsight } from '@/types/audit';

export function AiInsightPanel({ insight }: { insight: AiInsight | null }) {
  if (!insight) {
    return (
      <div className="rounded-lg border border-dashed border-ink-700 bg-ink-900/40 p-4 text-sm text-ink-500">
        AI analysis unavailable — no <code className="font-mono text-ink-400">ANTHROPIC_API_KEY</code> was configured for this
        run. The deterministic report above is unaffected.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-accent-bright">
        AI-assisted interpretation · {insight.modelUsed}
      </p>
      <p className="text-sm leading-relaxed text-ink-100">{insight.summary}</p>

      {insight.rootCauseHypotheses.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-400">Likely root causes</p>
          <ul className="space-y-1.5">
            {insight.rootCauseHypotheses.map((h, i) => (
              <li key={i} className="text-sm text-ink-300">
                · {h.hypothesis} <span className="text-xs text-ink-500">({Math.round(h.confidence * 100)}% confidence)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insight.recommendedActions.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-400">Suggested priority order</p>
          <ul className="space-y-1.5">
            {insight.recommendedActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                <span className="mt-0.5 shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-300">{a.priority}</span>
                {a.action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
