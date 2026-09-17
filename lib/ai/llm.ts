import type { AiInsight, Finding } from '@/types/audit';

/**
 * Judgment boundary (see README > "Why I built it this way"):
 *
 * The LLM is given ONLY the already-computed, evidence-backed Finding[]
 * array — never raw network/console data, and never asked to decide facts
 * (did a request fire, is this a duplicate, what was the HTTP status).
 * Those are 100% deterministic and computed before this function is ever
 * called. The LLM's job is strictly synthesis: summarizing, grouping
 * related findings into root-cause hypotheses, and prioritizing
 * remediation — tasks that require contextual/business judgment rather
 * than fact-finding.
 *
 * If ANTHROPIC_API_KEY is not set, this returns null and the rest of the
 * app treats that as "AI analysis unavailable" — it never crashes and
 * never fabricates an insight.
 */
export async function generateAiInsight(url: string, findings: Finding[]): Promise<AiInsight | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  // Only pass structured, already-verified evidence. No raw HTML, no
  // network dumps — this bounds what the model could possibly invent.
  const findingsForPrompt = findings
    .filter((f) => f.status !== 'PASS')
    .map((f) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      description: f.description,
      evidence: f.evidence,
      confidence: f.confidence
    }));

  if (findingsForPrompt.length === 0) {
    return {
      summary: `No blocking issues were found on ${url}. The page appears ready for paid traffic based on this audit.`,
      rootCauseHypotheses: [],
      recommendedActions: [],
      confidence: 0.9,
      modelUsed: model
    };
  }

  const systemPrompt = `You are a senior performance-marketing analytics engineer reviewing an automated pre-flight audit report.
You will be given a JSON array of ALREADY-VERIFIED findings, each with an id, severity, category, title, description, and evidence.
Your job is ONLY synthesis: write a stakeholder-friendly summary, group findings that likely share one underlying root cause, and prioritize remediation.
RULES:
- Never invent a finding, fact, event, or piece of evidence that is not in the provided list.
- Every hypothesis and recommended action MUST reference relatedFindingIds using only the ids given to you.
- Respond with STRICT JSON matching this exact shape and nothing else (no markdown fences, no prose outside the JSON):
{"summary": string, "rootCauseHypotheses": [{"hypothesis": string, "relatedFindingIds": string[], "confidence": number}], "recommendedActions": [{"action": string, "priority": "NOW"|"SOON"|"LATER", "relatedFindingIds": string[]}], "confidence": number}`;

  const userPrompt = `Landing page URL: ${url}\n\nFindings:\n${JSON.stringify(findingsForPrompt, null, 2)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error('AI insight request failed', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    const text: string = data.content?.map((c: { type: string; text?: string }) => c.text ?? '').join('') ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const validFindingIds = new Set(findings.map((f) => f.id));
    const sanitizeIds = (ids: unknown): string[] =>
      Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && validFindingIds.has(id)) : [];

    const insight: AiInsight = {
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Summary unavailable.',
      rootCauseHypotheses: Array.isArray(parsed.rootCauseHypotheses)
        ? parsed.rootCauseHypotheses.map((h: any) => ({
            hypothesis: String(h.hypothesis ?? ''),
            relatedFindingIds: sanitizeIds(h.relatedFindingIds),
            confidence: typeof h.confidence === 'number' ? h.confidence : 0.5
          }))
        : [],
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.map((a: any) => ({
            action: String(a.action ?? ''),
            priority: ['NOW', 'SOON', 'LATER'].includes(a.priority) ? a.priority : 'SOON',
            relatedFindingIds: sanitizeIds(a.relatedFindingIds)
          }))
        : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      modelUsed: model
    };

    return insight;
  } catch (err) {
    console.error('AI insight generation failed:', err);
    return null; // Never let AI failure break the deterministic report.
  }
}
