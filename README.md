# PR Review Insight

**PR quality, security & a11y gate** — scan every pull request for dead code,
duplication, complexity, security issues, OWASP risks, accessibility problems,
static pentest hygiene and Sonar-style code smells. Post **one premium PR
comment** (graphs on top, details collapsed) and gate the merge on **what the
PR introduced** — never on pre-existing debt.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/gallery/overview-band-dark.svg">
  <img alt="overview band: one card per category with count, severity, delta vs base and trend sparkline" src="docs/gallery/overview-band-light.svg">
</picture>

> The overview band every PR gets: count per category colored by worst
> severity, ▲ red = new debt, ▼ green = paid down, and a sparkline of the last
> baseline runs. Light/dark aware. See
> [docs/gallery](docs/gallery) for every report state.

## Why this and not another linter job

- **Diff-aware by default.** Findings are fingerprinted (rule + file +
  normalized code context, no line numbers). The gate fails only on
  fingerprints that are _not_ in the baseline — the Sonar "new code" model.
  Legacy debt is reported, never blocking.
- **npm-only.** Every scanner is an npm package. No pip, no binaries, no
  docker.
- **One comment per PR, updated in place.** Never a comment flood.
- **Deterministic.** Same repo state in → byte-identical report out. CI
  enforces this on every build.
- **Fails the job only when a gate says so.** A scanner that merely _finds
  things_ never breaks your build; a scanner that _crashes_ degrades to a
  warning (or fails the job with `strict: true`).

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
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - uses: subhashmahimaluri/pr-review-insight@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

And record the baseline after every merge to `main` — this powers the
new-vs-pre-existing split, the Δ arrows and the sparklines:

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

## Gates

Default policy: **zero new critical · max 5 new major · max duplication 5%**.
Configure via `pr-review-insight.config.json` (or a `"pr-review-insight"` key
in `package.json`); action inputs override the file:

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
or invalid inputs. **A PR that introduces nothing never fails** — pre-existing
debt is rendered as cleanup suggestions with an explicit "they don't block
this merge" note.

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
| `html-file`       | —                            | also emit a self-contained interactive HTML report                                 |

Outputs: `state`, `verdict`, `total-findings`, `new-findings`, `report-file`.

## CLI (GitLab, Jenkins, local)

```bash
npx @pr-review-insight/cli scan --dir . --report code-report.json \
  --sarif code-report.sarif --html code-report.html --md report.md
# exit codes: 0 pass · 1 gate failed · 2 crash

npx @pr-review-insight/cli gate            # re-check an existing report in a later stage
npx @pr-review-insight/cli report --md -   # re-render markdown from the JSON artifact
```

Two ways to get the new-vs-pre-existing split outside GitHub:

```bash
# dual-scan: point --base-dir at a checkout of the base branch / merge-base
npx @pr-review-insight/cli scan --dir ./head --base-dir ./base

# or a recorded baseline file (the same JSON the action stores per commit)
npx @pr-review-insight/cli scan --baseline baseline.json
```

## The report

- **Verdict header** — 8-state machine with strict priority:
  `scan-error > invalid-data > gate-failed > no-baseline > new-findings > improved > no-change > passed`
- **Policy line** — `policy: zero new critical · max duplication 5% · PR #12`
- **Overview band** — 🚦 quality-gate hero card (PASS/FAIL + what was
  introduced + overall-debt trend) followed by one card per category,
  committed to the baseline branch, light/dark via `<picture>`. Live per-PR
  band with `contents: write`; base-branch band + an explicit caption otherwise
- **`> [!CAUTION]` alert** when new criticals block the merge, naming the worst offender
- **🆕 Introduced by this PR** — an open-by-default section with exactly what
  the gate judged; categories that gained new findings sort first. When the PR
  adds nothing, the report says so and frames everything else as non-blocking
  cleanup suggestions
- **One spoiler per category** — security grouped by OWASP tag, duplication as
  linked clone pairs, dead code as file/symbol/why; new rows **bold + 🆕**,
  pre-existing rows muted
- **Truncation ladder** under the 65k comment budget: drop the all-findings
  table → cap rows at 25 → protected only (verdict, alerts, band, introduced list)

Browse [docs/gallery](docs/gallery) for every state, regenerate with
`npx tsx scripts/gallery.ts`.

## Architecture

```
packages/core        finding model, fingerprints, schema, gate engine, diff attribution
packages/scanners    one adapter per tool; partial failure degrades, never crashes
packages/reporters   markdown comment, SARIF, HTML artifact
packages/history     baseline series + overview band SVG
packages/action      GitHub wrapper (ncc → dist/index.js), baseline branch, annotations
packages/cli         pri scan|gate|report
```

The only integration surface is `code-report.json` (`schemaVersion: 1`,
zod-validated). Everything else — comment, SARIF, HTML, annotations — renders
from it.

## License

MIT
