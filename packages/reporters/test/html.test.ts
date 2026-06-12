import { describe, expect, it } from 'vitest';
import { renderHtml } from '@pr-review-insight/reporters';
import { makeFinding, makeReport } from './helpers';

describe('renderHtml', () => {
  const report = makeReport({
    findings: [
      makeFinding({
        category: 'security',
        severity: 'critical',
        isNew: true,
        message: 'Dangerous <script> & "stuff"',
      }),
      makeFinding({ file: 'src/other.ts' }),
    ],
  });

  it('is self-contained: CSP forbids external loads, no external URLs', () => {
    const html = renderHtml(report);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/src="https?:\/\//);
    expect(html).not.toMatch(/href="https?:\/\//);
  });

  it('escapes finding content', () => {
    const html = renderHtml(report);
    expect(html).toContain('Dangerous &lt;script&gt; &amp; &quot;stuff&quot;');
    expect(html).not.toContain('Dangerous <script>');
  });

  it('renders category cards, filters and NEW chips', () => {
    const html = renderHtml(report);
    expect(html).toContain('class="card"');
    expect(html).toContain('data-filter="new"');
    expect(html).toContain('<span class="new">NEW</span>');
  });
});
