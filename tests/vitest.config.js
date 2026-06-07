import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/unit/**', 'tests/integration/**'],
    exclude: ['node_modules', 'test'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'istanbul',
      include: ['agents/**/*.js'],
      exclude: ['agents/secret-manager.js'],
      reportsDirectory: 'tests/coverage',
    },
  },
})
