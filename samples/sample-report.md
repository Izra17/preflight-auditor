> ⚠️ **FIXTURE / DEMO DATA.** This report was hand-authored from `sample-audit.json` to
> illustrate PreFlight's real report format. It was **not** generated from a live
> Playwright session against neemans.com — this development environment has no
> outbound network access. Run `npm run dev` and audit a real neemans.com URL to
> produce a genuine live report (see README > "Running a live Neeman's audit").

# PreFlight Audit Report

**URL:** https://www.neemans.com/products/example-product
**Audited:** 2026-09-16T09:12:00.000Z
**Duration:** 18.4s
**Readiness:** READY WITH WARNINGS | **Score:** 68/100

## Executive Summary

READY WITH WARNINGS — 1 high-severity issue detected, most notably: Potential duplicate GA4 page_view.

## AI-Assisted Interpretation

The page is largely ready for paid traffic: page-view and add-to-cart tracking are
both firing correctly across GA4, Meta Pixel, and Shopify's native analytics. The
one issue worth fixing before scaling spend is a duplicate GA4 page_view, which
will inflate session counts and slightly distort attribution reporting.

**Root-cause hypotheses:**
- GA4 is most likely configured to fire both through a direct gtag.js snippet and again through Google Tag Manager, producing two page_view hits per load. _(confidence: 70%)_

**Recommended actions:**
- [NOW] Audit the theme's `<head>` and GTM container for a duplicate GA4 configuration tag and remove one.
- [SOON] Run a full Lighthouse pass on this PDP template to address the elevated LCP.

## Findings

### 🟠 [HIGH] Potential duplicate GOOGLE_ANALYTICS_4 page_view
*Category: TRACKING · Status: WARN · Confidence: 82%*

2 equivalent events were observed in rapid succession during the same interaction,
which typically indicates the tag firing through more than one path (e.g. both a
direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and
corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 2 equivalent GOOGLE_ANALYTICS_4 "page_view" events observed
- within 420ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform
integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟡 [MEDIUM] Largest Contentful Paint is slow (4.1s)
*Category: UX · Status: WARN · Confidence: 55%*

LCP exceeds the ~2.5s "good" threshold commonly used in Core Web Vitals guidance.

**Why it matters:** LCP is one of the strongest correlates of perceived load speed
and bounce rate on paid landing pages.

**Evidence:**
- LCP observed at 4100ms

**Recommendation:** This is a pre-flight signal, not a substitute for a full
Lighthouse/PageSpeed audit — run one for detailed remediation.

### 🔵 [LOW] 1 console error(s) logged
*Category: TECHNICAL · Status: WARN · Confidence: 40%*

A small number of console errors were logged during the session.

**Why it matters:** Low-severity, but worth a quick review to rule out affected
functionality.

**Evidence:**
- [console.error] Failed to load resource: net::ERR_BLOCKED_BY_CLIENT for a third-party pixel (t+9500ms)

**Recommendation:** Review at your convenience; not likely to be blocking.

## Passed Checks (4)

- ✅ Page loaded successfully (HTTP 200)
- ✅ Page-view tracking confirmed on load
- ✅ add_to_cart tracking confirmed
- ✅ Consent banner detected

## Technical Appendix

- Tracking events observed: 8
- Console issues: 1
- Network failures: 0
- Browser: Chromium (Playwright) (Playwright 1.46.0)
