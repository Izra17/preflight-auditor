import type { BrowserRunOutcome } from '@/lib/browser/runner';
import { detectDuplicateEvents } from '@/lib/tracking/duplicates';
import { buildDuplicateFindings } from '@/lib/rules/checks/duplicateChecks';
import { buildHealthFindings } from '@/lib/rules/checks/healthChecks';
import { buildConsentFindings, buildPageQualityFindings, buildPerformanceFindings } from '@/lib/rules/checks/pageQualityChecks';
import { buildTrackingFindings } from '@/lib/rules/checks/trackingChecks';
import type { Finding, TrackingEvent } from '@/types/audit';

export interface RuleEngineOutput {
  findings: Finding[];
  annotatedEvents: TrackingEvent[];
}

export function runRuleEngine(outcome: BrowserRunOutcome, urlProtocol: string): RuleEngineOutput {
  const { groups, annotated } = detectDuplicateEvents(outcome.trackingEvents);
  const eventsById = new Map(annotated.map((e) => [e.id, e]));

  const cta = outcome.interactions.find((i) => i.stage === 'cta_click');
  const atc = outcome.interactions.find((i) => i.stage === 'add_to_cart');

  const findings: Finding[] = [
    ...buildPageQualityFindings(outcome.httpStatus, outcome.pageTitle, outcome.hasViewportMeta, urlProtocol),
    ...buildTrackingFindings(annotated, {
      ctaAttempted: cta?.attempted ?? false,
      ctaSucceeded: cta?.succeeded ?? false,
      addToCartAttempted: atc?.attempted ?? false,
      addToCartSucceeded: atc?.succeeded ?? false
    }),
    ...buildDuplicateFindings(groups, eventsById),
    ...buildHealthFindings(outcome.consoleIssues, outcome.networkFailures),
    ...buildPerformanceFindings(outcome.performance),
    ...buildConsentFindings(outcome.consent)
  ];

  return { findings, annotatedEvents: annotated };
}
