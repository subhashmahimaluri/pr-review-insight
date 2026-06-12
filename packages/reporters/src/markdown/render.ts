import {
  CATEGORY_META,
  Category,
  CategorySummary,
  Finding,
  ReportState,
  ReviewReport,
  SEVERITY_RANK,
  Severity,
} from '@pr-review-insight/core';
import { buildFixPrompt } from '../fixplan/render';

export const COMMENT_MARKER = '<!-- pr-review-insight -->';

const DEFAULT_MAX_CHARS = 65000;
const ROW_CAP_WHEN_TRUNCATING = 25;
const ALL_FINDINGS_FILE_CAP = 100;

export const HEADERS: Record<ReportState, string> = {
  passed: '✅ Code review gate passed',
  'gate-failed': '❌ Code review gate failed `blocks merge`',
  'new-findings': '⚠️ New findings introduced',
  improved: '💚 Debt paid down — fewer findings than base',
  'no-change': '✅ Code review — no change in findings',
  'no-baseline': 'ℹ️ Code review baseline recorded',
  'invalid-data': '⚠️ Code review input error',
  'scan-error': '🛑 Scan error — report in failure mode',
};

const SEVERITY_CHIP: Record<Severity, string> = {
  critical: '🟥 critical',
  major: '🟧 major',
  minor: '🟨 minor',
  info: '⬜ info',
};

/** spoiler order: most decision-relevant first */
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

export type RenderMarkdownOptions = {
  maxChars?: number;
  /** committed band SVG URLs (light/dark) — rendered via <picture> */
  bandImages?: { light: string; dark: string };
  /** what the band actually shows — never headline base data as the PR's */
  bandCaption?: string;
  /** the run's artifacts page — renders a download link in the footer */
  artifactsUrl?: string;
};

type Section = {
  text: string;
  /** never dropped by the truncation ladder */
  protected?: boolean;
  /** first to drop when truncating */
  fullTable?: boolean;
  /** category spoilers get their rows capped at step 2 */
  category?: Category;
};

function blobUrl(report: ReviewReport, path: string): string | null {
  if (!report.repo || !report.pr?.headSha) return null;
  return `https://github.com/${report.repo.owner}/${report.repo.repo}/blob/${report.pr.headSha}/${path}`;
}

