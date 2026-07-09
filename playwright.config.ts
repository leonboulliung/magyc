import { defineConfig } from "@playwright/test";

// E2E runs against a DEPLOYED instance (no local dev flow in this project).
// Override with E2E_BASE_URL for a preview deployment.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://www.magyc.site",
    trace: "retain-on-failure",
    headless: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
