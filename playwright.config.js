// Playwright config for the browser e2e suite (migrated from the cmux scripts).
// Self-contained: the webServer command wipes + re-migrates a throwaway sqlite DB
// (before uvicorn serves, so the health check sees tables), then boots uvicorn.
// Server singletons (running_block, break_state) forbid parallelism, so one
// worker, serial.
import { defineConfig } from "@playwright/test";

const DB_URL = "sqlite:////tmp/pomo_pw.db";
const DB_FILE = "/tmp/pomo_pw.db";
const PORT = 8788;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    actionTimeout: 7_000,
  },
  webServer: {
    command: `rm -f ${DB_FILE} && uv run alembic upgrade head && uv run uvicorn backend.main:app --port ${PORT}`,
    url: `http://localhost:${PORT}/api/dashboard`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { POMOTODO_DATABASE_URL: DB_URL },
  },
});
