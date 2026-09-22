import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Hash the inputs that ship in the native app, including uncommitted source. */
export function androidSourceSnapshot(root: string): string {
  const files: string[] = [];
  function visit(path: string) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ["node_modules", "android", "ios", "test", "tests"].includes(entry.name)) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) files.push(full);
    }
  }
  for (const dir of ["apps/mobile/app", "apps/mobile/src", "apps/mobile/plugins", "apps/mobile/assets", "packages/domain/src", "packages/contracts/src", "patches"]) visit(join(root, dir));
  for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "app.config.js", "apps/mobile/package.json", "apps/mobile/app.json", "apps/mobile/app.config.js", "apps/mobile/expo-config.shared.js", "apps/mobile/index.js", "apps/mobile/babel.config.js", "apps/mobile/metro.config.js"]) {
    const full = join(root, file);
    if (existsSync(full)) files.push(full);
  }
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(root, file).replace(/\\/g, "/")).update("\0");
    hash.update(readFileSync(file)).update("\0");
  }
  return hash.digest("hex");
}
