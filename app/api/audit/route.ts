import { NextRequest, NextResponse } from 'next/server';
import { startAudit } from '@/lib/audit/pipeline';
import { validateAuditUrl, UnsafeUrlError } from '@/lib/security/urlValidation';
import { getAudit } from '@/lib/store/store';

// A tiny in-process concurrency gate — prevents someone from spinning up
// unbounded concurrent Chromium instances on a single node. This requires
// a long-running Node process (not a per-request serverless function) to
// mean anything, which matches the deployment architecture in the README.
const MAX_CONCURRENCY = Number(process.env.AUDIT_MAX_CONCURRENCY ?? 2);
let inFlight = 0;

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'A "url" field is required.' }, { status: 400 });
  }

  // Validate up front (fast, synchronous-ish) so obviously bad/unsafe URLs
  // fail immediately with a 400 rather than silently starting a background
  // job that will just error out a moment later.
  try {
    await validateAuditUrl(body.url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Could not validate that URL.' }, { status: 400 });
  }

  if (inFlight >= MAX_CONCURRENCY) {
    return NextResponse.json(
      { error: 'PreFlight is at capacity. Please wait a moment and try again.' },
      { status: 429 }
    );
  }

  inFlight++;
  try {
    const { auditId } = startAudit(body.url);
    // Release the concurrency slot once the background pipeline is done,
    // not when this response is sent.
    const poll = setInterval(() => {
      const a = getAudit(auditId);
      if (a && a.stages.every((s) => s.status === 'done' || s.status === 'error')) {
        clearInterval(poll);
        inFlight--;
      }
    }, 500);
    return NextResponse.json({ auditId });
  } catch (err) {
    inFlight--;
    console.error('Failed to start audit:', err);
    return NextResponse.json({ error: 'The audit could not be started. Please try again.' }, { status: 500 });
  }
}
