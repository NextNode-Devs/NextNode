import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 3100;
const BACKEND_PORT = 8100;

// Clerk development keys for signed-in journeys (#1), when present locally.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: signed-in specs skip; CI passes keys as environment secrets.
}

/**
 * Runs against the real production build of the frontend and a real Django
 * server backed by Postgres (docker compose up -d db, then migrations).
 * Locally, already-running servers on these ports are reused.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global.setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: `uv run uvicorn config.asgi:application --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { FRONTEND_ORIGIN: `http://localhost:${FRONTEND_PORT}` },
    },
    {
      command: `npm run build && npm run start -- --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        NEXT_PUBLIC_WS_URL: `ws://127.0.0.1:${BACKEND_PORT}/ws`,
      },
    },
  ],
});
