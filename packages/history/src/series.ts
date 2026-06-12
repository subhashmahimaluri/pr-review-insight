import { Category, CATEGORIES } from '@pr-review-insight/core';

/** one scan of the default branch, stored on the baseline orphan branch */
export type BaselineEntry = {
  sha: string;
  ref?: string;
  timestamp?: string;
  /** all finding fingerprints at that commit — drives `isNew` (D3) */
  fingerprints: string[];
  /** per-category totals — drives Δ and sparklines */
  counts: Record<Category, number>;
  /** scan-level stats — drives the diff-aware duplication gate */
  stats?: { duplicationPercent?: number };
};

export type HistoryIndex = {
  /** newest first */
  entries: { sha: string; timestamp?: string }[];
};

export type HistoryPoint = {
  sha: string;
  timestamp?: string;
  counts: Record<Category, number>;
};

/** oldest-first series for sparklines */
export function entriesToSeries(entries: BaselineEntry[]): HistoryPoint[] {
  const oldestFirst = [...entries].reverse();
  oldestFirst.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    return a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0;
  });
  return oldestFirst.map((entry) => ({
    sha: entry.sha,
    timestamp: entry.timestamp,
    counts: entry.counts,
  }));
}

export function categorySeries(points: HistoryPoint[], category: Category): number[] {
  return points.map((p) => p.counts[category] ?? 0);
}

export function emptyCounts(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
}
