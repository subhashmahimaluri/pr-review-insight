import { describe, expect, it } from 'vitest';
import { fingerprint, normalizeSnippet } from '@pr-review-insight/core';

describe('fingerprint', () => {
  it('is deterministic', () => {
    const input = { ruleId: 'r', file: 'f.ts', snippet: 'const a = 1;', message: 'm' };
    expect(fingerprint(input)).toBe(fingerprint({ ...input }));
  });

  it('survives unrelated edits — whitespace and indentation changes', () => {
    const a = fingerprint({ ruleId: 'r', file: 'f.ts', snippet: '  const a = 1;\n', message: 'm' });
    const b = fingerprint({
      ruleId: 'r',
      file: 'f.ts',
      snippet: '\tconst   a =  1;\n\n',
      message: 'm',
    });
    expect(a).toBe(b);
  });

  it('ignores the message when a snippet is available (line moves keep identity)', () => {
    const a = fingerprint({
      ruleId: 'r',
      file: 'f.ts',
      snippet: 'eval(x)',
      message: 'found at line 10',
    });
    const b = fingerprint({
      ruleId: 'r',
      file: 'f.ts',
      snippet: 'eval(x)',
      message: 'found at line 99',
    });
    expect(a).toBe(b);
  });

  it('differs across rule, file and context', () => {
    const base = { ruleId: 'r', file: 'f.ts', snippet: 's', message: 'm' };
    expect(fingerprint({ ...base, ruleId: 'other' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, file: 'g.ts' })).not.toBe(fingerprint(base));
    expect(fingerprint({ ...base, snippet: 'other' })).not.toBe(fingerprint(base));
  });

  it('falls back to the message when no snippet', () => {
    const a = fingerprint({ ruleId: 'r', file: 'f.ts', message: 'unused export `foo`' });
    const b = fingerprint({ ruleId: 'r', file: 'f.ts', message: 'unused export `bar`' });
    expect(a).not.toBe(b);
  });
});

describe('normalizeSnippet', () => {
  it('drops blank lines and collapses whitespace', () => {
    expect(normalizeSnippet('  a   b\n\n\tc  ')).toBe('a b\nc');
  });
});
