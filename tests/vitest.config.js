import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    exclude: ['test/**', 'node_modules/**'],
    setupFiles: [],
    coverage: {
      provider: 'istanbul',
      include: ['agents/**'],
      exclude: ['agents/keys/**', 'agents/execution-log.json', 'agents/task-log.json'],
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'tests/coverage',
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    sequence: {
      concurrent: false,
    },
  },
})
