import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, configSchema, evaluateGates } from '@pr-review-insight/core';
import { makeFinding } from './helpers';

describe('evaluateGates', () => {
  it('passes a clean scan', () => {
    const result = evaluateGates({ findings: [], config: DEFAULT_CONFIG, hasBaseline: true });
    expect(result.verdict).toBe('pass');
    expect(result.violations).toHaveLength(0);
  });

  it('fails on a single new critical (default newFindings.critical = 0)', () => {
    const result = evaluateGates({
      findings: [makeFinding({ severity: 'critical', isNew: true })],
      config: DEFAULT_CONFIG,
      hasBaseline: true,
    });
    expect(result.verdict).toBe('fail');
    expect(result.violations[0]).toMatchObject({ rule: 'new-findings', severity: 'critical' });
  });

  it('does NOT fail on pre-existing criticals — debt is reported, never blocking (D3)', () => {
    const result = evaluateGates({
      findings: [makeFinding({ severity: 'critical', isNew: false })],
      config: DEFAULT_CONFIG,
      hasBaseline: true,
    });
    expect(result.verdict).toBe('pass');
  });

  it('warns when new findings exist within limits', () => {
    const result = evaluateGates({
      findings: [makeFinding({ severity: 'minor', isNew: true })],
      config: DEFAULT_CONFIG,
      hasBaseline: true,
    });
    expect(result.verdict).toBe('warn');
    expect(result.violations).toHaveLength(0);
  });

  it('skips new-findings gates without a baseline', () => {
    const result = evaluateGates({
      findings: [makeFinding({ severity: 'critical', isNew: true })],
      config: DEFAULT_CONFIG,
      hasBaseline: false,
    });
    expect(result.verdict).toBe('pass');
  });

  it('gates duplication percentage', () => {
    const result = evaluateGates({
      findings: [],
      duplicationPercent: 7.2,
      config: DEFAULT_CONFIG,
      hasBaseline: true,
    });
    expect(result.verdict).toBe('fail');
    expect(result.violations[0]).toMatchObject({ rule: 'duplication', limit: 5, actual: 7.2 });
  });

  it('gates new dead code only when configured', () => {
    const finding = makeFinding({ category: 'dead-code', severity: 'minor', isNew: true });
    const warnOnly = evaluateGates({
      findings: [finding],
      config: DEFAULT_CONFIG,
      hasBaseline: true,
    });
    expect(warnOnly.verdict).toBe('warn');

    const gated = configSchema.parse({ gates: { deadCode: 'gate' } });
    const result = evaluateGates({ findings: [finding], config: gated, hasBaseline: true });
    expect(result.verdict).toBe('fail');
    expect(result.violations[0].rule).toBe('dead-code');
  });

  it('enforces optional absolute totals gate', () => {
    const config = configSchema.parse({ gates: { totals: { critical: 0 } } });
    const result = evaluateGates({
      findings: [makeFinding({ severity: 'critical', isNew: false })],
      config,
      hasBaseline: true,
    });
    expect(result.verdict).toBe('fail');
    expect(result.violations[0].rule).toBe('total-findings');
  });

  it('describes the policy for the comment header', () => {
    const result = evaluateGates({ findings: [], config: DEFAULT_CONFIG, hasBaseline: true });
    expect(result.description).toContain('zero new critical');
    expect(result.description).toContain('max 5 new major');
    expect(result.description).toContain('max duplication 5%');
  });
});
