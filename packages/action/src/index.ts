import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFailed, setOutput, info, warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import {
  Category,
  ConfigError,
  applyBaseline,
  applyInputOverrides,
  buildReport,
  evaluateGates,
  loadConfig,
  ReviewReport,
} from '@pr-review-insight/core';
import { realExec, runScanners } from '@pr-review-insight/scanners';
import {
  renderFixPlan,
  renderHtml,
  renderMarkdown,
  renderSarif,
  HEADERS,
} from '@pr-review-insight/reporters';
import {
  BaselineEntry,
  GateCardInfo,
  HistoryPoint,
  emptyCounts,
  entriesToSeries,
  overviewBandPath,
  prOverviewBandPath,
  renderOverviewBandSvg,
} from '@pr-review-insight/history';
import { readInputs, ActionInputs } from './inputs';
import { upsertReviewComment } from './github';
import { buildAnnotations, postCheckRun } from './checkRun';
import { commitFiles, pushIndexEntry, readEntry, readIndex } from './baseline/store';
import { resolveBaseline, ResolvedBaseline } from './baseline/resolve';
import { scanMergeBase } from './baseline/dualScan';

type Octokit = ReturnType<typeof getOctokit>;

const SPARKLINE_FETCH_LIMIT = 15;

async function fetchSeries(
  octokit: Octokit,
  params: { owner: string; repo: string; branch: string }
): Promise<HistoryPoint[]> {
  const index = await readIndex(octokit, params);
  const entries: BaselineEntry[] = [];
  for (const { sha } of index.entries.slice(0, SPARKLINE_FETCH_LIMIT)) {
    const entry = await readEntry(octokit, { ...params, sha });
    if (entry) entries.push(entry);
  }
  return entriesToSeries(entries);
}

function countsFromReport(report: ReviewReport): Record<Category, number> {
  const counts = emptyCounts();
  for (const summary of report.categories ?? []) counts[summary.category] = summary.total;
  return counts;
}

async function runBaselineMode(inputs: ActionInputs): Promise<void> {
  const octokit = getOctokit(inputs.token);
  const { owner, repo } = context.repo;
  const cwd = process.env.GITHUB_WORKSPACE ?? process.cwd();

  const { config: fileConfig } = loadConfig(cwd);
  const config = applyInputOverrides(fileConfig, {
    gates: inputs.gates,
    ignore: inputs.ignore,
    strict: inputs.strict,
  });

  const scan = await runScanners({ cwd, config, exec: realExec });
  for (const err of scan.errors) warning(`scanner ${err.scanner}: ${err.message}`);

  const policy = evaluateGates({
    findings: scan.findings,
    duplicationPercent: scan.stats.duplicationPercent,
    config,
    hasBaseline: false,
  });
  const report = buildReport({
    findings: scan.findings,
    policy,
    baseline: null,
    scannerErrors: scan.errors,
    warnings: scan.warnings,
    stats: scan.stats,
    repo: { owner, repo },
    generatedAt: new Date().toISOString(),
  });

  const entry: BaselineEntry = {
    sha: context.sha,
    ref: context.ref,
    timestamp: new Date().toISOString(),
    fingerprints: scan.findings.map((f) => f.fingerprint),
    counts: countsFromReport(report),
    stats: { duplicationPercent: scan.stats.duplicationPercent },
  };

  const branchParams = { owner, repo, branch: inputs.baselineBranch };
  const index = pushIndexEntry(await readIndex(octokit, branchParams), {
    sha: entry.sha,
    timestamp: entry.timestamp,
  });
  const series = [
    ...(await fetchSeries(octokit, branchParams)),
    {
      sha: entry.sha,
      timestamp: entry.timestamp,
      counts: entry.counts,
    },
  ];

  await commitFiles(octokit, {
    ...branchParams,
    message: `baseline: ${entry.sha.slice(0, 7)} (${scan.findings.length} findings)`,
    files: [
      { path: `baselines/${entry.sha}.json`, content: JSON.stringify(entry, null, 2) },
      { path: 'index.json', content: JSON.stringify(index, null, 2) },
      {
        path: overviewBandPath('light'),
        content: renderOverviewBandSvg(report.categories ?? [], series, 'light'),
      },
      {
        path: overviewBandPath('dark'),
        content: renderOverviewBandSvg(report.categories ?? [], series, 'dark'),
      },
    ],
  });
  info(`Baseline recorded for ${entry.sha} (${scan.findings.length} findings)`);
  setOutput('state', report.state);
  setOutput('total-findings', scan.findings.length);
}

