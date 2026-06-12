import { describe, expect, it } from 'vitest';
import { applyBaseline, applyIgnores, markTouched } from '@pr-review-insight/core';
import { makeFinding } from './helpers';

/**
 * Direct tests for diff attribution — the mutation run exposed this module
 * as 0%-covered (only exercised indirectly through the action/CLI).
 */
describe('applyBaseline', () => {
  const known = makeFinding({ file: 'src/old.ts' });
  const fresh = makeFinding({ file: 'src/new.ts', ruleId: 'security/x' });

  it('marks findings new exactly when their fingerprint is absent from the baseline', () => {
    const result = applyBaseline([known, fresh], new Set([known.fingerprint]));
    expect(result.find((f) => f.file === 'src/old.ts')?.isNew).toBe(false);
    expect(result.find((f) => f.file === 'src/new.ts')?.isNew).toBe(true);
  });

  it('clears isNew entirely without a baseline — first runs never blame', () => {
    const result = applyBaseline([{ ...known, isNew: true }], null);
    expect(result[0].isNew).toBeUndefined();
  });

  it('does not mutate its input', () => {
    const input = [known];
    applyBaseline(input, new Set());
    expect(input[0].isNew).toBeUndefined();
  });
});

describe('markTouched', () => {
  it('flags exactly the findings whose file is in the PR diff', () => {
    const a = makeFinding({ file: 'src/a.ts' });
    const b = makeFinding({ file: 'src/b.ts' });
    const result = markTouched([a, b], new Set(['src/a.ts']));
    expect(result.map((f) => f.touched)).toEqual([true, false]);
  });
});

describe('applyIgnores', () => {
  const findings = [
    makeFinding({ file: 'src/app.ts' }),
    makeFinding({ file: 'generated/api.ts' }),
    makeFinding({ file: '.env' }),
  ];

  it('drops findings matching any ignore glob', () => {
    const result = applyIgnores(findings, ['generated/**']);
    expect(result.map((f) => f.file)).toEqual(['src/app.ts', '.env']);
  });

  it('matches dotfiles (dot: true)', () => {
    const result = applyIgnores(findings, ['.env']);
    expect(result.map((f) => f.file)).toEqual(['src/app.ts', 'generated/api.ts']);
  });

  it('returns findings untouched with no globs', () => {
    expect(applyIgnores(findings, [])).toBe(findings);
  });
});
