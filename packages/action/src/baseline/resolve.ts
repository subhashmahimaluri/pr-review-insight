import type { GitHub } from '@actions/github/lib/utils';
import { BaselineMeta } from '@pr-review-insight/core';
import { BaselineEntry } from '@pr-review-insight/history';
import { readEntry, readIndex } from './store';

type Octokit = InstanceType<typeof GitHub>;

export type ResolvedBaseline = { entry: BaselineEntry; meta: BaselineMeta };

/**
 * exact hit at the merge-base → nearest recorded ancestor (staleness counted)
 * → null (first run, state `no-baseline`).
 */
export async function resolveBaseline(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  mergeBaseSha: string;
  maxWalk?: number;
}): Promise<ResolvedBaseline | null> {
  const { octokit, owner, repo, branch, mergeBaseSha, maxWalk = 50 } = params;

  const exact = await readEntry(octokit, { owner, repo, branch, sha: mergeBaseSha });
  if (exact) {
    return {
      entry: exact,
      meta: {
        sha: mergeBaseSha,
        ref: exact.ref,
        timestamp: exact.timestamp,
        source: 'branch',
        staleness: 0,
      },
    };
  }

  const index = await readIndex(octokit, { owner, repo, branch });
  if (index.entries.length === 0) return null;
  const recorded = new Set(index.entries.map((e) => e.sha));

  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: mergeBaseSha,
      per_page: maxWalk,
    });
    for (let i = 0; i < commits.length; i++) {
      if (!recorded.has(commits[i].sha)) continue;
      const entry = await readEntry(octokit, { owner, repo, branch, sha: commits[i].sha });
      if (!entry) continue;
      return {
        entry,
        meta: {
          sha: commits[i].sha,
          ref: entry.ref,
          timestamp: entry.timestamp,
          source: 'branch',
          staleness: i,
        },
      };
    }
  } catch {
    // ancestor walk is best-effort; fall through to "no baseline"
  }
  return null;
}
