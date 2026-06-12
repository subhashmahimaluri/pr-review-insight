# Roadmap — PR Review Insight

Where the product goes after v1. Phases are ordered by leverage: each one
builds on the artifacts and invariants that already exist (the
`code-report.json` schema, fingerprint diffing, the baseline branch, the
fix-plan document).

---

## Phase 7 — AI-assisted fixing (no API keys required)

The strategy: **produce prompts and context, not API calls.** Teams already
pay for an assistant (Copilot Enterprise, Claude, Cursor); the action's job is
to hand that assistant perfect context. This keeps D2 intact — zero non-GitHub
network calls by default — and works for enterprises where provisioning a
second AI vendor key is a non-starter.

| Step   | What ships                                                        | How it works without an API                                                                                                                                                                                                                     |
| ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 ✅ | **Fix plan artifact** (`fix-plan-file`)                           | new findings first, one paste-ready prompt each; pre-existing debt as per-category batch prompts                                                                                                                                                |
| 7.2 ✅ | **`copilot-instructions` emitter**                                | `pri emit-instructions` writes/updates `.github/copilot-instructions.md` with the repo's gate policy ("never introduce `eval`, keep cognitive complexity ≤ 15, …") so Copilot _avoids creating_ findings while authoring — prevention, not cure |
| 7.3 ✅ | **Per-finding "Fix with AI" prompts in the PR comment**           | each 🆕 finding gets a copy-paste prompt block inside the introduced section; one click in the GitHub UI, paste into Copilot Chat in the IDE — no integration surface at all                                                                    |
| 7.4    | **`gh`-native fix loop**                                          | document/script the loop: `gh run download` the fix plan → `gh copilot suggest` / Copilot Workspace per item; works on any runner with the GitHub CLI                                                                                           |
| 7.5    | **Copilot Extension / GitHub Models (when available to the org)** | a `pr-review-insight` Copilot extension that reads `code-report.json` from the run and walks the developer through fixes inside Copilot Chat — uses the org's Copilot seat, still no vendor API key                                             |
| 7.6    | **Optional BYO-key AI layer** (`ai: comment`)                     | dynamic-import only (D2): explains the top N new findings in plain language in the comment, suggests the diff; off by default, never blocking unless `aiCanBlock`                                                                               |

Success metric: time from "gate failed" to "gate green" on a seeded fixture
PR, measured with and without the fix plan.

## Phase 8 — More quality gates

Gap analysis against the established standards (SonarQube "Sonar way",
CodeClimate, OpenSSF Scorecard) — what we cover today vs what's worth adding.
Everything stays npm-only and diff-aware by default.

### Covered today

dead code · duplication (token clones + %) · cyclomatic & cognitive
complexity · ~200 Sonar smells · injection/XSS/unsafe-regex SAST · committed
secrets · dependency CVEs · OWASP tagging · JSX a11y · static pentest hygiene
(CSP, CORS, cookies, open redirect, exposed client env) · circular
dependencies

### Planned gates (priority order)

| Gate                     | Scanner (npm)                                           | Why it matters                                                  | Diff-aware shape                                      |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| 🔡 Type coverage         | `type-coverage`                                         | `any` leakage is the TS equivalent of debt                      | fail only when the PR lowers the %                    |
| 📜 License compliance    | `license-checker-rseidelsohn`                           | legal risk hides in transitive deps                             | fail on newly introduced disallowed licenses          |
| 🕰️ Outdated dependencies | `npm outdated --json`                                   | aging deps correlate with CVEs                                  | report-only column next to 📦 deps                    |
| 📏 Bundle-size budget    | `size-limit` (when a build exists)                      | regressions land one PR at a time                               | fail when the PR grows the bundle past budget         |
| 🧮 PR size advisory      | git diff stats (no dep)                                 | 2000-line PRs defeat review                                     | warn-only chip in the header                          |
| ♿ Runtime a11y          | `axe-core` + `linkedom` against built `dist/index.html` | static JSX checks miss rendered DOM issues                      | new violations only                                   |
| 🧪 Test hygiene          | `eslint-plugin-vitest`/`jest` rules                     | `.only`, disabled tests, empty assertions                       | gate on new                                           |
| 🧬 Test strength         | ingest Stryker `mutation-report.json`                   | coverage measures execution, mutation score measures assertions | fail on surviving mutants in changed files only       |
| 🐳 Dockerfile/IaC lint   | TBD — no good pure-npm option yet                       | container misconfig                                             | ingest external SARIF (same pattern as `dast-report`) |

Also planned: **ratchet mode** (`"ratchet": true` — totals may never increase,
the SonarQube "clean as you code" hard line) and per-category severity
overrides.

### Test strength — applied to ourselves first ✅

See [docs/test-strength-plan.md](docs/test-strength-plan.md): the repo now
dogfoods the techniques the 🧬 gate will ship — fast-check **property tests**
(gate monotonicity, fingerprint whitespace-invariance, truncation budget),
**parser fuzzing** (all five external-tool parsers hardened against arbitrary
JSON; the fuzzer found real crashes on day one), and **Stryker mutation
testing** (`npm run test:mutation`, nightly CI with incremental state).

## Phase 9 — Platform & scale

- **Trends dashboard** — a static page generated onto the baseline branch
  (GitHub Pages): category trends, debt burn-down, gate pass-rate; zero infra.
- **Monorepo support** — per-package scanning and gates (`projects` config),
  worst-verdict-wins, one comment with a per-package verdict table.
- **Org rollup** — a scheduled workflow aggregating `code-report.json` across
  repos into one scoreboard (the schema is the API; this is why D5 exists).
- **Marketplace listing** — screenshots from docs/gallery, OpenSSF Scorecard
  badge, SLSA provenance + SBOM on releases.
- **Performance** — scanner result caching keyed by content hash; changed-file
  fast path for eslint when the baseline is recorded (full scan stays the
  correctness fallback).
- **`@pr-review-insight/cli` on npm** — so `npx` works without the repo, and
  GitLab/Jenkins templates ship in `examples/`.

## Non-goals (kept deliberately out)

- **True DAST** — running attacks against a live app is a different product;
  we ingest ZAP/Burp JSON instead (`dast-report` input, planned).
- **Test coverage** — that's the sibling action
  (`vite-pr-coverage-insight`); one comment per concern.
- **Python/docker scanners** — D1 (npm-only) is what keeps install time and
  supply-chain surface small.

---

_Maintained alongside [CLAUDE.md](CLAUDE.md) (invariants) and the product
spec in `pr-review-insight.md`. PRs that pick up a roadmap item welcome —
each table row above is roughly one self-contained contribution._
