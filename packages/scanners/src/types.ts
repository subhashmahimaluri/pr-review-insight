import { Category, Config, Finding, ScannerError } from '@pr-review-insight/core';

export type ExecResult = { stdout: string; stderr: string; code: number };

/** injectable process runner so adapters are unit-testable without the tools */
export type Exec = (
  command: string,
  args: string[],
  opts: { cwd: string; timeoutMs?: number }
) => Promise<ExecResult>;

export type ScanContext = {
  cwd: string;
  config: Config;
  /** workspace-relative changed files, when the caller knows the PR diff */
  changedFiles?: string[];
  exec: Exec;
};

export type ScannerOutcome = {
  scanner: string;
  category: Category;
  findings: Finding[];
  stats?: { duplicationPercent?: number; filesScanned?: number };
  warnings?: string[];
};

export interface ScannerAdapter {
  name: string;
  category: Category;
  run(ctx: ScanContext): Promise<ScannerOutcome>;
}

export type ScanResult = {
  findings: Finding[];
  stats: { duplicationPercent?: number; filesScanned?: number };
  errors: ScannerError[];
  warnings: string[];
};
