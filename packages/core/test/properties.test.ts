import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_CONFIG,
  evaluateGates,
  fingerprint,
  normalizeSnippet,
  Finding,
  SEVERITIES,
  CATEGORIES,
} from '@pr-review-insight/core';

/**
 * Property-based tests (fast-check): invariants that must hold for ALL
 * inputs, not just the examples we thought of. See docs/test-strength-plan.md.
 */

const findingArb: fc.Arbitrary<Finding> = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  ruleId: fc.stringMatching(/^[a-z][a-z0-9/-]{0,30}$/),
  severity: fc.constantFrom(...SEVERITIES),
  file: fc.stringMatching(/^[a-z][a-z0-9/.]{0,40}$/),
  message: fc.string({ minLength: 1, maxLength: 80 }),
  fingerprint: fc.stringMatching(/^[0-9a-f]{16}$/),
  isNew: fc.boolean(),
});

describe('fingerprint properties', () => {
  it('is deterministic and 16-char hex for any input', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        (ruleId, file, snippet, message) => {
          const a = fingerprint({ ruleId, file, snippet, message });
          const b = fingerprint({ ruleId, file, snippet, message });
          expect(a).toBe(b);
          expect(a).toMatch(/^[0-9a-f]{16}$/);
        }
      )
    );
  });

  it('survives ANY whitespace mangling of the snippet', () => {
    // insert random extra spaces/tabs at token boundaries and blank lines —
    // the identity of a finding must not change
    const token = fc.stringMatching(/^[A-Za-z0-9(){}=+;.]{1,8}$/);
    fc.assert(
      fc.property(
        fc.array(token, { minLength: 1, maxLength: 20 }),
        fc.array(fc.constantFrom(' ', '  ', '\t', ' \t '), { minLength: 1, maxLength: 21 }),
        fc.nat({ max: 5 }),
        (tokens, gaps, blankLines) => {
          const clean = tokens.join(' ');
          const mangled =
            '\n'.repeat(blankLines) +
            tokens.map((t, i) => `${gaps[i % gaps.length]}${t}`).join(gaps[0]) +
            '\n'.repeat(blankLines);
          const base = { ruleId: 'r/x', file: 'f.ts', message: 'm' };
          expect(fingerprint({ ...base, snippet: mangled })).toBe(
            fingerprint({ ...base, snippet: clean })
          );
        }
      )
    );
  });

  it('normalizeSnippet is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeSnippet(normalizeSnippet(s))).toBe(normalizeSnippet(s));
      })
    );
  });

  it('different rule or file ⇒ different fingerprint (collision sanity)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,10}$/),
        fc.stringMatching(/^[a-z]{1,10}$/),
        (a, b) => {
          fc.pre(a !== b);
          const base = { file: 'f.ts', snippet: 'const x = 1;', message: 'm' };
          expect(fingerprint({ ...base, ruleId: a })).not.toBe(fingerprint({ ...base, ruleId: b }));
        }
      )
    );
  });
});

describe('gate engine properties', () => {
  it('MONOTONIC: adding a new critical can never make the default gate pass', () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 40 }), (findings) => {
        const critical: Finding = {
          category: 'security',
          ruleId: 'security/x',
          severity: 'critical',
          file: 'src/x.ts',
          message: 'boom',
          fingerprint: 'deadbeefdeadbeef',
          isNew: true,
        };
        const result = evaluateGates({
          findings: [...findings, critical],
          config: DEFAULT_CONFIG,
          hasBaseline: true,
        });
        expect(result.verdict).toBe('fail');
      })
    );
  });

  it('without a baseline the default gate NEVER fails on findings alone', () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 40 }), (findings) => {
        const result = evaluateGates({ findings, config: DEFAULT_CONFIG, hasBaseline: false });
        expect(result.verdict).toBe('pass');
      })
    );
  });

  it('pre-existing findings of any severity never produce violations by default', () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 40 }), (findings) => {
        const preExisting = findings.map((f) => ({ ...f, isNew: false }));
        const result = evaluateGates({
          findings: preExisting,
          config: DEFAULT_CONFIG,
          hasBaseline: true,
        });
        expect(result.violations).toHaveLength(0);
      })
    );
  });
});
