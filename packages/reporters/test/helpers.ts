import {
  buildReport,
  BuildReportInput,
  Category,
  DEFAULT_CONFIG,
  evaluateGates,
  Finding,
  fingerprint,
  ReviewReport,
  Severity,
} from '@pr-review-insight/core';

export const GENERATED_AT = '2026-01-01T00:00:00.000Z';

export function makeFinding(overrides: Partial<Finding> = {}): Finding {
  const base = {
    category: 'smell' as Category,
    ruleId: 'sonarjs/no-identical-expressions',
    severity: 'minor' as Severity,
    file: 'src/app.ts',
    range: { start: 10, end: 12 },
    message: 'Identical expressions on both sides of operator',
  };
  const merged = { ...base, ...overrides };
  return {
    fingerprint: fingerprint({
      ruleId: merged.ruleId,
      file: merged.file,
      message: `${merged.file}:${merged.message}`,
    }),
    ...merged,
  };
}

export function makeReport(
  input: Partial<BuildReportInput> & { findings?: Finding[] }
): ReviewReport {
  const findings = input.findings ?? [];
  const baseline =
    input.baseline !== undefined
      ? input.baseline
      : { sha: 'abc1234def5678', source: 'branch' as const, staleness: 0 };
  const policy =
    input.policy ??
    evaluateGates({
      findings,
      duplicationPercent: input.stats?.duplicationPercent,
      config: DEFAULT_CONFIG,
      hasBaseline: baseline !== null,
    });
  return buildReport({
    findings,
    baseline,
    baselineCounts: input.baselineCounts !== undefined ? input.baselineCounts : {},
    generatedAt: GENERATED_AT,
    repo: { owner: 'acme', repo: 'webapp' },
    pr: { number: 12, headSha: 'feedbeef00' },
    ...input,
    policy,
  });
}
