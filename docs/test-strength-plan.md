# Test strength — mutation, property & fuzz testing

> Coverage measures **execution**. None of it proves the tests would notice a
> bug. Mutation score, property tests and fuzzing measure **assertion
> strength** — the thing coverage pretends to be. This plan applies the idea
> twice: to our own test suites (dogfood), and as product features
> (test-strength gates nobody else in the Actions space ships).

## The three techniques, mapped to this codebase

| Technique                  | Tool (npm-only, D1 ✓)                                                           | What it catches that unit tests don't                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Property-based testing** | [fast-check](https://fast-check.dev)                                            | invariants over _all_ inputs: "the truncation ladder never exceeds the budget", "fingerprints survive any whitespace edit", "adding a critical finding can never turn a failing gate green" |
| **Fuzzing**                | fast-check arbitraries over parser inputs                                       | crashes on hostile/garbage scanner output — we ingest five external tools' JSON; any of them can emit shapes we never saw                                                                   |
| **Mutation testing**       | [Stryker](https://stryker-mutator.io) (`@stryker-mutator/core` + vitest runner) | tests that execute code but assert nothing; a mutant that survives (`>=` → `>`, `&&` → `\|\|`) is a real bug the suite would miss                                                           |

## Phase 1 — Dogfood (this repo) ✅ implemented with this plan

1. **Property tests** (`packages/*/test/properties.test.ts`):
   - `fingerprint`: deterministic; whitespace/indentation/blank-line
     insensitive; 16-char hex; distinct inputs → distinct outputs (collision
     sanity).
   - `evaluateGates` **monotonicity**: for ANY finding set, adding one new
     critical under the default policy yields `fail` — the gate can never be
     argued out of blocking by surrounding noise.
   - `renderMarkdown` **budget invariant**: for ANY findings and any
     `maxChars ≥ 10k`, output length ≤ budget, and the marker + verdict header
     survive every truncation step.
   - `renderOverviewBandSvg`: deterministic, structurally valid for any
     series.
2. **Parser fuzzing** (`packages/scanners/test/fuzz.test.ts`): every
   `parseX()` must return findings or throw a clean error — never crash — for
   arbitrary JSON values. Hardened the parsers where the fuzzer found real
   crashes (non-string fields, null entries).
3. **Mutation testing**: `npm run test:mutation` runs Stryker over
   `packages/core/src` (the gate engine, fingerprints, state machine — the
   code where a silent bug lies to users). Nightly CI workflow
   (`mutation.yml`) publishes the HTML report as an artifact; the score is the
   suite's honesty metric. Thresholds start advisory; ratchet once stable.

   **Baseline (first run, 2m43s): 70.6%** — and it immediately found a real
   gap: `diff/attribution.ts` scored **0%** (21 mutants, never covered
   directly — only through the action/CLI, which unit tests don't run).
   Closed with `attribution.test.ts` in the same commit. `fingerprint.ts`
   scored **100%**, which is the property tests earning their keep.

## Phase 2 — Product: 🧬 mutation gate in Coverage Insight

The trend-setting feature: _"your PR's new code must not only be covered —
the tests must kill its mutants."_

- New input `mutation: mutation-report.json` ingests Stryker's standard
  [mutation-testing-report-schema](https://github.com/stryker-mutator/mutation-testing-elements)
  JSON (consumers add one Stryker run; `--incremental` keeps it fast on PRs).
- New band card: **🧬 Mutation 72.4% ▲1.2** next to the four coverage metrics.
- Diff-aware gate (the house rule): fail only when _changed files_ have
  surviving mutants / the score drops vs base — pre-existing weak tests are
  suggestions, never blockers.
- Fix plan integration: each surviving mutant becomes an AI prompt —
  _"write a test that kills this mutant: `>=` replaced by `>` at
  `src/pricing.ts:42` — the suite currently passes with the mutation applied."_
  This is a strictly better prompt than "add tests for lines 40–50".

## Phase 3 — Product: test-hygiene & property-test nudges in PR Review Insight

- **Test-hygiene scanner** (already on the roadmap): eslint-plugin-vitest /
  eslint-plugin-jest rules — `.only` left in, disabled suites, assertion-free
  tests, conditional expects. Category: 🧪, diff-aware like everything else.
- **Property-test nudges in the fix plan**: when a changed file exports pure
  functions (no I/O imports, deterministic signature) and findings cluster
  there, the fix-plan prompt suggests a fast-check property instead of
  example-based tests, with a starter arbitrary.
- **Fuzz-target suggestions**: files matching parser/codec heuristics
  (`parse*`, `decode*`, `deserialize*`) get a "fuzz this boundary" prompt.

## Sequencing & cost

| Step                               | Effort                | CI cost                                                                   |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| Phase 1 (this repo)                | done with this commit | property/fuzz: ~1s in the normal suite · Stryker: nightly only (~minutes) |
| Phase 1 mirror in coverage-insight | small                 | same                                                                      |
| Phase 2 mutation gate              | ~1 week               | consumer opt-in; `--incremental` keeps PR runs fast                       |
| Phase 3 hygiene scanner            | days                  | one more eslint plugin in the existing in-process run                     |

## Non-goals

- Running Stryker _inside_ the action on consumer code by default — mutation
  runs are minutes-long; it stays opt-in via the report-ingest input.
- Coverage-style 100% mutation score mandates — the gate is diff-aware and
  ratchet-style, never absolute.
