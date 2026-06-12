import { describe, expect, it } from 'vitest';
import { CATEGORIES, CategorySummary } from '@pr-review-insight/core';
import { entriesToSeries, renderOverviewBandSvg, sparklinePath } from '@pr-review-insight/history';

function summary(overrides: Partial<CategorySummary>): CategorySummary {
  return {
    category: 'security',
    total: 0,
    new: 0,
    worst: null,
    bySeverity: { info: 0, minor: 0, major: 0, critical: 0 },
    delta: null,
    ...overrides,
  };
}

const allCategories = CATEGORIES.map((category, i) =>
  summary({
    category,
    total: i,
    worst: i === 0 ? null : 'minor',
    delta: i % 3 === 0 ? 1 : i % 3 === 1 ? -2 : 0,
  })
);

describe('renderOverviewBandSvg', () => {
  it('renders one card per category in rows of 5', () => {
    const svg = renderOverviewBandSvg(allCategories, [], 'light');
    expect(svg.match(/<rect[^>]*rx="8"/g)).toHaveLength(9);
    // 9 categories → 2 rows → height = 2*104 + 8
    expect(svg).toContain('height="216"');
  });

  it('shows ▲ red for new debt and ▼ green for paid down', () => {
    const svg = renderOverviewBandSvg(
      [
        summary({ total: 4, delta: 2, worst: 'major' }),
        summary({ category: 'smell', total: 1, delta: -3, worst: 'minor' }),
      ],
      [],
      'light'
    );
    expect(svg).toContain('>▲2</text>');
    expect(svg).toContain('>▼3</text>');
    expect(svg).toContain('#cf222e'); // debt red
    expect(svg).toContain('#1a7f37'); // paid-down green
  });

  it('colors counts by worst severity and green when clean', () => {
    const clean = renderOverviewBandSvg([summary({ total: 0 })], [], 'light');
    expect(clean).toContain('fill="#1a7f37">0<');
    const critical = renderOverviewBandSvg([summary({ total: 3, worst: 'critical' })], [], 'light');
    expect(critical).toContain('fill="#cf222e">3<');
  });

  it('draws sparklines from history series', () => {
    const entries = [3, 2, 1].map((n, i) => ({
      sha: `sha${i}`,
      timestamp: `2026-01-0${i + 1}T00:00:00Z`,
      fingerprints: [],
      counts: { ...Object.fromEntries(CATEGORIES.map((c) => [c, 0])), security: n } as Record<
        (typeof CATEGORIES)[number],
        number
      >,
    }));
    const series = entriesToSeries(entries);
    expect(series.map((p) => p.counts.security)).toEqual([3, 2, 1]);
    const svg = renderOverviewBandSvg([summary({ total: 1 })], series, 'dark');
    expect(svg).toContain('<path d="M');
  });

  it('is deterministic and theme-aware (D6)', () => {
    const light = renderOverviewBandSvg(allCategories, [], 'light');
    expect(light).toBe(renderOverviewBandSvg(allCategories, [], 'light'));
    const dark = renderOverviewBandSvg(allCategories, [], 'dark');
    expect(dark).toContain('#0d1117');
    expect(light).toContain('#ffffff');
    expect(light).not.toContain('Date');
  });
});

describe('quality gate card', () => {
  it('renders a leading PASS/FAIL card when gate info is provided (10 cards total)', () => {
    const failed = renderOverviewBandSvg(allCategories, [], 'light', {
      gate: { verdict: 'fail', newTotal: 3, newCritical: 1, newMajor: 2 },
    });
    expect(failed.match(/<rect[^>]*rx="8"/g)).toHaveLength(10);
    expect(failed).toContain('🚦 Quality gate');
    expect(failed).toContain('>FAIL<');
    expect(failed).toContain('3 new · 1 crit · 2 major');

    const passed = renderOverviewBandSvg(allCategories, [], 'dark', {
      gate: { verdict: 'pass', newTotal: 0 },
    });
    expect(passed).toContain('>PASS<');
    expect(passed).toContain('nothing introduced');
  });

  it('says "no baseline yet" when there is nothing to judge', () => {
    const svg = renderOverviewBandSvg(allCategories, [], 'light', {
      gate: { verdict: 'pass', newTotal: null },
    });
    expect(svg).toContain('no baseline yet');
  });

  it('omits the card without gate info (9 cards, backwards compatible)', () => {
    const svg = renderOverviewBandSvg(allCategories, [], 'light');
    expect(svg.match(/<rect[^>]*rx="8"/g)).toHaveLength(9);
    expect(svg).not.toContain('Quality gate');
  });
});

describe('sparklinePath', () => {
  it('fits values into the box', () => {
    const path = sparklinePath([0, 10], 0, 0, 100, 20);
    expect(path).toBe('M0 20 L100 0');
  });
  it('centers a flat series', () => {
    expect(sparklinePath([5, 5, 5], 0, 0, 100, 20)).toContain('M0 10');
  });
  it('returns empty for no data', () => {
    expect(sparklinePath([], 0, 0, 100, 20)).toBe('');
  });
});
