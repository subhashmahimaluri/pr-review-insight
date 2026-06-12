import { Finding, Severity, fingerprint } from '@pr-review-insight/core';
import { OWASP } from '../owasp';
import { ScanContext, ScannerAdapter, ScannerOutcome } from '../types';
import { stripAnsi } from '../exec';

type AuditVia = string | { title?: string; url?: string; severity?: string; range?: string };
type AuditVulnerability = {
  name?: string;
  severity?: string;
  range?: string;
  isDirect?: boolean;
  via?: AuditVia[];
  fixAvailable?: boolean | { name?: string; version?: string };
};
export type AuditJson = {
  vulnerabilities?: Record<string, AuditVulnerability>;
  error?: { summary?: string };
};

const SEVERITY_MAP: Record<string, Severity> = {
  info: 'info',
  low: 'minor',
  moderate: 'major',
  high: 'critical',
  critical: 'critical',
};

/** pure parser over `npm audit --json` output — unit-testable */
export function parseNpmAuditJson(raw: string): Finding[] {
  const data = JSON.parse(raw) as AuditJson;
  const findings: Finding[] = [];
  for (const [name, vuln] of Object.entries(data.vulnerabilities ?? {})) {
    const severity = SEVERITY_MAP[vuln.severity ?? ''] ?? 'major';
    const advisory = (vuln.via ?? []).find(
      (v): v is Exclude<AuditVia, string> => typeof v === 'object'
    );
    const title = advisory?.title ?? `Known vulnerability in \`${name}\``;
    const ruleId = 'audit/vulnerable-dependency';
    const fix =
      vuln.fixAvailable === true
        ? ' (fix available via `npm audit fix`)'
        : typeof vuln.fixAvailable === 'object'
          ? ` (fixed in ${vuln.fixAvailable.name}@${vuln.fixAvailable.version})`
          : '';
    findings.push({
      category: 'deps',
      ruleId,
      severity,
      owasp: OWASP.A06,
      file: 'package.json',
      message: `\`${name}\` ${vuln.range ?? ''}: ${title}${fix}`.replace(/\s+/g, ' ').trim(),
      detail: advisory?.url,
      fingerprint: fingerprint({ ruleId, file: 'package.json', message: `${name}:${title}` }),
    });
  }
  return findings;
}

export const npmAuditAdapter: ScannerAdapter = {
  name: 'npm-audit',
  category: 'deps',
  async run(ctx: ScanContext): Promise<ScannerOutcome> {
    const result = await ctx.exec('npm', ['audit', '--json'], { cwd: ctx.cwd });
    const stdout = stripAnsi(result.stdout).trim();
    if (!stdout.startsWith('{')) {
      // offline-tolerant: registry unreachable degrades to a warning, never a crash
      return {
        scanner: 'npm-audit',
        category: 'deps',
        findings: [],
        warnings: [
          `npm audit unavailable (exit ${result.code}) — dependency CVE check skipped this run`,
        ],
      };
    }
    const data = JSON.parse(stdout) as AuditJson;
    if (data.error) {
      return {
        scanner: 'npm-audit',
        category: 'deps',
        findings: [],
        warnings: [`npm audit unavailable: ${data.error.summary ?? 'unknown error'}`],
      };
    }
    return { scanner: 'npm-audit', category: 'deps', findings: parseNpmAuditJson(stdout) };
  },
};
