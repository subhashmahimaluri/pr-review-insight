import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ZodError } from 'zod';
import { Config, configSchema } from './schema';

export const CONFIG_FILE = 'pr-review-insight.config.json';
export const PACKAGE_JSON_KEY = 'pr-review-insight';

export type ConfigSource = 'file' | 'package.json' | 'defaults';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

function parseConfig(raw: unknown, origin: string): Config {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`Invalid config in ${origin} — ${formatZodError(result.error)}`);
  }
  return result.data;
}

/**
 * Discovery order: pr-review-insight.config.json → "pr-review-insight" key in
 * package.json → defaults. Action inputs are applied on top via
 * `applyInputOverrides` (file < inputs).
 */
export function loadConfig(cwd = process.cwd()): { config: Config; source: ConfigSource } {
  const filePath = join(cwd, CONFIG_FILE);
  if (existsSync(filePath)) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new ConfigError(`Could not parse ${CONFIG_FILE}: ${(error as Error).message}`);
    }
    return { config: parseConfig(raw, CONFIG_FILE), source: 'file' };
  }

  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
      if (pkg[PACKAGE_JSON_KEY] !== undefined) {
        return {
          config: parseConfig(pkg[PACKAGE_JSON_KEY], `package.json#${PACKAGE_JSON_KEY}`),
          source: 'package.json',
        };
      }
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      // unreadable package.json is not our error to report
    }
  }

  return { config: configSchema.parse({}), source: 'defaults' };
}

export type InputOverrides = {
  /** the `gates` action input — same JSON shape as the config file `gates` key */
  gates?: string;
  ignore?: string[];
  strict?: boolean;
};

export function applyInputOverrides(config: Config, inputs: InputOverrides): Config {
  let next = config;
  if (inputs.gates && inputs.gates.trim().length > 0) {
    let raw: unknown;
    try {
      raw = JSON.parse(inputs.gates);
    } catch (error) {
      throw new ConfigError(`Invalid \`gates\` input JSON: ${(error as Error).message}`);
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ConfigError('Invalid `gates` input JSON: expected an object');
    }
    const current = configToRaw(next);
    const merged = {
      ...current,
      gates: { ...(current.gates as Record<string, unknown>), ...(raw as Record<string, unknown>) },
    };
    next = parseConfig(merged, '`gates` input');
  }
  if (inputs.ignore && inputs.ignore.length > 0) {
    next = { ...next, ignore: [...next.ignore, ...inputs.ignore] };
  }
  if (inputs.strict !== undefined) {
    next = { ...next, strict: inputs.strict };
  }
  return next;
}

function configToRaw(config: Config): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}
