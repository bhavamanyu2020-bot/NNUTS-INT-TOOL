import { defineConfig } from "vitest/config";

// Integration tests hit a real Supabase project over the network (measured ~0.6-1s per
// round-trip against this project - see git history), and beforeAll/afterAll do several
// sequential round-trips to set up/tear down fixtures, so both the per-test and hook timeouts
// need real headroom over Vitest's 5s default.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
