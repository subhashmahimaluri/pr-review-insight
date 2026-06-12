import { Finding, ReviewReport, Severity } from '@pr-review-insight/core';

/**
 * SARIF 2.1.0 (D7) — findings appear in GitHub's code-scanning tab for free
 * via `github/codeql-action/upload-sarif`.
 */
const SARIF_LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = {
  critical: 'error',
  major: 'warning',
  minor: 'note',
  info: 'note',
};

type SarifRule = {
  id: string;
  shortDescription: { text: string };
  properties?: { tags?: string[] };
};

export function renderSarif(report: ReviewReport): object {
  const findings = report.findings ?? [];
  const rules = new Map<string, SarifRule>();
  for (const finding of findings) {
    if (rules.has(finding.ruleId)) continue;
    rules.set(finding.ruleId, {
      id: finding.ruleId,
      shortDescription: { text: finding.ruleId },
      properties: {
        tags: [finding.category, ...(finding.owasp ? [`owasp/${finding.owasp}`] : [])],
      },
    });
  }
  const ruleIndex = new Map([...rules.keys()].map((id, i) => [id, i]));

  const results = findings.map((finding: Finding) => ({
    ruleId: finding.ruleId,
    ruleIndex: ruleIndex.get(finding.ruleId),
    level: SARIF_LEVEL[finding.severity],
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.file, uriBaseId: '%SRCROOT%' },
          ...(finding.range
            ? { region: { startLine: finding.range.start, endLine: finding.range.end } }
            : {}),
        },
      },
    ],
    partialFingerprints: { primaryLocationLineHash: finding.fingerprint },
    ...(finding.isNew !== undefined ? { properties: { isNew: finding.isNew } } : {}),
  }));

  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'pr-review-insight',
            informationUri: 'https://github.com/subhashmahimaluri/pr-review-insight',
            rules: [...rules.values()],
          },
        },
        results,
      },
    ],
  };
}
