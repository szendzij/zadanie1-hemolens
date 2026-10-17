import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  testIgnore: /tests\/setup/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ['blob'],
        ['github'],
        ['list'],
      ]
    : [
        ['html'],
        ['json'],
        ['xml'],
        ['list'],
      ], 
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry'
  },

  projects: [
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /global\.setup\.ts/,
    },

    {
      name: 'api',
      testDir: './tests/spec/api',
      dependencies: ['setup'],
    },

    {
      name: 'e2e',
      testDir: './tests/spec/e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },

  ],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/todos`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NO_UPDATE_NOTIFIER: '1',
    },
  },
})
