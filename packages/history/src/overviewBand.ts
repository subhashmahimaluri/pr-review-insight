import { CATEGORY_META, Category, CategorySummary, Severity } from '@pr-review-insight/core';
import { sparklinePath } from './sparkline';
import { HistoryPoint, categorySeries } from './series';

/**
 * The overview band: one card per category — count colored by worst severity,
 * severity dot, Δ vs base (▲ red = new debt, ▼ green = paid down) and a
 * 30-run sparkline. Laid out in rows of 5. Deterministic output (D6): no
 * timestamps, no randomness.
 */
const CARD_W = 158;
const CARD_H = 104;
const GAP = 8;
const PER_ROW = 5;

export type Theme = 'light' | 'dark';

const THEMES: Record<Theme, { bg: string; card: string; fg: string; muted: string }> = {
  light: { bg: '#ffffff', card: '#f6f8fa', fg: '#1f2328', muted: '#656d76' },
  dark: { bg: '#0d1117', card: '#161b22', fg: '#e6edf3', muted: '#8b949e' },
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#cf222e',
  major: '#bc4c00',
  minor: '#9a6700',
  info: '#656d76',
};

const CLEAN = '#1a7f37';

function countColor(summary: CategorySummary): string {
  if (summary.total === 0) return CLEAN;
  return SEVERITY_COLOR[summary.worst ?? 'info'];
}

function deltaParts(summary: CategorySummary, theme: Theme): { text: string; color: string } {
  const delta = summary.delta;
  if (delta === null) return { text: '', color: THEMES[theme].muted };
  if (delta === 0) return { text: '±0', color: THEMES[theme].muted };
  // more findings = debt (red); fewer = paid down (green)
  return delta > 0
    ? { text: `▲${delta}`, color: '#cf222e' }
    : { text: `▼${Math.abs(delta)}`, color: CLEAN };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** same decision-relevant order as the comment spoilers */
const BAND_ORDER: Category[] = [
  'security',
  'pentest',
  'deps',
  'complexity',
  'duplication',
  'dead-code',
  'architecture',
  'a11y',
  'smell',
];

export function renderOverviewBandSvg(
  unordered: CategorySummary[],
  series: HistoryPoint[],
  theme: Theme
): string {
  const summaries = [...unordered].sort(
    (a, b) => BAND_ORDER.indexOf(a.category) - BAND_ORDER.indexOf(b.category)
  );
  const t = THEMES[theme];
  const rows = Math.max(1, Math.ceil(summaries.length / PER_ROW));
  const cols = Math.min(summaries.length, PER_ROW) || 1;
  const width = cols * CARD_W + (cols - 1) * GAP;
  const height = rows * CARD_H + (rows - 1) * GAP;

  const cards = summaries
    .map((summary, i) => {
      const meta = CATEGORY_META[summary.category];
      const x = (i % PER_ROW) * (CARD_W + GAP);
      const y = Math.floor(i / PER_ROW) * (CARD_H + GAP);
      const color = countColor(summary);
      const delta = deltaParts(summary, theme);
      const values = categorySeries(series, summary.category).slice(-30);
      const spark = sparklinePath(values, x + 12, y + 74, CARD_W - 24, 20);
      const newText = summary.new !== null && summary.new > 0 ? `${summary.new} new` : '';
      return [
        `<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="8" fill="${t.card}"/>`,
        `<text x="${x + 12}" y="${y + 20}" font-size="11" fill="${t.muted}">${escapeXml(
          `${meta.emoji} ${meta.label}`
        )}</text>`,
        `<circle cx="${x + CARD_W - 18}" cy="${y + 16}" r="4" fill="${color}"/>`,
        `<text x="${x + 12}" y="${y + 46}" font-size="22" font-weight="700" fill="${color}">${summary.total}</text>`,
        delta.text
          ? `<text x="${x + CARD_W - 12}" y="${y + 46}" font-size="13" font-weight="600" text-anchor="end" fill="${delta.color}">${delta.text}</text>`
          : '',
        newText
          ? `<text x="${x + 12}" y="${y + 62}" font-size="11" fill="#cf222e">${escapeXml(newText)} 🆕</text>`
          : `<text x="${x + 12}" y="${y + 62}" font-size="11" fill="${t.muted}">${
              summary.total === 0 ? 'clean' : 'no new'
            }</text>`,
        spark ? `<path d="${spark}" fill="none" stroke="${color}" stroke-width="1.5"/>` : '',
      ].join('');
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif" ` +
    `role="img" aria-label="code review findings per category: count, delta vs base and trend">` +
    `<rect width="${width}" height="${height}" fill="${t.bg}"/>${cards}</svg>`
  );
}

export const BASELINE_BRANCH = 'pr-review-insight-baseline';

export function overviewBandPath(theme: Theme): string {
  return `badges/overview-band-${theme}.svg`;
}

export function prOverviewBandPath(prNumber: number, theme: Theme): string {
  return `badges/pr-${prNumber}-overview-band-${theme}.svg`;
}
