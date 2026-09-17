'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PIPELINE = ['Browser', 'Observe', 'Validate', 'Report'];

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError('Enter a landing page URL to audit.');
      return;
    }
    setLoading(true);
    router.push(`/audit/pending?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <RunwayMark />
          <span className="font-mono text-sm tracking-tight text-ink-200">PreFlight</span>
        </div>
        <a href="/history" className="text-sm text-ink-300 hover:text-ink-50 transition-colors">
          Audit history
        </a>
      </header>

      <section className="mb-14">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-accent-bright">
          Landing Page Readiness &amp; Tracking Auditor
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.15] tracking-tight text-ink-50 md:text-5xl">
          Know your landing page is ready before you spend on traffic.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-300">
          Validate analytics, conversion tracking, technical health, and user interactions in a
          real browser session — not a source-code guess.
        </p>
      </section>

      <form onSubmit={runAudit} className="mb-10">
        <div className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl shadow-black/40 sm:flex-row">
          <input
            autoFocus
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter landing page URL — https://www.neemans.com/products/…"
            className="flex-1 rounded-lg bg-transparent px-4 py-3.5 text-ink-50 placeholder:text-ink-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-6 py-3.5 font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-60"
          >
            Run Pre-Flight Audit
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-severity-critical">{error}</p>}
      </form>

      <section className="mb-20 flex flex-wrap items-center gap-3 font-mono text-xs text-ink-400">
        {PIPELINE.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <span className="rounded border border-ink-700 bg-ink-900 px-3 py-1.5 text-ink-200">{step}</span>
            {i < PIPELINE.length - 1 && <span className="text-ink-600">→</span>}
          </div>
        ))}
      </section>

      <section className="grid gap-6 border-t border-ink-800 pt-10 sm:grid-cols-3">
        <Fact
          label="Real browser, not source inspection"
          detail="Chromium via Playwright observes actual network requests, console output, and dataLayer activity — the same signals your ad platforms rely on."
        />
        <Fact
          label="Evidence, not vibes"
          detail="Every finding cites the specific request, timestamp, or console message that produced it, so engineers can verify it independently."
        />
        <Fact
          label="Deterministic first, AI second"
          detail="Facts are computed with rules. An optional LLM layer only summarizes and prioritizes — it never decides whether something happened."
        />
      </section>
    </main>
  );
}

function Fact({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-ink-100">{label}</h3>
      <p className="text-sm leading-relaxed text-ink-400">{detail}</p>
    </div>
  );
}

function RunwayMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" stroke="#3d6bff" strokeWidth="1.5" />
      <path d="M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4" stroke="#6d8fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
