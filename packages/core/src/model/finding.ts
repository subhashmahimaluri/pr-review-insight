export const CATEGORIES = [
  'dead-code',
  'duplication',
  'complexity',
  'smell',
  'security',
  'deps',
  'a11y',
  'pentest',
  'architecture',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ['info', 'minor', 'major', 'critical'] as const;

export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

export const CATEGORY_META: Record<Category, { emoji: string; label: string }> = {
  'dead-code': { emoji: '🪦', label: 'Dead code' },
  duplication: { emoji: '👯', label: 'Duplication' },
  complexity: { emoji: '🌀', label: 'Complexity' },
  smell: { emoji: '🧹', label: 'Code smells' },
  security: { emoji: '🔐', label: 'Security & OWASP' },
  deps: { emoji: '📦', label: 'Dependencies' },
  a11y: { emoji: '♿', label: 'Accessibility' },
  pentest: { emoji: '🎯', label: 'Pentest checks' },
  architecture: { emoji: '🔄', label: 'Architecture' },
};

export type Finding = {
  category: Category;
  /** e.g. `sonarjs/cognitive-complexity`, `knip/unused-export` */
  ruleId: string;
  severity: Severity;
  /** OWASP Top-10 2021 tag, e.g. `A03:2021-Injection`, for security-family findings */
  owasp?: string;
  /** workspace-relative path, forward slashes */
  file: string;
  range?: { start: number; end: number };
  message: string;
  /** stable hash: ruleId + file + normalized code context — survives unrelated edits */
  fingerprint: string;
  /** not present in the baseline → introduced by this PR */
  isNew?: boolean;
  /** file is part of the PR diff */
  touched?: boolean;
  /** short extra context, e.g. the duplicated counterpart location or the unused symbol */
  detail?: string;
};

export function worstSeverity(findings: Pick<Finding, 'severity'>[]): Severity | null {
  let worst: Severity | null = null;
  for (const f of findings) {
    if (worst === null || SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst]) worst = f.severity;
  }
  return worst;
}

export function countBySeverity(findings: Pick<Finding, 'severity'>[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { info: 0, minor: 0, major: 0, critical: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}
