import { v4 as uuid } from 'uuid';
import { validateAuditUrl, UnsafeUrlError } from '@/lib/security/urlValidation';
import { runBrowserAudit } from '@/lib/browser/runner';
import { runRuleEngine } from '@/lib/rules/engine';
import { calculateRiskScore, explainReadiness, explainMainProblemPlainly } from '@/lib/scoring/score';
import { generateAiInsight } from '@/lib/ai/llm';
import { AUDIT_STAGE_DEFS, type AuditResult, type AuditStage } from '@/types/audit';
import { getAudit, saveAudit } from '@/lib/store/store';

const AUDIT_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS ?? 45000);

export type StageEmitter = (stage: AuditStage) => void;

function initStages(): AuditStage[] {
  return AUDIT_STAGE_DEFS.map((d) => ({ key: d.key, label: d.label, status: 'pending' as const }));
}

function markStage(stages: AuditStage[], key: AuditStage['key'], status: AuditStage['status'], detail?: string) {
  const s = stages.find((x) => x.key === key);
  if (!s) return;
  s.status = status;
  if (status === 'running') s.startedAt = Date.now();
  if (status === 'done' || status === 'error') s.finishedAt = Date.now();
  if (detail) s.detail = detail;
}

/**
 * Starts an audit and returns its id immediately (after the shell record
 * is persisted), while the actual browser/rule/scoring work continues in
 * the background on this same persistent Node process. This is what lets
 * the live progress screen poll GET /api/audit/:id and see real stage
 * transitions rather than a fake animation — it requires a long-running
 * server process (see README > Deployment), not a request-scoped
 * serverless function that terminates the moment a response is sent.
 */
export function startAudit(rawUrl: string): { auditId: string } {
  const auditId = uuid();
  const stages = initStages();
  const partial: AuditResult = emptyAuditShell(auditId, rawUrl, stages);
  saveAudit(partial);

  // Fire-and-forget: errors are normally captured and written back into the
  // store inside runAuditInternal's own try/catch. This outer catch is a
  // last-resort safety net for anything that throws BEFORE that inner
  // try/catch can run (e.g. Chromium failing to launch at all). We log it
  // loudly and still write a failed status back, so the frontend's polling
  // loop always terminates instead of spinning forever.
  void runAuditInternal(auditId, rawUrl, stages).catch((err) => {
    console.error(`[audit ${auditId}] fatal error before pipeline could run:`, err);
    const current = getAudit(auditId);
    if (current) {
      saveAudit({
        ...current,
        overallStatus: 'NOT_READY',
        summary: 'The audit could not complete.',
        mainProblemPlain: null,
        stages: stages.map((s) => (s.status === 'pending' ? { ...s, status: 'error' as const } : s)),
        error: { message: err instanceof Error ? err.message : 'Unknown fatal error', stage: 'launching_browser' }
      });
    }
  });

  return { auditId };
}

