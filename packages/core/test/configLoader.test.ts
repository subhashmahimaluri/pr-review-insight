import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ConfigError,
  applyInputOverrides,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  loadConfig,
} from '@pr-review-insight/core';

let dir: string;

function setup(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), 'pri-config-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('defaults when nothing found — newFindings.critical 0 is the point of the product', () => {
    const { config, source } = loadConfig(setup({}));
    expect(source).toBe('defaults');
    expect(config.gates.newFindings.critical).toBe(0);
    expect(config.gates.newFindings.major).toBe(5);
    expect(config.gates.duplication.maxPercent).toBe(5);
    expect(config.gates.deadCode).toBe('warn');
  });

  it('reads the config file ahead of package.json', () => {
    const cwd = setup({
      [CONFIG_FILE]: JSON.stringify({ gates: { duplication: { maxPercent: 3 } } }),
      'package.json': JSON.stringify({ 'pr-review-insight': { strict: true } }),
    });
    const { config, source } = loadConfig(cwd);
    expect(source).toBe('file');
    expect(config.gates.duplication.maxPercent).toBe(3);
    expect(config.strict).toBe(false);
  });

  it('reads the package.json key', () => {
    const cwd = setup({
      'package.json': JSON.stringify({ 'pr-review-insight': { ignore: ['**/gen/**'] } }),
    });
    const { config, source } = loadConfig(cwd);
    expect(source).toBe('package.json');
    expect(config.ignore).toEqual(['**/gen/**']);
  });

  it('rejects unknown keys with a readable error', () => {
    const cwd = setup({ [CONFIG_FILE]: JSON.stringify({ gatez: {} }) });
    expect(() => loadConfig(cwd)).toThrow(ConfigError);
  });

  it('rejects malformed JSON with a readable error', () => {
    const cwd = setup({ [CONFIG_FILE]: '{ nope' });
    expect(() => loadConfig(cwd)).toThrow(/Could not parse/);
  });
});

describe('applyInputOverrides', () => {
  it('action inputs win over file config (file < inputs)', () => {
    const config = applyInputOverrides(DEFAULT_CONFIG, {
      gates: JSON.stringify({ newFindings: { critical: 1 }, duplication: { maxPercent: 10 } }),
      strict: true,
    });
    expect(config.gates.newFindings.critical).toBe(1);
    expect(config.gates.duplication.maxPercent).toBe(10);
    expect(config.strict).toBe(true);
  });

  it('throws ConfigError on invalid gates JSON', () => {
    expect(() => applyInputOverrides(DEFAULT_CONFIG, { gates: '{nope' })).toThrow(ConfigError);
    expect(() => applyInputOverrides(DEFAULT_CONFIG, { gates: '[1]' })).toThrow(ConfigError);
  });

  it('appends ignore globs', () => {
    const config = applyInputOverrides(
      { ...DEFAULT_CONFIG, ignore: ['a/**'] },
      { ignore: ['b/**'] }
    );
    expect(config.ignore).toEqual(['a/**', 'b/**']);
  });
});