async function runReportMode(inputs: ActionInputs): Promise<void> {
  const octokit = getOctokit(inputs.token);
  const { owner, repo } = context.repo;
  const cwd = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const pr = context.payload.pull_request as
    | { number: number; head: { sha: string }; base: { sha: string } }
    | undefined;

  const inputErrors: string[] = [];
  const config = (() => {
    try {
      const { config: fileConfig } = loadConfig(cwd);
      return applyInputOverrides(fileConfig, {
        gates: inputs.gates,
        ignore: inputs.ignore,
        strict: inputs.strict,
      });
    } catch (error) {
      if (error instanceof ConfigError) {
        inputErrors.push(error.message);
        return applyInputOverrides(loadConfigSafeDefaults(), { strict: inputs.strict });
      }
      throw error;
    }
  })();

  // touched files via the PR API — drives annotations and 🆕 attribution UX
  let changedFiles: string[] = [];
  if (pr) {
    try {
      changedFiles = await octokit
        .paginate(octokit.rest.pulls.listFiles, {
          owner,
          repo,
          pull_number: pr.number,
          per_page: 100,
        })
        .then((files) => files.map((f) => f.filename));
    } catch (error) {
      warning(`Could not list PR files: ${(error as Error).message}`);
    }
  }

  const scan = await runScanners({ cwd, config, changedFiles, exec: realExec });
  for (const err of scan.errors) warning(`scanner ${err.scanner}: ${err.message}`);

  // baseline at the merge-base — pre-existing debt is reported, never blocking (D3)
  let baseline: ResolvedBaseline | null = null;
  if (pr && inputs.baselineMode !== 'off') {
    try {
      const { data: comparison } = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: pr.base.sha,
        head: pr.head.sha,
      });
      const mergeBaseSha = comparison.merge_base_commit?.sha ?? pr.base.sha;
      if (inputs.baselineMode === 'auto' || inputs.baselineMode === 'branch') {
        baseline = await resolveBaseline({
          octokit,
          owner,
          repo,
          branch: inputs.baselineBranch,
          mergeBaseSha,
        });
      }
      // dual-scan: no recorded baseline needed — scan the merge-base right here
      if (!baseline && (inputs.baselineMode === 'auto' || inputs.baselineMode === 'scan')) {
        info(`Scanning merge-base ${mergeBaseSha.slice(0, 7)} for the baseline (dual-scan)…`);
        const entry = await scanMergeBase({ cwd, mergeBaseSha, config });
        if (entry) {
          baseline = {
            entry,
            meta: { sha: mergeBaseSha, source: 'scan', staleness: 0 },
          };
        } else {
          warning(
            `Merge-base ${mergeBaseSha.slice(0, 7)} is not available locally — ` +
              'use actions/checkout with `fetch-depth: 0` to enable dual-scan baselines'
          );
        }
      }
    } catch (error) {
      warning(`Baseline resolution failed: ${(error as Error).message}`);
    }
  }

  const findings = applyBaseline(
    scan.findings,
    baseline ? new Set(baseline.entry.fingerprints) : null
  );
  const policy = evaluateGates({
    findings,
    duplicationPercent: scan.stats.duplicationPercent,
    baselineDuplicationPercent: baseline?.entry.stats?.duplicationPercent,
    config,
    hasBaseline: baseline !== null,
  });
  const report = buildReport({
    findings,
    policy,
    baseline: baseline?.meta ?? null,
    baselineCounts: baseline?.entry.counts ?? null,
    scannerErrors: scan.errors,
    inputErrors,
    warnings: scan.warnings,
    stats: {
      ...scan.stats,
      baselineDuplicationPercent: baseline?.entry.stats?.duplicationPercent,
    },
    repo: { owner, repo },
    pr: pr ? { number: pr.number, headSha: pr.head.sha } : undefined,
    strict: config.strict,
    generatedAt: new Date().toISOString(),
  });

  // D5 — the versioned JSON artifact is emitted in EVERY state
  writeFileSync(join(cwd, inputs.reportFile), JSON.stringify(report, null, 2));
  if (inputs.sarifFile) {
    writeFileSync(join(cwd, inputs.sarifFile), JSON.stringify(renderSarif(report), null, 2));
  }
  if (inputs.htmlFile) {
    writeFileSync(join(cwd, inputs.htmlFile), renderHtml(report));
  }
  if (inputs.fixPlanFile) {
    writeFileSync(join(cwd, inputs.fixPlanFile), renderFixPlan(report));
  }

  // live per-PR band needs contents: write; otherwise fall back to the
  // base-branch band and say so in the caption (never headline base data as
  // the PR's — hard-won rule #4)
  let bandImages: { light: string; dark: string } | undefined;
  let bandCaption: string | undefined;
  if (pr) {
    const branchParams = { owner, repo, branch: inputs.baselineBranch };
    const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${inputs.baselineBranch}`;
    try {
      const series = await fetchSeries(octokit, branchParams);
      const prSeries = [...series, { sha: pr.head.sha, counts: countsFromReport(report) }];
      const newFindings = findings.filter((f) => f.isNew);
      const gate: GateCardInfo = {
        verdict: policy.verdict,
        newTotal: baseline ? newFindings.length : null,
        newCritical: newFindings.filter((f) => f.severity === 'critical').length,
        newMajor: newFindings.filter((f) => f.severity === 'major').length,
      };
      await commitFiles(octokit, {
        ...branchParams,
        message: `pr-band: PR #${pr.number} @ ${pr.head.sha.slice(0, 7)}`,
        files: (['light', 'dark'] as const).map((theme) => ({
          path: prOverviewBandPath(pr.number, theme),
          content: renderOverviewBandSvg(report.categories ?? [], prSeries, theme, { gate }),
        })),
      });
      // bust GitHub's camo image cache per RUN, not per commit — re-runs on
      // the same sha would otherwise serve a stale band forever
      const cacheBust = `${pr.head.sha.slice(0, 7)}-${context.runId}`;
      bandImages = {
        light: `${rawBase}/${prOverviewBandPath(pr.number, 'light')}?v=${cacheBust}`,
        dark: `${rawBase}/${prOverviewBandPath(pr.number, 'dark')}?v=${cacheBust}`,
      };
      const baseLabel = baseline
        ? baseline.meta.source === 'scan'
          ? `Δ vs merge-base \`${baseline.meta.sha.slice(0, 7)}\` (scanned in this run)`
          : `Δ vs base \`${baseline.meta.sha.slice(0, 7)}\``
        : 'no baseline yet';
      const sparkLabel =
        series.length > 1 ? ` · sparklines: last ${series.length} baseline runs` : '';
      bandCaption = `Findings per category for this PR · ${baseLabel}${sparkLabel}`;
    } catch (error) {
      warning(`Could not publish per-PR band (needs contents: write): ${(error as Error).message}`);
      if (baseline) {
        bandImages = {
          light: `${rawBase}/${overviewBandPath('light')}`,
          dark: `${rawBase}/${overviewBandPath('dark')}`,
        };
        bandCaption =
          '⚠️ Band shows the **base branch**, not this PR (grant `contents: write` for a live per-PR band). The tables below are this PR.';
      }
    }
  }

  const body = renderMarkdown(report, { bandImages, bandCaption });

  // posting can never mask the verdict (hard-won rule #2)
  if (inputs.comment && pr) {
    try {
      await upsertReviewComment({ octokit, owner, repo, prNumber: pr.number, body });
    } catch (error) {
      warning(`Could not post PR comment: ${(error as Error).message}`);
    }
  }

  const conclusion =
    report.state === 'gate-failed' ||
    report.state === 'invalid-data' ||
    report.state === 'scan-error'
      ? 'failure'
      : report.state === 'new-findings'
        ? 'neutral'
        : 'success';
  if (inputs.checkRun) {
    try {
      await postCheckRun({
        token: inputs.token,
        title: HEADERS[report.state],
        summary: body.slice(0, 60000),
        conclusion,
        annotations:
          inputs.annotations === 'none' ? [] : buildAnnotations(findings, inputs.annotations),
      });
    } catch (error) {
      warning(`Could not post check run: ${(error as Error).message}`);
    }
  }

  setOutput('state', report.state);
  setOutput('verdict', policy.verdict);
  setOutput('total-findings', findings.length);
  setOutput('new-findings', findings.filter((f) => f.isNew).length);
  setOutput('report-file', inputs.reportFile);

  // job failure semantics: gates and real errors decide, never tool noise
  if (report.state === 'gate-failed') {
    setFailed(
      `Code review gate failed: ${policy.violations.length} violation(s) — see the PR comment`
    );
  } else if (report.state === 'invalid-data') {
    setFailed(`Invalid input: ${inputErrors.join('; ')}`);
  } else if (report.state === 'scan-error') {
    setFailed(
      `Scan error: ${scan.errors
        .map((e) => `${e.scanner}: ${e.message}`)
        .join('; ')
        .slice(0, 500)}`
    );
  }
}

function loadConfigSafeDefaults() {
  // config parse failed — fall back to defaults so the report can still post
  return applyInputOverrides(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@pr-review-insight/core') as typeof import('@pr-review-insight/core')).DEFAULT_CONFIG,
    {}
  );
}

async function main(): Promise<void> {
  const inputs = readInputs();
  if (inputs.mode === 'baseline') {
    await runBaselineMode(inputs);
  } else {
    await runReportMode(inputs);
  }
}

main().catch((error: Error) => {
  // a crash in the wrapper itself fails the job with the real reason
  setFailed(`pr-review-insight crashed: ${error.stack ?? error.message}`);
});
