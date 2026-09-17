import { v4 as uuid } from 'uuid';
import type { TrackingEvent } from '@/types/audit';

/**
 * Duplicate detection is deterministic and rule-based — never LLM-driven.
 * We do NOT flag every repeated request (e.g. GTM's container.js polling,
 * or two distinct events that both happen to be GA4). Two events are
 * considered a probable duplicate only when ALL of the following hold:
 *
 *   1. Same platform
 *   2. Same (or equivalent) event name/type
 *   3. Occurred within a short time window of each other (default 1500ms)
 *   4. Fired from the same interaction stage (both from page_load,
 *      both from the same click, etc.) — an add_to_cart click and a
 *      later page_view are NOT duplicates of each other.
 *
 * Payload similarity is used to raise/lower confidence, not as a hard gate,
 * since legitimate re-fires can carry slightly different timestanp/session
 * params.
 */

const TIME_WINDOW_MS = 1500;

export interface DuplicateGroupResult {
  groupId: string;
  eventIds: string[];
  confidence: number;
  evidence: string[];
}

function payloadSimilarity(a: TrackingEvent, b: TrackingEvent): number {
  const keysA = Object.keys(a.payloadSummary);
  const keysB = Object.keys(b.payloadSummary);
  const allKeys = new Set([...keysA, ...keysB]);
  if (allKeys.size === 0) return 0.5; // no params to compare either way
  let matches = 0;
  for (const k of allKeys) {
    if (a.payloadSummary[k] !== undefined && a.payloadSummary[k] === b.payloadSummary[k]) matches += 1;
  }
  return matches / allKeys.size;
}

export function detectDuplicateEvents(events: TrackingEvent[]): {
  groups: DuplicateGroupResult[];
  annotated: TrackingEvent[];
} {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const groups: DuplicateGroupResult[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a || assigned.has(a.id)) continue;

    const cluster: TrackingEvent[] = [a];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (!b) continue;
      if (b.timestamp - a.timestamp > TIME_WINDOW_MS) break; // sorted, so we can stop early
      if (assigned.has(b.id)) continue;
      const sameEvent =
        a.platform === b.platform &&
        a.triggeredBy === b.triggeredBy &&
        ((a.eventName && b.eventName && a.eventName === b.eventName) ||
          (!a.eventName && !b.eventName && a.eventType === b.eventType));
      if (sameEvent) cluster.push(b);
    }

    if (cluster.length > 1) {
      const groupId = uuid();
      for (const ev of cluster) assigned.add(ev.id);
      const similarity = payloadSimilarity(cluster[0]!, cluster[1]!);
      const spanMs = cluster[cluster.length - 1]!.timestamp - cluster[0]!.timestamp;
      // Confidence rises with payload similarity and falls with time spread.
      const confidence = Math.max(0.4, Math.min(0.98, 0.55 + similarity * 0.35 - (spanMs / TIME_WINDOW_MS) * 0.1));
      groups.push({
        groupId,
        eventIds: cluster.map((e) => e.id),
        confidence,
        evidence: [
          `${cluster.length} equivalent ${cluster[0]!.platform} "${cluster[0]!.eventName ?? cluster[0]!.eventType}" events observed`,
          `within ${spanMs}ms of each other`,
          `during the same "${cluster[0]!.triggeredBy}" interaction`,
          similarity >= 0.5 ? 'matching event parameters' : 'partially matching event parameters'
        ]
      });
    }
  }

  const annotated = sorted.map((e) => {
    const g = groups.find((grp) => grp.eventIds.includes(e.id));
    return g ? { ...e, duplicateGroup: g.groupId } : e;
  });

  return { groups, annotated };
}
