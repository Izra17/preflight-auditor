import { v4 as uuid } from 'uuid';
import type { InteractionStage, TrackingEvent, TrackingPlatform } from '@/types/audit';

export interface RawRequestRecord {
  url: string;
  method: string;
  status: number | null;
  timestamp: number; // ms since navigation start
  postData?: string | null;
}

interface DetectorRule {
  platform: TrackingPlatform;
  /** Matches the request URL. */
  match: (url: URL) => boolean;
  eventName: (url: URL, postData: string | null) => string | null;
  eventType: (eventName: string | null) => TrackingEvent['eventType'];
  /** Extract a small, non-sensitive summary of query/body params. */
  summarize: (url: URL, postData: string | null) => Record<string, string>;
}

const SAFE_PARAM_ALLOWLIST = new Set([
  'en', 'event', 'ev', 'event_name', 'tid', 'dl', 'dt', 't', 'v', 'cid',
  'ecommerce', 'items', 'value', 'currency', 'content_name', 'content_ids',
  'page_location', 'ep.event_category'
]);

function redactParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (SAFE_PARAM_ALLOWLIST.has(key) || key.startsWith('ep.') || key.startsWith('epn.')) {
      out[key] = value.length > 80 ? value.slice(0, 80) + '…' : value;
    }
  }
  return out;
}

function tryParseGA4EventName(url: URL): string | null {
  const en = url.searchParams.get('en');
  if (en) return en;
  return null;
}

const RULES: DetectorRule[] = [
  {
    platform: 'GOOGLE_ANALYTICS_4',
    match: (u) =>
      (u.hostname.includes('google-analytics.com') && /^\/(g|mp)\/collect/.test(u.pathname)) ||
      u.hostname.includes('analytics.google.com'),
    eventName: (u) => tryParseGA4EventName(u) ?? 'page_view',
    eventType: (name) => (name === 'page_view' ? 'pageview' : name === 'add_to_cart' || name === 'purchase' ? 'conversion' : 'unknown'),
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'GOOGLE_TAG_MANAGER',
    match: (u) => u.hostname.includes('googletagmanager.com') && u.pathname.includes('/gtm.js'),
    eventName: () => 'container_load',
    eventType: () => 'unknown',
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'GOOGLE_ADS',
    match: (u) => /googleadservices\.com|google\.com\/pagead|googlesyndication\.com/.test(u.hostname + u.pathname),
    eventName: (u) => (u.pathname.includes('conversion') ? 'conversion' : 'ad_request'),
    eventType: (name) => (name === 'conversion' ? 'conversion' : 'unknown'),
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'META_PIXEL',
    match: (u) => u.hostname.includes('facebook.com') && u.pathname.includes('/tr'),
    eventName: (u) => u.searchParams.get('ev'),
    eventType: (name) =>
      name === 'PageView' ? 'pageview' : name === 'AddToCart' || name === 'Purchase' || name === 'Lead' ? 'conversion' : 'unknown',
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'TIKTOK_PIXEL',
    match: (u) => u.hostname.includes('analytics.tiktok.com'),
    eventName: (u) => u.searchParams.get('event'),
    eventType: (name) => (name === 'ViewContent' || name === 'Pageview' ? 'pageview' : name === 'AddToCart' || name === 'CompletePayment' ? 'conversion' : 'unknown'),
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'MICROSOFT_ADS',
    match: (u) => u.hostname.includes('bat.bing.com') || u.hostname.includes('clarity.ms'),
    eventName: (u) => u.searchParams.get('ea') ?? 'uet_event',
    eventType: () => 'unknown',
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'LINKEDIN_INSIGHT',
    match: (u) => u.hostname.includes('px.ads.linkedin.com') || u.hostname.includes('snap.licdn.com'),
    eventName: () => 'insight_tag_fire',
    eventType: () => 'unknown',
    summarize: (u) => redactParams(u.searchParams)
  },
  {
    platform: 'SHOPIFY_ANALYTICS',
    match: (u) => u.hostname.includes('monorail-edge.shopifysvc.com') || (u.hostname.includes('.myshopify.com') && u.pathname.includes('/events')),
    eventName: () => 'shopify_event',
    eventType: () => 'unknown',
    summarize: (u) => redactParams(u.searchParams)
  }
];

/** Fallback for recognizable-but-uncatalogued analytics/marketing endpoints. */
const GENERIC_ANALYTICS_HOST_HINTS = [
  'segment.io', 'segment.com', 'amplitude.com', 'mixpanel.com', 'hotjar.com',
  'clarity.ms', 'fullstory.com', 'snowplowanalytics.com', 'pinterest.com/ct',
  'ads.snapchat.com', 'ads.twitter.com', 'sc-static.net'
];

export function classifyRequest(
  req: RawRequestRecord,
  triggeredBy: InteractionStage
): TrackingEvent | null {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return null;
  }

  for (const rule of RULES) {
    if (rule.match(url)) {
      const eventName = rule.eventName(url, req.postData ?? null);
      return {
        id: uuid(),
        platform: rule.platform,
        eventName,
        eventType: rule.eventType(eventName),
        timestamp: req.timestamp,
        requestUrl: req.url,
        method: req.method,
        status: req.status,
        payloadSummary: rule.summarize(url, req.postData ?? null),
        source: 'network',
        duplicateGroup: null,
        evidence: [`${req.method} request to ${url.hostname}${url.pathname} at t+${req.timestamp}ms`],
        triggeredBy
      };
    }
  }

  const hostMatch = GENERIC_ANALYTICS_HOST_HINTS.find((h) => url.hostname.includes(h));
  if (hostMatch) {
    return {
      id: uuid(),
      platform: 'GENERIC_ANALYTICS',
      eventName: null,
      eventType: 'unknown',
      timestamp: req.timestamp,
      requestUrl: req.url,
      method: req.method,
      status: req.status,
      payloadSummary: redactParams(url.searchParams),
      source: 'network',
      duplicateGroup: null,
      evidence: [`${req.method} request to recognized analytics host ${url.hostname} at t+${req.timestamp}ms`],
      triggeredBy
    };
  }

  return null;
}

/** Normalizes a raw dataLayer push captured via page.evaluate() polling. */
export function classifyDataLayerPush(
  push: Record<string, unknown>,
  timestamp: number,
  triggeredBy: InteractionStage
): TrackingEvent | null {
  const eventName = typeof push.event === 'string' ? push.event : null;
  if (!eventName) return null;
  const summary: Record<string, string> = {};
  for (const [k, v] of Object.entries(push)) {
    if (k === 'event' || typeof v === 'object') continue;
    summary[k] = String(v).slice(0, 80);
  }
  return {
    id: uuid(),
    platform: 'GOOGLE_TAG_MANAGER',
    eventName,
    eventType: eventName === 'page_view' ? 'pageview' : eventName === 'add_to_cart' || eventName === 'purchase' ? 'conversion' : 'unknown',
    timestamp,
    requestUrl: '(dataLayer)',
    method: 'PUSH',
    status: null,
    payloadSummary: summary,
    source: 'dataLayer',
    duplicateGroup: null,
    evidence: [`dataLayer.push({event: "${eventName}", ...}) observed at t+${timestamp}ms`],
    triggeredBy
  };
}
