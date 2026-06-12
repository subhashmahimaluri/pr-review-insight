# CLAUDE.md

PR Review Insight — a GitHub Action + CLI that scans PRs for dead code,
duplication, complexity, security/OWASP, a11y, static pentest hygiene and
Sonar-style smells, posts ONE premium PR comment (graphs visible, tables
collapsed) and gates the merge only on findings the PR _introduced_
(fingerprint diff vs a baseline — the Sonar "new code" model).

Sibling of `vite-pr-coverage-insight`; a reference copy lives git-ignored at
`vite-pr-coverage-insight-reference/`. The product spec is
`pr-review-insight.md` at the repo root.

## Commands

```bash
npm run typecheck         # tsc -b across all workspaces
npm test                  # vitest — tests import workspace SRC via aliases in vitest.config.ts
npm run lint              # eslint (flat config, eslint.config.mjs)
npm run format:check      # prettier — CI enforces it
npm run build             # builds every package; the action also ncc-bundles to root dist/

# end-to-end dry run against the seeded fixture (expected: gate-failed, exit 1)
node packages/cli/bin/pri.js scan --dir fixtures/demo-app --report /tmp/code-report.json --md /tmp/report.md

# regenerate docs/gallery (all 8 comment states + band SVGs) from the last fixture scan
npx tsx scripts/gallery.ts
```

Before declaring any change done, the **verification trio** must pass:

1. `npm test` (and typecheck + lint),
2. dist smoke test — after `npm run build`, `node dist/index.js` must fail
   ONLY with "Input required and not supplied: github-token" (any
   `webpackMissingModule` / `Cannot find module` means an ESM-only dep broke
   the ncc bundle),
3. determinism — two `pri scan` runs on `fixtures/demo-app` must be
   byte-identical except `generatedAt` (D6).

CI (`.github/workflows/ci.yml`) runs all three.

## Architecture

npm workspaces monorepo; the ONLY integration surface between layers is the
zod-validated `ReviewReport` (`code-report.json`, `schemaVersion: 1`):

```
packages/core       Finding model, fingerprint(), config loader (file < inputs),
                    gate engine, applyBaseline/markTouched, buildReport (8-state machine)
packages/scanners   ScannerAdapter framework + adapters; runScanners() orchestrates
packages/reporters  renderMarkdown (the PR comment), renderSarif, renderHtml
packages/history    BaselineEntry/HistoryIndex types, renderOverviewBandSvg, sparklines
packages/action     GitHub wrapper → ncc-bundled to root dist/ (committed);
                    comment upsert by marker, check-run annotations, baseline orphan branch
packages/cli        `pri scan|gate|report` (bin: packages/cli/bin/pri.js); exit 0/1/2
```

Scanner execution model (deliberate split):

- **In-process:** ESLint family (sonarjs, security, no-unsanitized, jsx-a11y,
  complexity rules) — plugin objects are passed directly into the flat config
  (`packages/scanners/src/adapters/eslint.ts`), no dynamic requires, so ncc
  bundling stays safe. Also `pentest.ts` (own regex ruleset).
- **Spawned CLIs with JSON output:** knip, jscpd, secretlint, npm audit,
  madge. Each adapter has a pure `parseX()` exported and unit-tested against
  fixture JSON; `resolveTool()` prefers local `node_modules/.bin`, falls back
  to pinned `npx --yes pkg@major`.
- A scanner crash degrades to a `ScannerError` + warning; it fails the job
  only with `strict: true`. secretlint-without-config and
  npm-audit-without-lockfile are EXPECTED degradations (warnings).

State machine priority (buildReport):
`scan-error > invalid-data > gate-failed > no-baseline > new-findings > improved > no-change > passed`.

Baseline resolution (`baseline-mode` input): `auto` (default) reads the
recorded baseline branch, falling back to **dual-scan** — scanning the PR's
merge-base in a temp git worktree in the same run
(`packages/action/src/baseline/dualScan.ts`, needs checkout `fetch-depth: 0`).
The CLI equivalent is `pri scan --base-dir <base-checkout>`.

## Invariants — do not regress

- **A PR that introduces nothing never fails.** ALL default gates are
  diff-aware: `newFindings` per severity, and duplication scope `'new'` (fails
  only when the PR raises duplication% above both the limit and the baseline +
  0.1pt tolerance). Absolute gates (`totals`, duplication `scope: 'absolute'`)
  are opt-in only.
- The comment leads with the open-by-default "🆕 Introduced by this PR"
  spoiler; when nothing is new, the pre-existing-debt note ("they don't block
  this merge") must appear instead. The band's 🚦 gate card shows what was
  judged.
- `relativize()` in scanners must keep handling tool-reported paths that are
  absolute, cwd-relative, or output-dir-relative, plus macOS /tmp →
  /private/tmp realpath aliasing — wrong relative paths silently break
  fingerprint matching across base/head scans (false 🆕).
- Band image URLs must be cache-busted per RUN (`?v=<sha>-<runId>`), not per
  commit — GitHub's camo proxy caches by exact URL, so re-runs on the same
  sha would show a stale band forever.
- The fix plan (`renderFixPlan`, `fix-plan-file` input, `--fix-plan` flag) is
  the AI-assist surface: prompts, not API calls (no keys, Copilot-ready).
  Keep new-findings-first and the non-blocking framing for pre-existing debt.

- **Fingerprints** = ruleId + file + normalized snippet (NO line numbers), so
  findings survive unrelated edits. Symbol-identity for knip,
  rotation-invariant cycles for madge, clone-pair identity for jscpd. Tests
  pin these.
- **Determinism (D6):** no `Date.now()`/randomness in any model or renderer;
  `generatedAt` is always injected by the caller. Findings are sorted in
  `runScanners` regardless of adapter completion order.
- **Comment discipline:** one comment per PR, found by
  `<!-- pr-review-insight -->`; visible area = verdict + alerts + band only,
  every table inside `<details>`; truncation ladder (65k) drops
  all-findings-by-file → caps rows at 25 → protected-only.
- **Never headline base-branch data as the PR's** — the band falls back to the
  base-branch SVG only with an explicit caption saying so.
- **Job failure semantics:** gates and real errors decide `setFailed`; tool
  noise and comment-posting failures never do.
- **Pin CJS-compatible majors** (`@actions/*@^1/^6`, eslint 9, zod 3).
  ESM-only majors kill the ncc bundle at load; dependabot ignores majors for
  these on purpose (`.github/dependabot.yml`).
- Fixture secrets in `fixtures/demo-app/.env` must be obviously fake — a
  realistic `sk_live_…` style value trips GitHub push protection and blocks
  every push containing the commit.

## Naming

Scope `@pr-review-insight/*` · CLI bin `pri` · baseline branch
`pr-review-insight-baseline` · config `pr-review-insight.config.json` (or the
`"pr-review-insight"` package.json key) · artifact `code-report.json`.
