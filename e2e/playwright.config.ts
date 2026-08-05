import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Per-test budget. Distinct from `webServer.timeout` below, which only covers
  // server startup — without this, Playwright's 30s default applied and quietly
  // capped assertions that asked for longer (the coach test declares 60s and
  // never got it). See DECISIONS.md, Checkpoint 20.
  timeout: 60_000,
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev",
    cwd: "..",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
