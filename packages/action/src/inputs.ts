import { getBooleanInput, getInput } from '@actions/core';

export type ActionInputs = {
  token: string;
  mode: 'report' | 'baseline';
  baselineBranch: string;
  /**
   * auto: recorded baseline branch, falling back to scanning the merge-base
   * in this run · branch: recorded only · scan: dual-scan only (no baseline
   * branch needed) · off: never resolve a baseline
   */
  baselineMode: 'auto' | 'branch' | 'scan' | 'off';
  /** JSON, same shape as the config file `gates` key (file < input) */
  gates: string;
  ignore: string[];
  strict: boolean;
  comment: boolean;
  checkRun: boolean;
  annotations: 'new' | 'all' | 'none';
  reportFile: string;
  sarifFile: string;
  htmlFile: string;
  fixPlanFile: string;
};

export function readInputs(): ActionInputs {
  const mode = (getInput('mode') || 'report') as ActionInputs['mode'];
  if (mode !== 'report' && mode !== 'baseline') {
    throw new Error(`Invalid \`mode\` input: ${mode} (expected report|baseline)`);
  }
  const annotations = (getInput('annotations') || 'new') as ActionInputs['annotations'];
  if (!['new', 'all', 'none'].includes(annotations)) {
    throw new Error(`Invalid \`annotations\` input: ${annotations} (expected new|all|none)`);
  }
  const baselineMode = (getInput('baseline-mode') || 'auto') as ActionInputs['baselineMode'];
  if (!['auto', 'branch', 'scan', 'off'].includes(baselineMode)) {
    throw new Error(
      `Invalid \`baseline-mode\` input: ${baselineMode} (expected auto|branch|scan|off)`
    );
  }
  return {
    token: getInput('github-token', { required: true }),
    mode,
    baselineBranch: getInput('baseline-branch') || 'pr-review-insight-baseline',
    baselineMode,
    gates: getInput('gates') || '',
    ignore: (getInput('ignore') || '')
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    strict: getInput('strict') ? getBooleanInput('strict') : false,
    comment: getInput('comment') ? getBooleanInput('comment') : true,
    checkRun: getInput('check-run') ? getBooleanInput('check-run') : true,
    annotations,
    reportFile: getInput('report-file') || 'code-report.json',
    sarifFile: getInput('sarif-file') || '',
    htmlFile: getInput('html-file') || '',
    fixPlanFile: getInput('fix-plan-file') || '',
  };
}
