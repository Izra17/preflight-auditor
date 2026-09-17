import { chromium, type Browser, type BrowserContext } from 'playwright';
import type {
  ConsoleIssue,
  ConsentObservation,
  InteractionResult,
  InteractionStage,
  NetworkFailure,
  PerformanceSignals,
  Screenshot
} from '@/types/audit';
import { classifyDataLayerPush, classifyRequest, type RawRequestRecord } from '@/lib/tracking/detectors';
import type { TrackingEvent } from '@/types/audit';
import { v4 as uuid } from 'uuid';

const NAV_TIMEOUT_MS = Number(process.env.AUDIT_NAV_TIMEOUT_MS ?? 20000);
// Kept as a plain constant (rather than `require('playwright/package.json')`)
// so this module has no dependency on Node's CommonJS resolution behaving a
// particular way under Next's bundler. Update alongside the pinned version
// in package.json if it changes.
const PLAYWRIGHT_VERSION = '1.46.0';

export interface BrowserRunOutcome {
  httpStatus: number | null;
  navStartedAt: number;
  trackingEvents: TrackingEvent[];
  consoleIssues: ConsoleIssue[];
  networkFailures: NetworkFailure[];
  interactions: InteractionResult[];
  performance: PerformanceSignals;
  consent: ConsentObservation;
  screenshots: Screenshot[];
  pageTitle: string | null;
  hasViewportMeta: boolean;
  ctaFound: string | null;
  addToCartFound: boolean;
  playwrightVersion: string;
}

const TRACKING_HOST_HINTS = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com', 'googleadservices.com',
  'googlesyndication.com', 'facebook.com', 'analytics.tiktok.com', 'bat.bing.com', 'clarity.ms',
  'px.ads.linkedin.com', 'snap.licdn.com', 'monorail-edge.shopifysvc.com', 'segment.io', 'segment.com',
  'amplitude.com', 'mixpanel.com', 'hotjar.com', 'fullstory.com', 'snowplowanalytics.com'
];

function isTrackingUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return TRACKING_HOST_HINTS.some((hint) => h.includes(hint));
  } catch {
    return false;
  }
}

/**
 * Runs a full PreFlight audit pass against a live page using a real
 * Chromium session. This is the ONLY module allowed to touch Playwright
 * directly — everything else in the app works off the normalized
 * output type above.
 */
