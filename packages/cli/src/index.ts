import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  applyBaseline,
  buildReport,
  evaluateGates,
  loadConfig,
  reviewReportSchema,
  ReviewReport,
} from '@pr-review-insight/core';
import { realExec, runScanners } from '@pr-review-insight/scanners';
import {
  renderCopilotInstructions,
  renderFixPlan,
  renderHtml,
  renderMarkdown,
  renderSarif,
  upsertInstructions,
} from '@pr-review-insight/reporters';
import { BaselineEntry, emptyCounts } from '@pr-review-insight/history';

/** exit codes: 0 = pass, 1 = gate failed, 2 = crash/invalid */
const USAGE = `pri — PR Review Insight CLI

Usage:
  pri scan   [--dir <path>] [--report <file>] [--sarif <file>] [--html <file>]
             [--md <file>] [--fix-plan <file>] [--baseline <baseline.json>]
             [--base-dir <path>] [--strict]
  pri gate   [--report <file>]
  pri report [--report <file>] [--md <file>] [--html <file>]
  pri emit-instructions [--dir <path>] [--out <file>]

scan    run all scanners, write code-report.json (and optional SARIF/HTML/markdown)
gate    exit 1 if the report's gate failed — for CI pipelines (GitLab, Jenkins)
report  re-render markdown/HTML from an existing code-report.json
emit-instructions
        write/refresh the gate policy as AI guidance in
        .github/copilot-instructions.md (prevention, not cure)
`;

function parseArgs(argv: string[]): { command: string; flags: Map<string, string | boolean> } {
  const [command, ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, true);
    }
  }
  return { command: command ?? '', flags };
}

function str(flags: Map<string, string | boolean>, key: string, fallback: string): string {
  const value = flags.get(key);
  return typeof value === 'string' ? value : fallback;
}

async function scan(flags: Map<string, string | boolean>): Promise<number> {
  const cwd = resolve(str(flags, 'dir', process.cwd()));
  const reportFile = str(flags, 'report', 'code-report.json');

  const { config: loaded, source } = loadConfig(cwd);
  const config = flags.get('strict') === true ? { ...loaded, strict: true } : loaded;
  console.error(`pri: scanning ${cwd} (config: ${source})`);

  const scanResult = await runScanners({ cwd, config, exec: realExec });
  for (const err of scanResult.errors) console.error(`pri: scanner ${err.scanner}: ${err.message}`);
  for (const warn of scanResult.warnings) console.error(`pri: ${warn}`);

  // baseline: a recorded entry file, or a second scan of the base checkout
  // (dual-scan — e.g. the merge-base in a sibling directory)
  let entry: BaselineEntry | null = null;
  let baselineSource: 'file' | 'scan' = 'file';
  const baselineFile = flags.get('baseline');
  const baseDir = flags.get('base-dir');
  if (typeof baselineFile === 'string') {
    entry = JSON.parse(readFileSync(resolve(baselineFile), 'utf8')) as BaselineEntry;
  } else if (typeof baseDir === 'string') {
    baselineSource = 'scan';
    const basePath = resolve(baseDir);
    console.error(`pri: scanning base ${basePath} for the baseline (dual-scan)`);
    const baseScan = await runScanners({ cwd: basePath, config, exec: realExec });
    const counts = emptyCounts();
    for (const finding of baseScan.findings) counts[finding.category] += 1;
    entry = {
      sha: 'base-dir',
      fingerprints: baseScan.findings.map((f) => f.fingerprint),
      counts,
      stats: { duplicationPercent: baseScan.stats.duplicationPercent },
    };
  }

  const baseline = entry
    ? { sha: entry.sha, ref: entry.ref, timestamp: entry.timestamp, source: baselineSource }
    : null;

  const findings = applyBaseline(scanResult.findings, entry ? new Set(entry.fingerprints) : null);
  const policy = evaluateGates({
    findings,
    duplicationPercent: scanResult.stats.duplicationPercent,
    baselineDuplicationPercent: entry?.stats?.duplicationPercent,
    config,
    hasBaseline: baseline !== null,
  });
  const report = buildReport({
    findings,
    policy,
    baseline,
    baselineCounts: entry?.counts ?? null,
    scannerErrors: scanResult.errors,
    warnings: scanResult.warnings,
    stats: {
      ...scanResult.stats,
      baselineDuplicationPercent: entry?.stats?.duplicationPercent,
    },
    strict: config.strict,
    generatedAt: new Date().toISOString(),
  });

  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.error(`pri: ${findings.length} findings → ${reportFile} (state: ${report.state})`);

  const sarifFile = flags.get('sarif');
  if (typeof sarifFile === 'string') {
    writeFileSync(sarifFile, JSON.stringify(renderSarif(report), null, 2));
  }
  const htmlFile = flags.get('html');
  if (typeof htmlFile === 'string') writeFileSync(htmlFile, renderHtml(report));
  const mdFile = flags.get('md');
  if (typeof mdFile === 'string') writeFileSync(mdFile, renderMarkdown(report));
  const fixPlanFile = flags.get('fix-plan');
  if (typeof fixPlanFile === 'string') writeFileSync(fixPlanFile, renderFixPlan(report));

  return exitCodeFor(report);
}

function exitCodeFor(report: ReviewReport): number {
  if (
    report.state === 'gate-failed' ||
    report.state === 'invalid-data' ||
    report.state === 'scan-error'
  ) {
    return 1;
  }
  return 0;
}

function loadReport(flags: Map<string, string | boolean>): ReviewReport {
  const file = str(flags, 'report', 'code-report.json');
  const raw = JSON.parse(readFileSync(resolve(file), 'utf8'));
  return reviewReportSchema.parse(raw);
}

function gate(flags: Map<string, string | boolean>): number {
  const report = loadReport(flags);
  const violations = report.policy?.violations ?? [];
  if (exitCodeFor(report) !== 0) {
    console.error(`pri: gate FAILED (${report.state})`);
    for (const v of violations) console.error(`pri:   - ${v.detail}`);
    return 1;
  }
  console.error(`pri: gate passed (${report.state})`);
  return 0;
}

function reportCmd(flags: Map<string, string | boolean>): number {
  const report = loadReport(flags);
  const mdFile = flags.get('md');
  const htmlFile = flags.get('html');
  if (typeof htmlFile === 'string') writeFileSync(htmlFile, renderHtml(report));
  if (typeof mdFile === 'string') {
    writeFileSync(mdFile, renderMarkdown(report));
  } else if (typeof htmlFile !== 'string') {
    process.stdout.write(renderMarkdown(report) + '\n');
  }
  return 0;
}

function emitInstructions(flags: Map<string, string | boolean>): number {
  const cwd = resolve(str(flags, 'dir', process.cwd()));
  const out = resolve(cwd, str(flags, 'out', '.github/copilot-instructions.md'));
  const { config } = loadConfig(cwd);
  const block = renderCopilotInstructions(config);
  let existing: string | null = null;
  try {
    existing = readFileSync(out, 'utf8');
  } catch {
    // no existing file — we create it
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, upsertInstructions(existing, block));
  console.error(`pri: ${existing ? 'updated' : 'created'} ${out}`);
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  switch (command) {
    case 'scan':
      return scan(flags);
    case 'gate':
      return gate(flags);
    case 'report':
      return reportCmd(flags);
    case 'emit-instructions':
      return emitInstructions(flags);
    default:
      process.stderr.write(USAGE);
      return command === '' || command === 'help' || command === '--help' ? 0 : 2;
  }
}
