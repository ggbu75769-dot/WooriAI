import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { generateRouteTypes } = require("../scripts/generate-route-types.cjs") as {
  generateRouteTypes(projectRoot: string): string;
};

describe("현재 파일 기준 Expo 경로 타입 생성", () => {
  it("개발 서버 없이 새 화면·동적 파라미터를 반영하고 삭제된 화면 타입을 제거한다", () => {
    const project = mkdtempSync(join(tmpdir(), "wooriai-route-types-"));
    try {
      mkdirSync(join(project, "app", "items"), { recursive: true });
      writeFileSync(join(project, "app", "index.tsx"), "export default function Home() { return null; }");
      writeFileSync(join(project, "app", "retired.tsx"), "export default function Retired() { return null; }");
      const output = generateRouteTypes(project);
      expect(readFileSync(output, "utf8")).toContain("/retired");

      rmSync(join(project, "app", "retired.tsx"));
      writeFileSync(join(project, "app", "items", "[itemId].tsx"), "export default function Item() { return null; }");
      generateRouteTypes(project);
      const declarations = readFileSync(output, "utf8");
      expect(declarations).not.toContain("/retired");
      expect(declarations).toContain("/items/[itemId]");
      expect(declarations).toContain("itemId: string | number");
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
