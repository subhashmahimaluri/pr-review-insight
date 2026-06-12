import { Finding, fingerprint } from '@pr-review-insight/core';
import { asArray, asString, isObject } from '../coerce';
import { relativize } from '../snippet';
import { ScanContext, ScannerAdapter, ScannerOutcome } from '../types';
import { resolveTool, stripAnsi } from '../exec';

export const KNIP_NPX_SPEC = 'knip@5';

type KnipSymbol = { name: string; line?: number; col?: number };
type KnipIssue = {
  file: string;
  exports?: KnipSymbol[];
  types?: KnipSymbol[];
  dependencies?: (KnipSymbol | string)[];
  devDependencies?: (KnipSymbol | string)[];
  unlisted?: (KnipSymbol | string)[];
};
type KnipJson = { files?: string[]; issues?: KnipIssue[] };

function symbolName(s: KnipSymbol | string): string {
  return typeof s === 'string' ? s : asString(s.name, 'unknown');
}

/**
 * Normalize knip symbol entries to {name, line?} objects; drop anything that
 * is neither a name string nor a {name} object (fuzz-hardening).
 */
function normalizeSymbols(value: unknown): KnipSymbol[] {
  return asArray(value)
    .map((entry) => (typeof entry === 'string' ? { name: entry } : entry))
    .filter((entry): entry is KnipSymbol => isObject(entry) && typeof entry.name === 'string')
    .map((entry) => ({
      name: entry.name,
      ...(typeof entry.line === 'number' && Number.isFinite(entry.line)
        ? { line: entry.line }
        : {}),
    }));
}

function deadCodeFinding(
  file: string,
  ruleId: string,
  message: string,
  detail: string,
  severity: Finding['severity'],
  line?: number
): Finding {
  const range = line ? { start: line, end: line } : undefined;
  return {
    category: 'dead-code',
    ruleId,
    severity,
    file,
    range,
    message,
    detail,
    // dead-code identity is the symbol, not the source text around it
    fingerprint: fingerprint({ ruleId, file, message: `${file}:${detail}` }),
  };
}

/** pure parser over `knip --reporter json` output — fuzz-hardened, unit-testable */
export function parseKnipJson(raw: string, cwd: string): Finding[] {
  const parsed: unknown = JSON.parse(raw);
  const data = (isObject(parsed) ? parsed : {}) as KnipJson;
  const findings: Finding[] = [];

  for (const file of asArray(data.files)) {
    if (typeof file !== 'string') continue;
    const rel = relativize(cwd, file);
    findings.push(
      deadCodeFinding(rel, 'knip/unused-file', 'File is never imported', 'entire file', 'major')
    );
  }

  for (const rawIssue of asArray(data.issues)) {
    if (!isObject(rawIssue)) continue;
    const issue = rawIssue as unknown as KnipIssue;
    const rel = relativize(cwd, asString(issue.file, 'unknown'));
    for (const exp of normalizeSymbols(issue.exports)) {
      findings.push(
        deadCodeFinding(
          rel,
          'knip/unused-export',
          `Unused export \`${exp.name}\``,
          exp.name,
          'minor',
          exp.line
        )
      );
    }
    for (const type of normalizeSymbols(issue.types)) {
      findings.push(
        deadCodeFinding(
          rel,
          'knip/unused-type',
          `Unused exported type \`${type.name}\``,
          type.name,
          'minor',
          type.line
        )
      );
    }
    for (const dep of normalizeSymbols(issue.dependencies)) {
      findings.push(
        deadCodeFinding(
          rel,
          'knip/unused-dependency',
          `Unused dependency \`${symbolName(dep)}\``,
          symbolName(dep),
          'minor'
        )
      );
    }
    for (const dep of normalizeSymbols(issue.devDependencies)) {
      findings.push(
        deadCodeFinding(
          rel,
          'knip/unused-dev-dependency',
          `Unused devDependency \`${symbolName(dep)}\``,
          symbolName(dep),
          'info'
        )
      );
    }
  }

  return findings;
}

export const knipAdapter: ScannerAdapter = {
  name: 'knip',
  category: 'dead-code',
  async run(ctx: ScanContext): Promise<ScannerOutcome> {
    const tool = resolveTool(ctx.cwd, 'knip', KNIP_NPX_SPEC);
    const result = await ctx.exec(
      tool.command,
      [...tool.prefixArgs, '--reporter', 'json', '--no-exit-code', '--no-progress'],
      { cwd: ctx.cwd }
    );
    const stdout = stripAnsi(result.stdout).trim();
    if (!stdout.startsWith('{')) {
      throw new Error(
        `knip produced no JSON (exit ${result.code}): ${stripAnsi(result.stderr).slice(0, 400)}`
      );
    }
    return {
      scanner: 'knip',
      category: 'dead-code',
      findings: parseKnipJson(stdout, ctx.cwd),
    };
  },
};
