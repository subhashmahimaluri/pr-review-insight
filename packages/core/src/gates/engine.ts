import { Finding, SEVERITIES, Severity, countBySeverity } from '../model/finding';
import { Config, SeverityLimits } from '../config/schema';

export type GateVerdict = 'pass' | 'warn' | 'fail';

export type GateViolation = {
  rule: 'new-findings' | 'total-findings' | 'duplication' | 'dead-code';
  severity?: Severity;
  limit: number;
  actual: number;
  detail: string;
};

export type GateResult = {
  verdict: GateVerdict;
  violations: GateViolation[];
  /** human policy line, e.g. `zero new critical · max 5 new major · max duplication 5%` */
  description: string;
};

export type GateInput = {
  findings: Finding[];
  /** project-wide duplication percentage from jscpd, when the scanner ran */
  duplicationPercent?: number;
  config: Config;
  /** without a baseline, `isNew` is unknowable — new-findings gates are skipped */
  hasBaseline: boolean;
};

function checkLimits(
  rule: 'new-findings' | 'total-findings',
  limits: SeverityLimits,
  counts: Record<Severity, number>,
  violations: GateViolation[]
): void {
  for (const severity of SEVERITIES) {
    const limit = limits[severity];
    if (limit === undefined) continue;
    const actual = counts[severity];
    if (actual > limit) {
      violations.push({
        rule,
        severity,
        limit,
        actual,
        detail:
          rule === 'new-findings'
            ? `${actual} new ${severity} finding(s) — limit ${limit}`
            : `${actual} total ${severity} finding(s) — limit ${limit}`,
      });
    }
  }
}

export function describePolicy(config: Config): string {
  const parts: string[] = [];
  const nf = config.gates.newFindings;
  // critical first — the policy line reads worst-to-best
  for (const severity of [...SEVERITIES].reverse()) {
    const limit = nf[severity];
    if (limit === undefined) continue;
    parts.push(limit === 0 ? `zero new ${severity}` : `max ${limit} new ${severity}`);
  }
  parts.push(`max duplication ${config.gates.duplication.maxPercent}%`);
  if (config.gates.deadCode === 'gate') parts.push('no new dead code');
  if (config.gates.totals) {
    for (const severity of SEVERITIES) {
      const limit = config.gates.totals[severity];
      if (limit !== undefined) parts.push(`max ${limit} total ${severity}`);
    }
  }
  return parts.join(' · ');
}

/**
 * A scanner that merely *finds things* never fails the job unless a gate says
 * so. Crashes are handled by the report state machine, not here.
 */
export function evaluateGates(input: GateInput): GateResult {
  const { findings, config } = input;
  const violations: GateViolation[] = [];

  // without a baseline `isNew` is unknowable — never blame, never warn
  const newFindings = input.hasBaseline ? findings.filter((f) => f.isNew) : [];
  if (input.hasBaseline) {
    checkLimits('new-findings', config.gates.newFindings, countBySeverity(newFindings), violations);
  }

  if (config.gates.totals) {
    checkLimits('total-findings', config.gates.totals, countBySeverity(findings), violations);
  }

  const maxDup = config.gates.duplication.maxPercent;
  if (input.duplicationPercent !== undefined && input.duplicationPercent > maxDup) {
    violations.push({
      rule: 'duplication',
      limit: maxDup,
      actual: input.duplicationPercent,
      detail: `duplication ${input.duplicationPercent.toFixed(1)}% — limit ${maxDup}%`,
    });
  }

  if (config.gates.deadCode === 'gate' && input.hasBaseline) {
    const newDead = newFindings.filter((f) => f.category === 'dead-code').length;
    if (newDead > 0) {
      violations.push({
        rule: 'dead-code',
        limit: 0,
        actual: newDead,
        detail: `${newDead} new dead-code finding(s) — dead code is gated`,
      });
    }
  }

  const verdict: GateVerdict =
    violations.length > 0 ? 'fail' : newFindings.length > 0 ? 'warn' : 'pass';

  return { verdict, violations, description: describePolicy(config) };
}
