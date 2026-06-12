import { z } from 'zod';
import { CATEGORIES, SEVERITIES } from '../model/finding';

export const REPORT_SCHEMA_VERSION = 1;

/**
 * Priority discipline (highest wins):
 * scan-error > invalid-data > gate-failed > no-baseline > new-findings >
 * improved > no-change > passed
 */
export const reportStateSchema = z.enum([
  'passed',
  'gate-failed',
  'new-findings',
  'improved',
  'no-change',
  'no-baseline',
  'invalid-data',
  'scan-error',
]);

export type ReportState = z.infer<typeof reportStateSchema>;

export const categorySchema = z.enum(CATEGORIES);
export const severitySchema = z.enum(SEVERITIES);

export const findingSchema = z
  .object({
    category: categorySchema,
    ruleId: z.string(),
    severity: severitySchema,
    owasp: z.string().optional(),
    file: z.string(),
    range: z.object({ start: z.number().int(), end: z.number().int() }).optional(),
    message: z.string(),
    fingerprint: z.string(),
    isNew: z.boolean().optional(),
    touched: z.boolean().optional(),
    detail: z.string().optional(),
  })
  .strict();

export const severityCountsSchema = z.object({
  info: z.number().int(),
  minor: z.number().int(),
  major: z.number().int(),
  critical: z.number().int(),
});

export const categorySummarySchema = z
  .object({
    category: categorySchema,
    total: z.number().int(),
    /** null when no baseline (isNew unknowable) */
    new: z.number().int().nullable(),
    worst: severitySchema.nullable(),
    bySeverity: severityCountsSchema,
    /** count delta vs baseline totals, when history is available */
    delta: z.number().int().nullable(),
  })
  .strict();

export const gateViolationSchema = z
  .object({
    rule: z.enum(['new-findings', 'total-findings', 'duplication', 'dead-code']),
    severity: severitySchema.optional(),
    limit: z.number(),
    actual: z.number(),
    detail: z.string(),
  })
  .strict();

export const scannerErrorSchema = z
  .object({
    scanner: z.string(),
    message: z.string(),
    fatal: z.boolean(),
  })
  .strict();

export const baselineMetaSchema = z
  .object({
    sha: z.string(),
    ref: z.string().optional(),
    timestamp: z.string().optional(),
    /** 'scan' = merge-base scanned in this very run (dual-scan mode) */
    source: z.enum(['branch', 'cache', 'file', 'scan']),
    /** commits between merge-base and the baseline entry actually used */
    staleness: z.number().int().optional(),
  })
  .strict();

export const reviewReportSchema = z
  .object({
    schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
    generatedAt: z.string(),
    state: reportStateSchema,
    repo: z.object({ owner: z.string(), repo: z.string() }).optional(),
    pr: z.object({ number: z.number().int(), headSha: z.string().optional() }).optional(),
    policy: z
      .object({
        verdict: z.enum(['pass', 'warn', 'fail']),
        violations: z.array(gateViolationSchema),
        description: z.string(),
      })
      .optional(),
    totals: z
      .object({
        total: z.number().int(),
        new: z.number().int().nullable(),
        bySeverity: severityCountsSchema,
      })
      .optional(),
    categories: z.array(categorySummarySchema).optional(),
    findings: z.array(findingSchema).optional(),
    stats: z
      .object({
        duplicationPercent: z.number().optional(),
        baselineDuplicationPercent: z.number().optional(),
        filesScanned: z.number().int().optional(),
      })
      .optional(),
    baseline: baselineMetaSchema.nullable().optional(),
    errors: z.array(scannerErrorSchema).optional(),
    warnings: z.array(z.string()).optional(),
  })
  .strict();

export type ReviewReport = z.infer<typeof reviewReportSchema>;
export type CategorySummary = z.infer<typeof categorySummarySchema>;
export type ScannerError = z.infer<typeof scannerErrorSchema>;
export type BaselineMeta = z.infer<typeof baselineMetaSchema>;
