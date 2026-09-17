import { describe, it, expect } from 'vitest';
import { calculateRiskScore, explainReadiness, SEVERITY_PENALTIES } from '@/lib/scoring/score';
import type { Finding } from '@/types/audit';

function makeFinding(overrides: Partial<Finding>): Finding {
  return {
    id: overrides.id ?? Math.random().toString(36),
    status: 'FAIL',
    severity: 'MEDIUM',
    category: 'TRACKING',
    title: 'Test finding',
    description: '',
    whyItMatters: '',
    evidence: [],
    recommendation: '',
    confidence: 0.5,
    relatedEventIds: [],
    ...overrides
  };
}

describe('calculateRiskScore', () => {
  it('returns a perfect score with only passing checks', () => {
    const findings = [makeFinding({ status: 'PASS', severity: 'INFO' }), makeFinding({ status: 'PASS', severity: 'INFO' })];
    const { overallScore, readiness } = calculateRiskScore(findings);
    expect(overallScore).toBe(100);
    expect(readiness).toBe('READY');
  });

  it('marks NOT_READY when any critical finding is present, regardless of score', () => {
    const findings = [makeFinding({ severity: 'CRITICAL', status: 'FAIL' })];
    const { readiness } = calculateRiskScore(findings);
    expect(readiness).toBe('NOT_READY');
  });

  it('marks READY_WITH_WARNINGS when a high-severity finding is present but no critical', () => {
    const findings = [makeFinding({ severity: 'HIGH', status: 'FAIL' })];
    const { readiness } = calculateRiskScore(findings);
    expect(readiness).toBe('READY_WITH_WARNINGS');
  });

  it('never lets the score drop below 0', () => {
    const findings = Array.from({ length: 20 }, () => makeFinding({ severity: 'CRITICAL', status: 'FAIL' }));
    const { overallScore } = calculateRiskScore(findings);
    expect(overallScore).toBe(0);
  });

  it('applies the configured penalty weight exactly once per finding', () => {
    const findings = [makeFinding({ severity: 'HIGH', status: 'FAIL' })];
    const { overallScore } = calculateRiskScore(findings);
    expect(overallScore).toBe(100 - SEVERITY_PENALTIES.HIGH);
  });

  it('produces a per-category breakdown alongside the overall score', () => {
    const findings = [makeFinding({ category: 'TRACKING', severity: 'HIGH', status: 'FAIL' }), makeFinding({ category: 'UX', severity: 'LOW', status: 'WARN' })];
    const { breakdown } = calculateRiskScore(findings);
    expect(breakdown.some((b) => b.category === 'TRACKING')).toBe(true);
    expect(breakdown.some((b) => b.category === 'UX')).toBe(true);
    expect(breakdown.some((b) => b.category === 'OVERALL')).toBe(true);
  });
});

describe('explainReadiness', () => {
  it('names the specific critical finding in the explanation', () => {
    const findings = [makeFinding({ severity: 'CRITICAL', status: 'FAIL', title: 'No tracking detected' })];
    const explanation = explainReadiness('NOT_READY', findings);
    expect(explanation).toContain('No tracking detected');
  });
});
