import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/store/store';
import { renderMarkdownReport } from '@/lib/export/markdown';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const audit = getAudit(params.id);
  if (!audit) return NextResponse.json({ error: 'Audit not found.' }, { status: 404 });

  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  if (format === 'md' || format === 'markdown') {
    return new NextResponse(renderMarkdownReport(audit), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="preflight-${audit.auditId}.md"`
      }
    });
  }

  return new NextResponse(JSON.stringify(audit, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="preflight-${audit.auditId}.json"`
    }
  });
}
