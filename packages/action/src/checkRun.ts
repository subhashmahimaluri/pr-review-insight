import { context, getOctokit } from '@actions/github';
import { Finding, SEVERITY_RANK, Severity } from '@pr-review-insight/core';

const MAX_ANNOTATIONS = 200;
const ANNOTATIONS_PER_REQUEST = 50;

type AnnotationLevel = 'notice' | 'warning' | 'failure';

const LEVEL: Record<Severity, AnnotationLevel> = {
  critical: 'failure',
  major: 'warning',
  minor: 'warning',
  info: 'notice',
};

export type Annotation = {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: AnnotationLevel;
  message: string;
  title: string;
};

/** ≤200 inline annotations on touched lines, failures-first */
export function buildAnnotations(findings: Finding[], scope: 'new' | 'all'): Annotation[] {
  return findings
    .filter((f) => f.touched && f.range && (scope === 'all' || f.isNew))
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        Number(b.isNew ?? false) - Number(a.isNew ?? false)
    )
    .slice(0, MAX_ANNOTATIONS)
    .map((f) => ({
      path: f.file,
      start_line: f.range!.start,
      end_line: f.range!.end,
      annotation_level: LEVEL[f.severity],
      message: f.message + (f.owasp ? `\n${f.owasp}` : ''),
      title: `${f.ruleId}${f.isNew ? ' (new)' : ''}`,
    }));
}

export async function postCheckRun(params: {
  token: string;
  title: string;
  summary: string;
  conclusion: 'success' | 'failure' | 'neutral';
  annotations: Annotation[];
}): Promise<void> {
  const octokit = getOctokit(params.token);
  const { owner, repo } = context.repo;
  const head_sha =
    (context.payload.pull_request?.head as { sha?: string } | undefined)?.sha ?? context.sha;

  const chunks: Annotation[][] = [];
  for (let i = 0; i < params.annotations.length; i += ANNOTATIONS_PER_REQUEST) {
    chunks.push(params.annotations.slice(i, i + ANNOTATIONS_PER_REQUEST));
  }
  const [first, ...rest] = chunks;

  const { data: checkRun } = await octokit.rest.checks.create({
    owner,
    repo,
    name: '🔍 PR Review Insight',
    head_sha,
    status: 'completed',
    conclusion: params.conclusion,
    output: {
      title: params.title,
      summary: params.summary,
      ...(first && first.length > 0 ? { annotations: first } : {}),
    },
  });

  for (const chunk of rest) {
    await octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: checkRun.id,
      output: { title: params.title, summary: params.summary, annotations: chunk },
    });
  }
}
