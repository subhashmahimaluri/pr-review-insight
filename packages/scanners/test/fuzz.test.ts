import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  parseJscpdReport,
  parseKnipJson,
  parseMadgeCircularJson,
  parseNpmAuditJson,
  parseSecretlintJson,
  scanFileForPentest,
} from '@pr-review-insight/scanners';

/**
 * Fuzzing: we ingest five external tools' JSON — any of them can emit shapes
 * we never saw (version bumps, errors mid-stream, locale weirdness). The
 * contract for every parser: for ANY valid-JSON input it either returns a
 * findings array or throws a clean Error — it must NEVER crash deep inside
 * (e.g. `hash.update(undefined)`), because the orchestrator's try/catch turns
 * clean throws into a degraded warning, while a crash with a confusing stack
 * is hard to diagnose from a CI log.
 */
const anyJson = fc.jsonValue();

function neverCrashes(parse: (raw: string) => unknown): (value: unknown) => void {
  return (value) => {
    // valid-JSON input of ANY shape: the parser must return an array, period —
    // a TypeError from deep inside (hash.update(undefined)) is exactly the
    // class of bug this fuzz target exists to catch
    const result = parse(JSON.stringify(value));
    expect(Array.isArray(result)).toBe(true);
  };
}

describe('parser fuzzing — arbitrary JSON shapes', () => {
  it('parseKnipJson', () => {
    fc.assert(
      fc.property(
        anyJson,
        neverCrashes((raw) => parseKnipJson(raw, '/w'))
      )
    );
  });

  it('parseNpmAuditJson', () => {
    fc.assert(
      fc.property(
        anyJson,
        neverCrashes((raw) => parseNpmAuditJson(raw))
      )
    );
  });

  it('parseSecretlintJson', () => {
    fc.assert(
      fc.property(
        anyJson,
        neverCrashes((raw) => parseSecretlintJson(raw, '/w'))
      )
    );
  });

  it('parseMadgeCircularJson', () => {
    fc.assert(
      fc.property(
        anyJson,
        neverCrashes((raw) => parseMadgeCircularJson(raw))
      )
    );
  });

  it('parseJscpdReport', () => {
    fc.assert(
      fc.property(anyJson, (value) => {
        const { findings } = parseJscpdReport(value as never, '/w');
        expect(Array.isArray(findings)).toBe(true);
      })
    );
  });
});

describe('pentest scanner fuzzing — arbitrary file content', () => {
  it('never crashes and always returns well-formed findings', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9/.]{1,30}$/),
        fc.string({ maxLength: 2000 }),
        (file, content) => {
          const findings = scanFileForPentest(file, content);
          for (const f of findings) {
            expect(f.category).toBe('pentest');
            expect(f.fingerprint).toMatch(/^[0-9a-f]{16}$/);
            expect(typeof f.message).toBe('string');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('is deterministic for any content', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (content) => {
        expect(scanFileForPentest('src/a.ts', content)).toEqual(
          scanFileForPentest('src/a.ts', content)
        );
      }),
      { numRuns: 100 }
    );
  });
});
