import { describe, expect, it } from 'vitest';
import {
  BuildReportInput,
  buildReport,
  DEFAULT_CONFIG,
  evaluateGates,
  reviewReportSchema,
} from '@pr-review-insight/core';
import { makeFinding } from './helpers';

const GENERATED_AT = '2026-01-01T00:00:00.000Z';

function build(overrides: Partial<BuildReportInput>): ReturnType<typeof buildReport> {
  const findings = overrides.findings ?? [];
  const policy =
    overrides.policy ??
    evaluateGates({
      findings,
      config: DEFAULT_CONFIG,
      hasBaseline: overrides.baseline !== null,
    });
  return buildReport({
    findings,
    policy,
    baseline: { sha: 'abc1234def', source: 'branch', staleness: 0 },
    baselineCounts: {},
    generatedAt: GENERATED_AT,
    ...overrides,
    policy,
  });
}

describe('buildReport state machine', () => {
  it('passed — gates met, no new findings, debt unchanged is no-change instead', () => {
    const report = build({
      findings: [makeFinding({ isNew: false })],
      baselineCounts: { smell: 0 },
    });
    expect(report.state).toBe('passed');
  });

  it('no-change — identical totals vs baseline', () => {
    const report = build({
      findings: [makeFinding({ isNew: false })],
      baselineCounts: { smell: 1 },
    });
    expect(report.state).toBe('no-change');
  });

  it('improved — fewer findings than baseline, none new', () => {
    const report = build({ findings: [], baselineCounts: { smell: 3 } });
    expect(report.state).toBe('improved');
  });

  it('new-findings — new within gates', () => {
    const report = build({
      findings: [makeFinding({ isNew: true, severity: 'minor' })],
      baselineCounts: { smell: 0 },
    });
    expect(report.state).toBe('new-findings');
  });

  it('gate-failed beats new-findings', () => {
    const report = build({
      findings: [makeFinding({ isNew: true, severity: 'critical' })],
      baselineCounts: { smell: 0 },
    });
    expect(report.state).toBe('gate-failed');
  });

  it('no-baseline — first run', () => {
    const report = build({ findings: [makeFinding()], baseline: null, baselineCounts: null });
    expect(report.state).toBe('no-baseline');
  });

  it('invalid-data beats gate-failed', () => {
    const report = build({
      findings: [makeFinding({ isNew: true, severity: 'critical' })],
      inputErrors: ['bad gates JSON'],
    });
    expect(report.state).toBe('invalid-data');
  });

  it('scan-error with strict beats everything', () => {
    const report = build({
      findings: [makeFinding({ isNew: true, severity: 'critical' })],
      inputErrors: ['bad gates JSON'],
      scannerErrors: [{ scanner: 'knip', message: 'boom', fatal: false }],
      strict: true,
    });
    expect(report.state).toBe('scan-error');
  });

  it('a single scanner crash without strict degrades, never decides', () => {
    const report = build({
      findings: [makeFinding({ isNew: false })],
      baselineCounts: { smell: 1 },
      scannerErrors: [{ scanner: 'knip', message: 'boom', fatal: false }],
    });
    expect(report.state).toBe('no-change');
    expect(report.errors).toHaveLength(1);
  });

  it('emits a schema-valid report in every state (D5)', () => {
    const states = [
      build({ findings: [], baselineCounts: { smell: 0 } }),
      build({ findings: [makeFinding({ isNew: true, severity: 'critical' })] }),
      build({ findings: [], baseline: null, baselineCounts: null }),
      build({ inputErrors: ['x'] }),
    ];
    for (const report of states) {
      expect(() => reviewReportSchema.parse(report)).not.toThrow();
      expect(report.schemaVersion).toBe(1);
      expect(report.generatedAt).toBe(GENERATED_AT);
    }
  });

  it('summarizes categories with new counts and deltas', () => {
    const report = build({
      findings: [
        makeFinding({ category: 'security', severity: 'critical', isNew: true }),
        makeFinding({ category: 'security', severity: 'major', isNew: false, file: 'b.ts' }),
      ],
      baselineCounts: { security: 1 },
    });
    const security = report.categories!.find((c) => c.category === 'security')!;
    expect(security).toMatchObject({ total: 2, new: 1, worst: 'critical', delta: 1 });
  });
});
