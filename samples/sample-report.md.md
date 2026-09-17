# PreFlight Audit Report

**URL:** https://neemans.com/collections/women
**Audited:** 2026-09-17T19:05:55.622Z
**Duration:** 28.1s
**Readiness:** NOT READY  |  **Score:** 47/100

## Executive Summary
NOT READY — 1 critical issue detected: 1 uncaught JavaScript exception(s) detected.

## In Plain English: What's Actually Wrong
**1 uncaught JavaScript exception(s) detected**

The page's own code is throwing errors while people use it. Think of it like a machine that occasionally jams while running — it might still mostly work, but things can silently break, including the very tracking scripts meant to measure success.

## Findings

### 🔴 [CRITICAL] 1 uncaught JavaScript exception(s) detected
*Category: TECHNICAL · Status: FAIL · Confidence: 90%*

One or more uncaught exceptions occurred during page load or interaction, which can break page functionality including tracking scripts.

**Why it matters:** Uncaught exceptions can silently prevent tracking tags, add-to-cart handlers, or other on-page scripts from running at all.

**Evidence:**
- [pageerror] Failed to resolve module specifier "vendor". Relative references must start with either "/", "./", or "../". (t+9126ms)

**Recommendation:** Investigate and fix the uncaught exception(s) before sending paid traffic; re-run the audit afterward.

### 🟠 [HIGH] Potential duplicate GOOGLE_ADS conversion
*Category: TRACKING · Status: WARN · Confidence: 81%*

3 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 3 equivalent GOOGLE_ADS "conversion" events observed
- within 1329ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟠 [HIGH] Potential duplicate GOOGLE_ANALYTICS_4 page_view
*Category: TRACKING · Status: WARN · Confidence: 80%*

2 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 2 equivalent GOOGLE_ANALYTICS_4 "page_view" events observed
- within 2ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟠 [HIGH] Potential duplicate GOOGLE_ADS conversion
*Category: TRACKING · Status: WARN · Confidence: 86%*

3 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 3 equivalent GOOGLE_ADS "conversion" events observed
- within 582ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟠 [HIGH] Potential duplicate GOOGLE_TAG_MANAGER gtm.scrollDepth
*Category: TRACKING · Status: WARN · Confidence: 76%*

2 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 2 equivalent GOOGLE_TAG_MANAGER "gtm.scrollDepth" events observed
- within 0ms of each other
- during the same "scroll" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟠 [HIGH] 7 tracking-related network request(s) failed
*Category: TRACKING · Status: FAIL · Confidence: 70%*

One or more requests to known analytics/ad-platform domains failed or were blocked.

**Why it matters:** Failed tracking requests directly translate into missing or undercounted conversion data.

