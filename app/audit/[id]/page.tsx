import { getAudit } from '@/lib/store/store';
import { notFound } from 'next/navigation';

// This reads live, in-memory audit state — it must never be statically
// generated/cached at build time, or every audit link would 404.
export const dynamic = 'force-dynamic';
import { ScoreGauge } from '@/components/ScoreGauge';
import { CategoryCards } from '@/components/CategoryCards';
import { FindingsExplorer } from '@/components/FindingsExplorer';
import { AiInsightPanel } from '@/components/AiInsightPanel';
import { TechnicalDrawer } from '@/components/TechnicalDrawer';

export default function AuditReportPage({ params }: { params: { id: string } }) {
  const audit = getAudit(params.id);
  if (!audit) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <a href="/" className="text-sm text-ink-500 hover:text-ink-200">
        ← New audit
      </a>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-ink-800 pb-8">
        <div>
          <p className="mb-1 font-mono text-xs text-ink-500">
            {new Date(audit.timestamp).toLocaleString()} · {(audit.durationMs / 1000).toFixed(1)}s
          </p>
          <h1 className="break-all text-xl font-medium text-ink-50">{audit.url}</h1>
          {audit.isFixtureData && (
            <p className="mt-2 inline-block rounded border border-severity-medium/30 bg-severity-medium/10 px-2 py-1 text-xs text-severity-medium">
              Fixture / demo data — not from a live browser session
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a href={`/api/audit/${audit.auditId}/export?format=json`} className="rounded-lg border border-ink-700 px-3 py-2 text-xs text-ink-300 hover:text-ink-50">
            Download JSON
          </a>
          <a href={`/api/audit/${audit.auditId}/export?format=md`} className="rounded-lg border border-ink-700 px-3 py-2 text-xs text-ink-300 hover:text-ink-50">
            Export Report (.md)
          </a>
        </div>
      </header>

      <section className="border-b border-ink-800 py-8">
        <ScoreGauge score={audit.score} status={audit.overallStatus} />
      </section>

      <section className="border-b border-ink-800 py-8">
        <CategoryCards breakdown={audit.scoreBreakdown} />
      </section>

      <section className="border-b border-ink-800 py-8">
        <h2 className="mb-2 text-sm font-medium text-ink-200">Executive Summary</h2>
        <p className="leading-relaxed text-ink-300">{audit.summary}</p>
      </section>

      {audit.mainProblemPlain && (
        <section className="border-b border-ink-800 py-8">
          <h2 className="mb-2 text-sm font-medium text-ink-200">In Plain English: What&apos;s Actually Wrong</h2>
          <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-4">
            <p className="mb-2 text-sm font-medium text-ink-100">{audit.mainProblemPlain.headline}</p>
            <p className="leading-relaxed text-ink-300">{audit.mainProblemPlain.explanation}</p>
          </div>
        </section>
      )}

      {audit.aiInsights && (
        <section className="border-b border-ink-800 py-8">
          <h2 className="mb-3 text-sm font-medium text-ink-200">AI-Assisted Interpretation</h2>
          <AiInsightPanel insight={audit.aiInsights} />
        </section>
      )}

      <section className="border-b border-ink-800 py-8">
        <h2 className="mb-4 text-sm font-medium text-ink-200">Findings</h2>
        <FindingsExplorer findings={audit.checks} />
      </section>

      <section className="py-8">
        <TechnicalDrawer audit={audit} />
      </section>
    </main>
  );
}
