<!-- pr-review-insight -->

## 💚 Debt paid down — fewer findings than base

_policy: zero new critical · max 5 new major · max duplication 5% (new) · PR #12_

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./overview-band-dark.svg">
  <img alt="findings per category: count, severity, delta vs base and trend" src="./overview-band-light.svg">
</picture>

<sub>Findings per category for this PR · Δ vs base `a1b2c3d` · sparklines: last 12 baseline runs</sub>

💡 **This PR introduces no new findings.** The 8 findings below are pre-existing — shown as cleanup suggestions, they don't block this merge.

<details>
<summary>🎯 Pentest checks (4 total)</summary>

| Where                                                                                             | Rule                                 | Severity    | Finding                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------- | ----------------------------------------------------------------------------- |
| [`.env:4`](https://github.com/acme/webapp/blob/feedbeef0012/.env#L4-L4)                           | `pentest/public-env-secret`          | 🟥 critical | Secret-looking key under a client-exposed env prefix — it ships in the bundle |
| [`src/Component.tsx:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L5-L5) | `pentest/dangerously-set-inner-html` | 🟧 major    | `dangerouslySetInnerHTML` — XSS sink, sanitize or remove                      |
| [`index.html:8`](https://github.com/acme/webapp/blob/feedbeef0012/index.html#L8-L8)               | `pentest/target-blank-no-rel`        | 🟨 minor    | `target="_blank"` without `rel="noopener"` — reverse tabnabbing               |
| [`index.html`](https://github.com/acme/webapp/blob/feedbeef0012/index.html)                       | `pentest/missing-csp`                | ⬜ info     | No Content-Security-Policy meta tag — consider adding one (or set the header) |

</details>

<details>
<summary>🪦 Dead code (2 total)</summary>

| File                                                                                      | Symbol        | Why                          |
| ----------------------------------------------------------------------------------------- | ------------- | ---------------------------- |
| [`src/Component.tsx`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx) | `entire file` | File is never imported       |
| [`package.json`](https://github.com/acme/webapp/blob/feedbeef0012/package.json)           | `left-pad`    | Unused dependency `left-pad` |

</details>

<details>
<summary>🔄 Architecture (1 total)</summary>

| Where                                                                   | Rule                        | Severity | Finding                                             |
| ----------------------------------------------------------------------- | --------------------------- | -------- | --------------------------------------------------- |
| [`src/a.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/a.ts) | `madge/circular-dependency` | 🟧 major | Circular dependency: src/a.ts → src/b.ts → src/a.ts |

</details>

<details>
<summary>♿ Accessibility (1 total)</summary>

| Where                                                                                             | Rule                | Severity | Finding                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| [`src/Component.tsx:4`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L4-L4) | `jsx-a11y/alt-text` | 🟨 minor | img elements must have an alt prop, either with meaningful text, or an empty string for decorative images. |

</details>

<details>
<summary>📋 All findings by file (5 files)</summary>

**[`.env`](https://github.com/acme/webapp/blob/feedbeef0012/.env)** — 1 finding

| Where                                                                   | Rule                        | Severity    | Finding                                                                       |
| ----------------------------------------------------------------------- | --------------------------- | ----------- | ----------------------------------------------------------------------------- |
| [`.env:4`](https://github.com/acme/webapp/blob/feedbeef0012/.env#L4-L4) | `pentest/public-env-secret` | 🟥 critical | Secret-looking key under a client-exposed env prefix — it ships in the bundle |

**[`index.html`](https://github.com/acme/webapp/blob/feedbeef0012/index.html)** — 2 findings

| Where                                                                               | Rule                          | Severity | Finding                                                                       |
| ----------------------------------------------------------------------------------- | ----------------------------- | -------- | ----------------------------------------------------------------------------- |
| [`index.html:8`](https://github.com/acme/webapp/blob/feedbeef0012/index.html#L8-L8) | `pentest/target-blank-no-rel` | 🟨 minor | `target="_blank"` without `rel="noopener"` — reverse tabnabbing               |
| [`index.html`](https://github.com/acme/webapp/blob/feedbeef0012/index.html)         | `pentest/missing-csp`         | ⬜ info  | No Content-Security-Policy meta tag — consider adding one (or set the header) |

**[`package.json`](https://github.com/acme/webapp/blob/feedbeef0012/package.json)** — 1 finding

| Where                                                                           | Rule                     | Severity | Finding                      |
| ------------------------------------------------------------------------------- | ------------------------ | -------- | ---------------------------- |
| [`package.json`](https://github.com/acme/webapp/blob/feedbeef0012/package.json) | `knip/unused-dependency` | 🟨 minor | Unused dependency `left-pad` |

**[`src/a.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/a.ts)** — 1 finding

| Where                                                                   | Rule                        | Severity | Finding                                             |
| ----------------------------------------------------------------------- | --------------------------- | -------- | --------------------------------------------------- |
| [`src/a.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/a.ts) | `madge/circular-dependency` | 🟧 major | Circular dependency: src/a.ts → src/b.ts → src/a.ts |

**[`src/Component.tsx`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx)** — 3 findings

| Where                                                                                             | Rule                                 | Severity | Finding                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| [`src/Component.tsx`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx)         | `knip/unused-file`                   | 🟧 major | File is never imported                                                                                     |
| [`src/Component.tsx:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L5-L5) | `pentest/dangerously-set-inner-html` | 🟧 major | `dangerouslySetInnerHTML` — XSS sink, sanitize or remove                                                   |
| [`src/Component.tsx:4`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L4-L4) | `jsx-a11y/alt-text`                  | 🟨 minor | img elements must have an alt prop, either with meaningful text, or an empty string for decorative images. |

</details>

<sub>Reported by **PR Review Insight** · schema v1 · baseline `a1b2c3d`</sub>
