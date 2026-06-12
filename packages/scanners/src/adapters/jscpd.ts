import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Finding, fingerprint } from '@pr-review-insight/core';
import { asArray, asFiniteNumber, isObject } from '../coerce';
import { relativize } from '../snippet';
import { ScanContext, ScannerAdapter, ScannerOutcome } from '../types';
import { resolveTool, stripAnsi } from '../exec';

export const JSCPD_NPX_SPEC = 'jscpd@4';

type JscpdSide = {
  name: string;
  start: number;
  end: number;
};
type JscpdDuplicate = {
  format?: string;
  lines?: number;
  firstFile: JscpdSide;
  secondFile: JscpdSide;
  fragment?: string;
};
export type JscpdReport = {
  statistics?: { total?: { percentage?: number } };
  duplicates?: JscpdDuplicate[];
};

/** is this a usable clone side? (fuzz-hardening: name + numeric range required) */
function isSide(value: unknown): value is JscpdSide {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    typeof value.start === 'number' &&
    typeof value.end === 'number'
  );
}

/** pure parser over jscpd-report.json — fuzz-hardened, unit-testable */
export function parseJscpdReport(
  report: JscpdReport,
  cwd: string
): { findings: Finding[]; duplicationPercent?: number } {
  const findings: Finding[] = [];
  const duplicates = isObject(report) ? asArray(report.duplicates) : [];
  for (const rawDup of duplicates) {
    if (!isObject(rawDup) || !isSide(rawDup.firstFile) || !isSide(rawDup.secondFile)) continue;
    const dup = rawDup as unknown as JscpdDuplicate;
    const fileA = relativize(cwd, dup.firstFile.name);
    const fileB = relativize(cwd, dup.secondFile.name);
    const lines =
      asFiniteNumber(dup.lines) ?? Math.max(1, dup.firstFile.end - dup.firstFile.start + 1);
    const ruleId = 'jscpd/duplication';
    findings.push({
      category: 'duplication',
      ruleId,
      severity: lines >= 50 ? 'major' : 'minor',
      file: fileA,
      range: { start: dup.firstFile.start, end: dup.firstFile.end },
      message: `${lines} duplicated lines, also at ${fileB}:${dup.secondFile.start}–${dup.secondFile.end}`,
      detail: `${fileB}#L${dup.secondFile.start}-L${dup.secondFile.end}`,
      fingerprint: fingerprint({
        ruleId,
        file: fileA,
        // the clone pair identifies the duplication, not its line numbers
        snippet: dup.fragment,
        message: `${fileA}|${fileB}`,
      }),
    });
  }
  return {
    findings,
    duplicationPercent: isObject(report)
      ? asFiniteNumber(
          (isObject(report.statistics) && isObject(report.statistics.total)
            ? report.statistics.total
            : {}
          ).percentage
        )
      : undefined,
  };
}

export const jscpdAdapter: ScannerAdapter = {
  name: 'jscpd',
  category: 'duplication',
  async run(ctx: ScanContext): Promise<ScannerOutcome> {
    const outDir = mkdtempSync(join(tmpdir(), 'pri-jscpd-'));
    try {
      const tool = resolveTool(ctx.cwd, 'jscpd', JSCPD_NPX_SPEC);
      const ignore = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        ...ctx.config.ignore,
      ].join(',');
      const result = await ctx.exec(
        tool.command,
        [
          ...tool.prefixArgs,
          ctx.cwd,
          '--reporters',
          'json',
          '--output',
          outDir,
          '--ignore',
          ignore,
          '--silent',
        ],
        { cwd: ctx.cwd }
      );
      let report: JscpdReport;
      try {
        report = JSON.parse(readFileSync(join(outDir, 'jscpd-report.json'), 'utf8'));
      } catch {
        throw new Error(
          `jscpd produced no report (exit ${result.code}): ${stripAnsi(result.stderr).slice(0, 400)}`
        );
      }
      const { findings, duplicationPercent } = parseJscpdReport(report, ctx.cwd);
      return {
        scanner: 'jscpd',
        category: 'duplication',
        findings,
        stats: { duplicationPercent },
      };
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  },
};
