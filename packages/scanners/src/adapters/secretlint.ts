import { Finding, fingerprint } from '@pr-review-insight/core';
import { asArray, asFiniteNumber, asString, isObject } from '../coerce';
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

/** pure parser over `secretlint --format json` output — fuzz-hardened, unit-testable */
export function parseSecretlintJson(raw: string, cwd: string): Finding[] {
  const parsed: unknown = JSON.parse(raw);
  const findings: Finding[] = [];
  for (const rawResult of asArray(parsed)) {
    if (!isObject(rawResult)) continue;
    const result = rawResult as SecretlintFileResult;
    const file = relativize(cwd, asString(result.filePath, 'unknown'));
    for (const rawMessage of asArray(result.messages)) {
      if (!isObject(rawMessage)) continue;
      const message = rawMessage as SecretlintMessage;
      const ruleId = `secretlint/${asString(message.ruleId, 'secret').replace(/^@secretlint\//, '')}`;
      const start = asFiniteNumber(message.loc?.start?.line);
      findings.push({
        category: 'security',
        ruleId,
        severity: 'critical',
        owasp: OWASP.A07,
        file,
        range: start ? { start, end: asFiniteNumber(message.loc?.end?.line) ?? start } : undefined,
        // never echo the secret itself into the report
        message: 'Possible committed secret detected',
        detail:
          asString(message.message).length > 120
            ? `${asString(message.message).slice(0, 117)}…`
            : asString(message.message),
        fingerprint: fingerprint({ ruleId, file, message: `${file}:${asString(message.ruleId)}` }),
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
