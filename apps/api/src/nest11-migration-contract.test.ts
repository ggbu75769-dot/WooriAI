import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("Nest 11 migration contract", () => {
  it("keeps the runtime and testing packages aligned on the patched Nest 11 baseline", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

    expect(packageJson.dependencies["@nestjs/common"]).toBe("^11.1.28");
    expect(packageJson.dependencies["@nestjs/core"]).toBe("^11.1.28");
    expect(packageJson.dependencies["@nestjs/platform-express"]).toBe("^11.1.28");
    expect(packageJson.devDependencies["@nestjs/testing"]).toBe("^11.1.28");
    expect(packageJson.devDependencies["@types/express"]).toMatch(/^\^5\./);
  });

  it("does not use Express 4 wildcard route patterns that change meaning in Express 5", () => {
    const source = sourceFiles(join(process.cwd(), "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/forRoutes\(\s*["'](?:\*|\(\.\*\))["']\s*\)/);
    expect(source).not.toMatch(/@(Get|Post|Put|Patch|Delete|All)\(\s*["'][^"']*\/\*["']\s*\)/);
  });
});
