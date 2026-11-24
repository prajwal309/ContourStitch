import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const testDatabase = process.env.CONTOURSTITCH_TEST_DATABASE_URL;
const baseURL = 'http://localhost:3100';
const providerMock = fileURLToPath(
  new URL('./e2e/oauth-provider-mock.mjs', import.meta.url),
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: {
    baseURL,
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  webServer: {
    command:
      'NEXT_PUBLIC_SCANNER_TEST_MODE=1 npm run dev -- --hostname localhost --port 3100',
    url: baseURL,
    env: testDatabase
      ? {
          AUTH_URL: `${baseURL}/api/auth`,
          AUTH_SECRET: 'local-test-secret-for-playwright-oauth-only',
          AUTH_GOOGLE_ID: 'test-google-client',
          AUTH_GOOGLE_SECRET: 'test-google-secret',
          AUTH_FACEBOOK_ID: 'test-facebook-client',
          AUTH_FACEBOOK_SECRET: 'test-facebook-secret',
          DATABASE_URL: testDatabase,
          DATABASE_URL_POOLED: testDatabase,
          NODE_OPTIONS: `--import="${providerMock}"`,
        }
      : undefined,
    reuseExistingServer: false,
  },
  timeout: 60000,
});
