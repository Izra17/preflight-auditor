import type { AuditResult, Finding } from '@/types/audit';

function severityEmoji(s: Finding['severity']): string {
  return { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵', INFO: 'ℹ️' }[s];
}

export function renderMarkdownReport(audit: AuditResult): string {
  const lines: string[] = [];
  lines.push(`# PreFlight Audit Report`);
  lines.push('');
  lines.push(`**URL:** ${audit.url}`);
  lines.push(`**Audited:** ${audit.timestamp}`);
  lines.push(`**Duration:** ${(audit.durationMs / 1000).toFixed(1)}s`);
  lines.push(`**Readiness:** ${audit.overallStatus.replace(/_/g, ' ')}  |  **Score:** ${audit.score}/100`);
  if (audit.isFixtureData) lines.push(`\n> ⚠️ This report was generated from fixture/demo data, not a live browser session.`);
  lines.push('');
  lines.push(`## Executive Summary`);
  lines.push(audit.summary);
  lines.push('');

  if (audit.mainProblemPlain) {
    lines.push(`## In Plain English: What's Actually Wrong`);
    lines.push(`**${audit.mainProblemPlain.headline}**`);
    lines.push('');
    lines.push(audit.mainProblemPlain.explanation);
    lines.push('');
  }

  if (audit.aiInsights) {
    lines.push(`## AI-Assisted Interpretation`);
    lines.push(audit.aiInsights.summary);
    if (audit.aiInsights.rootCauseHypotheses.length) {
      lines.push('');
      lines.push('**Root-cause hypotheses:**');
      for (const h of audit.aiInsights.rootCauseHypotheses) {
        lines.push(`- ${h.hypothesis} _(confidence: ${Math.round(h.confidence * 100)}%)_`);
      }
    }
    if (audit.aiInsights.recommendedActions.length) {
      lines.push('');
      lines.push('**Recommended actions:**');
      for (const a of audit.aiInsights.recommendedActions) {
        lines.push(`- [${a.priority}] ${a.action}`);
      }
    }
    lines.push('');
  }

  lines.push(`## Findings`);
  const nonPass = audit.checks.filter((c) => c.status !== 'PASS');
  const passed = audit.checks.filter((c) => c.status === 'PASS');

  for (const f of nonPass.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))) {
    lines.push('');
    lines.push(`### ${severityEmoji(f.severity)} [${f.severity}] ${f.title}`);
    lines.push(`*Category: ${f.category} · Status: ${f.status} · Confidence: ${Math.round(f.confidence * 100)}%*`);
    lines.push('');
    lines.push(f.description);
    lines.push('');
    lines.push(`**Why it matters:** ${f.whyItMatters}`);
    lines.push('');
    lines.push(`**Evidence:**`);
    for (const e of f.evidence) lines.push(`- ${e}`);
    lines.push('');
    lines.push(`**Recommendation:** ${f.recommendation}`);
  }

  lines.push('');
  lines.push(`## Passed Checks (${passed.length})`);
  for (const p of passed) lines.push(`- ✅ ${p.title}`);

  lines.push('');
  lines.push(`## Technical Appendix`);
  lines.push(`- Tracking events observed: ${audit.networkEvents.length}`);
  lines.push(`- Console issues: ${audit.consoleIssues.length}`);
  lines.push(`- Network failures: ${audit.networkFailures.length}`);
  lines.push(`- Browser: ${audit.environment.browser} (Playwright ${audit.environment.playwrightVersion})`);

  return lines.join('\n');
}

function severityRank(s: string): number {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 }[s] ?? 0;
}
