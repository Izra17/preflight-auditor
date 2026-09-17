import fs from 'node:fs';
import path from 'node:path';
import type { AuditResult } from '@/types/audit';

/**
 * Persistence: a JSON file on disk, read fresh on every single call rather
 * than cached in a module-level variable.
 *
 * Why not a plain in-memory Map? Next.js's dev server can compile different
 * route files (a page component, POST /api/audit, GET /api/audit/[id],
 * GET /api/audit/[id]/export) at different times, and in some configurations
 * those compile into separate module realms — even separate worker threads
 * — that do not share memory. A module-level Map, even one pinned to
 * `globalThis`, can end up permanently stale in one of those realms if it
 * was first touched before an audit finished. Reading the actual file from
 * disk on every call sidesteps all of that: the filesystem is the one thing
 * every realm/thread in this process genuinely shares.
 *
 * This keeps the demo dependency-free (no DB driver / native bindings to
 * install) while remaining trivially swappable for SQLite/Postgres later —
 * the four exported functions below are the seam.
 *
 * If PREFLIGHT_STORE is not set to "file", we fall back to an in-memory
 * Map pinned to globalThis. That fallback is fine for a single quick audit
 * in the same request lifecycle, but is NOT guaranteed to survive being
 * read back from a different route file in dev — set PREFLIGHT_STORE=file
 * to avoid that class of bug entirely.
 */

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'audits.json');
const USE_FILE = process.env.PREFLIGHT_STORE === 'file';

const globalForStore = globalThis as unknown as { __preflightMemoryStore?: Map<string, AuditResult> };
const memoryStore = globalForStore.__preflightMemoryStore ?? new Map<string, AuditResult>();
globalForStore.__preflightMemoryStore = memoryStore;

function readAllFromDisk(): Map<string, AuditResult> {
  const map = new Map<string, AuditResult>();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const arr: AuditResult[] = JSON.parse(raw);
      for (const a of arr) map.set(a.auditId, a);
    }
  } catch (err) {
    console.error('Failed to read persisted audits:', err);
  }
  return map;
}

function writeAllToDisk(map: Map<string, AuditResult>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // Cap history size and drop screenshots from the on-disk copy to keep
    // the file small.
    const all = [...map.values()]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 100)
      .map((a) => ({ ...a, screenshots: [] }));
    fs.writeFileSync(DATA_FILE, JSON.stringify(all), 'utf-8');
  } catch (err) {
    console.error('Failed to persist audits to disk:', err);
  }
}

export function saveAudit(audit: AuditResult): void {
  if (USE_FILE) {
    const all = readAllFromDisk();
    all.set(audit.auditId, audit);
    writeAllToDisk(all);
  }
  // Always also keep the in-memory copy up to date, so a fast poll
  // immediately after a save in the SAME module instance doesn't pay the
  // cost of a disk round-trip, and so the memory-only fallback still works.
  memoryStore.set(audit.auditId, audit);
}

export function getAudit(id: string): AuditResult | null {
  if (USE_FILE) {
    const fromDisk = readAllFromDisk().get(id);
    if (fromDisk) return fromDisk;
  }
  return memoryStore.get(id) ?? null;
}

export function listAudits(limit = 25): AuditResult[] {
  const source = USE_FILE ? readAllFromDisk() : memoryStore;
  return [...source.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export function deleteAudit(id: string): void {
  if (USE_FILE) {
    const all = readAllFromDisk();
    all.delete(id);
    writeAllToDisk(all);
  }
  memoryStore.delete(id);
}
