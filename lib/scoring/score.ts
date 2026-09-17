import type { Finding, FindingCategory, ReadinessStatus, RiskScoreBreakdown, Severity } from '@/types/audit';

/**
 * All scoring weights live here — the single configurable location
 * required by the spec. Nothing else in the codebase should hardcode
 * a penalty value.
 */
export const SEVERITY_PENALTIES: Record<Severity, number> = {
  CRITICAL: 40,
  HIGH: 20,
  MEDIUM: 10,
  LOW: 4,
  INFO: 0
};

export const PASS_BONUS = 2; // small positive contribution per passing check, capped below

const CATEGORIES: FindingCategory[] = ['TRACKING', 'ATTRIBUTION', 'TECHNICAL', 'UX', 'PRIVACY'];

// How much each category counts toward the OVERALL readiness score. Tracking
// and Attribution are weighted heaviest since they're this tool's core
// purpose (is paid traffic being measured correctly), Technical/UX/Privacy
// matter but are secondary. Weights are renormalized over whichever
// categories actually produced findings for a given audit, so a site with
// no Attribution findings doesn't get penalized for a category that simply
// didn't apply.
const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  TRACKING: 0.3,
  ATTRIBUTION: 0.2,
  TECHNICAL: 0.2,
  UX: 0.15,
  PRIVACY: 0.15
};

function scoreForFindings(findings: Finding[]): { score: number; penalties: RiskScoreBreakdown['penalties'] } {
  let score = 100;
  const penalties: RiskScoreBreakdown['penalties'] = [];

  for (const f of findings) {
    if (f.status === 'FAIL' || f.status === 'WARN') {
      const points = SEVERITY_PENALTIES[f.severity];
      if (points > 0) {
        score -= points;
        penalties.push({ findingId: f.id, severity: f.severity, points });
      }
    } else if (f.status === 'PASS') {
      score = Math.min(100, score + PASS_BONUS);
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), penalties };
}

export function calculateRiskScore(findings: Finding[]): {
  overallScore: number;
  breakdown: RiskScoreBreakdown[];
  readiness: ReadinessStatus;
} {
  const breakdown: RiskScoreBreakdown[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const category of CATEGORIES) {
    const catFindings = findings.filter((f) => f.category === category);
    if (catFindings.length === 0) continue;
    const { score, penalties } = scoreForFindings(catFindings);
    breakdown.push({ category, score, penalties });
    weightedSum += score * CATEGORY_WEIGHTS[category];
    weightTotal += CATEGORY_WEIGHTS[category];
  }

  // Weighted average of the category scores, renormalized over categories
  // that actually had findings. Falls back to 100 (nothing to penalize) if
  // somehow no category produced any findings at all.
  const overallScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 100;

  // Still surface every individual penalty on the OVERALL row for the
  // evidence/export views, even though the overall SCORE itself is now a
  // composite of the category scores rather than a raw re-application of
  // every penalty.
  const { penalties: overallPenalties } = scoreForFindings(findings);
  breakdown.push({ category: 'OVERALL', score: overallScore, penalties: overallPenalties });

  const hasCritical = findings.some((f) => f.severity === 'CRITICAL' && f.status !== 'PASS');
  const highCount = findings.filter((f) => f.severity === 'HIGH' && f.status !== 'PASS').length;

  let readiness: ReadinessStatus;
  if (hasCritical || overallScore < 50) {
    readiness = 'NOT_READY';
  } else if (highCount > 0 || overallScore < 80) {
    readiness = 'READY_WITH_WARNINGS';
  } else {
    readiness = 'READY';
  }

  return { overallScore, breakdown, readiness };
}

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

/**
 * Plain-language, jargon-free explanation of the SINGLE biggest problem on
 * the page — meant to be understandable by someone with no technical
 * background at all, e.g. explaining to a client, boss, or teammate why a
 * score is low without them needing to know what "GTM" or "dataLayer" mean.
 */
const CATEGORY_PLAIN_EXPLANATION: Record<FindingCategory, string> = {
  TRACKING:
    "The page isn't properly telling advertising and analytics tools when someone visits or does something on it. In simple terms: money spent on ads for this page can't be reliably measured, so nobody can tell what's actually working.",
  ATTRIBUTION:
    "When a visitor clicks the main button on the page (like 'Buy' or 'Sign up'), that action isn't being recorded anywhere. So even if people ARE clicking, there's no record of it — which makes it look like the page isn't working, even if it is.",
  TECHNICAL:
    "The page's own code is throwing errors while people use it. Think of it like a machine that occasionally jams while running — it might still mostly work, but things can silently break, including the very tracking scripts meant to measure success.",
  UX:
    "Some images, styles, or scripts on the page are failing to load properly. Visitors may see broken or missing pieces, which can make the page look unfinished or untrustworthy.",
  PRIVACY:
    "There's a question mark around how the page handles visitor consent/privacy — either a banner wasn't found, or tracking started before a visitor had a chance to agree to it. This needs a human (ideally legal/privacy-aware) to double check, not just automated tools."
};

export function explainMainProblemPlainly(findings: Finding[]): { headline: string; explanation: string } | null {
  const active = findings.filter((f) => f.status !== 'PASS' && f.status !== 'NOT_TESTED');
  if (active.length === 0) return null;

  const worst = [...active].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.confidence - a.confidence;
  })[0]!;

  return {
    headline: worst.title,
    explanation: CATEGORY_PLAIN_EXPLANATION[worst.category] ?? worst.description
  };
}

export function explainReadiness(readiness: ReadinessStatus, findings: Finding[]): string {
  const critical = findings.filter((f) => f.severity === 'CRITICAL' && f.status !== 'PASS');
  const high = findings.filter((f) => f.severity === 'HIGH' && f.status !== 'PASS');

  if (readiness === 'NOT_READY') {
    if (critical.length > 0) {
      return `NOT READY — ${critical.length} critical issue${critical.length > 1 ? 's' : ''} detected: ${critical[0]!.title}.`;
    }
    return `NOT READY — overall readiness score fell below the acceptable threshold.`;
  }
  if (readiness === 'READY_WITH_WARNINGS') {
    if (high.length > 0) {
      return `READY WITH WARNINGS — ${high.length} high-severity issue${high.length > 1 ? 's' : ''} detected, most notably: ${high[0]!.title}.`;
    }
    return `READY WITH WARNINGS — some medium/low-severity issues were found but nothing blocking.`;
  }
  return 'READY — no critical or high-severity issues were detected in this audit.';
}
