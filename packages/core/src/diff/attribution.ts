import picomatch from 'picomatch';
import { Finding } from '../model/finding';

/**
 * Mark each finding new/pre-existing against the baseline fingerprint set
 * (D3 — the Sonar "new code" model). With no baseline every finding stays
 * unmarked: first runs report, they never blame.
 */
export function applyBaseline(
  findings: Finding[],
  baselineFingerprints: ReadonlySet<string> | null
): Finding[] {
  if (!baselineFingerprints) return findings.map((f) => ({ ...f, isNew: undefined }));
  return findings.map((f) => ({ ...f, isNew: !baselineFingerprints.has(f.fingerprint) }));
}

/** Mark findings whose file is part of the PR diff. */
export function markTouched(findings: Finding[], touchedFiles: ReadonlySet<string>): Finding[] {
  return findings.map((f) => ({ ...f, touched: touchedFiles.has(f.file) }));
}

/** Drop findings matching the configured ignore globs. */
export function applyIgnores(findings: Finding[], ignore: string[]): Finding[] {
  if (ignore.length === 0) return findings;
  const isIgnored = picomatch(ignore, { dot: true });
  return findings.filter((f) => !isIgnored(f.file));
}
