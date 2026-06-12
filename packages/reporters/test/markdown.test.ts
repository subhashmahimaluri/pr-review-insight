import { describe, expect, it } from 'vitest';
import { COMMENT_MARKER, renderMarkdown } from '@pr-review-insight/reporters';
import { makeFinding, makeReport } from './helpers';

describe('renderMarkdown — states', () => {
  it('passed: verdict header + policy line + marker', () => {
    // baseline present but without recorded counts → no delta, plain pass
    const report = makeReport({ findings: [], baselineCounts: null });
    const md = renderMarkdown(report);
    expect(md).toContain(COMMENT_MARKER);
    expect(md).toContain('## ✅ Code review gate passed');
    expect(md).toContain('policy: zero new critical');
    expect(md).toContain('PR #12');
    expect(md).toContain('Reported by **PR Review Insight**');
  });

  it('gate-failed: blocks-merge header, CAUTION naming the worst offender, violations', () => {
    const report = makeReport({
      findings: [
        makeFinding({
          category: 'security',
          ruleId: 'security/detect-eval-with-expression',
          severity: 'critical',
          isNew: true,
          owasp: 'A03:2021-Injection',
          file: 'src/api.ts',
        }),
      ],
    });
    const md = renderMarkdown(report);
    expect(md).toContain('## ❌ Code review gate failed `blocks merge`');
    expect(md).toContain('> [!CAUTION]');
    expect(md).toContain('security/detect-eval-with-expression');
    expect(md).toContain('src/api.ts');
    expect(md).toContain('**Gate violations**');
    expect(md).toContain('🆕 Introduced by this PR (1)');
  });

  it('no-change: minimal single-block comment', () => {
    const report = makeReport({
      findings: [makeFinding({ isNew: false })],
      baselineCounts: { smell: 1 },
    });
    const md = renderMarkdown(report);
    expect(md).toContain('## ✅ Code review — no change in findings');
    expect(md).not.toContain('<details>');
  });

  it('no-baseline: baseline-recorded header, findings listed without 🆕 blame', () => {
    const report = makeReport({
      findings: [makeFinding()],
      baseline: null,
      baselineCounts: null,
    });
    const md = renderMarkdown(report);
    expect(md).toContain('## ℹ️ Code review baseline recorded');
    expect(md).not.toContain('🆕');
  });

  it('scan-error: failure-mode header and scanner detail', () => {
    const report = makeReport({
      findings: [],
      scannerErrors: [{ scanner: 'knip', message: 'knip produced no JSON (exit 2)', fatal: false }],
      strict: true,
    });
    const md = renderMarkdown(report);
    expect(md).toContain('## 🛑 Scan error — report in failure mode');
    expect(md).toContain('> [!WARNING]');
    expect(md).toContain('knip produced no JSON');
  });
});

