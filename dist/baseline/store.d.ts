import type { GitHub } from '@actions/github/lib/utils';
import { BaselineEntry, HistoryIndex } from '@pr-review-insight/history';
type Octokit = InstanceType<typeof GitHub>;
export declare function entryPath(sha: string): string;
export declare function readJsonFile<T>(octokit: Octokit, params: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
}): Promise<T | null>;
/**
 * Commit a set of files to the baseline branch in ONE commit via the git data
 * API. Creates the branch as an orphan (no parents) when it doesn't exist.
 */
export declare function commitFiles(octokit: Octokit, params: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: {
        path: string;
        content: string;
    }[];
}): Promise<void>;
export declare function readEntry(octokit: Octokit, params: {
    owner: string;
    repo: string;
    branch: string;
    sha: string;
}): Promise<BaselineEntry | null>;
export declare function readIndex(octokit: Octokit, params: {
    owner: string;
    repo: string;
    branch: string;
}): Promise<HistoryIndex>;
export declare function pushIndexEntry(index: HistoryIndex, entry: {
    sha: string;
    timestamp?: string;
}): HistoryIndex;
export {};
//# sourceMappingURL=store.d.ts.map