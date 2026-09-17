import { v4 as uuid } from 'uuid';
import type { Finding, TrackingEvent } from '@/types/audit';

/**
 * Event Expectation Engine.
 *
 * Encodes what tracking activity is *plausibly* expected for a given
 * interaction, WITHOUT assuming every platform fires every event. A
 * missing event is reported as a WARN (not a hard FAIL) unless no
 * analytics platform of any kind was observed at all, which is a much
 * stronger signal of a broken implementation.
 */
export function buildTrackingFindings(events: TrackingEvent[], interactionsById: {
  ctaAttempted: boolean;
  ctaSucceeded: boolean;
  addToCartAttempted: boolean;
  addToCartSucceeded: boolean;
}): Finding[] {
  const findings: Finding[] = [];
  const platformsSeen = new Set(events.map((e) => e.platform));
  const pageviewEvents = events.filter((e) => e.eventType === 'pageview' && e.triggeredBy === 'page_load');
  const ctaEvents = events.filter((e) => e.triggeredBy === 'cta_click');
  const atcEvents = events.filter((e) => e.triggeredBy === 'add_to_cart');

  // 1. Any analytics at all?
  if (platformsSeen.size === 0) {
    findings.push({
      id: uuid(),
      status: 'FAIL',
      severity: 'CRITICAL',
      category: 'TRACKING',
      title: 'No analytics or advertising tracking detected',
      description: 'No recognizable analytics, tag-manager, or ad-platform network requests were observed at any point during the audit.',
      whyItMatters:
        'Without any tracking firing, ad spend directed at this page cannot be measured, optimized, or attributed. Every dollar spent here is effectively untracked.',
      evidence: ['0 tracking-related network requests observed across page load, CTA click, add-to-cart, and scroll.'],
      recommendation: 'Confirm that Google Tag Manager (or equivalent) is installed and firing on this page before sending paid traffic.',
      confidence: 0.9,
      relatedEventIds: []
    });
    return findings; // downstream checks are moot if nothing fires at all
  }

  // 2. Page view expectation
  if (pageviewEvents.length === 0) {
    findings.push({
      id: uuid(),
      status: 'WARN',
      severity: 'HIGH',
      category: 'TRACKING',
      title: 'No page_view (or equivalent) event observed on load',
      description: `Tracking activity was observed from ${[...platformsSeen].join(', ')}, but no explicit page-view/pageview event was identified.`,
      whyItMatters:
        'Page-view tracking anchors session and funnel analysis. Without it, downstream conversion rates and attribution reports may be unreliable.',
      evidence: [`Platforms observed during load: ${[...platformsSeen].join(', ') || 'none'}`],
      recommendation: 'Verify GA4 / pixel configuration sends an explicit page_view (or platform-equivalent) event on initial load.',
      confidence: 0.6,
      relatedEventIds: []
    });
  } else {
    findings.push({
      id: uuid(),
      status: 'PASS',
      severity: 'INFO',
      category: 'TRACKING',
      title: 'Page-view tracking confirmed on load',
      description: `${pageviewEvents.length} page-view-equivalent event(s) observed during initial load.`,
      whyItMatters: 'Confirms baseline session tracking is functioning.',
      evidence: pageviewEvents.slice(0, 3).flatMap((e) => e.evidence),
      recommendation: 'No action needed.',
      confidence: 0.85,
      relatedEventIds: pageviewEvents.map((e) => e.id)
    });
  }

  // 3. CTA expectation
  if (interactionsById.ctaSucceeded) {
    if (ctaEvents.length === 0) {
      findings.push({
        id: uuid(),
        status: 'WARN',
        severity: 'MEDIUM',
        category: 'ATTRIBUTION',
        title: 'No tracking activity observed after primary CTA click',
        description: 'A primary call-to-action was clicked, but no new tracking network activity or dataLayer push followed within the observation window.',
        whyItMatters:
          'If the CTA is meant to represent engagement or a micro-conversion, its absence from tracking means this signal cannot be used for optimization or attribution.',
        evidence: ['CTA click executed successfully.', 'No corresponding tracking event observed within ~1.2s afterward.'],
        recommendation: 'Confirm whether a click/engagement event is expected on this CTA, and instrument it if so.',
        confidence: 0.55,
        relatedEventIds: []
      });
    } else {
      findings.push({
        id: uuid(),
        status: 'PASS',
        severity: 'INFO',
        category: 'ATTRIBUTION',
        title: 'CTA interaction produced tracking activity',
        description: `${ctaEvents.length} event(s) observed following the CTA click.`,
        whyItMatters: 'Confirms the primary conversion path is instrumented.',
        evidence: ctaEvents.slice(0, 3).flatMap((e) => e.evidence),
        recommendation: 'No action needed.',
        confidence: 0.7,
        relatedEventIds: ctaEvents.map((e) => e.id)
      });
    }
  } else if (interactionsById.ctaAttempted) {
    findings.push({
      id: uuid(),
      status: 'NOT_TESTED',
      severity: 'INFO',
      category: 'TRACKING',
      title: 'CTA interaction could not be completed',
      description: 'A CTA candidate was found but could not be safely clicked.',
      whyItMatters: 'CTA-triggered tracking could not be verified this run.',
      evidence: [],
      recommendation: 'Re-run the audit, or manually verify CTA tracking.',
      confidence: 0.3,
      relatedEventIds: []
    });
  }

  // 4. Add-to-cart expectation
  if (interactionsById.addToCartSucceeded) {
    if (atcEvents.length === 0) {
      findings.push({
        id: uuid(),
        status: 'FAIL',
        severity: 'HIGH',
        category: 'TRACKING',
        title: 'add_to_cart event not observed after Add to Cart click',
        description: 'The add-to-cart control was clicked, but no add_to_cart (or platform-equivalent) event was observed.',
        whyItMatters:
          'add_to_cart is a core mid-funnel signal used for retargeting audiences and platform bidding optimization (e.g. Meta/Google Ads). Its absence directly weakens ad performance.',
        evidence: ['Add-to-cart control clicked successfully.', 'No add_to_cart-equivalent event observed within ~1.2s afterward.'],
        recommendation: 'Verify the add_to_cart event fires on this action across GA4, Meta Pixel, and any other configured platforms.',
        confidence: 0.75,
        relatedEventIds: []
      });
    } else {
      findings.push({
        id: uuid(),
        status: 'PASS',
        severity: 'INFO',
        category: 'TRACKING',
        title: 'add_to_cart tracking confirmed',
        description: `${atcEvents.length} event(s) observed following the add-to-cart interaction.`,
        whyItMatters: 'Confirms mid-funnel retargeting/optimization signals are functioning.',
        evidence: atcEvents.slice(0, 3).flatMap((e) => e.evidence),
        recommendation: 'No action needed.',
        confidence: 0.8,
        relatedEventIds: atcEvents.map((e) => e.id)
      });
    }
  }

  return findings;
}
