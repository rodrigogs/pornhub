import { defineConfig, defineProject } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.cts', 'src/types/**'],
    },
    projects: [
      defineProject({
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        },
      }),
      defineProject({
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          fileParallelism: false,
          maxConcurrency: 1,
          retry: 3,
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      }),
    ],
  },
});
