import { describe, expect, it } from 'vitest';
import {
  parseJscpdReport,
  parseKnipJson,
  parseMadgeCircularJson,
  parseNpmAuditJson,
  parseSecretlintJson,
} from '@pr-review-insight/scanners';

const CWD = '/work/repo';

describe('parseKnipJson', () => {
  const raw = JSON.stringify({
    files: ['/work/repo/src/orphan.ts'],
    issues: [
      {
        file: 'src/util.ts',
        exports: [{ name: 'unusedHelper', line: 12, col: 14 }],
        types: [{ name: 'UnusedType', line: 30 }],
        dependencies: [{ name: 'left-pad' }],
        devDependencies: ['old-tool'],
      },
    ],
  });

  it('maps files, exports, types and dependencies to dead-code findings', () => {
    const findings = parseKnipJson(raw, CWD);
    expect(findings.map((f) => f.ruleId)).toEqual([
      'knip/unused-file',
      'knip/unused-export',
      'knip/unused-type',
      'knip/unused-dependency',
      'knip/unused-dev-dependency',
    ]);
    expect(findings[0].file).toBe('src/orphan.ts');
    expect(findings[0].severity).toBe('major');
    expect(findings[1]).toMatchObject({
      file: 'src/util.ts',
      detail: 'unusedHelper',
      range: { start: 12, end: 12 },
      severity: 'minor',
    });
    expect(findings.every((f) => f.category === 'dead-code')).toBe(true);
  });

  it('fingerprints by symbol so line moves keep identity', () => {
    const moved = JSON.stringify({
      issues: [{ file: 'src/util.ts', exports: [{ name: 'unusedHelper', line: 99 }] }],
    });
    const a = parseKnipJson(raw, CWD).find((f) => f.ruleId === 'knip/unused-export')!;
    const b = parseKnipJson(moved, CWD)[0];
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});

describe('parseJscpdReport', () => {
  const report = {
    statistics: { total: { percentage: 3.14 } },
    duplicates: [
      {
        format: 'typescript',
        lines: 25,
        firstFile: { name: '/work/repo/src/a.ts', start: 10, end: 34 },
        secondFile: { name: '/work/repo/src/b.ts', start: 50, end: 74 },
        fragment: 'const x = compute();',
      },
    ],
  };

  it('maps clone pairs with both locations and surfaces the percentage', () => {
    const { findings, duplicationPercent } = parseJscpdReport(report, CWD);
    expect(duplicationPercent).toBe(3.14);
    expect(findings[0]).toMatchObject({
      category: 'duplication',
      file: 'src/a.ts',
      range: { start: 10, end: 34 },
      detail: 'src/b.ts#L50-L74',
      severity: 'minor',
    });
    expect(findings[0].message).toContain('src/b.ts:50–74');
  });

  it('escalates big clones to major', () => {
    const big = {
      duplicates: [
        {
          lines: 80,
          firstFile: { name: 'a.ts', start: 1, end: 80 },
          secondFile: { name: 'b.ts', start: 1, end: 80 },
        },
      ],
    };
    expect(parseJscpdReport(big, CWD).findings[0].severity).toBe('major');
  });
});

describe('parseNpmAuditJson', () => {
  const raw = JSON.stringify({
    vulnerabilities: {
      lodash: {
        name: 'lodash',
        severity: 'high',
        range: '<4.17.21',
        via: [{ title: 'Prototype Pollution', url: 'https://example.com/advisory' }],
        fixAvailable: true,
      },
      'minor-pkg': { name: 'minor-pkg', severity: 'low', via: ['lodash'] },
    },
  });

  it('maps severities and tags OWASP A06', () => {
    const findings = parseNpmAuditJson(raw);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      category: 'deps',
      severity: 'critical',
      owasp: 'A06:2021-Vulnerable and Outdated Components',
      file: 'package.json',
    });
    expect(findings[0].message).toContain('Prototype Pollution');
    expect(findings[0].message).toContain('fix available');
    expect(findings[1].severity).toBe('minor');
  });
});

describe('parseSecretlintJson', () => {
  const raw = JSON.stringify([
    {
      filePath: '/work/repo/.env.production',
      messages: [
        {
          ruleId: '@secretlint/secretlint-rule-aws',
          message: 'found AWS Secret Access Key: AKIA...',
          loc: { start: { line: 3 }, end: { line: 3 } },
        },
      ],
    },
  ]);

  it('reports critical findings without echoing the secret', () => {
    const findings = parseSecretlintJson(raw, CWD);
    expect(findings[0]).toMatchObject({
      category: 'security',
      severity: 'critical',
      owasp: 'A07:2021-Identification and Authentication Failures',
      file: '.env.production',
      range: { start: 3, end: 3 },
      message: 'Possible committed secret detected',
    });
  });
});

describe('parseMadgeCircularJson', () => {
  it('one finding per cycle, rotation-invariant fingerprint', () => {
    const a = parseMadgeCircularJson(JSON.stringify([['a.ts', 'b.ts', 'c.ts']]));
    const b = parseMadgeCircularJson(JSON.stringify([['b.ts', 'c.ts', 'a.ts']]));
    expect(a[0]).toMatchObject({ category: 'architecture', severity: 'major' });
    expect(a[0].message).toContain('a.ts → b.ts → c.ts → a.ts');
    expect(a[0].fingerprint).toBe(b[0].fingerprint);
  });
});
