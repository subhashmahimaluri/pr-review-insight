import type { GitHub } from '@actions/github/lib/utils';
import { COMMENT_MARKER } from '@pr-review-insight/reporters';

type Octokit = InstanceType<typeof GitHub>;

/** one comment per PR, updated in place (D4) — found by the hidden marker */
export async function upsertReviewComment(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}): Promise<void> {
  const { octokit, owner, repo, prNumber, body } = params;
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find((c: { id: number; body?: string }) =>
    c.body?.includes(COMMENT_MARKER)
  );
  if (existing) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }
}
