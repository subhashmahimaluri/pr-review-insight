<!-- pr-review-insight -->

## ⚠️ New findings introduced

_policy: zero new critical · max 5 new major · max duplication 5% · PR #12_

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./overview-band-dark.svg">
  <img alt="findings per category: count, severity, delta vs base and trend" src="./overview-band-light.svg">
</picture>

<sub>Findings per category for this PR · Δ vs base `a1b2c3d` · sparklines: last 12 baseline runs</sub>

<details>
<summary>🎯 Pentest checks (2 new · 7 total)</summary>

| Where                                                                                             | Rule                                 | Severity        | Finding                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------- | --------------------------------------------------------------------------------- |
| [`src/danger.ts:10`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L10-L10)      | `pentest/open-redirect`              | **🟧 major** 🆕 | **Possible open redirect from user-controlled input**                             |
| [`index.html`](https://github.com/acme/webapp/blob/feedbeef0012/index.html)                       | `pentest/missing-csp`                | **⬜ info** 🆕  | **No Content-Security-Policy meta tag — consider adding one (or set the header)** |
| [`src/Component.tsx:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L5-L5) | `pentest/dangerously-set-inner-html` | 🟧 major        | `dangerouslySetInnerHTML` — XSS sink, sanitize or remove                          |
| [`src/danger.ts:4`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L4-L4)         | `pentest/new-function`               | 🟧 major        | `new Function()` — dynamic code execution                                         |
| [`index.html:8`](https://github.com/acme/webapp/blob/feedbeef0012/index.html#L8-L8)               | `pentest/target-blank-no-rel`        | 🟨 minor        | `target="_blank"` without `rel="noopener"` — reverse tabnabbing                   |
| [`src/Component.tsx:6`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L6-L6) | `pentest/target-blank-no-rel`        | 🟨 minor        | `target="_blank"` without `rel="noopener"` — reverse tabnabbing                   |
| [`src/danger.ts:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L5-L5)         | `pentest/cleartext-http`             | 🟨 minor        | Cleartext `http://` URL — use https                                               |

</details>

<details>
<summary>🌀 Complexity (3 total)</summary>

| Where                                                                                         | Rule                           | Severity | Finding                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| [`src/index.ts:16`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts#L16-L16)    | `sonarjs/cognitive-complexity` | 🟧 major | Refactor this function to reduce its Cognitive Complexity from 43 to the 15 allowed. |
| [`src/index.ts:23–31`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts#L23-L31) | `max-depth`                    | 🟧 major | Blocks are nested too deeply (6). Maximum allowed is 5.                              |
| [`src/index.ts:24–30`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts#L24-L30) | `max-depth`                    | 🟧 major | Blocks are nested too deeply (7). Maximum allowed is 5.                              |

</details>

<details>
<summary>🪦 Dead code (1 new · 5 total)</summary>

| File                                                                                      | Symbol              | Why                           |
| ----------------------------------------------------------------------------------------- | ------------------- | ----------------------------- |
| [`src/Component.tsx`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx) | `src/Component.tsx` | **File is never imported** 🆕 |
| [`src/unused.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/unused.ts)         | `src/unused.ts`     | File is never imported        |
| [`package.json`](https://github.com/acme/webapp/blob/feedbeef0012/package.json)           | `left-pad`          | Unused dependency `left-pad`  |
| [`src/danger.ts:9`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L9-L9) | `redirect`          | Unused export `redirect`      |
| [`src/util.ts:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/util.ts#L5-L5)     | `neverCalled`       | Unused export `neverCalled`   |

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
<summary>🧹 Code smells (1 new · 1 total)</summary>

| Where                                                                                     | Rule                | Severity        | Finding                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------- | --------------- | ----------------------------------------------------------------------- |
| [`src/danger.ts:3`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L3-L3) | `sonarjs/code-eval` | **🟨 minor** 🆕 | **Make sure that this dynamic injection or execution of code is safe.** |

</details>

<details>
<summary>📋 All findings by file (8 files)</summary>

**[`index.html`](https://github.com/acme/webapp/blob/feedbeef0012/index.html)** — 2 findings (**1 new**)

| Where                                                                               | Rule                          | Severity       | Finding                                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------- | -------------- | --------------------------------------------------------------------------------- |
| [`index.html`](https://github.com/acme/webapp/blob/feedbeef0012/index.html)         | `pentest/missing-csp`         | **⬜ info** 🆕 | **No Content-Security-Policy meta tag — consider adding one (or set the header)** |
| [`index.html:8`](https://github.com/acme/webapp/blob/feedbeef0012/index.html#L8-L8) | `pentest/target-blank-no-rel` | 🟨 minor       | `target="_blank"` without `rel="noopener"` — reverse tabnabbing                   |

**[`package.json`](https://github.com/acme/webapp/blob/feedbeef0012/package.json)** — 1 finding

| Where                                                                           | Rule                     | Severity | Finding                      |
| ------------------------------------------------------------------------------- | ------------------------ | -------- | ---------------------------- |
| [`package.json`](https://github.com/acme/webapp/blob/feedbeef0012/package.json) | `knip/unused-dependency` | 🟨 minor | Unused dependency `left-pad` |

**[`src/a.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/a.ts)** — 1 finding

| Where                                                                   | Rule                        | Severity | Finding                                             |
| ----------------------------------------------------------------------- | --------------------------- | -------- | --------------------------------------------------- |
| [`src/a.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/a.ts) | `madge/circular-dependency` | 🟧 major | Circular dependency: src/a.ts → src/b.ts → src/a.ts |

**[`src/Component.tsx`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx)** — 4 findings (**1 new**)

| Where                                                                                             | Rule                                 | Severity        | Finding                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------- |
| [`src/Component.tsx`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx)         | `knip/unused-file`                   | **🟧 major** 🆕 | **File is never imported**                                                                                 |
| [`src/Component.tsx:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L5-L5) | `pentest/dangerously-set-inner-html` | 🟧 major        | `dangerouslySetInnerHTML` — XSS sink, sanitize or remove                                                   |
| [`src/Component.tsx:4`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L4-L4) | `jsx-a11y/alt-text`                  | 🟨 minor        | img elements must have an alt prop, either with meaningful text, or an empty string for decorative images. |
| [`src/Component.tsx:6`](https://github.com/acme/webapp/blob/feedbeef0012/src/Component.tsx#L6-L6) | `pentest/target-blank-no-rel`        | 🟨 minor        | `target="_blank"` without `rel="noopener"` — reverse tabnabbing                                            |

**[`src/danger.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts)** — 5 findings (**2 new**)

| Where                                                                                        | Rule                     | Severity        | Finding                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------ | --------------- | ----------------------------------------------------------------------- |
| [`src/danger.ts:10`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L10-L10) | `pentest/open-redirect`  | **🟧 major** 🆕 | **Possible open redirect from user-controlled input**                   |
| [`src/danger.ts:3`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L3-L3)    | `sonarjs/code-eval`      | **🟨 minor** 🆕 | **Make sure that this dynamic injection or execution of code is safe.** |
| [`src/danger.ts:4`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L4-L4)    | `pentest/new-function`   | 🟧 major        | `new Function()` — dynamic code execution                               |
| [`src/danger.ts:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L5-L5)    | `pentest/cleartext-http` | 🟨 minor        | Cleartext `http://` URL — use https                                     |
| [`src/danger.ts:9`](https://github.com/acme/webapp/blob/feedbeef0012/src/danger.ts#L9-L9)    | `knip/unused-export`     | 🟨 minor        | Unused export `redirect`                                                |

**[`src/index.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts)** — 3 findings

| Where                                                                                         | Rule                           | Severity | Finding                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| [`src/index.ts:16`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts#L16-L16)    | `sonarjs/cognitive-complexity` | 🟧 major | Refactor this function to reduce its Cognitive Complexity from 43 to the 15 allowed. |
| [`src/index.ts:23–31`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts#L23-L31) | `max-depth`                    | 🟧 major | Blocks are nested too deeply (6). Maximum allowed is 5.                              |
| [`src/index.ts:24–30`](https://github.com/acme/webapp/blob/feedbeef0012/src/index.ts#L24-L30) | `max-depth`                    | 🟧 major | Blocks are nested too deeply (7). Maximum allowed is 5.                              |

**[`src/unused.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/unused.ts)** — 1 finding

| Where                                                                             | Rule               | Severity | Finding                |
| --------------------------------------------------------------------------------- | ------------------ | -------- | ---------------------- |
| [`src/unused.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/unused.ts) | `knip/unused-file` | 🟧 major | File is never imported |

**[`src/util.ts`](https://github.com/acme/webapp/blob/feedbeef0012/src/util.ts)** — 1 finding

| Where                                                                                 | Rule                 | Severity | Finding                     |
| ------------------------------------------------------------------------------------- | -------------------- | -------- | --------------------------- |
| [`src/util.ts:5`](https://github.com/acme/webapp/blob/feedbeef0012/src/util.ts#L5-L5) | `knip/unused-export` | 🟨 minor | Unused export `neverCalled` |

</details>

<sub>Reported by **PR Review Insight** · schema v1 · baseline `a1b2c3d`</sub>