**Evidence:**
- POST https://analytics.google.com/g/collect?v=2&tid=G-3042L5GP9T&gtm=45je69g0v881198150za200zb9205647393zd9205647393xf1&_p=1789671964215&gcs=G111&gcd=13t3t3t3t5l1&npa=0&dma=0&gdid=dN2ZkMj.dNTU0Yz.dYmNjMT&ecid=775843363&_eu=AAAAAGQC&are=1&cid=998500141.1789671967&ec_mode=c&excid=shp.66f05fb2-9aea-485f-9981-7872d3bd0dd1&frm=0&pscdl=noapi&rcb=8&sr=1366x900&uaa=x64&uab=64&uafvl=Chromium%3B128.0.6613.18%7CNot%253BA%253DBrand%3B24.0.0.0%7CHeadlessChrome%3B128.0.6613.18&uam=&uamb=0&uap=Windows&uapv=10.0&uaw=0&ul=en-gb&gaf=2&_s=2&tag_exp=115938465~115938468~118897920~118897930~120213116~120385422~120469145~120469153&sid=1789671966&sct=1&seg=0&dl=https%3A%2F%2Fneemans.com%2Fcollections%2Fwomen&dt=Shop%20Women%27s%20Shoes%20Online%20with%20Up%20to%2065%25%20Off%20on%20Every%20Style&_tu=AAI&tfd=6531 → net::ERR_ABORTED (t+6989ms)
- POST https://analytics.google.com/g/collect?v=2&tid=G-3042L5GP9T&gtm=45je69g0v881198150za200zb9205647393zd9205647393xf1&_p=1789671964215&_gaz=1&gcs=G111&gcd=13t3t3t3t5l1&npa=0&dma=0&gdid=dN2ZkMj.dNTU0Yz.dYmNjMT&ecid=775843363&_eu=AAAAAGAC&are=1&cid=998500141.1789671967&ec_mode=c&excid=shp.66f05fb2-9aea-485f-9981-7872d3bd0dd1&frm=0&pscdl=noapi&rcb=8&sr=1366x900&uaa=x64&uab=64&uafvl=Chromium%3B128.0.6613.18%7CNot%253BA%253DBrand%3B24.0.0.0%7CHeadlessChrome%3B128.0.6613.18&uam=&uamb=0&uap=Windows&uapv=10.0&uaw=0&ul=en-gb&gaf=2&_s=1&tag_exp=115938465~115938468~118897920~118897930~120213116~120385422~120469145~120469153&dp=%2Fcollections%2Fwomen&dt=Shop%20Women%27s%20Shoes%20Online%20with%20Up%20to%2065%25%20Off%20on%20Every%20Style&dl=https%3A%2F%2Fneemans.com%2Fcollections%2Fwomen&sid=1789671966&sct=1&seg=0&_tu=AAI&en=page_view&_fv=1&_ss=1&_ee=1&edid=dNzYwYj&ep.shopify_event_name=page_viewed&evnid=sh-b0c31366-7AB2-41C5-CE36-A4C100AF4913&tfd=6514 → net::ERR_ABORTED (t+7003ms)
- POST https://analytics.google.com/g/collect?v=2&tid=G-3042L5GP9T&gtm=45je69g0v881198150z8854378256za200zb9205647393zd9205647393xf1&_p=1789671964215&gcs=G111&gcd=13t3t3t3t5l1&npa=0&dma=0&gdid=dN2ZkMj.dNTU0Yz.dYmNjMT&ecid=775843363&_eu=AAAAAGQC&are=1&cid=998500141.1789671967&frm=0&pscdl=noapi&rcb=8&sr=1366x900&uaa=x64&uab=64&uafvl=Chromium%3B128.0.6613.18%7CNot%253BA%253DBrand%3B24.0.0.0%7CHeadlessChrome%3B128.0.6613.18&uam=&uamb=0&uap=Windows&uapv=10.0&uaw=0&ul=en-gb&gaf=2&_s=3&tag_exp=115938465~115938468~118897920~118897930~120213116~120385422~120469145~120469153&sid=1789671966&sct=1&seg=0&dl=https%3A%2F%2Fneemans.com%2Fcollections%2Fwomen&dt=Shop%20Women%27s%20Shoes%20Online%20with%20Up%20to%2065%25%20Off%20on%20Every%20Style&_tu=AAI&en=view_item_list&_et=1657&tfd=8211 → net::ERR_ABORTED (t+9636ms)
- POST https://analytics.google.com/g/collect?v=2&tid=G-3042L5GP9T&gtm=45je69g0v881198150z8854378256za200zb9205647393zd9205647393xf1&_p=1789671964215&gcs=G111&gcd=13t3t3t3t5l1&npa=0&dma=0&gdid=dN2ZkMj.dNTU0Yz.dYmNjMT&ecid=775843363&_eu=IAAAAGQC&are=1&cid=998500141.1789671967&ec_mode=c&excid=shp.66f05fb2-9aea-485f-9981-7872d3bd0dd1&frm=0&pscdl=noapi&rcb=8&sr=1366x900&uaa=x64&uab=64&uafvl=Chromium%3B128.0.6613.18%7CNot%253BA%253DBrand%3B24.0.0.0%7CHeadlessChrome%3B128.0.6613.18&uam=&uamb=0&uap=Windows&uapv=10.0&uaw=0&ul=en-gb&gaf=2&_s=4&tag_exp=115938465~115938468~118897920~118897930~120213116~120385422~120469145~120469153&sid=1789671966&sct=1&seg=0&dl=https%3A%2F%2Fneemans.com%2Fcollections%2Fwomen&dt=Shop%20Women%27s%20Shoes%20Online%20with%20Up%20to%2065%25%20Off%20on%20Every%20Style&_tu=AAI&tfd=8215 → net::ERR_ABORTED (t+9636ms)
- POST https://www.google-analytics.com/g/collect?v=2&tid=G-VDE0ZFZ4LP&gtm=45je69g0v9249449940z8854378256za20gzb854378256zd854378256xf1&_p=1789671964215&gcs=G111&gcd=13t3t3t3t5l1&npa=0&dma=0&are=1&cid=998500141.1789671967&frm=0&ngs=1&pscdl=noapi&rcb=10&sr=1366x900&uaa=x64&uab=64&uafvl=Chromium%3B128.0.6613.18%7CNot%253BA%253DBrand%3B24.0.0.0%7CHeadlessChrome%3B128.0.6613.18&uam=&uamb=0&uap=Windows&uapv=10.0&uaw=0&ul=en-gb&_s=1&tag_exp=115616986~115938465~115938468~118012007~118897920~118897930~120213116~120385423~120469145~120469153&sid=1789671970&sct=1&seg=0&dl=https%3A%2F%2Fneemans.com%2Fcollections%2Fwomen&dt=Shop%20Women%27s%20Shoes%20Online%20with%20Up%20to%2065%25%20Off%20on%20Every%20Style&en=page_view&_fv=1&_ss=1&tfd=10106 → net::ERR_ABORTED (t+10358ms)

