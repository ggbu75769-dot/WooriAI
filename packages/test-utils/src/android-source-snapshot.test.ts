import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { androidSourceSnapshot } from "../../../scripts/lib/android-source-snapshot";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "wooriai-source-"));
  roots.push(root);
  const write = (name: string, value: string) => {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, value);
  };
  write("apps/mobile/app/index.tsx", "export default 'home';");
  return { root, write };
}

describe("Android build source binding", () => {
  it("detects edited and newly added uncommitted app code", () => {
    const { root, write } = fixture();
    const before = androidSourceSnapshot(root);
    write("apps/mobile/app/index.tsx", "export default 'changed';");
    const edited = androidSourceSnapshot(root);
    expect(edited).not.toBe(before);
    write("apps/mobile/src/new-feature.ts", "export const enabled = true;");
    expect(androidSourceSnapshot(root)).not.toBe(edited);
  });

  it("binds native configuration and locked dependencies", () => {
    const { root, write } = fixture();
    const before = androidSourceSnapshot(root);
    write("apps/mobile/app.json", '{"expo":{"android":{"package":"kr.wooriai.app"}}}');
    const configured = androidSourceSnapshot(root);
    expect(configured).not.toBe(before);
    write("pnpm-lock.yaml", "lockfileVersion: '9.0'");
    expect(androidSourceSnapshot(root)).not.toBe(configured);
  });

  it("does not bind generated files, test output or private environment files", () => {
    const { root, write } = fixture();
    const before = androidSourceSnapshot(root);
    write("apps/mobile/android/app/build.gradle", "generated");
    write("apps/mobile/src/index.test.ts", "test-only edit");
    write("apps/mobile/.env.local", "PRIVATE_KEY=not-an-app-input");
    expect(androidSourceSnapshot(root)).toBe(before);
  });
});
