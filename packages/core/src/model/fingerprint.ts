import { createHash } from 'node:crypto';

/**
 * Normalize a code snippet so the fingerprint survives unrelated edits:
 * whitespace collapsed, lines trimmed, blank lines dropped. Line numbers are
 * deliberately excluded — a finding that merely moves keeps its identity.
 */
export function normalizeSnippet(snippet: string): string {
  return snippet
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0)
    .join('\n');
}

export function fingerprint(input: {
  ruleId: string;
  file: string;
  /** the offending source lines when available; falls back to the message */
  snippet?: string;
  message: string;
}): string {
  const context = input.snippet ? normalizeSnippet(input.snippet) : input.message.trim();
  const hash = createHash('sha256');
  hash.update(input.ruleId);
  hash.update('\0');
  hash.update(input.file);
  hash.update('\0');
  hash.update(context);
  return hash.digest('hex').slice(0, 16);
}
