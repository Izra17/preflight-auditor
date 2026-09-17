import { describe, it, expect } from 'vitest';
import { classifyRequest, classifyDataLayerPush } from '@/lib/tracking/detectors';

describe('classifyRequest', () => {
  it('classifies a GA4 collect request as GOOGLE_ANALYTICS_4 page_view', () => {
    const ev = classifyRequest(
      { url: 'https://www.google-analytics.com/g/collect?v=2&tid=G-XXXX&en=page_view&dl=https://example.com', method: 'GET', status: 200, timestamp: 100 },
      'page_load'
    );
    expect(ev?.platform).toBe('GOOGLE_ANALYTICS_4');
    expect(ev?.eventName).toBe('page_view');
    expect(ev?.eventType).toBe('pageview');
  });

  it('classifies a Meta pixel /tr request with AddToCart event', () => {
    const ev = classifyRequest(
      { url: 'https://www.facebook.com/tr?id=123&ev=AddToCart&cd=1', method: 'GET', status: 200, timestamp: 50 },
      'add_to_cart'
    );
    expect(ev?.platform).toBe('META_PIXEL');
    expect(ev?.eventName).toBe('AddToCart');
    expect(ev?.eventType).toBe('conversion');
  });

  it('classifies TikTok pixel events', () => {
    const ev = classifyRequest({ url: 'https://analytics.tiktok.com/api/v2/pixel?event=ViewContent', method: 'GET', status: 200, timestamp: 10 }, 'page_load');
    expect(ev?.platform).toBe('TIKTOK_PIXEL');
  });

  it('returns null for a request to an unrelated domain', () => {
    const ev = classifyRequest({ url: 'https://cdn.example.com/main.js', method: 'GET', status: 200, timestamp: 10 }, 'page_load');
    expect(ev).toBeNull();
  });

  it('falls back to GENERIC_ANALYTICS for a recognized-but-uncatalogued analytics host', () => {
    const ev = classifyRequest({ url: 'https://api.mixpanel.com/track?data=abc', method: 'POST', status: 200, timestamp: 10 }, 'page_load');
    expect(ev?.platform).toBe('GENERIC_ANALYTICS');
  });

  it('redacts unlisted query params from the payload summary', () => {
    const ev = classifyRequest(
      { url: 'https://www.google-analytics.com/g/collect?en=page_view&uid=super-secret-email@example.com', method: 'GET', status: 200, timestamp: 10 },
      'page_load'
    );
    expect(ev?.payloadSummary.uid).toBeUndefined();
    expect(ev?.payloadSummary.en).toBe('page_view');
  });
});

describe('classifyDataLayerPush', () => {
  it('classifies a dataLayer push with an event key', () => {
    const ev = classifyDataLayerPush({ event: 'add_to_cart', value: 49.99 }, 500, 'add_to_cart');
    expect(ev?.eventName).toBe('add_to_cart');
    expect(ev?.eventType).toBe('conversion');
    expect(ev?.source).toBe('dataLayer');
  });

  it('returns null for a dataLayer push with no event key', () => {
    const ev = classifyDataLayerPush({ 'gtm.uniqueEventId': 4 }, 500, 'page_load');
    expect(ev).toBeNull();
  });
});
