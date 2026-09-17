import { describe, it, expect } from 'vitest';
import { detectDuplicateEvents } from '@/lib/tracking/duplicates';
import type { TrackingEvent } from '@/types/audit';

function makeEvent(overrides: Partial<TrackingEvent>): TrackingEvent {
  return {
    id: overrides.id ?? Math.random().toString(36),
    platform: 'GOOGLE_ANALYTICS_4',
    eventName: 'page_view',
    eventType: 'pageview',
    timestamp: 0,
    requestUrl: 'https://www.google-analytics.com/g/collect?en=page_view',
    method: 'GET',
    status: 200,
    payloadSummary: { en: 'page_view', dl: 'https://example.com' },
    source: 'network',
    duplicateGroup: null,
    evidence: ['test evidence'],
    triggeredBy: 'page_load',
    ...overrides
  };
}

describe('detectDuplicateEvents', () => {
  it('flags two identical page_view events fired within the time window as a duplicate', () => {
    const events = [makeEvent({ id: 'a', timestamp: 100 }), makeEvent({ id: 'b', timestamp: 400 })];
    const { groups, annotated } = detectDuplicateEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].eventIds.sort()).toEqual(['a', 'b']);
    expect(annotated.every((e) => e.duplicateGroup === groups[0].groupId)).toBe(true);
  });

  it('does NOT flag events from different interaction stages as duplicates', () => {
    const events = [
      makeEvent({ id: 'a', timestamp: 100, triggeredBy: 'page_load' }),
      makeEvent({ id: 'b', timestamp: 400, triggeredBy: 'add_to_cart', eventName: 'add_to_cart', eventType: 'conversion' })
    ];
    const { groups } = detectDuplicateEvents(events);
    expect(groups).toHaveLength(0);
  });

  it('does NOT flag events from different platforms as duplicates', () => {
    const events = [
      makeEvent({ id: 'a', timestamp: 100, platform: 'GOOGLE_ANALYTICS_4' }),
      makeEvent({ id: 'b', timestamp: 200, platform: 'META_PIXEL', eventName: 'PageView' })
    ];
    const { groups } = detectDuplicateEvents(events);
    expect(groups).toHaveLength(0);
  });

  it('does NOT flag events far apart in time as duplicates', () => {
    const events = [makeEvent({ id: 'a', timestamp: 0 }), makeEvent({ id: 'b', timestamp: 10000 })];
    const { groups } = detectDuplicateEvents(events);
    expect(groups).toHaveLength(0);
  });

  it('groups three or more equivalent events into a single group, not pairwise', () => {
    const events = [
      makeEvent({ id: 'a', timestamp: 0 }),
      makeEvent({ id: 'b', timestamp: 200 }),
      makeEvent({ id: 'c', timestamp: 400 })
    ];
    const { groups } = detectDuplicateEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].eventIds).toHaveLength(3);
  });

  it('raises confidence when payloads match closely', () => {
    const closePayload = [
      makeEvent({ id: 'a', timestamp: 0, payloadSummary: { en: 'page_view', dl: 'https://x.com/p' } }),
      makeEvent({ id: 'b', timestamp: 100, payloadSummary: { en: 'page_view', dl: 'https://x.com/p' } })
    ];
    const farPayload = [
      makeEvent({ id: 'c', timestamp: 0, payloadSummary: { en: 'page_view', dl: 'https://x.com/p' } }),
      makeEvent({ id: 'd', timestamp: 100, payloadSummary: { en: 'page_view', dl: 'https://x.com/q' } })
    ];
    const closeResult = detectDuplicateEvents(closePayload);
    const farResult = detectDuplicateEvents(farPayload);
    expect(closeResult.groups[0].confidence).toBeGreaterThanOrEqual(farResult.groups[0].confidence);
  });
});
