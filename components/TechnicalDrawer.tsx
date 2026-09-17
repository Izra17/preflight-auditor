'use client';

import { useState } from 'react';
import type { AuditResult } from '@/types/audit';

export function TechnicalDrawer({ audit }: { audit: AuditResult }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'events' | 'console' | 'network' | 'screenshots'>('events');

  return (
    <div className="rounded-lg border border-ink-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink-200"
      >
        Technical Evidence
        <span className="text-ink-500">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-ink-800 p-4">
          <div className="mb-3 flex gap-4 text-xs">
            {(['events', 'console', 'network', 'screenshots'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={tab === t ? 'font-medium text-accent-bright' : 'text-ink-500 hover:text-ink-200'}
              >
                {t === 'events' ? `Tracking events (${audit.networkEvents.length})` : t === 'console' ? `Console (${audit.consoleIssues.length})` : t === 'network' ? `Network failures (${audit.networkFailures.length})` : `Screenshots (${audit.screenshots.length})`}
              </button>
            ))}
          </div>

          {tab === 'events' && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-ink-900 text-ink-500">
                  <tr>
                    <th className="py-1 pr-3">t+ms</th>
                    <th className="py-1 pr-3">Platform</th>
                    <th className="py-1 pr-3">Event</th>
                    <th className="py-1 pr-3">Stage</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1">Dup?</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-ink-300">
                  {audit.networkEvents.map((e) => (
                    <tr key={e.id} className="border-t border-ink-800/60">
                      <td className="py-1 pr-3">{e.timestamp}</td>
                      <td className="py-1 pr-3">{e.platform}</td>
                      <td className="py-1 pr-3">{e.eventName ?? e.eventType}</td>
                      <td className="py-1 pr-3">{e.triggeredBy}</td>
                      <td className="py-1 pr-3">{e.status ?? '—'}</td>
                      <td className="py-1">{e.duplicateGroup ? '⚠' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'console' && (
            <ul className="max-h-96 space-y-1 overflow-auto font-mono text-xs text-ink-300">
              {audit.consoleIssues.map((c) => (
                <li key={c.id}>
                  <span className="text-ink-500">[{c.type}]</span> {c.message}
                </li>
              ))}
              {audit.consoleIssues.length === 0 && <li className="text-ink-500">No console issues recorded.</li>}
            </ul>
          )}

          {tab === 'network' && (
            <ul className="max-h-96 space-y-1 overflow-auto font-mono text-xs text-ink-300">
              {audit.networkFailures.map((f) => (
                <li key={f.id}>
                  {f.method} {f.url} → {f.status ?? f.failureText}
                </li>
              ))}
              {audit.networkFailures.length === 0 && <li className="text-ink-500">No network failures recorded.</li>}
            </ul>
          )}

          {tab === 'screenshots' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {audit.screenshots.map((s) => (
                <div key={s.id}>
                  <img src={s.dataUrl} alt={s.label} className="rounded border border-ink-800" />
                  <p className="mt-1 text-xs text-ink-500">{s.label}</p>
                </div>
              ))}
              {audit.screenshots.length === 0 && <p className="text-xs text-ink-500">No screenshots captured.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
