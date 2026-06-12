import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Category, Config } from '@pr-review-insight/core';
import { realExec, runScanners } from '@pr-review-insight/scanners';
import { BaselineEntry, emptyCounts } from '@pr-review-insight/history';

/**
 * Dual-scan mode: materialize the merge-base in a temp git worktree and scan
 * it in this very run — no baseline branch, no history needed. Requires the
 * merge-base commit to be fetched (actions/checkout with `fetch-depth: 0`).
 * Returns null when the commit isn't available locally.
 */
export async function scanMergeBase(params: {
  cwd: string;
  mergeBaseSha: string;
  config: Config;
}): Promise<BaselineEntry | null> {
  const { cwd, mergeBaseSha, config } = params;

  const probe = await realExec('git', ['cat-file', '-e', `${mergeBaseSha}^{commit}`], { cwd });
  if (probe.code !== 0) return null;

  const worktree = mkdtempSync(join(tmpdir(), 'pri-base-'));
  try {
    const add = await realExec(
      'git',
      ['worktree', 'add', '--detach', '--force', worktree, mergeBaseSha],
      { cwd }
    );
    if (add.code !== 0) {
      throw new Error(`git worktree add failed: ${add.stderr.slice(0, 300)}`);
    }

    const scan = await runScanners({ cwd: worktree, config, exec: realExec });

    const counts = emptyCounts();
    for (const finding of scan.findings) {
      counts[finding.category as Category] += 1;
    }
    return {
      sha: mergeBaseSha,
      fingerprints: scan.findings.map((f) => f.fingerprint),
      counts,
      stats: { duplicationPercent: scan.stats.duplicationPercent },
    };
  } finally {
    await realExec('git', ['worktree', 'remove', '--force', worktree], { cwd }).catch(() => {});
    rmSync(worktree, { recursive: true, force: true });
  }
}