function fileLink(report: ReviewReport, finding: Pick<Finding, 'file' | 'range'>): string {
  const label = finding.range
    ? finding.range.start === finding.range.end
      ? `${finding.file}:${finding.range.start}`
      : `${finding.file}:${finding.range.start}–${finding.range.end}`
    : finding.file;
  const url = blobUrl(report, finding.file);
  if (!url) return `\`${label}\``;
  const anchor = finding.range ? `#L${finding.range.start}-L${finding.range.end}` : '';
  return `[\`${label}\`](${url}${anchor})`;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function severityCell(finding: Finding): string {
  return finding.isNew
    ? `**${SEVERITY_CHIP[finding.severity]}** 🆕`
    : SEVERITY_CHIP[finding.severity];
}

function messageCell(finding: Finding): string {
  const text = escapeCell(finding.message);
  return finding.isNew ? `**${text}**` : text;
}

function sortFindings(findings: Finding[]): Finding[] {
  // new first, then by severity desc, then stable by file
  return [...findings].sort(
    (a, b) =>
      Number(b.isNew ?? false) - Number(a.isNew ?? false) ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.file.localeCompare(b.file) ||
      (a.range?.start ?? 0) - (b.range?.start ?? 0)
  );
}

/* ---------------------------------- header --------------------------------- */

function headerBlock(report: ReviewReport): string {
  const lines = [`## ${HEADERS[report.state]}`];
  const meta: string[] = [];
  if (report.policy?.description) meta.push(`policy: ${report.policy.description}`);
  if (report.pr) meta.push(`PR #${report.pr.number}`);
  if (meta.length > 0) lines.push('', `_${meta.join(' · ')}_`);
  return lines.join('\n');
}

function cautionBlock(report: ReviewReport): string {
  const newCriticals = (report.findings ?? []).filter((f) => f.isNew && f.severity === 'critical');
  if (report.state !== 'gate-failed' || newCriticals.length === 0) return '';
  const worst = newCriticals[0];
  return [
    '> [!CAUTION]',
    `> **${newCriticals.length} new critical finding${newCriticals.length === 1 ? '' : 's'} block${
      newCriticals.length === 1 ? 's' : ''
    } this merge** — worst: \`${worst.ruleId}\` in \`${worst.file}\`${
      worst.owasp ? ` (${worst.owasp})` : ''
    }.`,
  ].join('\n');
}

function violationsBlock(report: ReviewReport): string {
  const violations = report.policy?.violations ?? [];
  if (violations.length === 0) return '';
  return ['**Gate violations**', '', ...violations.map((v) => `- ❌ ${v.detail}`)].join('\n');
}

function scannerErrorsBlock(report: ReviewReport): string {
  const errors = report.errors ?? [];
  if (errors.length === 0) return '';
  const lines = [
    '> [!WARNING]',
    `> ${errors.length} scanner${errors.length === 1 ? '' : 's'} did not finish — results may be partial.`,
    ...errors.map((e) => `> - \`${e.scanner}\`: ${escapeCell(e.message.slice(0, 200))}`),
  ];
  return lines.join('\n');
}

function bandSection(report: ReviewReport, opts: RenderMarkdownOptions): string {
  if (!opts.bandImages) return '';
  const lines = [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${opts.bandImages.dark}">`,
    `  <img alt="findings per category: count, severity, delta vs base and trend" src="${opts.bandImages.light}">`,
    '</picture>',
  ];
  if (opts.bandCaption) lines.push('', `<sub>${opts.bandCaption}</sub>`);
  return lines.join('\n');
}

/** text fallback when no band image can be committed: a compact summary table */
function summaryTable(report: ReviewReport): string {
  const categories = (report.categories ?? []).filter((c) => c.total > 0);
  if (categories.length === 0) return '_No findings. Ship it._ 🎉';
  const ordered = CATEGORY_ORDER.map((cat) => categories.find((c) => c.category === cat)).filter(
    (c): c is CategorySummary => Boolean(c)
  );
  const rows = ordered.map((c) => {
    const meta = CATEGORY_META[c.category];
    const delta =
      c.delta === null
        ? '—'
        : c.delta === 0
          ? '±0'
          : c.delta > 0
            ? `▲${c.delta}`
            : `▼${Math.abs(c.delta)}`;
    const newCount = c.new === null ? '—' : c.new > 0 ? `**${c.new}** 🆕` : '0';
    return `| ${meta.emoji} ${meta.label} | ${c.total} | ${newCount} | ${delta} | ${
      c.worst ? SEVERITY_CHIP[c.worst] : '—'
    } |`;
  });
  return [
    '| Category | Total | New | Δ vs base | Worst |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows,
  ].join('\n');
}

/* ------------------------------ category spoilers ------------------------------ */

function spoilerSummaryLabel(summary: CategorySummary, extra?: string): string {
  const meta = CATEGORY_META[summary.category];
  const parts: string[] = [];
  if (summary.new !== null && summary.new > 0) parts.push(`${summary.new} new`);
  parts.push(`${summary.total} total`);
  if (extra) parts.push(extra);
  return `${meta.emoji} ${meta.label} (${parts.join(' · ')})`;
}

function findingsTable(report: ReviewReport, findings: Finding[], rowCap: number): string {
  const rows = sortFindings(findings).slice(0, rowCap);
  const lines = [
    '| Where | Rule | Severity | Finding |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (f) => `| ${fileLink(report, f)} | \`${f.ruleId}\` | ${severityCell(f)} | ${messageCell(f)} |`
    ),
  ];
  if (findings.length > rowCap) {
    lines.push(
      '',
      `_…and ${findings.length - rowCap} more — see the \`code-report.json\` artifact._`
    );
  }
  return lines.join('\n');
}

