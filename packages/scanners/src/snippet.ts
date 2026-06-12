import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

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

function safeRealpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * Workspace-relative forward-slash path (hard-won rule #5). Tools report
 * paths absolute, cwd-relative or even relative to their own output dir —
 * and macOS aliases /tmp to /private/tmp — so try every combination and keep
 * the first candidate that lands inside the workspace.
 */
export function relativize(cwd: string, file: string): string {
  const abs = isAbsolute(file) ? resolve(file) : resolve(cwd, file);
  const bases = [resolve(cwd), safeRealpath(cwd)];
  for (const candidate of [abs, safeRealpath(abs)]) {
    for (const base of bases) {
      const rel = relative(base, candidate);
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) {
        return rel.replace(/\\/g, '/');
      }
    }
  }
  return file.replace(/\\/g, '/');
}
