import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map<string, string[] | null>();

/**
 * Source lines for fingerprinting. Cached per file; a missing/binary file
 * yields undefined and the fingerprint falls back to the message.
 */
export function snippetFor(
  cwd: string,
  relativeFile: string,
  range?: { start: number; end: number }
): string | undefined {
  if (!range) return undefined;
  const key = join(cwd, relativeFile);
  if (!cache.has(key)) {
    try {
      cache.set(key, readFileSync(key, 'utf8').split('\n'));
    } catch {
      cache.set(key, null);
    }
  }
  const lines = cache.get(key);
  if (!lines) return undefined;
  const start = Math.max(1, range.start);
  const end = Math.min(lines.length, Math.max(range.end, start));
  const slice = lines.slice(start - 1, end);
  return slice.length > 0 ? slice.join('\n') : undefined;
}

export function clearSnippetCache(): void {
  cache.clear();
}

/** workspace-relative forward-slash path (hard-won rule #5) */
export function relativize(cwd: string, file: string): string {
  let rel = file;
  const normalizedCwd = cwd.endsWith('/') ? cwd : `${cwd}/`;
  if (rel.startsWith(normalizedCwd)) rel = rel.slice(normalizedCwd.length);
  return rel.replace(/\\/g, '/');
}
