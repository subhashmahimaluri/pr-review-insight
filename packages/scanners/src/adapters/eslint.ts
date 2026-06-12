import { Category, Finding, Severity, fingerprint } from '@pr-review-insight/core';
import { owaspForRule } from '../owasp';
import { relativize, snippetFor } from '../snippet';
import { ScanContext, ScannerAdapter, ScannerOutcome } from '../types';

export const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/vendor/**',
  '**/.git/**',
];

/** security rules whose hit is near-certainly exploitable */
const CRITICAL_SECURITY_RULES = new Set([
  'security/detect-eval-with-expression',
  'security/detect-child-process',
  'security/detect-non-literal-require',
]);

/** sonarjs rules that are likely bugs, not just smells */
const MAJOR_SONAR_RULES = new Set([
  'sonarjs/no-all-duplicated-branches',
  'sonarjs/no-element-overwrite',
  'sonarjs/no-identical-conditions',
  'sonarjs/no-identical-expressions',
  'sonarjs/no-one-iteration-loop',
  'sonarjs/no-use-of-empty-return-value',
  'sonarjs/no-ignored-return',
  'sonarjs/no-empty-collection',
]);

const COMPLEXITY_RULES = new Set([
  'complexity',
  'max-depth',
  'max-lines-per-function',
  'sonarjs/cognitive-complexity',
]);

export function classifyEslintRule(ruleId: string): { category: Category; severity: Severity } {
  if (COMPLEXITY_RULES.has(ruleId)) return { category: 'complexity', severity: 'major' };
  if (ruleId.startsWith('security/')) {
    return {
      category: 'security',
      severity: CRITICAL_SECURITY_RULES.has(ruleId) ? 'critical' : 'major',
    };
  }
  if (ruleId.startsWith('no-unsanitized/')) return { category: 'security', severity: 'major' };
  if (ruleId.startsWith('jsx-a11y/')) return { category: 'a11y', severity: 'minor' };
  if (ruleId.startsWith('sonarjs/')) {
    return { category: 'smell', severity: MAJOR_SONAR_RULES.has(ruleId) ? 'major' : 'minor' };
  }
  return { category: 'smell', severity: 'minor' };
}

type EslintMessage = {
  ruleId: string | null;
  message: string;
  line?: number;
  endLine?: number;
  fatal?: boolean;
};

type EslintFileResult = { filePath: string; messages: EslintMessage[] };

/** pure mapping from ESLint JSON results to findings — unit-testable */
export function mapEslintResults(
  results: EslintFileResult[],
  cwd: string
): {
  findings: Finding[];
  warnings: string[];
} {
  const findings: Finding[] = [];
  const warnings: string[] = [];
  for (const result of results) {
    const file = relativize(cwd, result.filePath);
    for (const message of result.messages) {
      if (message.fatal || !message.ruleId) {
        if (message.fatal) warnings.push(`eslint could not parse ${file}: ${message.message}`);
        continue;
      }
      const { category, severity } = classifyEslintRule(message.ruleId);
      const range = message.line
        ? { start: message.line, end: message.endLine ?? message.line }
        : undefined;
      findings.push({
        category,
        ruleId: message.ruleId,
        severity,
        owasp: category === 'security' ? owaspForRule(message.ruleId) : undefined,
        file,
        range,
        message: message.message,
        fingerprint: fingerprint({
          ruleId: message.ruleId,
          file,
          snippet: snippetFor(cwd, file, range),
          message: message.message,
        }),
      });
    }
  }
  return { findings, warnings };
}

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
function buildOverrideConfig(ctx: ScanContext): unknown[] {
  const sonarjs = require('eslint-plugin-sonarjs');
  const security = require('eslint-plugin-security');
  const noUnsanitized = require('eslint-plugin-no-unsanitized');
  const jsxA11y = require('eslint-plugin-jsx-a11y');
  const tsParser = require('@typescript-eslint/parser');

  const sonarRules = (sonarjs.configs?.recommended?.rules ?? {}) as Record<string, unknown>;
  const securityRules = (security.configs?.recommended?.rules ?? {}) as Record<string, unknown>;
  const a11yRules = (jsxA11y.flatConfigs?.recommended?.rules ??
    jsxA11y.configs?.recommended?.rules ??
    {}) as Record<string, unknown>;

  const { maxCognitive, maxCyclomatic } = ctx.config.gates.complexity;

  return [
    { ignores: [...DEFAULT_IGNORES, ...ctx.config.ignore] },
    {
      files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
      languageOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: {
        // plugin objects passed directly — no dynamic resolution, ncc-safe
        sonarjs,
        security,
        'no-unsanitized': noUnsanitized,
        'jsx-a11y': jsxA11y,
      },
      rules: {
        ...sonarRules,
        ...securityRules,
        ...(ctx.config.categories['a11y'] === false ? {} : a11yRules),
        complexity: ['warn', maxCyclomatic],
        'max-depth': ['warn', 5],
        'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
        'sonarjs/cognitive-complexity': ['warn', maxCognitive],
        'no-unsanitized/method': 'warn',
        'no-unsanitized/property': 'warn',
      },
    },
  ];
}

export const eslintAdapter: ScannerAdapter = {
  name: 'eslint',
  category: 'smell',
  async run(ctx: ScanContext): Promise<ScannerOutcome> {
    const { ESLint } = require('eslint');
    const eslint = new ESLint({
      cwd: ctx.cwd,
      overrideConfigFile: true,
      overrideConfig: buildOverrideConfig(ctx) as any,
      errorOnUnmatchedPattern: false,
    });
    // always repo-wide: the baseline fingerprint diff needs the full picture
    // (D3); `changedFiles` only drives the `touched` flag downstream
    const results: EslintFileResult[] = await eslint.lintFiles(['**/*.{js,jsx,mjs,cjs,ts,tsx}']);
    const { findings, warnings } = mapEslintResults(results, ctx.cwd);
    const enabled = findings.filter((f) => ctx.config.categories[f.category] !== false);
    return {
      scanner: 'eslint',
      category: 'smell',
      findings: enabled,
      stats: { filesScanned: results.length },
      warnings,
    };
  },
};
