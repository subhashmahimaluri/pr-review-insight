import { Config } from '@pr-review-insight/core';
import { describePolicy } from '@pr-review-insight/core';

/**
 * Roadmap 7.2 — prevention, not cure: a copilot-instructions block derived
 * from the repo's actual gate policy, so AI assistants avoid *creating*
 * findings while authoring. Upserted between markers so the rest of the
 * file stays owned by the team.
 */
export const INSTRUCTIONS_START = '<!-- pr-review-insight:start -->';
export const INSTRUCTIONS_END = '<!-- pr-review-insight:end -->';

export function renderCopilotInstructions(config: Config): string {
  const { maxCognitive, maxCyclomatic } = config.gates.complexity;
  const dup = config.gates.duplication;
  const enabled = (category: string) =>
    config.categories[category as keyof typeof config.categories] !== false;

  const lines: string[] = [
    INSTRUCTIONS_START,
    '',
    '## Code quality rules (enforced by PR Review Insight)',
    '',
    `Pull requests in this repository are gated: **${describePolicy(config)}**.`,
    'Every rule below maps to a scanner that will flag the PR — write code that',
    'passes the gate the first time.',
    '',
    '### Security',
    '',
    '- Never use `eval`, `new Function`, or `require`/`import` with a dynamic, user-influenced argument.',
    '- Never assign unsanitized values to `innerHTML`/`outerHTML`/`document.write`; avoid `dangerouslySetInnerHTML` — sanitize first if unavoidable.',
    '- Never commit secrets. Never put secret-looking values behind client-exposed env prefixes (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`) — they ship in the bundle.',
    '- Use `https://` URLs. Add `rel="noopener"` to every `target="_blank"` link.',
    '- No wildcard CORS (`Access-Control-Allow-Origin: *`). Set `HttpOnly` and `Secure` on cookies.',
    '- Never redirect to a URL taken from user input (query params, hash, request body).',
    '- Avoid regexes with catastrophic backtracking; avoid non-literal file paths in `fs` calls.',
    '',
    '### Complexity & size',
    '',
    `- Keep cognitive complexity ≤ ${maxCognitive} and cyclomatic complexity ≤ ${maxCyclomatic} per function.`,
    '- Nest blocks at most 5 deep; keep functions under 200 lines — extract helpers instead.',
    '',
    '### Duplication & dead code',
    '',
    `- Do not copy-paste blocks of code — extract and reuse (duplication is gated at ${dup.maxPercent}%${dup.scope === 'new' ? ', judged on what the PR adds' : ''}).`,
    '- Remove unused exports, files and dependencies as you go; do not leave commented-out code.',
  ];

  if (enabled('a11y')) {
    lines.push(
      '',
      '### Accessibility (JSX)',
      '',
      '- Every `<img>` needs a meaningful `alt` (or `alt=""` when decorative).',
      '- Use ARIA attributes only where the role supports them; prefer semantic elements over `role` overrides.',
      '- Interactive elements must be keyboard-reachable and labeled.'
    );
  }

  lines.push(
    '',
    '### Code smells',
    '',
    '- Follow eslint-plugin-sonarjs recommended rules: no identical branches/expressions, no ignored return values, no empty collections reads, prefer early returns.',
    '',
    INSTRUCTIONS_END
  );

  return lines.join('\n');
}

/** insert or replace the marked block, leaving the rest of the file alone */
export function upsertInstructions(existing: string | null, block: string): string {
  if (!existing || existing.trim().length === 0) return `${block}\n`;
  const start = existing.indexOf(INSTRUCTIONS_START);
  const end = existing.indexOf(INSTRUCTIONS_END);
  if (start !== -1 && end !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + INSTRUCTIONS_END.length);
  }
  return `${existing.replace(/\s*$/, '')}\n\n${block}\n`;
}
