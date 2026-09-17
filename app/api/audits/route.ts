import { NextResponse } from 'next/server';
import { listAudits } from '@/lib/store/store';

export async function GET() {
  const audits = listAudits(25).map((a) => ({
    auditId: a.auditId,
    url: a.url,
    timestamp: a.timestamp,
    overallStatus: a.overallStatus,
    score: a.score,
    isFixtureData: a.isFixtureData
  }));
  return NextResponse.json({ audits });
}
