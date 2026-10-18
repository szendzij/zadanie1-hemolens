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
        ['list'],
        ['html', { open: 'never' }],
      ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
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
      name: 'e2e-chromium',
      testDir: './tests/spec/e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'e2e-firefox',
      testDir: './tests/spec/e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'e2e-webkit',
      testDir: './tests/spec/e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'] },
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
