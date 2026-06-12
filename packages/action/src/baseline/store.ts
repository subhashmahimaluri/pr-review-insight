import type { GitHub } from '@actions/github/lib/utils';
import { BaselineEntry, HistoryIndex } from '@pr-review-insight/history';

type Octokit = InstanceType<typeof GitHub>;

const MAX_HISTORY_ENTRIES = 100;

export function entryPath(sha: string): string {
  return `baselines/${sha}.json`;
}

export async function readJsonFile<T>(
  octokit: Octokit,
  params: { owner: string; repo: string; branch: string; path: string }
): Promise<T | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.branch,
    });
    if (Array.isArray(data) || !('content' in data) || !data.content) return null;
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) as T;
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/**
 * Commit a set of files to the baseline branch in ONE commit via the git data
 * API. Creates the branch as an orphan (no parents) when it doesn't exist.
 */
export async function commitFiles(
  octokit: Octokit,
  params: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: { path: string; content: string }[];
  }
): Promise<void> {
  const { owner, repo, branch, message, files } = params;

  let parentSha: string | null = null;
  let baseTree: string | undefined;
  try {
    const { data: ref } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
    parentSha = ref.object.sha;
    const { data: commit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: parentSha,
    });
    baseTree = commit.tree.sha;
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
  }

  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo,
    ...(baseTree ? { base_tree: baseTree } : {}),
    tree: files.map((file) => ({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: file.content,
    })),
  });

  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.sha,
    parents: parentSha ? [parentSha] : [],
  });

  if (parentSha) {
    await octokit.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
  } else {
    await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.sha });
  }
}

export async function readEntry(
  octokit: Octokit,
  params: { owner: string; repo: string; branch: string; sha: string }
): Promise<BaselineEntry | null> {
  return readJsonFile<BaselineEntry>(octokit, { ...params, path: entryPath(params.sha) });
}

export async function readIndex(
  octokit: Octokit,
  params: { owner: string; repo: string; branch: string }
): Promise<HistoryIndex> {
  return (
    (await readJsonFile<HistoryIndex>(octokit, { ...params, path: 'index.json' })) ?? {
      entries: [],
    }
  );
}

export function pushIndexEntry(
  index: HistoryIndex,
  entry: { sha: string; timestamp?: string }
): HistoryIndex {
  const entries = [entry, ...index.entries.filter((e) => e.sha !== entry.sha)].slice(
    0,
    MAX_HISTORY_ENTRIES
  );
  return { entries };
}
