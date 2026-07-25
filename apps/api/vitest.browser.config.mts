import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: ["test/admin-browser/**/*.browser.test.ts"],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  }
});
