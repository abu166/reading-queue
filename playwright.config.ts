import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173/reading-queue/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173/reading-queue/",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL:
        process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY:
        process.env.VITE_SUPABASE_ANON_KEY || "fixture-public-key",
    },
  },
});
