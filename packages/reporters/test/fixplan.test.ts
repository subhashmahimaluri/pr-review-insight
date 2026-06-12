import { describe, expect, it } from 'vitest';
import { renderFixPlan } from '@pr-review-insight/reporters';
import { makeFinding, makeReport } from './helpers';

describe('renderFixPlan', () => {
  const report = makeReport({
    findings: [
      makeFinding({
        category: 'security',
        ruleId: 'security/detect-eval-with-expression',
        severity: 'critical',
        isNew: true,
        owasp: 'A03:2021-Injection',
        file: 'src/api.ts',
        range: { start: 4, end: 4 },
        message: 'eval with argument of type Identifier',
      }),
      makeFinding({
        category: 'smell',
        severity: 'minor',
        isNew: false,
        file: 'src/old.ts',
        message: 'Identical expressions',
      }),
      makeFinding({
        category: 'a11y',
        ruleId: 'jsx-a11y/alt-text',
        severity: 'minor',
        isNew: false,
        file: 'src/Card.tsx',
        message: 'img elements must have an alt prop',
      }),
    ],
  });

  it('separates new findings (first) from pre-existing debt', () => {
    const plan = renderFixPlan(report);
    expect(plan).toContain('## 🆕 Introduced by this PR (1) — fix these first');
    expect(plan).toContain('## 🧹 Pre-existing debt (2) — suggested cleanups');
    expect(plan.indexOf('Introduced by this PR')).toBeLessThan(plan.indexOf('Pre-existing debt'));
    expect(plan).toContain('do **not** block the merge');
  });

  it('emits a ready-to-paste AI prompt per new finding', () => {
    const plan = renderFixPlan(report);
    expect(plan).toContain('**Prompt for your AI assistant:**');
    expect(plan).toContain('Fix the following issue in `src/api.ts` (lines 4–4):');
    expect(plan).toContain(
      'Rule security/detect-eval-with-expression (critical, A03:2021-Injection)'
    );
    expect(plan).toContain('keep behavior identical');
  });

  it('groups pre-existing debt into per-category batches with a batch prompt', () => {
    const plan = renderFixPlan(report);
    expect(plan).toContain('### ♿ Accessibility (1)');
    expect(plan).toContain('### 🧹 Code smells (1)');
    expect(plan).toContain('Batch prompt for your AI assistant');
    expect(plan).toContain('one file at a time');
  });

  it('celebrates a clean PR and handles missing baselines honestly', () => {
    const clean = renderFixPlan(
      makeReport({ findings: [makeFinding({ isNew: false })], baselineCounts: { smell: 2 } })
    );
    expect(clean).toContain('_Nothing — this PR introduces no new findings._');

    const noBaseline = renderFixPlan(
      makeReport({ findings: [makeFinding()], baseline: null, baselineCounts: null })
    );
    expect(noBaseline).toContain('attribution was not possible');
  });
});
