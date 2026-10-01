import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/*-unit.test.js",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5190", channel: process.env.PLAYWRIGHT_CHANNEL || undefined, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5190 --strictPort --configLoader runner", url: "http://127.0.0.1:5190", reuseExistingServer: true },
});
