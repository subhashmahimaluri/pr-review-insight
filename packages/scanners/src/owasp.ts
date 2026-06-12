/**
 * OWASP Top-10 2021 taxonomy layer — every security-family finding is tagged
 * with its category so the report can group by it. Not a scanner.
 */
export const OWASP = {
  A01: 'A01:2021-Broken Access Control',
  A02: 'A02:2021-Cryptographic Failures',
  A03: 'A03:2021-Injection',
  A04: 'A04:2021-Insecure Design',
  A05: 'A05:2021-Security Misconfiguration',
  A06: 'A06:2021-Vulnerable and Outdated Components',
  A07: 'A07:2021-Identification and Authentication Failures',
  A08: 'A08:2021-Software and Data Integrity Failures',
  A09: 'A09:2021-Security Logging and Monitoring Failures',
  A10: 'A10:2021-Server-Side Request Forgery',
} as const;

/** eslint security-family rule → OWASP tag */
const RULE_OWASP: Record<string, string> = {
  'security/detect-eval-with-expression': OWASP.A03,
  'security/detect-child-process': OWASP.A03,
  'security/detect-non-literal-require': OWASP.A03,
  'security/detect-non-literal-fs-filename': OWASP.A01,
  'security/detect-non-literal-regexp': OWASP.A03,
  'security/detect-unsafe-regex': OWASP.A05,
  'security/detect-buffer-noassert': OWASP.A05,
  'security/detect-disable-mustache-escape': OWASP.A03,
  'security/detect-no-csrf-before-method-override': OWASP.A01,
  'security/detect-object-injection': OWASP.A03,
  'security/detect-possible-timing-attacks': OWASP.A02,
  'security/detect-pseudoRandomBytes': OWASP.A02,
  'security/detect-new-buffer': OWASP.A05,
  'security/detect-bidi-characters': OWASP.A08,
  'no-unsanitized/method': OWASP.A03,
  'no-unsanitized/property': OWASP.A03,
};

export function owaspForRule(ruleId: string): string | undefined {
  if (RULE_OWASP[ruleId]) return RULE_OWASP[ruleId];
  if (ruleId.startsWith('secretlint/')) return OWASP.A07;
  if (ruleId.startsWith('audit/')) return OWASP.A06;
  if (ruleId.startsWith('security/')) return OWASP.A05;
  if (ruleId.startsWith('no-unsanitized/')) return OWASP.A03;
  return undefined;
}