function securitySpoiler(
  report: ReviewReport,
  summary: CategorySummary,
  findings: Finding[],
  rowCap: number
): string {
  // grouped by OWASP category — the taxonomy layer made visible
  const groups = new Map<string, Finding[]>();
  for (const f of sortFindings(findings)) {
    const key = f.owasp ?? 'Uncategorized';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const blocks: string[] = [];
  let budget = rowCap;
  for (const [owasp, group] of groups) {
    if (budget <= 0) break;
    blocks.push(`**${owasp}**\n\n${findingsTable(report, group, budget)}`);
    budget -= group.length;
  }
  return spoiler(spoilerSummaryLabel(summary), blocks.join('\n\n'));
}

function duplicationSpoiler(
  report: ReviewReport,
  summary: CategorySummary,
  findings: Finding[],
  duplicationPercent: number | undefined,
  rowCap: number
): string {
  const basePct = report.stats?.baselineDuplicationPercent;
  const pct =
    duplicationPercent !== undefined
      ? `${duplicationPercent.toFixed(1)}%${basePct !== undefined ? ` vs ${basePct.toFixed(1)}% on base` : ''}`
      : undefined;
  const rows = sortFindings(findings).slice(0, rowCap);
  const lines = [
    '| Clone | Also at | Severity |',
    '| --- | --- | --- |',
    ...rows.map((f) => {
      const other = f.detail ? cloneLink(report, f.detail) : '—';
      return `| ${fileLink(report, f)} | ${other} | ${severityCell(f)} |`;
    }),
  ];
  if (findings.length > rowCap) {
    lines.push('', `_…and ${findings.length - rowCap} more clone pairs._`);
  }
  return spoiler(spoilerSummaryLabel(summary, pct && `${pct} duplicated`), lines.join('\n'));
}

/** detail format: `path#L10-L20` — link the counterpart side of the clone */
function cloneLink(report: ReviewReport, detail: string): string {
  const match = /^(.+)#L(\d+)-L(\d+)$/.exec(detail);
  if (!match) return `\`${escapeCell(detail)}\``;
  const [, file, start, end] = match;
  return fileLink(report, { file, range: { start: Number(start), end: Number(end) } });
}

function deadCodeSpoiler(
  report: ReviewReport,
  summary: CategorySummary,
  findings: Finding[],
  rowCap: number
): string {
  const rows = sortFindings(findings).slice(0, rowCap);
  const lines = [
    '| File | Symbol | Why |',
    '| --- | --- | --- |',
    ...rows.map(
      (f) =>
        `| ${fileLink(report, f)} | \`${escapeCell(f.detail ?? '—')}\` | ${messageCell(f)}${
          f.isNew ? ' 🆕' : ''
        } |`
    ),
  ];
  if (findings.length > rowCap) lines.push('', `_…and ${findings.length - rowCap} more._`);
  return spoiler(spoilerSummaryLabel(summary), lines.join('\n'));
}

function spoiler(summaryLabel: string, body: string): string {
  return ['<details>', `<summary>${summaryLabel}</summary>`, '', body, '', '</details>'].join('\n');
}

function categorySection(report: ReviewReport, category: Category, rowCap: number): string {
  const summary = (report.categories ?? []).find((c) => c.category === category);
  if (!summary || summary.total === 0) return '';
  const findings = (report.findings ?? []).filter((f) => f.category === category);
  switch (category) {
    case 'security':
      return securitySpoiler(report, summary, findings, rowCap);
    case 'duplication':
      return duplicationSpoiler(
        report,
        summary,
        findings,
        report.stats?.duplicationPercent,
        rowCap
      );
    case 'dead-code':
      return deadCodeSpoiler(report, summary, findings, rowCap);
    default:
      return spoiler(spoilerSummaryLabel(summary), findingsTable(report, findings, rowCap));
  }
}

function allFindingsByFile(report: ReviewReport): string {
  const findings = report.findings ?? [];
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(f);
  }
  if (byFile.size === 0 || byFile.size > ALL_FINDINGS_FILE_CAP) return '';
  const blocks: string[] = [];
  for (const [file, group] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const newCount = group.filter((f) => f.isNew).length;
    blocks.push(
      `**${fileLink(report, { file })}** — ${group.length} finding${group.length === 1 ? '' : 's'}${
        newCount > 0 ? ` (**${newCount} new**)` : ''
      }`,
      '',
      findingsTable(report, group, group.length),
      ''
    );
  }
  return spoiler(`📋 All findings by file (${byFile.size} files)`, blocks.join('\n'));
}

const INTRODUCED_ROW_CAP = 15;
const FIX_PROMPT_CAP = 10;

/**
 * Per-finding paste-ready prompts (roadmap 7.3) — copy into Copilot Chat /
 * any AI assistant with the file open. Nested + collapsed inside the
 * introduced section; no API, no integration surface.
 */
function fixPromptsBlock(report: ReviewReport, fresh: Finding[]): string {
  const prompts = sortFindings(fresh).slice(0, FIX_PROMPT_CAP);
  const blocks = prompts.map((f) =>
    [`**${fileLink(report, f)}** — \`${f.ruleId}\``, '', buildFixPrompt(f)].join('\n')
  );
  const more =
    fresh.length > FIX_PROMPT_CAP
      ? `\n\n_…and ${fresh.length - FIX_PROMPT_CAP} more in the fix-plan artifact._`
      : '';
  return [
    '<details>',
    `<summary>🤖 Fix with AI — copy a prompt per finding (${prompts.length})</summary>`,
    '',
    'Paste a block into Copilot Chat (or any AI assistant) with the file open.',
    '',
    blocks.join('\n\n'),
    more,
    '',
    '</details>',
  ].join('\n');
}

/**
 * The product's headline: what THIS PR introduced — the only thing the gate
 * judges. Open by default (still collapsible), protected through every
 * truncation step.
 */
