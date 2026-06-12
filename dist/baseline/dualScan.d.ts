import { Config } from '@pr-review-insight/core';
import { BaselineEntry } from '@pr-review-insight/history';
/**
 * Dual-scan mode: materialize the merge-base in a temp git worktree and scan
 * it in this very run — no baseline branch, no history needed. Requires the
 * merge-base commit to be fetched (actions/checkout with `fetch-depth: 0`).
 * Returns null when the commit isn't available locally.
 */
export declare function scanMergeBase(params: {
    cwd: string;
    mergeBaseSha: string;
    config: Config;
}): Promise<BaselineEntry | null>;
//# sourceMappingURL=dualScan.d.ts.map