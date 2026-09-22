import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

describe("API startup process", () => {
  it.each(["production", undefined])("exits with failure when secrets are absent in %s", (nodeEnv) => {
    const env = { ...process.env };
    delete env.JWT_ACCESS_SECRET;
    if (nodeEnv) env.NODE_ENV = nodeEnv;
    else delete env.NODE_ENV;
    // Required-secret validation must fail before opening any database connection.
    env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
    const result = spawnSync(process.execPath, [tsxCli, "src/main.ts"], {
      cwd: apiRoot,
      env,
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("JWT_ACCESS_SECRET must be set");
  });
});
