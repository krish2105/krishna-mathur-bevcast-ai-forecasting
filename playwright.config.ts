import { defineConfig, devices } from "@playwright/test";

/**
 * Local: builds and starts the production server on :3100.
 * Production: BASE_URL=https://bevcast-ai.vercel.app npx playwright test
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3100";
const local = !process.env.BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: local ? 3 : 2,
  retries: local ? 0 : 1,
  reporter: [["list"], ["json", { outputFile: `docs/qa/e2e-results-${local ? "local" : "production"}.json` }]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: local
    ? { command: "npm run start -- -p 3100", url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
