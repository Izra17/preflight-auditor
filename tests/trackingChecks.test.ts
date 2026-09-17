import { describe, it, expect } from 'vitest';
import { buildTrackingFindings } from '@/lib/rules/checks/trackingChecks';
import type { TrackingEvent } from '@/types/audit';

function makeEvent(overrides: Partial<TrackingEvent>): TrackingEvent {
  return {
    id: Math.random().toString(36),
    platform: 'GOOGLE_ANALYTICS_4',
    eventName: 'page_view',
    eventType: 'pageview',
    timestamp: 0,
    requestUrl: 'https://www.google-analytics.com/g/collect',
    method: 'GET',
    status: 200,
    payloadSummary: {},
    source: 'network',
    duplicateGroup: null,
    evidence: [],
    triggeredBy: 'page_load',
    ...overrides
  };
}

const noInteractions = { ctaAttempted: false, ctaSucceeded: false, addToCartAttempted: false, addToCartSucceeded: false };

describe('buildTrackingFindings', () => {
  it('returns a single CRITICAL finding when no tracking is observed at all', () => {
    const findings = buildTrackingFindings([], noInteractions);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].status).toBe('FAIL');
  });

  it('does not fail add_to_cart expectation when add-to-cart was never attempted (non-PDP page)', () => {
    const events = [makeEvent({})];
    const findings = buildTrackingFindings(events, noInteractions);
    expect(findings.some((f) => f.title.includes('add_to_cart'))).toBe(false);
  });

  it('FAILs add_to_cart expectation when the click succeeded but no event followed', () => {
    const events = [makeEvent({})]; // only a page_view, no add_to_cart event
    const findings = buildTrackingFindings(events, { ...noInteractions, addToCartAttempted: true, addToCartSucceeded: true });
    const atc = findings.find((f) => f.title.includes('add_to_cart event not observed'));
    expect(atc).toBeDefined();
    expect(atc?.status).toBe('FAIL');
    expect(atc?.severity).toBe('HIGH');
  });

  it('PASSes add_to_cart expectation when the event is present', () => {
    const events = [
      makeEvent({}),
      makeEvent({ eventName: 'add_to_cart', eventType: 'conversion', triggeredBy: 'add_to_cart' })
    ];
    const findings = buildTrackingFindings(events, { ...noInteractions, addToCartAttempted: true, addToCartSucceeded: true });
    const atc = findings.find((f) => f.title === 'add_to_cart tracking confirmed');
    expect(atc?.status).toBe('PASS');
  });

  it('WARNs but does not FAIL when page_view is missing but other tracking exists', () => {
    const events = [makeEvent({ eventName: null, eventType: 'unknown' })];
    const findings = buildTrackingFindings(events, noInteractions);
    const pv = findings.find((f) => f.title.includes('No page_view'));
    expect(pv?.status).toBe('WARN');
  });
});
