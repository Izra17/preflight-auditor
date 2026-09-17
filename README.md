# PreFlight

**Landing Page Readiness \& Tracking Auditor**

PreFlight opens a real Chromium browser session against a landing page, observes what
actually happens — network requests, console errors, dataLayer pushes, the results of
clicking the primary CTA and add-to-cart — and turns that into an evidence-backed,
severity-ranked readiness report a growth marketer can act on before sending paid traffic.

\---

\## ✅ Verified with a live audit run



This tool was run live against a real Neeman's page:

`https://neemans.com/collections/women` (with real `gclid`/`gbraid` ad-click parameters).



The audit completed in \~24 seconds and surfaced 12 findings, including a CRITICAL uncaught

JavaScript exception and several duplicate tracking events across Google Ads, GTM, and GA4.



Several findings were manually cross-checked against Chrome DevTools on the same page:

\- Confirmed: Meta Pixel logged an "Invalid parameter format for currency" warning

\- Confirmed: 2 console errors (a 403 resource load failure, and an X-Frame-Options block)

&#x20; matched what the audit reported

\- Not reproduced in a single manual pass: the CRITICAL uncaught exception — likely

&#x20; interaction-triggered or timing-sensitive rather than a false positive; noted as a

&#x20; recommended evidence-quality improvement (the tool should quote the exact exception

&#x20; text in its finding, not just a count, to make this easier to verify by hand)



The real output from this run is saved in `/samples/sample-audit.json` and

`/samples/sample-report.md` — this is genuine live data, not a fixture.

## Why browser-based auditing?

Static HTML inspection tells you what a server *sent*. It tells you nothing about what a
browser actually *does* with that HTML: which scripts execute, which network requests they
fire, whether a tag manager's asynchronous container ever finishes loading, whether a click
handler is even attached, or whether an ad blocker silently swallows a pixel request. Almost
every tracking bug that matters in production — a pixel that only fires after a client-side
redirect, a duplicate GA4 tag from an old direct install plus a newer GTM install, an
add-to-cart handler that's attached to the wrong element after a redesign — is invisible to
a `curl` + regex approach and only observable by actually running the page. That's why this
project launches Chromium via Playwright rather than parsing markup.

## Architecture

```
User
  ↓
Next.js UI  (app router, Tailwind, React)
  ↓
Audit API  (POST /api/audit → starts job, GET /api/audit/:id → polls status/result)
  ↓
Playwright Browser  (lib/browser/runner.ts — the ONLY module that touches Playwright)
  ↓
Network + Runtime Instrumentation  (request/response/console/pageerror listeners, dataLayer polling)
  ↓
Normalized Events  (lib/tracking/detectors.ts → TrackingEvent\[])
  ↓
Deterministic Rule Engine  (lib/rules/\* — duplicate detection, expectation matching, health checks)
  ↓
Risk Scoring  (lib/scoring/score.ts — configurable weights, transparent penalties)
  ↓
Optional LLM Interpretation  (lib/ai/llm.ts — isolated, structured-output only, evidence-bounded)
  ↓
Actionable Report  (app/audit/\[id]/page.tsx)
```

### Folder structure

```
app/                    Next.js routes (pages + API)
  api/audit/            POST start, GET poll/result, GET export
  api/health/           liveness + Chromium-launch health check
  audit/\[id]/           report dashboard
  audit/pending/        live progress screen (polls real backend stage state)
  history/              audit history list
components/             Report UI (FindingCard, ScoreGauge, FindingsExplorer, ...)
lib/
  audit/pipeline.ts     orchestrates every stage end-to-end
  browser/runner.ts     the ONLY module that imports Playwright
  tracking/             platform detection + duplicate-detection heuristics
  rules/                deterministic Finding-producing checks, one concern per file
  scoring/              configurable, transparent risk scoring
  ai/llm.ts             optional, isolated LLM interpretation layer
  security/             SSRF/URL validation
  store/                pluggable persistence (in-memory / JSON file today)
  export/               Markdown report renderer
types/audit.ts          the single AuditResult schema everything else reads/writes
tests/                  vitest unit + fixture-scenario tests
samples/                labeled fixture sample audit + report
```

Each pipeline stage produces and consumes the same normalized `AuditResult` type
(`types/audit.ts`) — nothing downstream re-derives facts from raw Playwright objects, which
is what makes the rule engine, scoring, and AI layer independently unit-testable without a
browser.

## Detection strategy

Tracking platforms are detected from **real network requests**, not by grepping the page's
HTML for script tags (which only proves a script was *requested*, not that it *fired
correctly*). `lib/tracking/detectors.ts` matches known request signatures per platform:

