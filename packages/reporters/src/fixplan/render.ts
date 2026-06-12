import {
  CATEGORY_META,
  Category,
  Finding,
  ReviewReport,
  SEVERITY_RANK,
} from '@pr-review-insight/core';

/**
 * The fix plan: a downloadable markdown document built for handing to an AI
 * assistant (Copilot Chat, Claude, Cursor) — or a human. New findings come
 * first with one ready-to-paste prompt each; pre-existing debt follows as
 * per-category batches. No 65k budget here: it's an artifact, not a comment.
 */
const CATEGORY_ORDER: Category[] = [
  'security',
  'pentest',
  'deps',
  'complexity',
  'duplication',
  'dead-code',
  'architecture',
  'a11y',
  'smell',
];

function where(f: Finding): string {
  return f.range
    ? f.range.start === f.range.end
      ? `${f.file} (line ${f.range.start})`
      : `${f.file} (lines ${f.range.start}–${f.range.end})`
    : f.file;
}

function sortBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.file.localeCompare(b.file) ||
      (a.range?.start ?? 0) - (b.range?.start ?? 0)
  );
}

/**
 * One paste-ready prompt for an AI assistant (Copilot Chat, Claude, Cursor).
 * Shared between the fix-plan artifact and the PR comment's per-finding
 * "fix with AI" blocks.
 */
export function buildFixPrompt(f: Finding): string {
  const lines = [
    `Fix the following issue in \`${f.file}\`${
      f.range ? ` (lines ${f.range.start}–${f.range.end})` : ''
    }:`,
    `Rule ${f.ruleId} (${f.severity}${f.owasp ? `, ${f.owasp}` : ''}): ${f.message}`,
    ...(f.detail ? [`Context: ${f.detail}`] : []),
    'Constraints: keep behavior identical, change only what the fix requires,',
    'follow the surrounding code style, and add or update tests when the fix is testable.',
  ];
  return ['```text', ...lines, '```'].join('\n');
}

function findingBlock(f: Finding, index: number): string {
  return [
    `### ${index}. \`${f.ruleId}\` — ${where(f)}`,
    '',
    `- **Severity:** ${f.severity}${f.owasp ? ` · **OWASP:** ${f.owasp}` : ''} · **Category:** ${
      CATEGORY_META[f.category].label
    }`,
    `- **Finding:** ${f.message}`,
    ...(f.detail ? [`- **Context:** ${f.detail}`] : []),
    '',
    '**Prompt for your AI assistant:**',
    '',
    buildFixPrompt(f),
  ].join('\n');
}

function categoryBatch(category: Category, findings: Finding[]): string {
  const meta = CATEGORY_META[category];
  const rows = sortBySeverity(findings).map(
    (f) => `| ${where(f)} | \`${f.ruleId}\` | ${f.severity} | ${f.message.replace(/\|/g, '\\|')} |`
  );
  const batchPrompt = [
    '```text',
    `Work through the ${meta.label.toLowerCase()} issues listed below one file at a time.`,
    'For each: apply the smallest safe fix, keep behavior identical, and stop to run the',
    'tests after each file before moving on.',
    '',
    ...sortBySeverity(findings).map((f) => `- ${where(f)} — ${f.ruleId}: ${f.message}`),
    '```',
  ].join('\n');
  return [
    `### ${meta.emoji} ${meta.label} (${findings.length})`,
    '',
    '| Where | Rule | Severity | Finding |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '<details>',
    '<summary>Batch prompt for your AI assistant</summary>',
    '',
    batchPrompt,
    '',
    '</details>',
  ].join('\n');
}

export function renderFixPlan(report: ReviewReport): string {
  const findings = report.findings ?? [];
  const fresh = sortBySeverity(findings.filter((f) => f.isNew));
  const existing = findings.filter((f) => !f.isNew);

  const parts: string[] = [
    '# Fix plan — PR Review Insight',
    '',
    [
      report.pr ? `PR #${report.pr.number}` : null,
      `state: ${report.state}`,
      report.policy ? `policy: ${report.policy.description}` : null,
      `generated: ${report.generatedAt}`,
    ]
      .filter(Boolean)
      .join(' · '),
    '',
    '> **How to use:** paste a prompt block into Copilot Chat (or any AI assistant)',
    '> with the named file open. Fix the *new* findings first — they are what the',
    '> quality gate judges. Pre-existing items are debt you can pay down any time.',
  ];

  parts.push('', `## 🆕 Introduced by this PR (${fresh.length}) — fix these first`, '');
  if (fresh.length === 0) {
    parts.push(
      report.baseline
        ? '_Nothing — this PR introduces no new findings._ 🎉'
        : '_No baseline available — new-vs-pre-existing attribution was not possible._'
    );
  } else {
    fresh.forEach((f, i) => parts.push(findingBlock(f, i + 1), ''));
  }

  parts.push('', `## 🧹 Pre-existing debt (${existing.length}) — suggested cleanups`, '');
  if (existing.length === 0) {
    parts.push('_None. The codebase is clean._');
  } else {
    parts.push(
      "_These do **not** block the merge. Pick a category, pay it down, and the baseline's_",
      '_Δ arrows turn green on the next run._',
      ''
    );
    for (const category of CATEGORY_ORDER) {
      const inCategory = existing.filter((f) => f.category === category);
      if (inCategory.length > 0) parts.push(categoryBatch(category, inCategory), '');
    }
  }

  parts.push('', '---', '', '<sub>Generated by **PR Review Insight** · schema v1</sub>', '');
  return parts.join('\n');
}
