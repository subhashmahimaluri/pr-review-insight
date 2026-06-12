import type { GitHub } from '@actions/github/lib/utils';
import { BaselineMeta } from '@pr-review-insight/core';
import { BaselineEntry } from '@pr-review-insight/history';
type Octokit = InstanceType<typeof GitHub>;
export type ResolvedBaseline = {
    entry: BaselineEntry;
    meta: BaselineMeta;
};
/**
 * exact hit at the merge-base → nearest recorded ancestor (staleness counted)
 * → null (first run, state `no-baseline`).
 */
export declare function resolveBaseline(params: {
    octokit: Octokit;
    owner: string;
    repo: string;
    branch: string;
    mergeBaseSha: string;
    maxWalk?: number;
}): Promise<ResolvedBaseline | null>;
export {};
//# sourceMappingURL=resolve.d.ts.map