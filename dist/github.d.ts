import type { GitHub } from '@actions/github/lib/utils';
type Octokit = InstanceType<typeof GitHub>;
/** one comment per PR, updated in place (D4) — found by the hidden marker */
export declare function upsertReviewComment(params: {
    octokit: Octokit;
    owner: string;
    repo: string;
    prNumber: number;
    body: string;
}): Promise<void>;
export {};
