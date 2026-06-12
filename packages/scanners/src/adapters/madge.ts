import { Finding, fingerprint } from '@pr-review-insight/core';
import { asArray } from '../coerce';
import { ScanContext, ScannerAdapter, ScannerOutcome } from '../types';
import { resolveTool, stripAnsi } from '../exec';

export const MADGE_NPX_SPEC = 'madge@8';

/**
 * Pure parser over `madge --circular --json` output (an array of cycles,
 * each an array of module paths) — unit-testable.
 */
export function parseMadgeCircularJson(raw: string): Finding[] {
  const parsed: unknown = JSON.parse(raw);
  const ruleId = 'madge/circular-dependency';
  // fuzz-hardened: keep only arrays of strings — anything else is not a cycle
  const cycles = asArray(parsed)
    .filter((c): c is unknown[] => Array.isArray(c))
    .map((c) => c.filter((m): m is string => typeof m === 'string'))
    .filter((c) => c.length > 0);
  return cycles.map((cycle) => {
    // normalize rotation so the same cycle always fingerprints identically
    const sorted = [...cycle].sort();
    const file = sorted[0] ?? 'unknown';
    return {
      category: 'architecture' as const,
      ruleId,
      severity: 'major' as const,
      file,
      message: `Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
      detail: `${cycle.length} modules in cycle`,
      fingerprint: fingerprint({ ruleId, file, message: sorted.join('|') }),
    };
  });
}

export const madgeAdapter: ScannerAdapter = {
  name: 'madge',
  category: 'architecture',
  async run(ctx: ScanContext): Promise<ScannerOutcome> {
    const tool = resolveTool(ctx.cwd, 'madge', MADGE_NPX_SPEC);
    const result = await ctx.exec(
      tool.command,
      [...tool.prefixArgs, '--circular', '--json', '--extensions', 'js,jsx,ts,tsx', '.'],
      { cwd: ctx.cwd }
    );
    const stdout = stripAnsi(result.stdout).trim();
    if (!stdout.startsWith('[')) {
      throw new Error(
        `madge produced no JSON (exit ${result.code}): ${stripAnsi(result.stderr).slice(0, 400)}`
      );
    }
    return {
      scanner: 'madge',
      category: 'architecture',
      findings: parseMadgeCircularJson(stdout),
    };
  },
};
