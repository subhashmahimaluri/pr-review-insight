import { z } from 'zod';
import { CATEGORIES } from '../model/finding';

const severityLimitsSchema = z
  .object({
    critical: z.number().int().min(0).optional(),
    major: z.number().int().min(0).optional(),
    minor: z.number().int().min(0).optional(),
    info: z.number().int().min(0).optional(),
  })
  .strict();

export const gatesSchema = z
  .object({
    /** max NEW findings per severity — the diff-aware gate (D3), default-on */
    newFindings: severityLimitsSchema.default({ critical: 0, major: 5 }),
    /** optional absolute gate over ALL findings, pre-existing included */
    totals: severityLimitsSchema.optional(),
    duplication: z
      .object({ maxPercent: z.number().min(0).max(100) })
      .strict()
      .default({
        maxPercent: 5,
      }),
    complexity: z
      .object({
        maxCognitive: z.number().int().min(1).default(15),
        maxCyclomatic: z.number().int().min(1).default(20),
      })
      .strict()
      .default({ maxCognitive: 15, maxCyclomatic: 20 }),
    /** 'warn' = report-only; 'gate' = new dead code fails the job */
    deadCode: z.enum(['warn', 'gate']).default('warn'),
  })
  .strict();

export const configSchema = z
  .object({
    gates: gatesSchema.default({}),
    ignore: z.array(z.string()).default([]),
    /** disable whole categories, e.g. { a11y: false } */
    categories: z.record(z.enum(CATEGORIES), z.boolean()).default({}),
    owaspProfile: z.literal('top10-2021').default('top10-2021'),
    /** a scanner crash fails the job only when strict */
    strict: z.boolean().default(false),
    ai: z.enum(['off', 'comment']).default('off'),
    visuals: z.enum(['images', 'text', 'auto']).default('auto'),
  })
  .strict();

export type Gates = z.infer<typeof gatesSchema>;
export type Config = z.infer<typeof configSchema>;
export type SeverityLimits = z.infer<typeof severityLimitsSchema>;

export const DEFAULT_CONFIG: Config = configSchema.parse({});
