import { listAudits } from '@/lib/store/store';
import { ReadinessPill } from '@/components/Badges';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  const audits = listAudits(25);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <a href="/" className="text-sm text-ink-500 hover:text-ink-200">
        ← New audit
      </a>
      <h1 className="mb-6 mt-4 text-xl font-medium text-ink-50">Audit history</h1>

      {audits.length === 0 ? (
        <p className="text-sm text-ink-500">No audits yet. Run one from the home page.</p>
      ) : (
        <div className="space-y-2">
          {audits.map((a) => (
            <a
              key={a.auditId}
              href={`/audit/${a.auditId}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-ink-800 bg-ink-900/60 p-4 hover:border-ink-600"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-100">{a.url}</p>
                <p className="text-xs text-ink-500">{new Date(a.timestamp).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="mono-tabular text-sm text-ink-300">{a.score}/100</span>
                <ReadinessPill status={a.overallStatus} />
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
