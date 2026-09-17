import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

/**
 * GET /api/health
 *
 * Used by the hosting platform's health-check probe. Verifies not just
 * that the Node process is alive, but that Chromium can actually launch —
 * this is the specific failure mode ("browser worker unhealthy") that a
 * naive "return 200" health check would miss entirely.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    await browser.close();
    return NextResponse.json({
      status: 'ok',
      browser: 'chromium',
      browserLaunchMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'degraded',
        reason: 'Chromium failed to launch',
        detail: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