|Platform|Match signal|
|-|-|
|Google Analytics 4|`google-analytics.com/g/collect` or `/mp/collect`|
|Google Tag Manager|`googletagmanager.com/gtm.js`|
|Google Ads|`googleadservices.com`, `google.com/pagead`, `googlesyndication.com`|
|Meta Pixel|`facebook.com/tr`|
|TikTok Pixel|`analytics.tiktok.com`|
|Microsoft/Bing Ads|`bat.bing.com`, `clarity.ms`|
|LinkedIn Insight|`px.ads.linkedin.com`, `snap.licdn.com`|
|Shopify analytics|`monorail-edge.shopifysvc.com`, `\*.myshopify.com/events`|
|Generic analytics|host-hint fallback list (Segment, Amplitude, Mixpanel, Hotjar, FullStory, Snowplow, ...)|

dataLayer activity is captured by polling `window.dataLayer` before and after each
interaction (`lib/browser/runner.ts`), since a page already navigated to cannot have its
`push` method retroactively monkey-patched before its own scripts ran (see Limitations).

## Deterministic vs. AI

This is the most important design decision in the project, and it's enforced structurally,
not just by convention: `lib/ai/llm.ts` never receives raw network/console data — only the
already-computed `Finding\[]` array — so it is structurally incapable of inventing a fact
that wasn't already verified deterministically.

|Check|Deterministic?|Why|
|-|-|-|
|Did a request fire?|Yes|Observable browser fact (`page.on('response')`)|
|HTTP status|Yes|Observable|
|Is this a duplicate event?|Yes|Rule-based: same platform + same event + same interaction stage + tight time window (`lib/tracking/duplicates.ts`)|
|Did a JS error occur?|Yes|Browser event (`page.on('pageerror')`)|
|Did the expected interaction happen?|Yes|Playwright interaction result|
|Risk score / readiness|Yes|Configurable weighted formula (`lib/scoring/score.ts`)|
|Root-cause hypothesis linking several findings|AI-assisted|Requires contextual/business judgment about *why* symptoms relate|
|Executive summary language|AI-assisted|Synthesis and stakeholder-appropriate phrasing|
|Remediation prioritization|AI-assisted|Requires weighing business impact, not just severity number|

If `ANTHROPIC\_API\_KEY` is unset, `generateAiInsight()` returns `null` immediately. The UI
renders "AI analysis unavailable" in that case (`components/AiInsightPanel.tsx`) and every
other part of the report — score, findings, evidence, recommendations — is entirely
unaffected. The app was designed so this is true by construction: the rule engine and
scorer run to completion before the AI layer is even called, and the AI call is wrapped in
`.catch(() => null)` in the pipeline, so a slow, failing, or misconfigured AI call can never
break a live audit.

## "Why I built it this way" (judgment)

**Facts observable from a browser should be deterministic.** Whether a request fired, what
status code it returned, whether two events are functional duplicates, whether a JS
exception occurred, whether a click produced a corresponding tracking event — all of these
are things a computer can verify with 100% consistency and zero hallucination risk. Putting
any of them behind an LLM would make the audit's factual claims non-reproducible and
non-auditable, which is unacceptable for a tool whose entire purpose is to be trusted before
spending real ad money.

**Interpretation is where an LLM genuinely adds value.** A senior analytics engineer looking
at "duplicate GA4 page\_view" + "GTM container present" + "direct gtag.js snippet also
present in page source" doesn't just see three findings — they see one probable root cause.
Encoding every possible cross-finding correlation as a hardcoded rule doesn't scale and
produces brittle, over-fit heuristics. This is exactly the kind of flexible, contextual
pattern-matching an LLM is well suited for — provided it's fed only verified findings and
required to cite them, which is what `lib/ai/llm.ts` enforces via its JSON schema and
finding-ID sanitization.

**A smaller number of robust checks beats fifty shallow ones.** The rule engine implements
roughly a dozen checks, each with a concrete evidence requirement and a documented
rationale, rather than an exhaustive taxonomy of vaguely-defined checks that would be hard
to trust or maintain.

## Trade-offs

