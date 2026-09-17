import clsx from 'clsx';
import type { CheckStatus, ReadinessStatus, Severity } from '@/types/audit';

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  HIGH: 'bg-severity-high/15 text-severity-high border-severity-high/30',
  MEDIUM: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
  LOW: 'bg-severity-low/15 text-severity-low border-severity-low/30',
  INFO: 'bg-ink-500/15 text-ink-300 border-ink-500/30'
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={clsx('inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide', SEVERITY_STYLES[severity])}>
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<CheckStatus, string> = {
  PASS: 'bg-severity-pass/15 text-severity-pass border-severity-pass/30',
  WARN: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
  FAIL: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
  NOT_TESTED: 'bg-ink-500/15 text-ink-300 border-ink-500/30'
};

export function StatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium', STATUS_STYLES[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}

const READINESS_STYLES: Record<ReadinessStatus, { label: string; className: string; dot: string }> = {
  READY: { label: 'Ready', className: 'text-severity-pass border-severity-pass/40 bg-severity-pass/10', dot: 'bg-severity-pass' },
  READY_WITH_WARNINGS: {
    label: 'Ready with warnings',
    className: 'text-severity-high border-severity-high/40 bg-severity-high/10',
    dot: 'bg-severity-high'
  },
  NOT_READY: { label: 'Not ready', className: 'text-severity-critical border-severity-critical/40 bg-severity-critical/10', dot: 'bg-severity-critical' }
};

export function ReadinessPill({ status, size = 'md' }: { status: ReadinessStatus; size?: 'md' | 'lg' }) {
  const style = READINESS_STYLES[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border font-semibold',
        style.className,
        size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1 text-sm'
      )}
    >
      <span className={clsx('h-2 w-2 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}
