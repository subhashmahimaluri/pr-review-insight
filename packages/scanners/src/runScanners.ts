import { ScannerError, applyIgnores, markTouched } from '@pr-review-insight/core';
import { Finding } from '@pr-review-insight/core';
import { ScanContext, ScanResult, ScannerAdapter } from './types';
import { eslintAdapter } from './adapters/eslint';
import { knipAdapter } from './adapters/knip';
import { jscpdAdapter } from './adapters/jscpd';
import { secretlintAdapter } from './adapters/secretlint';
import { npmAuditAdapter } from './adapters/npmAudit';
import { madgeAdapter } from './adapters/madge';
import { pentestAdapter } from './adapters/pentest';
import { clearSnippetCache } from './snippet';

export const ALL_ADAPTERS: ScannerAdapter[] = [
  eslintAdapter,
  knipAdapter,
  jscpdAdapter,
  secretlintAdapter,
  npmAuditAdapter,
  madgeAdapter,
  pentestAdapter,
];

/**
 * Every adapter runs behind one interface; partial failure degrades to a
 * warning + ScannerError, never a crash (the report state machine decides
 * whether errors matter — `strict` gates that).
 */
export async function runScanners(
  ctx: ScanContext,
  adapters: ScannerAdapter[] = ALL_ADAPTERS
): Promise<ScanResult> {
  clearSnippetCache();
  const findings: Finding[] = [];
  const errors: ScannerError[] = [];
  const warnings: string[] = [];
  const stats: ScanResult['stats'] = {};

  const enabled = adapters.filter(
    (adapter) =>
      // eslint covers several categories and filters internally
      adapter.name === 'eslint' || ctx.config.categories[adapter.category] !== false
  );

  for (const adapter of enabled) {
    try {
      const outcome = await adapter.run(ctx);
      findings.push(...outcome.findings);
      warnings.push(...(outcome.warnings ?? []));
      if (outcome.stats?.duplicationPercent !== undefined) {
        stats.duplicationPercent = outcome.stats.duplicationPercent;
      }
      if (outcome.stats?.filesScanned !== undefined) {
        stats.filesScanned = outcome.stats.filesScanned;
      }
    } catch (error) {
      // capture the real reason, never just "exited with code 1"
      errors.push({
        scanner: adapter.name,
        message: (error as Error).message ?? String(error),
        fatal: false,
      });
    }
  }

  let filtered = applyIgnores(findings, ctx.config.ignore);
  if (ctx.changedFiles) {
    filtered = markTouched(filtered, new Set(ctx.changedFiles));
  }
  // deterministic order regardless of adapter completion order (D6)
  filtered.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (a.range?.start ?? 0) - (b.range?.start ?? 0) ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.fingerprint.localeCompare(b.fingerprint)
  );

  return { findings: filtered, stats, errors, warnings };
}
