import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    // Mock electron and other native modules
    alias: {
      electron: new URL('./src/main/__mocks__/electron.ts', import.meta.url).pathname
    }
  }
})
