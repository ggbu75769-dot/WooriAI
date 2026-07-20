import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runPortableCommand } from "./release5v-command-runner";

describe("Release 5V portable command runner", () => {
  it("preserves binary stdout when the caller requests no encoding", () => {
    const output = runPortableCommand(process.execPath, ["-e", "process.stdout.write(Buffer.from([0, 255, 1]))"], {
      cwd: process.cwd(),
      encoding: null
    });
    expect(Buffer.isBuffer(output)).toBe(true);
    expect([...output as Buffer]).toEqual([0, 255, 1]);
  });

  it.skipIf(process.platform !== "win32")("runs Android build-tool batch wrappers on Windows", () => {
    const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
    const buildTools = join(sdkRoot, "build-tools");
    const version = readdirSync(buildTools, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse()[0];
    const signer = join(buildTools, version, "apksigner.bat");
    expect(existsSync(signer)).toBe(true);
    expect(String(runPortableCommand(signer, ["version"], { cwd: process.cwd() })).trim()).not.toBe("");
  });
});
