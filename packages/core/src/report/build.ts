import { CATEGORIES, Category, Finding, countBySeverity, worstSeverity } from '../model/finding';
import { GateResult } from '../gates/engine';
import {
  BaselineMeta,
  CategorySummary,
  REPORT_SCHEMA_VERSION,
  ReportState,
  ReviewReport,
  ScannerError,
} from './schema';

export type BuildReportInput = {
  findings: Finding[];
  policy: GateResult;
  /** null = no baseline resolved (first run) */
  baseline: BaselineMeta | null;
  /** per-category totals recorded in the baseline, for Δ and `improved` */
  baselineCounts?: Partial<Record<Category, number>> | null;
  scannerErrors?: ScannerError[];
  /** config/input-level errors — drive the invalid-data state */
  inputErrors?: string[];
  warnings?: string[];
  stats?: {
    duplicationPercent?: number;
    baselineDuplicationPercent?: number;
    filesScanned?: number;
  };
  repo?: { owner: string; repo: string };
  pr?: { number: number; headSha?: string };
  strict?: boolean;
  /** injectable for determinism (D6) — defaults to a fixed epoch in tests */
  generatedAt: string;
};

function classifyState(input: BuildReportInput, totalDelta: number | null): ReportState {
  const fatalCrash =
    (input.scannerErrors ?? []).some((e) => e.fatal) ||
    ((input.scannerErrors ?? []).length > 0 &&
      input.findings.length === 0 &&
      (input.scannerErrors ?? []).length >= 3);
  if (input.strict && (input.scannerErrors ?? []).length > 0) return 'scan-error';
  if (fatalCrash) return 'scan-error';
  if ((input.inputErrors ?? []).length > 0) return 'invalid-data';
  if (input.policy.verdict === 'fail') return 'gate-failed';
  if (!input.baseline) return 'no-baseline';
  const newCount = input.findings.filter((f) => f.isNew).length;
  if (newCount > 0) return 'new-findings';
  if (totalDelta !== null && totalDelta < 0) return 'improved';
  if (totalDelta === 0) return 'no-change';
  return 'passed';
}

function summarizeCategories(
  findings: Finding[],
  hasBaseline: boolean,
  baselineCounts?: Partial<Record<Category, number>> | null
): CategorySummary[] {
  return CATEGORIES.map((category) => {
    const inCategory = findings.filter((f) => f.category === category);
    const base = baselineCounts?.[category];
    return {
      category,
      total: inCategory.length,
      new: hasBaseline ? inCategory.filter((f) => f.isNew).length : null,
      worst: worstSeverity(inCategory),
      bySeverity: countBySeverity(inCategory),
      delta: base === undefined || base === null ? null : inCategory.length - base,
    };
  });
}

export function buildReport(input: BuildReportInput): ReviewReport {
  const hasBaseline = input.baseline !== null;
  const categories = summarizeCategories(input.findings, hasBaseline, input.baselineCounts);

  const baselineTotal = input.baselineCounts
    ? Object.values(input.baselineCounts).reduce((sum, n) => sum + (n ?? 0), 0)
    : null;
  const totalDelta = baselineTotal === null ? null : input.findings.length - baselineTotal;

  const state = classifyState(input, totalDelta);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    state,
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.pr ? { pr: input.pr } : {}),
    policy: {
      verdict: input.policy.verdict,
      violations: input.policy.violations,
      description: input.policy.description,
    },
    totals: {
      total: input.findings.length,
      new: hasBaseline ? input.findings.filter((f) => f.isNew).length : null,
      bySeverity: countBySeverity(input.findings),
    },
    categories,
    findings: input.findings,
    ...(input.stats ? { stats: input.stats } : {}),
    baseline: input.baseline,
    errors: input.scannerErrors ?? [],
    warnings: [...(input.inputErrors ?? []).map((e) => `input: ${e}`), ...(input.warnings ?? [])],
  };
}
