import { describe, expect, it } from 'vitest';
import { configSchema, DEFAULT_CONFIG } from '@pr-review-insight/core';
import {
  INSTRUCTIONS_END,
  INSTRUCTIONS_START,
  renderCopilotInstructions,
  upsertInstructions,
} from '@pr-review-insight/reporters';

describe('renderCopilotInstructions', () => {
  it('derives the guidance from the actual gate policy', () => {
    const block = renderCopilotInstructions(DEFAULT_CONFIG);
    expect(block).toContain(INSTRUCTIONS_START);
    expect(block).toContain(INSTRUCTIONS_END);
    expect(block).toContain('zero new critical');
    expect(block).toContain('cognitive complexity ≤ 15');
    expect(block).toContain('cyclomatic complexity ≤ 20');
    expect(block).toContain('gated at 5%');
    expect(block).toContain('rel="noopener"');
    expect(block).toContain('Accessibility (JSX)');
  });

  it('reflects config overrides and disabled categories', () => {
    const config = configSchema.parse({
      gates: { complexity: { maxCognitive: 10, maxCyclomatic: 12 } },
      categories: { a11y: false },
    });
    const block = renderCopilotInstructions(config);
    expect(block).toContain('cognitive complexity ≤ 10');
    expect(block).toContain('cyclomatic complexity ≤ 12');
    expect(block).not.toContain('Accessibility (JSX)');
  });
});

describe('upsertInstructions', () => {
  const block = renderCopilotInstructions(DEFAULT_CONFIG);

  it('creates a fresh file when none exists', () => {
    expect(upsertInstructions(null, block)).toBe(`${block}\n`);
  });

  it('appends to an existing file without markers, preserving content', () => {
    const result = upsertInstructions('# Team conventions\n\nUse pnpm.\n', block);
    expect(result).toContain('# Team conventions');
    expect(result).toContain('Use pnpm.');
    expect(result).toContain(INSTRUCTIONS_START);
  });

  it('replaces only the marked block on re-run (idempotent)', () => {
    const original = `# Team conventions\n\n${block}\n\n## After section\n`;
    const updated = upsertInstructions(original, block.replace('≤ 15', '≤ 99'));
    expect(updated).toContain('# Team conventions');
    expect(updated).toContain('## After section');
    expect(updated).toContain('≤ 99');
    expect(updated).not.toContain('≤ 15');
    // exactly one marked block
    expect(updated.split(INSTRUCTIONS_START)).toHaveLength(2);
  });
});
