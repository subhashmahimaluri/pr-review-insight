import { describe, expect, it } from 'vitest';
import { renderSarif } from '@pr-review-insight/reporters';
import { makeFinding, makeReport } from './helpers';

type Sarif = {
  version: string;
  runs: {
    tool: { driver: { name: string; rules: { id: string }[] } };
    results: {
      ruleId: string;
      ruleIndex: number;
      level: string;
      locations: { physicalLocation: { region?: { startLine: number } } }[];
      partialFingerprints: { primaryLocationLineHash: string };
    }[];
  }[];
};

describe('renderSarif', () => {
  it('emits valid SARIF 2.1.0 shape with deduped rules and severity mapping', () => {
    const report = makeReport({
      findings: [
        makeFinding({ severity: 'critical', category: 'security', ruleId: 'secretlint/aws' }),
        makeFinding({ severity: 'major', file: 'b.ts' }),
        makeFinding({ severity: 'minor', file: 'c.ts' }),
        makeFinding({ severity: 'minor', file: 'd.ts' }),
      ],
    });
    const sarif = renderSarif(report) as Sarif;
    expect(sarif.version).toBe('2.1.0');
    const run = sarif.runs[0];
    expect(run.tool.driver.name).toBe('pr-review-insight');
    // two distinct rules across four results
    expect(run.tool.driver.rules.map((r) => r.id).sort()).toEqual([
      'secretlint/aws',
      'sonarjs/no-identical-expressions',
    ]);
    expect(run.results).toHaveLength(4);
    expect(run.results[0].level).toBe('error');
    expect(run.results[1].level).toBe('warning');
    expect(run.results[2].level).toBe('note');
    expect(run.results[0].partialFingerprints.primaryLocationLineHash).toBeTruthy();
    expect(run.results[0].locations[0].physicalLocation.region?.startLine).toBe(10);
  });
});