**Recommendation:** Check for ad-blocker interference, CSP restrictions, or misconfigured tag endpoints.

### 🟡 [MEDIUM] Potential duplicate GENERIC_ANALYTICS unknown
*Category: TRACKING · Status: WARN · Confidence: 69%*

2 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 2 equivalent GENERIC_ANALYTICS "unknown" events observed
- within 580ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟡 [MEDIUM] Potential duplicate MICROSOFT_ADS uet_event
*Category: TRACKING · Status: WARN · Confidence: 69%*

3 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 3 equivalent MICROSOFT_ADS "uet_event" events observed
- within 529ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟡 [MEDIUM] Potential duplicate GENERIC_ANALYTICS unknown
*Category: TRACKING · Status: WARN · Confidence: 64%*

2 equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).

**Why it matters:** Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.

**Evidence:**
- 2 equivalent GENERIC_ANALYTICS "unknown" events observed
- within 1201ms of each other
- during the same "page_load" interaction
- matching event parameters

**Recommendation:** Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.

### 🟡 [MEDIUM] 8 console error(s) logged during the session
*Category: TECHNICAL · Status: WARN · Confidence: 50%*

Multiple console errors were logged. Some may be benign (third-party script noise) but the volume warrants review.

**Why it matters:** Console error volume can be an early indicator of a fragile page, especially under real user network/device conditions.

**Evidence:**
- [console.error] An import map is added after module script load was triggered. (t+4032ms)
- [console.error] Multiple import maps are not yet supported. https://crbug.com/927119 (t+4517ms)
- [console.error] Multiple import maps are not yet supported. https://crbug.com/927119 (t+4860ms)
- [console.error] Clear-Site-Data header on 'https://neemans.com/cart/update.js': Unrecognized type: "prefetchCache". (t+10988ms)
- [console.error] Clear-Site-Data header on 'https://neemans.com/cart/update.js': Unrecognized type: "prerenderCache". (t+10988ms)

**Recommendation:** Review console errors, particularly any originating from tracking or checkout-related scripts.

### 🟡 [MEDIUM] Slow full page load (10.9s)
*Category: UX · Status: WARN · Confidence: 60%*

The page load event fired significantly later than the ~3-4s threshold generally considered acceptable for paid landing pages.

**Why it matters:** Slow-loading landing pages increase bounce rate and reduce ad platform quality/relevance scores.

**Evidence:**
- window.onload fired at 10890ms

**Recommendation:** Investigate render-blocking resources, large images, and third-party script load order.

### 🔵 [LOW] 19 resource(s) failed to load
*Category: UX · Status: WARN · Confidence: 50%*

One or more page resources (images, scripts, styles) failed to load.

**Why it matters:** Broken resources can degrade visual polish and trust signals on the landing page.

**Evidence:**
- 19 failed resource request(s) recorded.

**Recommendation:** Review the network failures list for specific broken resources.

### ℹ️ [INFO] Consent banner not detected
*Category: PRIVACY · Status: NOT_TESTED · Confidence: 40%*

No consent banner could be detected via common selectors. This does not confirm one is absent — some implementations are custom-built.

**Why it matters:** This is a technical observation, not legal advice. Absence of a detectable banner does not confirm compliance status.

**Evidence:**
- No element matching common consent-banner selectors was found.

**Recommendation:** If applicable regulations require a consent mechanism, confirm one exists and is technically implemented.

## Passed Checks (3)
- ✅ Page loaded successfully (HTTP 200)
- ✅ Page-view tracking confirmed on load
- ✅ add_to_cart tracking confirmed

## Technical Appendix
- Tracking events observed: 35
- Console issues: 32
- Network failures: 21
- Browser: Chromium (Playwright) (Playwright 1.46.0)