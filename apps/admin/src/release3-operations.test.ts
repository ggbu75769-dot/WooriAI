import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Release 3 operations console", () => {
  it("exposes the operations route without rendering raw payloads", () => {
    const page = join(process.cwd(), "app/operations/page.tsx");
    expect(existsSync(page)).toBe(true);
    const source = readFileSync(page, "utf8");
    for (const heading of ["개인정보 요청", "Dead letter", "상품 링크 health", "예약 콘텐츠", "알림 전달", "리포트 무결성"]) {
      expect(source).toContain(heading);
    }
    expect(source).not.toContain("payloadJson");
  });
});
