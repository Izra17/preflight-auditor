'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuditStage } from '@/types/audit';

// useSearchParams() opts a component into client-side-only rendering for
// the part of the tree that reads it, which Next requires to be wrapped in
// a Suspense boundary so the rest of the route isn't forced dynamic too.
export default function PendingAuditPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PendingAuditPage />
    </Suspense>
  );
}

function PendingAuditPage() {
  const router = useRouter();
  const params = useSearchParams();
  const url = params.get('url') ?? '';
  const [stages, setStages] = useState<AuditStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !url) return;
    startedRef.current = true;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function start() {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start the audit.');
        return;
      }
      const auditId: string = data.auditId;

      pollTimer = setInterval(async () => {
        const r = await fetch(`/api/audit/${auditId}`);
        if (!r.ok) return;
        const audit = await r.json();
        setStages(audit.stages ?? []);
        const finished = (audit.stages ?? []).every((s: AuditStage) => s.status === 'done' || s.status === 'error');
        if (finished) {
          if (pollTimer) clearInterval(pollTimer);
          if (audit.error) {
            setError(audit.error.message);
          } else {
            router.replace(`/audit/${auditId}`);
          }
        }
      }, 500);
    }

    start();
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!url) {
    return (
      <Centered>
        <p className="text-ink-300">No URL provided.</p>
        <a href="/" className="text-accent-bright underline underline-offset-4">
          Go back
        </a>
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <p className="mb-2 font-medium text-severity-critical">Audit could not complete</p>
        <p className="max-w-md text-center text-sm text-ink-300">{error}</p>
        <a href="/" className="mt-4 text-accent-bright underline underline-offset-4">
          Try another URL
        </a>
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-accent-bright">Running audit</p>
      <h1 className="mb-8 truncate text-xl font-medium text-ink-50">{url}</h1>

      <ol className="space-y-1">
        {stages.map((s) => (
          <li key={s.key} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <StageIcon status={s.status} />
            <span className={s.status === 'pending' ? 'text-ink-500' : 'text-ink-100'}>{s.label}</span>
            {s.detail && s.status === 'done' && <span className="ml-auto truncate text-xs text-ink-500">{s.detail}</span>}
          </li>
        ))}
      </ol>
    </main>
  );
}

function StageIcon({ status }: { status: AuditStage['status'] }) {
  if (status === 'done') {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-severity-pass/20 text-severity-pass">✓</span>;
  }
  if (status === 'running') {
    return <span className="h-5 w-5 animate-pulse rounded-full border-2 border-accent-bright" />;
  }
  if (status === 'error') {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-severity-critical/20 text-severity-critical">✕</span>;
  }
  return <span className="h-5 w-5 rounded-full border-2 border-ink-700" />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">{children}</main>;
}