/** Convenience wrapper for callers (tests, scripts) that want to await completion. */
export async function runAudit(rawUrl: string): Promise<AuditResult> {
  const { auditId } = startAudit(rawUrl);
  // Poll the in-memory store until the audit finishes. Safe because this
  // runs in the same process/module instance as startAudit.
  while (true) {
    const current = getAudit(auditId);
    if (current && current.stages.every((s) => s.status === 'done' || s.status === 'error')) return current;
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function runAuditInternal(auditId: string, rawUrl: string, stages: AuditStage[]): Promise<AuditResult> {
  const startedAt = Date.now();
  const emit = (key: AuditStage['key'], status: AuditStage['status'], detail?: string) => {
    markStage(stages, key, status, detail);
    const current = getAudit(auditId);
    if (current) saveAudit({ ...current, stages: [...stages] });
  };

  const partial: AuditResult = emptyAuditShell(auditId, rawUrl, stages);

  const timeoutGuard = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Audit exceeded the maximum allowed time.')), AUDIT_TIMEOUT_MS)
  );

  try {
    return await Promise.race([runPipeline(), timeoutGuard]);
  } catch (err) {
    const failedStage = stages.find((s) => s.status === 'running')?.key ?? 'launching_browser';
    emit(failedStage, 'error', err instanceof Error ? err.message : 'Unknown error');
    const result: AuditResult = {
      ...partial,
      durationMs: Date.now() - startedAt,
      overallStatus: 'NOT_READY',
      summary: 'The audit could not complete.',
        mainProblemPlain: null,
      stages,
      error: { message: err instanceof Error ? err.message : 'Unknown error', stage: failedStage }
    };
    saveAudit(result);
    return result;
  }

  async function runPipeline(): Promise<AuditResult> {
    // 1. Validate
    emit('validating_url', 'running');
    let validated;
    try {
      validated = await validateAuditUrl(rawUrl);
    } catch (e) {
      if (e instanceof UnsafeUrlError) throw e;
      throw new Error('URL validation failed.');
    }
    emit('validating_url', 'done', `Resolved to ${validated.resolvedIps.join(', ')}`);

    // 2-6: browser launch, navigation, network capture, analytics, interactions
    // are all performed inside one Playwright session for efficiency; we
    // emit synthetic stage progress around it since Playwright doesn't
    // expose granular sub-stage callbacks natively.
    emit('launching_browser', 'running');
    emit('launching_browser', 'done');

    emit('loading_page', 'running');
    const outcome = await runBrowserAudit(validated.url.toString());
    emit('loading_page', 'done', outcome.httpStatus ? `HTTP ${outcome.httpStatus}` : undefined);

    emit('capturing_network', 'running');
    emit('capturing_network', 'done', `${outcome.trackingEvents.length} tracking event(s) observed`);

    emit('inspecting_analytics', 'running');
    const platformsSeen = new Set(outcome.trackingEvents.map((e) => e.platform));
    emit('inspecting_analytics', 'done', platformsSeen.size ? [...platformsSeen].join(', ') : 'No platforms detected');

    emit('testing_interactions', 'running');
    emit('testing_interactions', 'done', `${outcome.interactions.filter((i) => i.succeeded).length}/${outcome.interactions.length} interactions completed`);

    emit('checking_runtime_health', 'running');
    emit('checking_runtime_health', 'done', `${outcome.consoleIssues.length} console issue(s), ${outcome.networkFailures.length} network failure(s)`);

    // 7. Deterministic rule engine + duplicate detection
    emit('detecting_duplicates', 'running');
    const { findings, annotatedEvents } = runRuleEngine(outcome, validated.url.protocol);
    const dupCount = findings.filter((f) => f.title.startsWith('Potential duplicate')).length;
    emit('detecting_duplicates', 'done', `${dupCount} duplicate group(s) found`);

    // 8. Scoring
    emit('calculating_readiness', 'running');
    const { overallScore, breakdown, readiness } = calculateRiskScore(findings);
    const summary = explainReadiness(readiness, findings);
    const mainProblemPlain = explainMainProblemPlainly(findings);
    emit('calculating_readiness', 'done', `${readiness} (${overallScore}/100)`);

    // 9. Optional AI layer — isolated, never blocking, never required.
    const aiInsights = await generateAiInsight(validated.url.toString(), findings).catch(() => null);

    // 10. Assemble report
    emit('generating_report', 'running');
    const recommendations = findings
      .filter((f) => f.status !== 'PASS')
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
      .slice(0, 8)
      .map((f) => f.recommendation);

    const result: AuditResult = {
      auditId,
      url: validated.url.toString(),
      timestamp: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      overallStatus: readiness,
      score: overallScore,
      scoreBreakdown: breakdown,
      summary,
      mainProblemPlain,
      httpStatus: outcome.httpStatus,
      stages,
      checks: findings,
      networkEvents: annotatedEvents,
      consoleIssues: outcome.consoleIssues,
      networkFailures: outcome.networkFailures,
      interactions: outcome.interactions,
      performance: outcome.performance,
      consent: outcome.consent,
      screenshots: outcome.screenshots,
      recommendations,
      aiInsights,
      isFixtureData: false,
      environment: {
        browser: 'Chromium (Playwright)',
        playwrightVersion: outcome.playwrightVersion,
        executedAt: new Date().toISOString()
      }
    };
    emit('generating_report', 'done');
    saveAudit(result);
    return result;
  }
}

function severityRank(s: string): number {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 }[s] ?? 0;
}

function emptyAuditShell(auditId: string, url: string, stages: AuditStage[]): AuditResult {
  return {
    auditId,
    url,
    timestamp: new Date().toISOString(),
    durationMs: 0,
    overallStatus: 'NOT_READY',
    score: 0,
    scoreBreakdown: [],
    summary: 'Audit in progress…',
    mainProblemPlain: null,
    httpStatus: null,
    stages,
    checks: [],
    networkEvents: [],
    consoleIssues: [],
    networkFailures: [],
    interactions: [],
    performance: {
      domContentLoadedMs: null,
      loadEventMs: null,
      largestContentfulPaintMs: null,
      requestCount: 0,
      failedResourceCount: 0,
      transferredBytesApprox: null,
      hasViewportMeta: false
    },
    consent: { bannerDetected: false, bannerSelectorGuess: null, trackingBeforeInteraction: false, note: '' },
    screenshots: [],
    recommendations: [],
    aiInsights: null,
    isFixtureData: false,
    environment: { browser: 'Chromium (Playwright)', playwrightVersion: 'unknown', executedAt: new Date().toISOString() }
  };
}
