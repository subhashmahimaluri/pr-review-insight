import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { COMMENT_MARKER, renderMarkdown } from '@pr-review-insight/reporters';
import { CATEGORIES, SEVERITIES, Finding } from '@pr-review-insight/core';
import { makeReport } from './helpers';

/** bounded arbitrary findings — realistic field sizes, all categories/severities */
const findingArb: fc.Arbitrary<Finding> = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  ruleId: fc.stringMatching(/^[a-z][a-z0-9/-]{0,30}$/),
  severity: fc.constantFrom(...SEVERITIES),
  file: fc.stringMatching(/^src\/[a-z0-9/.]{1,30}\.ts$/),
  message: fc.string({ minLength: 1, maxLength: 80 }),
  fingerprint: fc.stringMatching(/^[0-9a-f]{16}$/),
  isNew: fc.boolean(),
});

describe('renderMarkdown properties', () => {
  it('NEVER exceeds the budget, for any findings and any budget ≥ 10k', () => {
    fc.assert(
      fc.property(
        fc.array(findingArb, { maxLength: 300 }),
        fc.integer({ min: 10_000, max: 70_000 }),
        (findings, maxChars) => {
          const report = makeReport({ findings });
          const md = renderMarkdown(report, { maxChars });
          expect(md.length).toBeLessThanOrEqual(maxChars);
        }
      ),
      { numRuns: 30 } // rendering is the expensive part; 30 random shapes is plenty
    );
  });

  it('the marker and verdict header survive every truncation step', () => {
    fc.assert(
      fc.property(
        fc.array(findingArb, { maxLength: 300 }),
        fc.integer({ min: 10_000, max: 70_000 }),
        (findings, maxChars) => {
          const md = renderMarkdown(makeReport({ findings }), { maxChars });
          expect(md.startsWith(COMMENT_MARKER)).toBe(true);
          expect(md).toContain('## ');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('is deterministic for any input (D6)', () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 60 }), (findings) => {
        const report = makeReport({ findings });
        expect(renderMarkdown(report)).toBe(renderMarkdown(report));
      }),
      { numRuns: 20 }
    );
  });
});
