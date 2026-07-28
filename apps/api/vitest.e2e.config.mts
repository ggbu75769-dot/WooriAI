import { defineConfig } from "vitest/config";
import { releaseGateE2eFiles } from "./vitest.test-groups";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: releaseGateE2eFiles,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1
      }
    },
    fileParallelism: false
  }
});
