import { Finding, fingerprint } from '@pr-review-insight/core';
import { OWASP } from '../owasp';
import { relativize } from '../snippet';
import { ScanContext, ScannerAdapter, ScannerOutcome } from '../types';
import { resolveTool, stripAnsi } from '../exec';

export const SECRETLINT_NPX_SPEC = 'secretlint@9';

type SecretlintMessage = {
  ruleId?: string;
  message: string;
  loc?: { start?: { line?: number }; end?: { line?: number } };
};
type SecretlintFileResult = { filePath: string; messages: SecretlintMessage[] };

/** pure parser over `secretlint --format json` output — unit-testable */
export function parseSecretlintJson(raw: string, cwd: string): Finding[] {
  const results = JSON.parse(raw) as SecretlintFileResult[];
  const findings: Finding[] = [];
  for (const result of results) {
    const file = relativize(cwd, result.filePath);
    for (const message of result.messages ?? []) {
      const ruleId = `secretlint/${(message.ruleId ?? 'secret').replace(/^@secretlint\//, '')}`;
      const start = message.loc?.start?.line;
      findings.push({
        category: 'security',
        ruleId,
        severity: 'critical',
        owasp: OWASP.A07,
        file,
        range: start ? { start, end: message.loc?.end?.line ?? start } : undefined,
        // never echo the secret itself into the report
        message: 'Possible committed secret detected',
        detail:
          message.message.length > 120 ? `${message.message.slice(0, 117)}…` : message.message,
        fingerprint: fingerprint({ ruleId, file, message: `${file}:${message.ruleId}` }),
      });
    }
  }
  return findings;
}

export const secretlintAdapter: ScannerAdapter = {
  name: 'secretlint',
  category: 'security',
  async run(ctx: ScanContext): Promise<ScannerOutcome> {
    const tool = resolveTool(ctx.cwd, 'secretlint', SECRETLINT_NPX_SPEC);
    const result = await ctx.exec(
      tool.command,
      [...tool.prefixArgs, '--format', 'json', '--no-color', '**/*'],
      { cwd: ctx.cwd }
    );
    const stdout = stripAnsi(result.stdout).trim();
    // exit 1 just means "found something"; no JSON means it actually broke
    if (!stdout.startsWith('[') && !stdout.startsWith('{')) {
      // missing config is the common case — treat as "nothing to scan with"
      const stderr = stripAnsi(result.stderr);
      if (/secretlintrc/i.test(stderr)) {
        return {
          scanner: 'secretlint',
          category: 'security',
          findings: [],
          warnings: [
            'secretlint skipped: no .secretlintrc found — add @secretlint/secretlint-rule-preset-recommend to enable secret scanning',
          ],
        };
      }
      throw new Error(`secretlint produced no JSON (exit ${result.code}): ${stderr.slice(0, 400)}`);
    }
    return {
      scanner: 'secretlint',
      category: 'security',
      findings: parseSecretlintJson(stdout, ctx.cwd),
    };
  },
};
