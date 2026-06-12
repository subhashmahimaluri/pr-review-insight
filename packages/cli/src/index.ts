import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyBaseline,
  buildReport,
  evaluateGates,
  loadConfig,
  reviewReportSchema,
  ReviewReport,
} from '@pr-review-insight/core';
import { realExec, runScanners } from '@pr-review-insight/scanners';
import { renderHtml, renderMarkdown, renderSarif } from '@pr-review-insight/reporters';
import { BaselineEntry } from '@pr-review-insight/history';

/** exit codes: 0 = pass, 1 = gate failed, 2 = crash/invalid */
const USAGE = `pri — PR Review Insight CLI

Usage:
  pri scan   [--dir <path>] [--report <file>] [--sarif <file>] [--html <file>]
             [--md <file>] [--baseline <baseline.json>] [--strict]
  pri gate   [--report <file>]
  pri report [--report <file>] [--md <file>] [--html <file>]

scan    run all scanners, write code-report.json (and optional SARIF/HTML/markdown)
gate    exit 1 if the report's gate failed — for CI pipelines (GitLab, Jenkins)
report  re-render markdown/HTML from an existing code-report.json
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

  let baseline = null;
  let baselineCounts = null;
  const baselineFile = flags.get('baseline');
  if (typeof baselineFile === 'string') {
    const entry = JSON.parse(readFileSync(resolve(baselineFile), 'utf8')) as BaselineEntry;
    baseline = {
      sha: entry.sha,
      ref: entry.ref,
      timestamp: entry.timestamp,
      source: 'file' as const,
    };
    baselineCounts = entry.counts ?? null;
  }

  const findings = applyBaseline(
    scanResult.findings,
    typeof baselineFile === 'string'
      ? new Set(
          (JSON.parse(readFileSync(resolve(baselineFile), 'utf8')) as BaselineEntry).fingerprints
        )
      : null
  );
  const policy = evaluateGates({
    findings,
    duplicationPercent: scanResult.stats.duplicationPercent,
    config,
    hasBaseline: baseline !== null,
  });
  const report = buildReport({
    findings,
    policy,
    baseline,
    baselineCounts,
    scannerErrors: scanResult.errors,
    warnings: scanResult.warnings,
    stats: scanResult.stats,
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

export async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  switch (command) {
    case 'scan':
      return scan(flags);
    case 'gate':
      return gate(flags);
    case 'report':
      return reportCmd(flags);
    default:
      process.stderr.write(USAGE);
      return command === '' || command === 'help' || command === '--help' ? 0 : 2;
  }
}