* **Playwright vs. Puppeteer** — Playwright was chosen for its first-class TypeScript
support, unified API across engines, and built-in `page.waitForLoadState` / tracing
primitives that make instrumentation code noticeably shorter than the Puppeteer
equivalent.
* **Synchronous vs. queued audit execution** — Audits run in-process (`startAudit()` returns
immediately; the browser work continues on the same Node process, and the client polls
`GET /api/audit/:id` for live stage progress). A production system handling meaningful
concurrent load would move this to a real job queue (BullMQ/SQS) with dedicated worker
processes; the `AuditStage\[]` polling contract was deliberately designed so that swap is a
backend-only change with zero UI changes required.
* **SQLite/Postgres vs. in-memory/file store** — `lib/store/store.ts` is a \~60-line seam: an
in-memory `Map`, optionally mirrored to a JSON file so history survives a dev-server
restart. This avoids a native-binding dependency (`better-sqlite3`) that would complicate
`npm install` for a take-home reviewer, at the cost of not being production-durable.
Swapping in Postgres means rewriting the four functions in that one file.
* **Rule engine vs. LLM for facts** — covered above; deterministic won for anything the
browser can observe directly.
* **Browser cost vs. static inspection** — a real Chromium session costs several seconds and
meaningful CPU/RAM versus milliseconds for an HTML fetch. That cost is the entire point:
static inspection cannot see client-side tracking behavior at all (see "Why browser-based
auditing?").
* **Accuracy vs. audit duration** — `page.waitForLoadState('networkidle')` was deliberately
*not* used as the primary wait condition, because many ad/analytics-heavy pages never
truly go idle (polling beacons, chat widgets, etc.) and would make every audit hit the
navigation timeout. Instead the pipeline uses `domcontentloaded` + a bounded settle window

  * `load` with a shorter fallback timeout, trading a small amount of completeness for
predictable, bounded audit duration (\~15-25s typical).

## Limitations

Documented honestly, not glossed over:

* dataLayer capture is via **polling**, not a `push` override injected before the page's own
scripts run — a page already navigated to cannot have an already-defined array's method
retroactively monkey-patched before other scripts already captured a reference to the
original `push`. This means dataLayer pushes that occur in the first few milliseconds,
before the first poll, could in rare cases be missed. Network-request-based detection
(the primary signal) does not have this limitation.
* Tracking platforms change their request formats over time; the pattern list in
`detectors.ts` reflects commonly-observed formats as of this writing and will need
periodic updates, same as any browser extension-based tracker blocker.
* Consent-flow variation is high; PreFlight's consent detection is a best-effort selector
match and explicitly makes no legal-compliance claim (see `buildConsentFindings`).
* Bot protection (Cloudflare challenge pages, etc.) on the target site can prevent the audit
from completing at all; PreFlight surfaces this as a clear stage-level error rather than a
silent partial result.
* Some events are intentionally gated behind user consent by design — PreFlight cannot
distinguish "broken tracking" from "correctly consent-gated tracking" with certainty in
every implementation, which is why consent findings are framed as observations, not
failures.
* Browser observation proves that a request *left the browser* — it cannot prove
server-side attribution correctness (e.g., that a platform's backend correctly matched
and counted the event). That is out of scope for a client-side auditor.
* This tool is not a replacement for Lighthouse/PageSpeed Insights; performance signals here
are explicitly labeled "pre-flight technical signals," a lighter-weight sanity check.

## Assumptions

* The audited page is publicly reachable without authentication.
* "Safe to interact with" means: clicking a CTA and an add-to-cart control is acceptable;
proceeding through checkout, submitting real forms, or entering payment/personal
information is not, and is explicitly skipped with a `NOT\_TESTED` result rather than
silently omitted.
* A single Chromium context per audit is sufficient; PreFlight does not attempt to simulate
multiple devices/geographies in one run (that would be a reasonable v2 feature).
* The reviewer's evaluation environment has outbound internet access to install
dependencies, install the Playwright browser binary, and reach neemans.com — none of
which was available in the environment this code was written in (see the notice at the
top of this file).

## Security

* All submitted URLs go through `lib/security/urlValidation.ts` before any navigation:
protocol allowlist (http/https only), hostname blocklist (`localhost`, `.local`,
`.internal`), literal-IP checks, and a DNS resolution step that rejects hostnames
resolving to private/loopback/link-local/CGNAT ranges — closing the DNS-rebinding SSRF
gap that a hostname-only check would miss.
* Navigation and interaction timeouts are enforced throughout (`AUDIT\_NAV\_TIMEOUT\_MS`,
`AUDIT\_TIMEOUT\_MS`), and a small in-process concurrency gate bounds how many Chromium
instances can run at once (`AUDIT\_MAX\_CONCURRENCY`).
* Only an allowlisted set of query-parameter keys are ever surfaced in evidence
(`SAFE\_PARAM\_ALLOWLIST` in `detectors.ts`); everything else — session IDs, emails, cart
contents — is redacted before it ever reaches a Finding or the UI.
* No destructive interactions are ever attempted (see Assumptions).

## Error handling

Every external failure mode maps to a specific, human-readable message rather than a raw
stack trace: invalid URLs and SSRF attempts return a 400 with a plain-English reason before
any browser is launched; navigation timeouts, browser launch failures, and mid-audit
exceptions are all caught inside `lib/audit/pipeline.ts` and written back into the audit's
`error` field with the specific stage that failed, which the UI (`app/audit/pending`) then
surfaces directly to the user instead of leaving them on a stuck progress screen. A failed
audit never crashes the server process or takes down other in-flight audits — each audit
runs in its own Playwright browser/context which is always closed (including in the
`catch` path) so failures can't leak resources across audits.

## Deployment

**Do not deploy the Playwright worker to a sleeping/serverless target.** Chromium needs a
warm, persistent process with its browser binaries already resident; cold-starting it inside
a serverless function that sleeps after inactivity is precisely the failure mode this
project's requirements call out, and it will produce slow or failed audits during evaluation.

The included `Dockerfile` builds on `mcr.microsoft.com/playwright`, which ships Chromium and
all required OS-level dependencies preinstalled — no `playwright install` cold-start cost at
request time. Deploy that image to a platform that runs it as a **persistent container**,
not a request-scoped function: Render (Web Service, not a Function), Railway, Fly.io, or a
plain VM/ECS/Cloud Run *service* (minimum-instance-count ≥ 1, not scale-to-zero) all work.
Point the platform's health check at `GET /api/health`, which verifies Chromium can actually
launch, not just that the process is alive.

```bash
docker build -t preflight .
docker run -p 3000:3000 -e ANTHROPIC\_API\_KEY=sk-ant-... preflight
```

Required environment variables — see `.env.example`:

|Variable|Required?|Purpose|
|-|-|-|
|`ANTHROPIC\_API\_KEY`|No|Enables the optional AI interpretation layer|
|`ANTHROPIC\_MODEL`|No|Defaults to `claude-sonnet-4-6`|
|`AUDIT\_TIMEOUT\_MS`|No|Hard ceiling on total audit time (default 45000)|
|`AUDIT\_NAV\_TIMEOUT\_MS`|No|Navigation timeout (default 20000)|
|`AUDIT\_MAX\_CONCURRENCY`|No|Max concurrent audits per process (default 2)|
|`PREFLIGHT\_STORE`|No|`memory` (default) or `file` for JSON-file-backed history|

Health check: `GET /api/health` → `200 {"status":"ok","browser":"chromium",...}` or `503` if
Chromium cannot launch. Expected audit duration: roughly 15–25 seconds for a typical
e-commerce PDP, bounded by `AUDIT\_TIMEOUT\_MS`.

## Running locally

```bash
npm install
npx playwright install chromium
cp .env.example .env.local   # optional: add ANTHROPIC\_API\_KEY to enable AI insights
npm run dev
```

Then open `http://localhost:3000`, paste a landing page URL, and click "Run Pre-Flight
Audit."

## Running a live Neeman's audit

1. Complete "Running locally" above on a machine with internet access.
2. Open `http://localhost:3000`.
3. Paste a real neemans.com product or collection URL, e.g.
`https://www.neemans.com/collections/men` or a specific product page.
4. Click "Run Pre-Flight Audit" and watch the live stage progress (this reflects real
backend state via polling `GET /api/audit/:id`, not a fake animation).
5. Review the resulting report; use "Download JSON" or "Export Report (.md)" to save it —
this reproduces the same shape as `/samples/sample-audit.json` and
`/samples/sample-report.md`, but from a genuine live session.

## Testing

```bash
npm test
```

Covers: duplicate-event detection heuristics, severity/score calculation, tracking-request
classification, URL validation/SSRF protection, and the expectation/rule engine — including
six scenario fixtures (`tests/fixtures.test.ts`): healthy page, missing analytics, duplicate
page\_view, failed tracking request, broken JS, missing conversion event. The Playwright
browser layer itself (`lib/browser/runner.ts`) is intentionally exercised manually via
`npm run dev` against a real page rather than mocked in unit tests — mocking Playwright's
event model would test the mock, not the integration.

## What's deterministic vs. what uses AI (quick reference)

* **Deterministic, always on, no API key needed:** URL/SSRF validation, browser
instrumentation, tracking classification, duplicate detection, health checks, page-quality
checks, performance signals, consent detection, risk scoring, readiness status.
* **AI-assisted, optional, requires `ANTHROPIC\_API\_KEY`:** executive summary language,
root-cause hypothesis grouping across findings, remediation prioritization. Absent a key,
the UI shows "AI analysis unavailable" and nothing else in the report changes.

## Known limitations of this delivery specifically

* No PDF export (Markdown and JSON export are implemented; PDF was deprioritized as
"if practical" per the brief, in favor of correctness elsewhere).
* No SSE streaming endpoint; live progress is implemented via short-interval polling of
`GET /api/audit/:id`, which is simpler to reason about and just as real-time from a user's
perspective at this scale.

