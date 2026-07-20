import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["test/admin-browser/**/*.browser.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Capped thread concurrency: this repo's dev environment (Windows, Node
    // 25.x, limited sandbox memory) intermittently throws "Deriving bits
    // failed" out of node:crypto's scryptSync (admin-password.ts's
    // constant-time login hash, computed once per app instance at
    // AdminModule load) -- or even OOMs a worker outright -- when many e2e
    // suites, each booting a full Nest app, run concurrently across the
    // default (CPU-core-count) worker pool. This is unrelated to test
    // correctness; capping the pool avoids the resource contention.
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },
    fileParallelism: false
  }
});
