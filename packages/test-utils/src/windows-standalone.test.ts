import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type Symlink = (target: string, destination: string, type?: string) => Promise<void>;
const { standaloneSymlink } = createRequire(import.meta.url)("../../../scripts/build-admin.cjs") as {
  standaloneSymlink: (root: string, output: string, symlink?: Symlink) => Symlink;
};
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "wooriai-standalone-"));
  directories.push(root);
  const output = join(root, "standalone");
  mkdirSync(output);
  return { root, output };
}

describe("Windows standalone directory links", () => {
  it("loads the traced dependency after the source dependency is removed", async () => {
    const { root, output } = fixture();
    const source = join(root, "node_modules/dependency");
    const traced = join(output, "node_modules/dependency");
    const destination = join(output, "apps/admin/node_modules/dependency");
    for (const directory of [source, traced, join(output, "apps/admin/node_modules")]) {
      mkdirSync(directory, { recursive: true });
    }
    writeFileSync(join(source, "value.txt"), "source");
    writeFileSync(join(traced, "value.txt"), "traced");
    await standaloneSymlink(root, output)(source, destination);
    rmSync(source, { recursive: true });
    expect(readFileSync(join(destination, "value.txt"), "utf8")).toBe("traced");
  });

  it("does not redirect links outside the standalone directory", async () => {
    const { root, output } = fixture();
    const original = vi.fn<Symlink>().mockResolvedValue();
    const target = join(root, "node_modules/dependency");
    const destination = join(root, "standalone-other/dependency");
    await standaloneSymlink(root, output, original)(target, destination, "dir");
    expect(original).toHaveBeenCalledWith(target, destination, "dir");
  });

  it("preserves file-link failures instead of reporting a successful build", async () => {
    const { root, output } = fixture();
    const target = join(root, "dependency.js");
    writeFileSync(target, "module.exports = 1;");
    const error = Object.assign(new Error("test link denied"), { code: "EPERM" });
    const original = vi.fn<Symlink>().mockRejectedValue(error);
    await expect(standaloneSymlink(root, output, original)(target, join(output, "dependency.js"))).rejects.toBe(error);
  });
});
