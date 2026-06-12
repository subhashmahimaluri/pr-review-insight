# PR Review Insight

[![CI](https://github.com/subhashmahimaluri/pr-review-insight/actions/workflows/ci.yml/badge.svg)](https://github.com/subhashmahimaluri/pr-review-insight/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![scanners: npm only](https://img.shields.io/badge/scanners-npm--only-orange)

**PR quality, security & a11y gate** — scan every pull request for dead code,
duplication, complexity, security issues, OWASP risks, accessibility problems,
static pentest hygiene and Sonar-style code smells. Post **one premium PR
comment** (graphs on top, details collapsed) and gate the merge on **what the
PR introduced** — never on pre-existing debt.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/gallery/overview-band-dark.svg">
  <img alt="overview band: quality gate verdict card plus one card per category with count, severity, delta vs base and trend sparkline" src="docs/gallery/overview-band-light.svg">
</picture>

> The overview band every PR gets: a 🚦 **quality gate** verdict card (what was
> introduced, judged in one glance) and one card per category — count colored
> by worst severity, ▲ red = new debt, ▼ green = paid down, sparkline = trend
> across baseline runs. Light/dark aware. Browse
> [docs/gallery](docs/gallery) for the rendered comment in **every state**.

## The one rule that matters

> **A PR that introduces nothing never fails.**

Findings are fingerprinted (rule + file + normalized code context — no line
numbers), so they survive unrelated edits. The gate judges only fingerprints
that are _not_ in the baseline — the Sonar "new code" model. Everything
inherited is reported as cleanup suggestions with an explicit _"they don't
block this merge"_ note.

### What blocks a merge (defaults)

| Situation                                       | Default         | Job result               |
| ----------------------------------------------- | --------------- | ------------------------ |
| PR introduces a **critical** finding            | `critical: 0`   | ❌ fails                 |
| PR introduces **more than 5 major** findings    | `major: 5`      | ❌ fails                 |
| PR introduces ≤5 major / any minor / any info   | within limits   | ⚠️ passes with warnings  |
| PR **worsens duplication** past 5% and the base | `scope: "new"`  | ❌ fails                 |
| Pre-existing debt of any severity               | —               | ✅ never blocks          |
| A scanner crashes                               | `strict: false` | ✅ degrades to a warning |

Every limit is configurable — see [Gates](#gates). Want new majors to block
too? `{"gates": {"newFindings": {"critical": 0, "major": 0}}}`.

## What you get on every PR

- 🚦 **Quality-gate verdict** — 8-state header + the gate card in the band
- 🆕 **"Introduced by this PR"** — an open-by-default section with exactly
  what the gate judged; categories that gained findings sort first
- 📊 **Overview band SVG** — committed to an orphan branch, light/dark via
  `<picture>`, live per-PR with `contents: write`
- 🔐 **Security grouped by OWASP Top-10 2021**, duplication as linked clone
  pairs, dead code as file/symbol/why; new rows **bold + 🆕**
- 📝 **Inline annotations** on touched lines (≤200, failures first)
- 📦 **Artifacts**: versioned JSON, SARIF (code-scanning tab), interactive
  HTML (print → PDF), and an **AI-ready fix plan** — see
  [Artifacts](#artifacts--fixing-with-an-ai-assistant)

## Quick start

```yaml
# .github/workflows/pr-review.yml
name: PR Review Insight
on: pull_request
permissions:
  contents: write # live per-PR overview band (optional, degrades gracefully)
  pull-requests: write # the report comment
  checks: write # inline annotations
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 } # enables dual-scan baselines
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: subhashmahimaluri/pr-review-insight@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          sarif-file: code-report.sarif
          html-file: code-report.html
          fix-plan-file: fix-plan.md
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: code-report
          path: |
            code-report.json
            code-report.html
            fix-plan.md
```

Optionally record a baseline after every merge to `main` — it makes PR runs
faster (one scan instead of two) and powers the trend sparklines:

```yaml
# .github/workflows/review-baseline.yml
name: Review baseline
on:
  push: { branches: [main] }
permissions: { contents: write }
jobs:
  baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: subhashmahimaluri/pr-review-insight@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: baseline
```

Full examples in [examples/workflows](examples/workflows).

## What gets scanned

| Category           | Scanner                                                                       | Notes                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🪦 Dead code       | [knip](https://knip.dev)                                                      | unused files, exports, types, dependencies                                                                                                                                                  |
| 👯 Duplication     | [jscpd](https://github.com/kucherenko/jscpd)                                  | token-based clones, % duplicated, both locations linked                                                                                                                                     |
| 🌀 Complexity      | eslint `complexity`, `max-depth` + sonarjs `cognitive-complexity`             | cyclomatic _and_ cognitive hotspots                                                                                                                                                         |
| 🧹 Code smells     | [eslint-plugin-sonarjs](https://github.com/SonarSource/eslint-plugin-sonarjs) | ~200 Sonar smell/bug rules                                                                                                                                                                  |
| 🔐 Security (SAST) | eslint-plugin-security, eslint-plugin-no-unsanitized, secretlint              | injection sinks, unsafe regex/eval, unsanitized DOM, committed secrets                                                                                                                      |
| 📦 Security (deps) | `npm audit`                                                                   | known CVEs, severity-mapped, offline-tolerant                                                                                                                                               |
| 🛡️ OWASP           | taxonomy layer                                                                | every security finding tagged with its OWASP Top-10 2021 category                                                                                                                           |
| ♿ Accessibility   | eslint-plugin-jsx-a11y                                                        | static a11y for JSX                                                                                                                                                                         |
| 🎯 Pentest checks  | own static ruleset                                                            | missing CSP, `http://` URLs, `target="_blank"` w/o `rel`, wildcard CORS, cookie flags, `dangerouslySetInnerHTML`, exposed `VITE_*` secrets, open redirects — honest _static_ scope, no DAST |
| 🔄 Architecture    | [madge](https://github.com/pahen/madge)                                       | circular dependencies                                                                                                                                                                       |

All scanners are npm packages — no pip, no binaries, no docker. A scanner that
merely _finds things_ never breaks your build; a scanner that _crashes_
degrades to a warning (or fails the job with `strict: true`).

## Gates

Configure via `pr-review-insight.config.json` (or a `"pr-review-insight"` key
in `package.json`); the `gates` action input overrides the file:

```jsonc
{
  "gates": {
    "newFindings": { "critical": 0, "major": 5 }, // diff-aware gate, default-on
    // scope "new" (default): fails only when the PR *worsens* duplication —
    // 60% inherited duplication is a suggestion, never a blocker.
    // "absolute": hard cap regardless of the baseline.
    "duplication": { "maxPercent": 5, "scope": "new" },
    "complexity": { "maxCognitive": 15, "maxCyclomatic": 20 },
    "deadCode": "warn", // or "gate" to fail on new dead code
    "totals": { "critical": 0 }, // optional absolute gate, pre-existing included
  },
  "ignore": ["**/generated/**"],
  "categories": { "a11y": false }, // disable whole categories
  "strict": false, // scanner crash fails the job
}
```

The job fails only on: gate violations, a scanner crash with `strict: true`,
or invalid inputs.

## How the baseline works (`baseline-mode`)

The new-vs-pre-existing split needs to know what the base looked like. Two
interchangeable sources:

| Mode             | How                                                                                    | Needs                               | Extra value                                                |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `branch`         | reads the baseline recorded on the orphan branch by the `mode: baseline` workflow      | the baseline workflow on `main`     | fast; powers Δ arrows **and trend sparklines** across runs |
| `scan`           | checks out the PR's **merge-base** in a temp git worktree and scans it in the same job | `actions/checkout` `fetch-depth: 0` | zero setup — no baseline branch, no history dependency     |
| `auto` (default) | `branch` first, falling back to `scan`                                                 | —                                   | best of both                                               |
| `off`            | no baseline                                                                            | —                                   | report-only                                                |

The caption under the overview band always states which source produced the
deltas — ``Δ vs base `32a1f2e` · sparklines: last 15 baseline runs`` (recorded
baseline) or ``Δ vs merge-base `32a1f2e` (scanned in this run)`` (dual-scan).
The band never presents base-branch data as if it were the PR's.

## Action reference

### Inputs

| Input             | Default                      | Description                                                                        |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `github-token`    | — (required)                 | `secrets.GITHUB_TOKEN`                                                             |
| `mode`            | `report`                     | `report` (PR scan + comment) or `baseline`                                         |
| `baseline-branch` | `pr-review-insight-baseline` | orphan branch for baselines, history, band SVGs                                    |
| `baseline-mode`   | `auto`                       | `auto` / `branch` / `scan` (dual-scan, no branch needed) / `off`                   |
| `gates`           | —                            | JSON overriding the config file `gates` key                                        |
| `ignore`          | —                            | extra ignore globs (comma/newline separated)                                       |
| `strict`          | `false`                      | scanner crash fails the job                                                        |
| `comment`         | `true`                       | post/update the PR comment                                                         |
| `check-run`       | `true`                       | post a check run                                                                   |
| `annotations`     | `new`                        | inline annotations on touched lines: `new` / `all` / `none` (≤200, failures first) |
| `report-file`     | `code-report.json`           | versioned JSON artifact (`schemaVersion: 1`, emitted in every state)               |
| `sarif-file`      | —                            | also emit SARIF → upload for GitHub's code-scanning tab                            |
| `html-file`       | —                            | also emit a self-contained interactive HTML report (print → PDF ready)             |
| `fix-plan-file`   | —                            | also emit the markdown **fix plan** with ready-to-paste AI prompts                 |

### Outputs

`state` · `verdict` · `total-findings` · `new-findings` · `report-file`

### Report states

| State          | Header                                       | Job       |
| -------------- | -------------------------------------------- | --------- |
| `passed`       | ✅ Code review gate passed                   | success   |
| `no-change`    | ✅ No change in findings                     | success   |
| `improved`     | 💚 Debt paid down — fewer findings than base | success   |
| `new-findings` | ⚠️ New findings introduced (within limits)   | success   |
| `no-baseline`  | ℹ️ Baseline recorded (first run)             | success   |
| `gate-failed`  | ❌ Code review gate failed `blocks merge`    | **fails** |
| `invalid-data` | ⚠️ Input error                               | **fails** |
| `scan-error`   | 🛑 Scan error (only with `strict: true`)     | **fails** |

Priority when several apply:
`scan-error > invalid-data > gate-failed > no-baseline > new-findings > improved > no-change > passed`.

## Artifacts — fixing with an AI assistant

Every run can emit four artifacts; together they close the loop from _found_
to _fixed_:

| Artifact           | Input           | What it's for                                                                                                                                                                                                          |
| ------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code-report.json` | `report-file`   | the only integration surface — `schemaVersion: 1`, zod-validated, emitted in **every** state                                                                                                                           |
| SARIF              | `sarif-file`    | findings in GitHub's Security → Code scanning tab                                                                                                                                                                      |
| HTML report        | `html-file`     | self-contained, filterable (new / category), dark-mode aware, **print stylesheet included — open in a browser and Print → Save as PDF** for a clean document                                                           |
| **Fix plan**       | `fix-plan-file` | markdown with **🆕 new findings first** (one ready-to-paste prompt each) and **🧹 pre-existing debt** as per-category batch prompts — paste into **Copilot Chat**, Claude, or Cursor with the file open and let it fix |

The fix plan needs no AI API keys or vendor lock-in: it produces _prompts_,
and any assistant your team already has (including Copilot Enterprise)
consumes them. The same separation (new vs pre-existing) means an author fixes
their own findings first, and debt cleanup can be scheduled as separate work.

## CLI (GitLab, Jenkins, local)

```bash
npx @pr-review-insight/cli scan --dir . --report code-report.json \
  --sarif code-report.sarif --html code-report.html --fix-plan fix-plan.md
# exit codes: 0 pass · 1 gate failed · 2 crash

# dual-scan: point --base-dir at a checkout of the base branch / merge-base
npx @pr-review-insight/cli scan --dir ./head --base-dir ./base

# or use a recorded baseline file (the same JSON the action stores per commit)
npx @pr-review-insight/cli scan --baseline baseline.json

npx @pr-review-insight/cli gate          # re-check a report in a later CI stage
npx @pr-review-insight/cli report --md - # re-render markdown from the JSON artifact
```

## Architecture

```
packages/core        finding model, fingerprints, schema, gate engine, diff attribution
packages/scanners    one adapter per tool; partial failure degrades, never crashes
packages/reporters   markdown comment, SARIF, HTML artifact, fix plan
packages/history     baseline series + overview band SVG
packages/action      GitHub wrapper (ncc → dist/index.js), baseline branch, annotations
packages/cli         pri scan|gate|report
```

Design rules the codebase enforces (CI checks all three):

1. **Deterministic** — same repo state in → byte-identical report out
2. **ncc-safe** — the bundled `dist/index.js` must load with an empty env
3. **Fail semantics** — gates decide the job, never tool noise; posting the
   comment can never mask the verdict

## Development

```bash
npm ci
npm test                 # vitest (88 tests), runs against workspace sources
npm run typecheck && npm run lint
npm run build            # all packages + ncc bundle to dist/
node packages/cli/bin/pri.js scan --dir fixtures/demo-app   # seeded dry run
npx tsx scripts/gallery.ts                                  # regenerate docs/gallery
```

Contributions welcome — see [CLAUDE.md](CLAUDE.md) for the architecture map
and the invariants that must not regress, and [ROADMAP.md](ROADMAP.md) for
where this is going (AI-assisted fixing, more gates, trends).

## License

[MIT](LICENSE)
