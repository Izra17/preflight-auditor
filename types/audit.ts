/**
 * Central data model for PreFlight.
 *
 * Design principle: every stage of the pipeline (browser, tracking,
 * rules, scoring, AI) reads/writes plain structured data defined here.
 * Nothing downstream should ever re-derive facts from raw Playwright
 * objects — it consumes these normalized types instead. This is what
 * lets deterministic logic be unit-tested without a browser (see /tests).
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'NOT_TESTED';
export type ReadinessStatus = 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';
export type FindingCategory = 'TRACKING' | 'ATTRIBUTION' | 'TECHNICAL' | 'UX' | 'PRIVACY';

export type TrackingPlatform =
  | 'GOOGLE_ANALYTICS_4'
  | 'GOOGLE_TAG_MANAGER'
  | 'GOOGLE_ADS'
  | 'META_PIXEL'
  | 'TIKTOK_PIXEL'
  | 'MICROSOFT_ADS'
  | 'LINKEDIN_INSIGHT'
  | 'SHOPIFY_ANALYTICS'
  | 'GENERIC_ANALYTICS'
  | 'UNKNOWN';

/** A single normalized network-derived tracking event. */
export interface TrackingEvent {
  id: string;
  platform: TrackingPlatform;
  eventName: string | null;
  eventType: 'pageview' | 'conversion' | 'engagement' | 'unknown';
  timestamp: number; // ms since audit navigation start
  requestUrl: string;
  method: string;
  status: number | null;
  /** Redacted, human-scannable summary of the request payload. Never raw PII. */
  payloadSummary: Record<string, string>;
  /** What produced this event: 'network' (observed request) or 'dataLayer'. */
  source: 'network' | 'dataLayer';
  /** Populated by duplicate-detection; events sharing a group are considered equivalent. */
  duplicateGroup: string | null;
  /** Human-readable evidence trail for this single event. */
  evidence: string[];
  /** Which interaction stage produced this event (load, cta_click, add_to_cart, scroll, nav). */
  triggeredBy: InteractionStage;
}

export type InteractionStage = 'page_load' | 'cta_click' | 'add_to_cart' | 'navigation' | 'scroll';

export interface ConsoleIssue {
  id: string;
  type: 'error' | 'warning' | 'pageerror' | 'requestfailed';
  message: string;
  source?: string;
  timestamp: number;
}

export interface NetworkFailure {
  id: string;
  url: string;
  method: string;
  status: number | null;
  failureText?: string;
  timestamp: number;
  isTrackingRelated: boolean;
}

export interface Screenshot {
  id: string;
  label: string;
  /** base64 PNG data URI */
  dataUrl: string;
  timestamp: number;
}

export interface InteractionResult {
  stage: InteractionStage;
  attempted: boolean;
  succeeded: boolean;
  /** Set when an interaction was deliberately skipped for safety. */
  skippedReason?: string;
  elementDescription?: string;
  timestamp: number;
  notes?: string;
}

export interface Finding {
  id: string;
  status: CheckStatus;
  severity: Severity;
  category: FindingCategory;
  title: string;
  description: string;
  whyItMatters: string;
  evidence: string[];
  recommendation: string;
  confidence: number; // 0..1
  /** ids of TrackingEvent / ConsoleIssue / NetworkFailure this finding cites */
  relatedEventIds: string[];
}

export interface RiskScoreBreakdown {
  category: FindingCategory | 'OVERALL';
  score: number; // 0..100
  penalties: { findingId: string; severity: Severity; points: number }[];
}

export interface AiInsight {
  summary: string;
  rootCauseHypotheses: { hypothesis: string; relatedFindingIds: string[]; confidence: number }[];
  recommendedActions: { action: string; priority: 'NOW' | 'SOON' | 'LATER'; relatedFindingIds: string[] }[];
  confidence: number;
  modelUsed: string;
}

export interface PerformanceSignals {
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  largestContentfulPaintMs: number | null;
  requestCount: number;
  failedResourceCount: number;
  transferredBytesApprox: number | null;
  hasViewportMeta: boolean;
}

export interface ConsentObservation {
  bannerDetected: boolean;
  bannerSelectorGuess: string | null;
  trackingBeforeInteraction: boolean;
  note: string;
}

export interface AuditStage {
  key:
    | 'validating_url'
    | 'launching_browser'
    | 'loading_page'
    | 'capturing_network'
    | 'inspecting_analytics'
    | 'testing_interactions'
    | 'checking_runtime_health'
    | 'detecting_duplicates'
    | 'calculating_readiness'
    | 'generating_report';
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  startedAt?: number;
  finishedAt?: number;
  detail?: string;
}

export interface AuditResult {
  auditId: string;
  url: string;
  timestamp: string; // ISO
  durationMs: number;
  overallStatus: ReadinessStatus;
  score: number; // 0..100
  scoreBreakdown: RiskScoreBreakdown[];
  summary: string;
  /** The single biggest problem, explained in plain, jargon-free language for a non-technical reader. Null only if there were no active findings at all. */
  mainProblemPlain: { headline: string; explanation: string } | null;
  httpStatus: number | null;
  stages: AuditStage[];
  checks: Finding[];
  networkEvents: TrackingEvent[];
  consoleIssues: ConsoleIssue[];
  networkFailures: NetworkFailure[];
  interactions: InteractionResult[];
  performance: PerformanceSignals;
  consent: ConsentObservation;
  screenshots: Screenshot[];
  recommendations: string[];
  aiInsights: AiInsight | null;
  isFixtureData: boolean;
  environment: {
    browser: string;
    playwrightVersion: string;
    executedAt: string;
  };
  error?: { message: string; stage: AuditStage['key'] };
}

export const AUDIT_STAGE_DEFS: { key: AuditStage['key']; label: string }[] = [
  { key: 'validating_url', label: 'Validating URL' },
  { key: 'launching_browser', label: 'Launching browser' },
  { key: 'loading_page', label: 'Loading page' },
  { key: 'capturing_network', label: 'Capturing network activity' },
  { key: 'inspecting_analytics', label: 'Inspecting analytics' },
  { key: 'testing_interactions', label: 'Testing interactions' },
  { key: 'checking_runtime_health', label: 'Checking runtime health' },
  { key: 'detecting_duplicates', label: 'Detecting duplicates' },
  { key: 'calculating_readiness', label: 'Calculating readiness' },
  { key: 'generating_report', label: 'Generating report' }
];
