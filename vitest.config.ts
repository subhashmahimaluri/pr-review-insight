import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // tests run against workspace sources, not built dist
      '@pr-review-insight/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@pr-review-insight/scanners': new URL('./packages/scanners/src/index.ts', import.meta.url)
        .pathname,
      '@pr-review-insight/reporters': new URL('./packages/reporters/src/index.ts', import.meta.url)
        .pathname,
      '@pr-review-insight/history': new URL('./packages/history/src/index.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['packages/core/src/**'],
    },
  },
});
