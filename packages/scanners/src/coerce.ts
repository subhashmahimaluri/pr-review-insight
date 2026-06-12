/**
 * Defensive coercion for external-tool JSON. We ingest five tools' output;
 * any of them can emit shapes we never saw (version bumps, partial writes,
 * error payloads). Parsers use these so a weird shape degrades to "no
 * findings" instead of a TypeError from deep inside. Pinned by the fuzz
 * suite (test/fuzz.test.ts).
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
