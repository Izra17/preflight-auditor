import { v4 as uuid } from 'uuid';
import type { Finding, TrackingEvent } from '@/types/audit';
import type { DuplicateGroupResult } from '@/lib/tracking/duplicates';

export function buildDuplicateFindings(groups: DuplicateGroupResult[], eventsById: Map<string, TrackingEvent>): Finding[] {
  return groups.map((g) => {
    const sample = eventsById.get(g.eventIds[0]!);
    const severity = g.confidence >= 0.75 ? 'HIGH' : 'MEDIUM';
    return {
      id: uuid(),
      status: 'WARN' as const,
      severity,
      category: 'TRACKING' as const,
      title: `Potential duplicate ${sample?.platform ?? 'tracking'} ${sample?.eventName ?? sample?.eventType ?? 'event'}`,
      description: `${g.eventIds.length} equivalent events were observed in rapid succession during the same interaction, which typically indicates the tag firing through more than one path (e.g. both a direct integration and Google Tag Manager).`,
      whyItMatters:
        'Duplicate conversion events inflate reported conversions and corrupt ROAS/CPA calculations used to make budget decisions.',
      evidence: g.evidence,
      recommendation:
        'Check whether this tag is configured in both a native platform integration and GTM (or fired by two separate script instances), and de-duplicate.',
      confidence: g.confidence,
      relatedEventIds: g.eventIds
    };
  });
}