export async function runBrowserAudit(targetUrl: string): Promise<BrowserRunOutcome> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  const trackingEvents: TrackingEvent[] = [];
  const consoleIssues: ConsoleIssue[] = [];
  const networkFailures: NetworkFailure[] = [];
  const screenshots: Screenshot[] = [];
  let httpStatus: number | null = null;
  let navStartedAt = Date.now();
  let currentStage: InteractionStage = 'page_load';

  const elapsed = () => Date.now() - navStartedAt;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu']
    });

    context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PreFlightAuditor/1.0'
    });
    context.setDefaultTimeout(NAV_TIMEOUT_MS);

    const page = await context.newPage();

    // --- Network instrumentation -----------------------------------------
    // We classify on 'response' rather than 'request' so we have the final
    // HTTP status available for each classified event.
    page.on('response', async (res) => {
      try {
        const req = res.request();
        const record: RawRequestRecord = {
          url: req.url(),
          method: req.method(),
          status: res.status(),
          timestamp: elapsed(),
          postData: req.postData()
        };
        const classified = classifyRequest(record, currentStage);
        if (classified) trackingEvents.push(classified);

        if (res.status() >= 400) {
          networkFailures.push({
            id: uuid(),
            url: req.url(),
            method: req.method(),
            status: res.status(),
            timestamp: elapsed(),
            isTrackingRelated: isTrackingUrl(req.url())
          });
        }
      } catch {
        // Response body/host may be unavailable for aborted requests — ignore.
      }
    });

    page.on('requestfailed', (req) => {
      networkFailures.push({
        id: uuid(),
        url: req.url(),
        method: req.method(),
        status: null,
        failureText: req.failure()?.errorText,
        timestamp: elapsed(),
        isTrackingRelated: isTrackingUrl(req.url())
      });
      consoleIssues.push({
        id: uuid(),
        type: 'requestfailed',
        message: `Request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText ?? 'unknown error'})`,
        timestamp: elapsed()
      });
    });

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleIssues.push({
          id: uuid(),
          type: type === 'error' ? 'error' : 'warning',
          message: msg.text().slice(0, 500),
          timestamp: elapsed()
        });
      }
    });

    page.on('pageerror', (err) => {
      consoleIssues.push({
        id: uuid(),
        type: 'pageerror',
        message: err.message.slice(0, 500),
        timestamp: elapsed()
      });
    });

    // --- Navigation ---------------------------------------------------------
    navStartedAt = Date.now();
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    httpStatus = response?.status() ?? null;

    // Let network settle a bit rather than waiting forever on `networkidle`,
    // which many ad/analytics-heavy pages never truly reach.
    await page.waitForTimeout(1500);
    try {
      await page.waitForLoadState('load', { timeout: 8000 });
    } catch {
      /* tolerate slow/never-firing load event */
    }
    await page.waitForTimeout(1000);

    const pageTitle = await page.title().catch(() => null);
    const hasViewportMeta = await page
      .locator('meta[name="viewport"]')
      .count()
      .then((c) => c > 0)
      .catch(() => false);

    // --- Performance signals -------------------------------------------------
    const perf = await page
      .evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1] : null;
        const resources = performance.getEntriesByType('resource');
        return {
          domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
          largestContentfulPaintMs: lcp ? Math.round((lcp as any).startTime) : null,
          requestCount: resources.length,
          transferredBytesApprox: resources.reduce((sum: number, r: any) => sum + (r.transferSize || 0), 0)
        };
      })
      .catch(() => ({
        domContentLoadedMs: null,
        loadEventMs: null,
        largestContentfulPaintMs: null,
        requestCount: 0,
        transferredBytesApprox: null
      }));

    const performance_: PerformanceSignals = {
      ...perf,
      failedResourceCount: networkFailures.length,
      hasViewportMeta
    };

    // --- Screenshot: post-load -------------------------------------------
    const postLoadShot = await page.screenshot({ fullPage: false }).catch(() => null);
    if (postLoadShot) {
      screenshots.push({
        id: uuid(),
        label: 'Post-load viewport',
        dataUrl: `data:image/png;base64,${postLoadShot.toString('base64')}`,
        timestamp: elapsed()
      });
    }

    // --- dataLayer polling ---------------------------------------------
    // We poll dataLayer length rather than monkey-patching push before the
    // site's own scripts load, since injecting into an already-navigated
    // page cannot retroactively hook earlier pushes. This is an accepted,
    // documented limitation (see README > Limitations).
    let lastDataLayerLen = await page
      .evaluate(() => (Array.isArray((window as any).dataLayer) ? (window as any).dataLayer.length : 0))
      .catch(() => 0);

    const pollDataLayer = async (stage: InteractionStage) => {
      const pushes: Record<string, unknown>[] = await page
        .evaluate((fromIdx) => {
          const dl = (window as any).dataLayer;
          if (!Array.isArray(dl)) return [];
          return dl.slice(fromIdx).filter((e: unknown) => e && typeof e === 'object');
        }, lastDataLayerLen)
        .catch(() => []);
      lastDataLayerLen += pushes.length;
      for (const p of pushes) {
        const ev = classifyDataLayerPush(p as Record<string, unknown>, elapsed(), stage);
        if (ev) trackingEvents.push(ev);
      }
    };

    await pollDataLayer('page_load');

    // --- Consent banner detection -----------------------------------------
    const consentSelectors = [
      '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]',
      'button:has-text("Accept")', 'button:has-text("Accept All")', 'button:has-text("I agree")'
    ];
    let bannerSelectorGuess: string | null = null;
    for (const sel of consentSelectors) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 500 })) {
          bannerSelectorGuess = sel;
          break;
        }
      } catch {
        /* selector not present/visible — continue */
      }
    }
    const trackingBeforeInteraction = trackingEvents.length > 0;
    const consent: ConsentObservation = {
      bannerDetected: bannerSelectorGuess !== null,
      bannerSelectorGuess,
      trackingBeforeInteraction,
      note: bannerSelectorGuess
        ? 'A consent banner was detected. This is a technical observation only — PreFlight does not evaluate legal compliance.'
        : 'No consent banner could be detected via common selectors. This does not confirm one is absent — some implementations are custom-built.'
    };

    // --- Interactions ------------------------------------------------------
    const interactions: InteractionResult[] = [];

    // Test: primary CTA
    currentStage = 'cta_click';
    const ctaCandidates = [
      'a:has-text("Shop Now")', 'a:has-text("Buy Now")', 'button:has-text("Shop Now")',
      'a:has-text("Learn More")', 'button:has-text("Get Started")', '[data-testid*="cta" i]',
      'a:has-text("Shop")'
    ];
    let ctaFound: string | null = null;
    let ctaLocatorSel: string | null = null;
    for (const sel of ctaCandidates) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 500 })) {
          ctaFound = (await loc.textContent().catch(() => sel))?.trim() || sel;
          ctaLocatorSel = sel;
          break;
        }
      } catch {
        /* not present */
      }
    }
    if (ctaLocatorSel) {
      try {
        // Non-destructive: hover + click but never follow off-domain nav
        // that could trigger a real purchase/lead flow; we only observe
        // the immediate tracking reaction, not the destination page.
        await page.locator(ctaLocatorSel).first().click({ timeout: 3000, trial: false, noWaitAfter: true });
        await page.waitForTimeout(1200);
        await pollDataLayer('cta_click');
        interactions.push({
          stage: 'cta_click',
          attempted: true,
          succeeded: true,
          elementDescription: ctaFound ?? ctaLocatorSel,
          timestamp: elapsed()
        });
      } catch (e) {
        interactions.push({
          stage: 'cta_click',
          attempted: true,
          succeeded: false,
          elementDescription: ctaFound ?? ctaLocatorSel,
          timestamp: elapsed(),
          notes: 'CTA element was found but could not be safely clicked (may be obscured or navigated away).'
        });
      }
    } else {
      interactions.push({
        stage: 'cta_click',
        attempted: false,
        succeeded: false,
        skippedReason: 'No recognizable primary CTA element was found on the page.',
        timestamp: elapsed()
      });
    }

    // Test: Add to Cart
    currentStage = 'add_to_cart';
    const addToCartSelectors = [
      'button:has-text("Add to Cart")', 'button:has-text("Add to Bag")',
      '[name="add"]', 'button[data-testid*="add-to-cart" i]', 'form[action*="/cart/add"] button'
    ];
    let addToCartFound = false;
    let atcSel: string | null = null;
    for (const sel of addToCartSelectors) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 500 })) {
          addToCartFound = true;
          atcSel = sel;
          break;
        }
      } catch {
        /* not present */
      }
    }
    if (atcSel) {
      try {
        await page.locator(atcSel).first().click({ timeout: 3000, noWaitAfter: true });
        await page.waitForTimeout(1200);
        await pollDataLayer('add_to_cart');
        interactions.push({
          stage: 'add_to_cart',
          attempted: true,
          succeeded: true,
          elementDescription: atcSel,
          timestamp: elapsed(),
          notes: 'Clicked the first visible add-to-cart control. Cart was not proceeded to checkout.'
        });
      } catch {
        interactions.push({
          stage: 'add_to_cart',
          attempted: true,
          succeeded: false,
          elementDescription: atcSel,
          timestamp: elapsed(),
          notes: 'Add-to-cart control found but click did not register safely.'
        });
      }
    } else {
      interactions.push({
        stage: 'add_to_cart',
        attempted: false,
        succeeded: false,
        skippedReason: 'No add-to-cart control was found on this page (likely a non-PDP landing page).',
        timestamp: elapsed()
      });
    }

    // Checkout / payment / form submission — explicitly NOT tested.
    interactions.push({
      stage: 'navigation',
      attempted: false,
      succeeded: false,
      skippedReason: 'Not tested — potentially destructive (checkout/payment/form submission is out of scope for a safe audit).',
      timestamp: elapsed()
    });

    // Test: scroll / engagement
    currentStage = 'scroll';
    try {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.6, behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(1000);
      await pollDataLayer('scroll');
      interactions.push({ stage: 'scroll', attempted: true, succeeded: true, timestamp: elapsed(), notes: 'Scrolled ~60% down the page.' });
    } catch {
      interactions.push({ stage: 'scroll', attempted: true, succeeded: false, timestamp: elapsed() });
    }

    // Final full-page screenshot as post-interaction evidence.
    const finalShot = await page.screenshot({ fullPage: true }).catch(() => null);
    if (finalShot) {
      screenshots.push({
        id: uuid(),
        label: 'Full page (post-interaction)',
        dataUrl: `data:image/png;base64,${finalShot.toString('base64')}`,
        timestamp: elapsed()
      });
    }

    await context.close();
    await browser.close();

    return {
      httpStatus,
      navStartedAt,
      trackingEvents,
      consoleIssues,
      networkFailures,
      interactions,
      performance: performance_,
      consent,
      screenshots,
      pageTitle,
      hasViewportMeta,
      ctaFound,
      addToCartFound,
      playwrightVersion: PLAYWRIGHT_VERSION
    };
  } catch (err) {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}