describe('renderMarkdown — layout discipline', () => {
  const richReport = () =>
    makeReport({
      findings: [
        makeFinding({
          category: 'security',
          ruleId: 'security/detect-unsafe-regex',
          severity: 'major',
          isNew: true,
          owasp: 'A05:2021-Security Misconfiguration',
          file: 'src/re.ts',
        }),
        makeFinding({
          category: 'duplication',
          ruleId: 'jscpd/duplication',
          severity: 'minor',
          file: 'src/a.ts',
          range: { start: 10, end: 34 },
          detail: 'src/b.ts#L50-L74',
          message: '25 duplicated lines, also at src/b.ts:50–74',
        }),
        makeFinding({
          category: 'dead-code',
          ruleId: 'knip/unused-export',
          severity: 'minor',
          file: 'src/util.ts',
          detail: 'oldHelper',
          message: 'Unused export `oldHelper`',
        }),
      ],
      stats: { duplicationPercent: 3.1 },
    });

  it('the visible area is graphs/verdict only — every table is inside a spoiler', () => {
    const md = renderMarkdown(richReport(), {
      bandImages: { light: 'https://x/l.svg', dark: 'https://x/d.svg' },
      bandCaption: 'Findings per category for this PR',
    });
    // every markdown table row lives after a <details> opening (the
    // introduced-by-this-PR section is a spoiler too — just open by default)
    const visible = md.split('<details')[0];
    expect(visible).not.toContain('| --- |');
    expect(visible).toContain('<picture>');
    expect(visible).toContain('prefers-color-scheme: dark');
  });

  it('new findings get an open-by-default "Introduced by this PR" section before the categories', () => {
    const md = renderMarkdown(richReport());
    expect(md).toContain('<details open>');
    expect(md).toContain('🆕 Introduced by this PR (1) — what the gate judges');
    // the introduced section precedes every category spoiler
    expect(md.indexOf('Introduced by this PR')).toBeLessThan(
      md.indexOf('<summary>🔐 Security & OWASP')
    );
  });

  it('frames pre-existing-only debt as non-blocking suggestions', () => {
    const md = renderMarkdown(
      makeReport({
        findings: [makeFinding({ isNew: false }), makeFinding({ isNew: false, file: 'b.ts' })],
        baselineCounts: { smell: 1 }, // delta ≠ 0 so we stay out of no-change
      })
    );
    expect(md).toContain('**This PR introduces no new findings.**');
    expect(md).toContain("they don't block this merge");
    expect(md).not.toContain('<details open>');
  });

  it('falls back to a summary table only when no band image exists', () => {
    const md = renderMarkdown(richReport());
    expect(md).not.toContain('<picture>');
    expect(md).toContain('| Category | Total | New | Δ vs base | Worst |');
  });

  it('groups security findings by OWASP category and blob-links files', () => {
    const md = renderMarkdown(richReport());
    expect(md).toContain('**A05:2021-Security Misconfiguration**');
    expect(md).toContain(
      '[`src/re.ts:10–12`](https://github.com/acme/webapp/blob/feedbeef00/src/re.ts#L10-L12)'
    );
  });

  it('duplication spoiler links both sides of the clone pair', () => {
    const md = renderMarkdown(richReport());
    expect(md).toContain('👯 Duplication');
    expect(md).toContain('3.1% duplicated');
    expect(md).toContain('src/b.ts#L50-L74');
  });

  it('dead-code spoiler shows file, symbol, why', () => {
    const md = renderMarkdown(richReport());
    expect(md).toContain('| File | Symbol | Why |');
    expect(md).toContain('`oldHelper`');
  });

  it('new findings are bold with a 🆕 chip; pre-existing are muted', () => {
    const md = renderMarkdown(richReport());
    expect(md).toContain('**🟧 major** 🆕');
    expect(md).toContain('🟨 minor |'); // pre-existing row, unbolded
  });
});

describe('renderMarkdown — truncation ladder (65k budget)', () => {
  function hugeReport(count: number) {
    return makeReport({
      findings: [
        makeFinding({
          category: 'security',
          severity: 'critical',
          isNew: true,
          file: 'src/worst.ts',
          ruleId: 'security/detect-eval-with-expression',
        }),
        ...Array.from({ length: count }, (_, i) =>
          makeFinding({
            file: `src/file-${i % 90}.ts`,
            range: { start: i + 1, end: i + 2 },
            message: `Some long finding message that pads the table row nicely #${i}`,
            ruleId: `sonarjs/rule-${i % 40}`,
          })
        ),
      ],
    });
  }

  it('drops the all-findings table first, then caps rows, protected always survives', () => {
    const report = hugeReport(800);
    const full = renderMarkdown(report, { maxChars: 10_000_000 });
    expect(full).toContain('📋 All findings by file');

    const truncated = renderMarkdown(report, { maxChars: 30_000 });
    expect(truncated.length).toBeLessThanOrEqual(30_000);
    expect(truncated).not.toContain('📋 All findings by file');

    const minimal = renderMarkdown(report, { maxChars: 3_000 });
    expect(minimal.length).toBeLessThanOrEqual(3_000);
    // protected content survives every step
    expect(minimal).toContain('## ❌ Code review gate failed');
    expect(minimal).toContain('> [!CAUTION]');
  });

  it('is deterministic (D6)', () => {
    const report = hugeReport(50);
    expect(renderMarkdown(report)).toBe(renderMarkdown(report));
  });
});
