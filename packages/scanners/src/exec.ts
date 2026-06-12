import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Exec, ExecResult } from './types';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** no shell — arguments are passed verbatim, never interpolated */
export const realExec: Exec = (command, args, opts) =>
  new Promise<ExecResult>((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: opts.cwd,
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
            ? ((error as unknown as { code: number }).code as number)
            : error
              ? 1
              : 0;
        resolve({ stdout: String(stdout), stderr: String(stderr), code });
      }
    );
  });

/**
 * Prefer the repo-local binary; fall back to `npx --yes pkg@pinned` so the
 * action works without the tool pre-installed (npm-only, D1; pinned, D6).
 */
export function resolveTool(
  cwd: string,
  bin: string,
  npxSpec: string
): { command: string; prefixArgs: string[] } {
  const local = join(cwd, 'node_modules', '.bin', bin);
  if (existsSync(local)) return { command: local, prefixArgs: [] };
  // also check next to our own install (workspace hoisting)
  const own = join(__dirname, '..', '..', '..', 'node_modules', '.bin', bin);
  if (existsSync(own)) return { command: own, prefixArgs: [] };
  return { command: 'npx', prefixArgs: ['--yes', npxSpec] };
}

/** ANSI escapes never reach the comment (hard-won rule #7) */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, '');
}
