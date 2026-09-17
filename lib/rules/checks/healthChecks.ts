import { v4 as uuid } from 'uuid';
import type { ConsoleIssue, Finding, NetworkFailure } from '@/types/audit';

/**
 * Classifies console/network signals into severities. Deliberately
 * conservative: a handful of console warnings or one non-tracking 404
 * does not fail the audit. We look for patterns that materially affect
 * either page functionality or tracking/conversion infrastructure.
 */
export function buildHealthFindings(consoleIssues: ConsoleIssue[], networkFailures: NetworkFailure[]): Finding[] {
  const findings: Finding[] = [];

  const pageErrors = consoleIssues.filter((c) => c.type === 'pageerror');
  const jsErrors = consoleIssues.filter((c) => c.type === 'error');
  const warnings = consoleIssues.filter((c) => c.type === 'warning');
  const trackingFailures = networkFailures.filter((f) => f.isTrackingRelated);
  const nonTrackingFailures = networkFailures.filter((f) => !f.isTrackingRelated && (f.status ?? 0) >= 500);

  if (pageErrors.length > 0) {
    findings.push({
      id: uuid(),
      status: 'FAIL',
      severity: 'CRITICAL',
      category: 'TECHNICAL',
      title: `${pageErrors.length} uncaught JavaScript exception(s) detected`,
      description: 'One or more uncaught exceptions occurred during page load or interaction, which can break page functionality including tracking scripts.',
      whyItMatters: 'Uncaught exceptions can silently prevent tracking tags, add-to-cart handlers, or other on-page scripts from running at all.',
      evidence: pageErrors.slice(0, 5).map((e) => `[pageerror] ${e.message} (t+${e.timestamp}ms)`),
      recommendation: 'Investigate and fix the uncaught exception(s) before sending paid traffic; re-run the audit afterward.',
      confidence: 0.9,
      relatedEventIds: pageErrors.map((e) => e.id)
    });
  }

  if (jsErrors.length >= 3) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'MEDIUM',
      category: 'TECHNICAL',
      title: `${jsErrors.length} console error(s) logged during the session`,
      description: 'Multiple console errors were logged. Some may be benign (third-party script noise) but the volume warrants review.',
      whyItMatters: 'Console error volume can be an early indicator of a fragile page, especially under real user network/device conditions.',
      evidence: jsErrors.slice(0, 5).map((e) => `[console.error] ${e.message} (t+${e.timestamp}ms)`),
      recommendation: 'Review console errors, particularly any originating from tracking or checkout-related scripts.',
      confidence: 0.5,
      relatedEventIds: jsErrors.map((e) => e.id)
    });
  } else if (jsErrors.length > 0) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'LOW',
      category: 'TECHNICAL',
      title: `${jsErrors.length} console error(s) logged`,
      description: 'A small number of console errors were logged during the session.',
      whyItMatters: 'Low-severity, but worth a quick review to rule out affected functionality.',
      evidence: jsErrors.map((e) => `[console.error] ${e.message} (t+${e.timestamp}ms)`),
      recommendation: 'Review at your convenience; not likely to be blocking.',
      confidence: 0.4,
      relatedEventIds: jsErrors.map((e) => e.id)
    });
  }

  if (trackingFailures.length > 0) {
    findings.push({
      id: uuid(),
      status: 'FAIL',
      severity: 'HIGH',
      category: 'TRACKING',
      title: `${trackingFailures.length} tracking-related network request(s) failed`,
      description: 'One or more requests to known analytics/ad-platform domains failed or were blocked.',
      whyItMatters: 'Failed tracking requests directly translate into missing or undercounted conversion data.',
      evidence: trackingFailures.slice(0, 5).map((f) => `${f.method} ${f.url} → ${f.status ?? f.failureText ?? 'failed'} (t+${f.timestamp}ms)`),
      recommendation: 'Check for ad-blocker interference, CSP restrictions, or misconfigured tag endpoints.',
      confidence: 0.7,
      relatedEventIds: trackingFailures.map((f) => f.id)
    });
  }

  if (nonTrackingFailures.length > 0) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'MEDIUM',
      category: 'TECHNICAL',
      title: `${nonTrackingFailures.length} server error(s) (5xx) observed on page resources`,
      description: 'Non-tracking resources returned server errors during the session.',
      whyItMatters: 'Server errors on page resources can degrade page experience and, in ad platforms, landing page quality scores.',
      evidence: nonTrackingFailures.slice(0, 5).map((f) => `${f.method} ${f.url} → ${f.status} (t+${f.timestamp}ms)`),
      recommendation: 'Investigate the failing resource(s) with the site engineering team.',
      confidence: 0.6,
      relatedEventIds: nonTrackingFailures.map((f) => f.id)
    });
  }

  if (pageErrors.length === 0 && jsErrors.length === 0 && trackingFailures.length === 0) {
    findings.push({
      id: uuid(),
      status: 'PASS',
      severity: 'INFO',
      category: 'TECHNICAL',
      title: 'No critical runtime errors detected',
      description: 'No uncaught exceptions or failed tracking requests were observed during this session.',
      whyItMatters: 'Indicates a technically healthy page load for this run.',
      evidence: [`${warnings.length} non-critical console warning(s) observed.`],
      recommendation: 'No action needed.',
      confidence: 0.7,
      relatedEventIds: []
    });
  }

  return findings;
}
