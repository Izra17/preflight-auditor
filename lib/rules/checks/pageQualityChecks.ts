import { v4 as uuid } from 'uuid';
import type { ConsentObservation, Finding, PerformanceSignals } from '@/types/audit';

export function buildPageQualityFindings(
  httpStatus: number | null,
  pageTitle: string | null,
  hasViewportMeta: boolean,
  urlProtocol: string
): Finding[] {
  const findings: Finding[] = [];

  if (httpStatus === null || httpStatus >= 400) {
    findings.push({
      id: uuid(),
      status: 'FAIL',
      severity: 'CRITICAL',
      category: 'TECHNICAL',
      title: `Page did not load successfully (HTTP ${httpStatus ?? 'unknown'})`,
      description: 'The primary page navigation did not return a successful (2xx/3xx) response.',
      whyItMatters: 'A broken landing page means 100% of ad spend directed here is wasted.',
      evidence: [`HTTP status: ${httpStatus ?? 'unknown'}`],
      recommendation: 'Fix the underlying server/routing issue before running any traffic to this URL.',
      confidence: 0.95,
      relatedEventIds: []
    });
  } else {
    findings.push({
      id: uuid(),
      status: 'PASS',
      severity: 'INFO',
      category: 'TECHNICAL',
      title: `Page loaded successfully (HTTP ${httpStatus})`,
      description: 'The page returned a successful HTTP response.',
      whyItMatters: 'Baseline reachability confirmed.',
      evidence: [`HTTP status: ${httpStatus}`],
      recommendation: 'No action needed.',
      confidence: 0.95,
      relatedEventIds: []
    });
  }

  if (urlProtocol !== 'https:') {
    findings.push({
      id: uuid(),
      status: 'FAIL',
      severity: 'HIGH',
      category: 'TECHNICAL',
      title: 'Page is not served over HTTPS',
      description: 'The audited URL uses plain HTTP rather than HTTPS.',
      whyItMatters: 'Most ad platforms penalize or reject non-HTTPS landing pages, and browsers show security warnings that hurt conversion.',
      evidence: [`Protocol: ${urlProtocol}`],
      recommendation: 'Serve the landing page over HTTPS with a valid certificate.',
      confidence: 0.95,
      relatedEventIds: []
    });
  }

  if (!pageTitle || pageTitle.trim().length === 0) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'LOW',
      category: 'UX',
      title: 'Page is missing a <title>',
      description: 'No page title was found.',
      whyItMatters: 'Affects SEO, browser tab identification, and can be a symptom of a broken template.',
      evidence: ['<title> was empty or absent.'],
      recommendation: 'Add a descriptive page title.',
      confidence: 0.8,
      relatedEventIds: []
    });
  }

  if (!hasViewportMeta) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'MEDIUM',
      category: 'UX',
      title: 'Missing viewport meta tag',
      description: 'No <meta name="viewport"> tag was found on the page.',
      whyItMatters: 'Most paid traffic is mobile; without a viewport tag the page is likely to render poorly on mobile devices.',
      evidence: ['<meta name="viewport"> not found in the DOM.'],
      recommendation: 'Add a responsive viewport meta tag.',
      confidence: 0.85,
      relatedEventIds: []
    });
  }

  return findings;
}

export function buildPerformanceFindings(perf: PerformanceSignals): Finding[] {
  const findings: Finding[] = [];

  if (perf.loadEventMs !== null && perf.loadEventMs > 8000) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'MEDIUM',
      category: 'UX',
      title: `Slow full page load (${(perf.loadEventMs / 1000).toFixed(1)}s)`,
      description: 'The page load event fired significantly later than the ~3-4s threshold generally considered acceptable for paid landing pages.',
      whyItMatters: 'Slow-loading landing pages increase bounce rate and reduce ad platform quality/relevance scores.',
      evidence: [`window.onload fired at ${perf.loadEventMs}ms`],
      recommendation: 'Investigate render-blocking resources, large images, and third-party script load order.',
      confidence: 0.6,
      relatedEventIds: []
    });
  }

  if (perf.largestContentfulPaintMs !== null && perf.largestContentfulPaintMs > 4000) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'MEDIUM',
      category: 'UX',
      title: `Largest Contentful Paint is slow (${(perf.largestContentfulPaintMs / 1000).toFixed(1)}s)`,
      description: 'LCP exceeds the ~2.5s "good" threshold commonly used in Core Web Vitals guidance.',
      whyItMatters: 'LCP is one of the strongest correlates of perceived load speed and bounce rate on paid landing pages.',
      evidence: [`LCP observed at ${perf.largestContentfulPaintMs}ms`],
      recommendation: 'This is a pre-flight signal, not a substitute for a full Lighthouse/PageSpeed audit — run one for detailed remediation.',
      confidence: 0.55,
      relatedEventIds: []
    });
  }

  if (perf.failedResourceCount > 0) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'LOW',
      category: 'UX',
      title: `${perf.failedResourceCount} resource(s) failed to load`,
      description: 'One or more page resources (images, scripts, styles) failed to load.',
      whyItMatters: 'Broken resources can degrade visual polish and trust signals on the landing page.',
      evidence: [`${perf.failedResourceCount} failed resource request(s) recorded.`],
      recommendation: 'Review the network failures list for specific broken resources.',
      confidence: 0.5,
      relatedEventIds: []
    });
  }

  return findings;
}

export function buildConsentFindings(consent: ConsentObservation): Finding[] {
  if (!consent.bannerDetected) {
    return [
      {
        id: uuid(),
        status: 'NOT_TESTED',
        severity: 'INFO',
        category: 'PRIVACY',
        title: 'Consent banner not detected',
        description: consent.note,
        whyItMatters: 'This is a technical observation, not legal advice. Absence of a detectable banner does not confirm compliance status.',
        evidence: ['No element matching common consent-banner selectors was found.'],
        recommendation: 'If applicable regulations require a consent mechanism, confirm one exists and is technically implemented.',
        confidence: 0.4,
        relatedEventIds: []
      }
    ];
  }
  return [
    {
      id: uuid(),
      status: consent.trackingBeforeInteraction ? 'WARN' : 'PASS',
      severity: consent.trackingBeforeInteraction ? 'MEDIUM' : 'INFO',
      category: 'PRIVACY',
      title: 'Consent banner detected',
      description: consent.trackingBeforeInteraction
        ? 'A consent banner was detected, and tracking network activity was also observed before any interaction with it.'
        : 'A consent banner was detected and no tracking activity was observed prior to interacting with it in this session.',
      whyItMatters:
        'This is a technical observation only; PreFlight cannot determine whether this implementation satisfies applicable privacy requirements (e.g. GDPR/CCPA) in your jurisdiction.',
      evidence: [`Consent banner matched selector pattern: ${consent.bannerSelectorGuess}`],
      recommendation: 'Have legal/privacy stakeholders confirm the consent implementation meets applicable requirements.',
      confidence: 0.5,
      relatedEventIds: []
    }
  ];
}
