/**
 * End-to-end tests of the deterministic pipeline (rule engine → scoring)
 * against six hand-built fixtures representing common real-world
 * scenarios. These fixtures stand in for a real BrowserRunOutcome so the
 * rule engine and scorer can be exercised without actually launching
 * Chromium — see README > Testing for why the Playwright layer itself is
 * exercised manually/via `npm run dev` rather than mocked here.
 */
import { describe, it, expect } from 'vitest';
import { runRuleEngine } from '@/lib/rules/engine';
import { calculateRiskScore } from '@/lib/scoring/score';
import type { BrowserRunOutcome } from '@/lib/browser/runner';
import type { ConsoleIssue, TrackingEvent } from '@/types/audit';

function baseOutcome(overrides: Partial<BrowserRunOutcome>): BrowserRunOutcome {
  return {
    httpStatus: 200,
    navStartedAt: Date.now(),
    trackingEvents: [],
    consoleIssues: [],
    networkFailures: [],
    interactions: [
      { stage: 'cta_click', attempted: true, succeeded: true, timestamp: 500 },
      { stage: 'add_to_cart', attempted: false, succeeded: false, skippedReason: 'not present', timestamp: 500 },
      { stage: 'scroll', attempted: true, succeeded: true, timestamp: 900 }
    ],
    performance: {
      domContentLoadedMs: 900,
      loadEventMs: 1400,
      largestContentfulPaintMs: 1200,
      requestCount: 40,
      failedResourceCount: 0,
      transferredBytesApprox: 500000,
      hasViewportMeta: true
    },
    consent: { bannerDetected: false, bannerSelectorGuess: null, trackingBeforeInteraction: false, note: '' },
    screenshots: [],
    pageTitle: 'Test Page',
    hasViewportMeta: true,
    ctaFound: 'Shop Now',
    addToCartFound: false,
    playwrightVersion: '1.46.0',
    ...overrides
  };
}

function pv(id: string, timestamp: number): TrackingEvent {
  return {
    id,
    platform: 'GOOGLE_ANALYTICS_4',
    eventName: 'page_view',
    eventType: 'pageview',
    timestamp,
    requestUrl: 'https://www.google-analytics.com/g/collect',
    method: 'GET',
    status: 200,
    payloadSummary: { en: 'page_view' },
    source: 'network',
    duplicateGroup: null,
    evidence: ['test'],
    triggeredBy: 'page_load'
  };
}

describe('Fixture: healthy page', () => {
  it('scores READY with a single page_view and no errors', () => {
    const outcome = baseOutcome({ trackingEvents: [pv('a', 100)] });
    const { findings } = runRuleEngine(outcome, 'https:');
    const { readiness } = calculateRiskScore(findings);
    expect(readiness).toBe('READY');
  });
});

describe('Fixture: missing analytics', () => {
  it('scores NOT_READY with a critical finding when no tracking fires at all', () => {
    const outcome = baseOutcome({ trackingEvents: [] });
    const { findings } = runRuleEngine(outcome, 'https:');
    const { readiness } = calculateRiskScore(findings);
    expect(readiness).toBe('NOT_READY');
    expect(findings.some((f) => f.severity === 'CRITICAL')).toBe(true);
  });
});

describe('Fixture: duplicate page_view', () => {
  it('flags a duplicate-event finding and degrades readiness', () => {
    const outcome = baseOutcome({ trackingEvents: [pv('a', 100), pv('b', 300)] });
    const { findings } = runRuleEngine(outcome, 'https:');
    expect(findings.some((f) => f.title.startsWith('Potential duplicate'))).toBe(true);
  });
});

describe('Fixture: failed tracking request', () => {
  it('flags a HIGH finding for a failed request to a tracking domain', () => {
    const outcome = baseOutcome({
      trackingEvents: [pv('a', 100)],
      networkFailures: [
        { id: 'f1', url: 'https://www.google-analytics.com/g/collect', method: 'GET', status: 500, timestamp: 200, isTrackingRelated: true }
      ]
    });
    const { findings } = runRuleEngine(outcome, 'https:');
    const failFinding = findings.find((f) => f.title.includes('tracking-related network request'));
    expect(failFinding?.severity).toBe('HIGH');
  });
});

describe('Fixture: broken JS', () => {
  it('flags a CRITICAL finding on uncaught page errors', () => {
    const issues: ConsoleIssue[] = [{ id: 'c1', type: 'pageerror', message: 'TypeError: cannot read property of undefined', timestamp: 100 }];
    const outcome = baseOutcome({ trackingEvents: [pv('a', 100)], consoleIssues: issues });
    const { findings } = runRuleEngine(outcome, 'https:');
    const { readiness } = calculateRiskScore(findings);
    expect(findings.some((f) => f.severity === 'CRITICAL' && f.category === 'TECHNICAL')).toBe(true);
    expect(readiness).toBe('NOT_READY');
  });
});

describe('Fixture: missing conversion event', () => {
  it('FAILs when add-to-cart is clicked but no add_to_cart event follows', () => {
    const outcome = baseOutcome({
      trackingEvents: [pv('a', 100)],
      interactions: [
        { stage: 'cta_click', attempted: true, succeeded: true, timestamp: 500 },
        { stage: 'add_to_cart', attempted: true, succeeded: true, timestamp: 700 },
        { stage: 'scroll', attempted: true, succeeded: true, timestamp: 900 }
      ]
    });
    const { findings } = runRuleEngine(outcome, 'https:');
    expect(findings.some((f) => f.title.includes('add_to_cart event not observed'))).toBe(true);
  });
});
