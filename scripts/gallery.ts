/**
 * Dry-run gallery: render every report state + the overview band SVGs into
 * docs/gallery/ so the comment UX can be reviewed without a live PR.
 *
 *   npx tsx scripts/gallery.ts
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReport,
  BuildReportInput,
  CATEGORIES,
  Category,
  DEFAULT_CONFIG,
  evaluateGates,
  Finding,
  ReviewReport,
} from '@pr-review-insight/core';
import { renderHtml, renderMarkdown } from '@pr-review-insight/reporters';
import { HistoryPoint, renderOverviewBandSvg } from '@pr-review-insight/history';

const OUT = join(__dirname, '..', 'docs', 'gallery');
mkdirSync(OUT, { recursive: true });

const GENERATED_AT = '2026-06-12T00:00:00.000Z';

// real findings from the fixture scan when available, synthetic otherwise
const fixtureReportPath = '/tmp/code-report.json';
const scanned: Finding[] = existsSync(fixtureReportPath)
  ? ((JSON.parse(readFileSync(fixtureReportPath, 'utf8')) as ReviewReport).findings ?? [])
  : [];

function withNewMarks(findings: Finding[], newRatio: number): Finding[] {
  return findings.map((f, i) => ({
    ...f,
    isNew: i % Math.round(1 / newRatio) === 0,
    touched: true,
  }));
}

function report(input: Partial<BuildReportInput>): ReviewReport {
  const findings = input.findings ?? [];
  const baseline =
    input.baseline !== undefined
      ? input.baseline
      : { sha: 'a1b2c3d4e5f6', source: 'branch' as const, staleness: 0 };
  const policy = evaluateGates({
    findings,
    duplicationPercent: input.stats?.duplicationPercent,
    config: DEFAULT_CONFIG,
    hasBaseline: baseline !== null,
  });
  return buildReport({
    findings,
    policy,
    baseline,
    baselineCounts: input.baselineCounts ?? null,
    generatedAt: GENERATED_AT,
    repo: { owner: 'acme', repo: 'webapp' },
    pr: { number: 12, headSha: 'feedbeef0012' },
    ...input,
    policy,
  });
}

const baselineCounts: Partial<Record<Category, number>> = {
  security: 0,
  pentest: 6,
  complexity: 2,
  duplication: 1,
  'dead-code': 4,
  architecture: 1,
  a11y: 1,
  smell: 1,
};

const states: Record<string, ReviewReport> = {
  'gate-failed': report({
    findings: withNewMarks(scanned, 0.4),
    baselineCounts,
    stats: { duplicationPercent: 12.7 },
  }),
  'new-findings': report({
    findings: withNewMarks(
      scanned.filter((f) => f.severity !== 'critical'),
      0.25
    ).filter((f) => f.category !== 'duplication'),
    baselineCounts,
  }),
  passed: report({ findings: scanned.map((f) => ({ ...f, isNew: false })) }),
  improved: report({
    findings: scanned.slice(0, 8).map((f) => ({ ...f, isNew: false })),
    baselineCounts: { ...baselineCounts, pentest: 10, smell: 5 },
  }),
  'no-change': report({
    findings: scanned.map((f) => ({ ...f, isNew: false })),
    baselineCounts: Object.fromEntries(
      CATEGORIES.map((c) => [c, scanned.filter((f) => f.category === c).length])
    ),
  }),
  'no-baseline': report({ findings: scanned, baseline: null }),
  'invalid-data': report({
    findings: [],
    inputErrors: ['Invalid `gates` input JSON: Unexpected token n'],
  }),
  'scan-error': report({
    findings: [],
    scannerErrors: [
      { scanner: 'knip', message: 'knip produced no JSON (exit 2): config error', fatal: false },
    ],
    strict: true,
  }),
};

// synthetic 12-run history for sparklines
const series: HistoryPoint[] = Array.from({ length: 12 }, (_, i) => ({
  sha: `sha${i}`,
  timestamp: `2026-05-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  counts: Object.fromEntries(
    CATEGORIES.map((c) => {
      const finalCount = scanned.filter((f) => f.category === c).length;
      const wobble = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 0, 0][i];
      return [
        c,
        Math.max(0, finalCount - Math.floor((11 - i) / 3) + (c === 'pentest' ? wobble : 0)),
      ];
    })
  ) as Record<Category, number>,
}));

for (const [name, rep] of Object.entries(states)) {
  writeFileSync(
    join(OUT, `comment-${name}.md`),
    renderMarkdown(rep, {
      bandImages: {
        light: `./overview-band-light.svg`,
        dark: `./overview-band-dark.svg`,
      },
      bandCaption: `Findings per category for this PR · Δ vs base \`a1b2c3d\` · sparklines: last 12 baseline runs`,
    })
  );
}

const bandSource = states['gate-failed'];
const fresh = (bandSource.findings ?? []).filter((f) => f.isNew);
const gate = {
  verdict: bandSource.policy?.verdict ?? ('fail' as const),
  newTotal: fresh.length,
  newCritical: fresh.filter((f) => f.severity === 'critical').length,
  newMajor: fresh.filter((f) => f.severity === 'major').length,
};
writeFileSync(
  join(OUT, 'overview-band-light.svg'),
  renderOverviewBandSvg(bandSource.categories ?? [], series, 'light', { gate })
);
writeFileSync(
  join(OUT, 'overview-band-dark.svg'),
  renderOverviewBandSvg(bandSource.categories ?? [], series, 'dark', { gate })
);
writeFileSync(join(OUT, 'code-report.html'), renderHtml(states['gate-failed']));

console.log(`gallery written to ${OUT}`);