function introducedSection(report: ReviewReport): string {
  const fresh = (report.findings ?? []).filter((f) => f.isNew);
  if (fresh.length === 0) return '';
  const table = findingsTable(report, fresh, INTRODUCED_ROW_CAP);
  return [
    '<details open>',
    `<summary><b>🆕 Introduced by this PR (${fresh.length}) — what the gate judges</b></summary>`,
    '',
    table,
    '',
    fixPromptsBlock(report, fresh),
    '',
    '</details>',
  ].join('\n');
}

/** when the PR adds nothing, say so — and frame the rest as suggestions */
function preExistingNote(report: ReviewReport): string {
  const total = report.totals?.total ?? 0;
  const fresh = report.totals?.new;
  if (fresh !== 0 || total === 0) return '';
  return (
    `💡 **This PR introduces no new findings.** The ${total} finding${total === 1 ? '' : 's'} ` +
    `below ${total === 1 ? 'is' : 'are'} pre-existing — shown as cleanup suggestions, ` +
    `they don't block this merge.`
  );
}

function footer(report: ReviewReport, opts: RenderMarkdownOptions): string {
  const parts = ['Reported by **PR Review Insight**', `schema v${report.schemaVersion}`];
  if (report.baseline) {
    const staleness =
      report.baseline.staleness && report.baseline.staleness > 0
        ? ` (${report.baseline.staleness} commit${report.baseline.staleness === 1 ? '' : 's'} stale)`
        : '';
    parts.push(`baseline \`${report.baseline.sha.slice(0, 7)}\`${staleness}`);
  }
  if (opts.artifactsUrl) {
    parts.push(`📥 [download the full report](${opts.artifactsUrl}) (HTML · JSON · fix plan)`);
  }
  return `<sub>${parts.join(' · ')}</sub>`;
}

/* --------------------------------- assemble --------------------------------- */

function assemble(parts: string[]): string {
  return parts.filter((p) => p.length > 0).join('\n\n');
}

function sectionsFor(report: ReviewReport, opts: RenderMarkdownOptions, rowCap: number): Section[] {
  const sections: Section[] = [];
  const caution = cautionBlock(report);
  if (caution) sections.push({ text: caution, protected: true });
  const violations = violationsBlock(report);
  if (violations) sections.push({ text: violations, protected: true });
  const errors = scannerErrorsBlock(report);
  if (errors) sections.push({ text: errors, protected: true });

  const band = bandSection(report, opts);
  if (band) sections.push({ text: band, protected: true });
  // graphs visible on top; the table fallback only when there is no image band
  if (!band) sections.push({ text: summaryTable(report), protected: true });

  const introduced = introducedSection(report);
  if (introduced) sections.push({ text: introduced, protected: true });
  const note = preExistingNote(report);
  if (note) sections.push({ text: note, protected: true });

  // categories that gained new findings come first — the reader's priority
  const newIn = new Set(
    (report.categories ?? []).filter((c) => (c.new ?? 0) > 0).map((c) => c.category)
  );
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => newIn.has(c)),
    ...CATEGORY_ORDER.filter((c) => !newIn.has(c)),
  ];
  for (const category of ordered) {
    const text = categorySection(report, category, rowCap);
    if (text) sections.push({ text, category });
  }

  const fullTable = allFindingsByFile(report);
  if (fullTable) sections.push({ text: fullTable, fullTable: true });

  return sections;
}

export function renderMarkdown(report: ReviewReport, opts: RenderMarkdownOptions = {}): string {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const header = headerBlock(report);

  // minimal single-block comment for the quiet state
  if (report.state === 'no-change') {
    const warnings = scannerErrorsBlock(report);
    return assemble([`${COMMENT_MARKER}\n${header}`, warnings, footer(report, opts)]);
  }

  const build = (sections: Section[]): string =>
    assemble([
      `${COMMENT_MARKER}\n${header}`,
      ...sections.map((s) => s.text),
      footer(report, opts),
    ]);

  // full output
  let sections = sectionsFor(report, opts, Number.MAX_SAFE_INTEGER);
  let output = build(sections);
  if (output.length <= maxChars) return output;

  // step 1 — drop the all-findings-by-file table
  sections = sections.filter((s) => !s.fullTable);
  output = build(sections);
  if (output.length <= maxChars) return output;

  // step 2 — cap category spoiler rows
  const capped = sectionsFor(report, opts, ROW_CAP_WHEN_TRUNCATING).filter((s) => !s.fullTable);
  output = build(capped);
  if (output.length <= maxChars) return output;

  // step 3 — protected only: verdict, alerts, band, introduced-by-this-PR
  return build(capped.filter((s) => s.protected));
}
