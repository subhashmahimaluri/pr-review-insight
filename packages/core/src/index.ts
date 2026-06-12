export {
  CATEGORIES,
  CATEGORY_META,
  SEVERITIES,
  SEVERITY_RANK,
  countBySeverity,
  worstSeverity,
} from './model/finding';
export type { Category, Finding, Severity } from './model/finding';

export { fingerprint, normalizeSnippet } from './model/fingerprint';

export { configSchema, gatesSchema, DEFAULT_CONFIG } from './config/schema';
export type { Config, Gates, SeverityLimits } from './config/schema';
export { CONFIG_FILE, ConfigError, applyInputOverrides, loadConfig } from './config/loader';
export type { ConfigSource, InputOverrides } from './config/loader';

export { describePolicy, evaluateGates } from './gates/engine';
export type { GateInput, GateResult, GateVerdict, GateViolation } from './gates/engine';

export { applyBaseline, applyIgnores, markTouched } from './diff/attribution';

export {
  REPORT_SCHEMA_VERSION,
  reportStateSchema,
  reviewReportSchema,
  findingSchema,
} from './report/schema';
export type {
  BaselineMeta,
  CategorySummary,
  ReportState,
  ReviewReport,
  ScannerError,
} from './report/schema';

export { buildReport } from './report/build';
export type { BuildReportInput } from './report/build';
