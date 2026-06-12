import { Category, Finding, Severity, fingerprint } from '@pr-review-insight/core';

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
      message: merged.message,
    }),
    ...merged,
  };
}
