import { describe, expect, it } from 'vitest';
import { classifyEslintRule, mapEslintResults } from '@pr-review-insight/scanners';

describe('classifyEslintRule', () => {
  it('routes rules to the right category and severity', () => {
    expect(classifyEslintRule('sonarjs/cognitive-complexity')).toEqual({
      category: 'complexity',
      severity: 'major',
    });
    expect(classifyEslintRule('complexity')).toEqual({ category: 'complexity', severity: 'major' });
    expect(classifyEslintRule('security/detect-eval-with-expression')).toEqual({
      category: 'security',
      severity: 'critical',
    });
    expect(classifyEslintRule('security/detect-unsafe-regex')).toEqual({
      category: 'security',
      severity: 'major',
    });
    expect(classifyEslintRule('no-unsanitized/property')).toEqual({
      category: 'security',
      severity: 'major',
    });
    expect(classifyEslintRule('jsx-a11y/alt-text')).toEqual({
      category: 'a11y',
      severity: 'minor',
    });
    expect(classifyEslintRule('sonarjs/no-identical-expressions')).toEqual({
      category: 'smell',
      severity: 'major',
    });
    expect(classifyEslintRule('sonarjs/prefer-immediate-return')).toEqual({
      category: 'smell',
      severity: 'minor',
    });
  });
});

describe('mapEslintResults', () => {
  it('maps messages to findings with OWASP tags and relative paths', () => {
    const { findings, warnings } = mapEslintResults(
      [
        {
          filePath: '/repo/src/danger.ts',
          messages: [
            {
              ruleId: 'security/detect-eval-with-expression',
              message: 'eval with argument of type Identifier',
              line: 4,
              endLine: 4,
            },
            { ruleId: null, fatal: true, message: 'Parsing error: oops', line: 1 },
          ],
        },
      ],
      '/repo'
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: 'src/danger.ts',
      category: 'security',
      severity: 'critical',
      owasp: 'A03:2021-Injection',
      range: { start: 4, end: 4 },
    });
    expect(warnings[0]).toContain('could not parse src/danger.ts');
  });
});
