import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * ADM-130: the admin app shipped without any of Next's error conventions, so a
 * render-time exception or a mistyped URL dropped the operator onto Next's
 * built-in English screens ("Application error: a client-side exception has
 * occurred" / "404 | This page could not be found") with no recovery action.
 *
 * These are source-contract tests, matching the convention of the other admin
 * suites here (no DOM renderer is installed in this workspace): they pin the
 * file names Next resolves by convention, the wiring that makes the screens
 * recoverable, and the Korean 해요체 copy — i.e. exactly the properties whose
 * silent loss would put the English default screens back.
 */
describe("Admin error boundaries (ADM-130)", () => {
  it("provides a route-level error boundary wired to reset() and a way home", () => {
    const source = readSource("app/error.tsx");

    // error.tsx receives an onClick handler, so it must be a Client Component.
    expect(source).toContain("use client");
    // Next passes { error, reset }; reset() re-renders the failed segment.
    expect(source).toContain("reset");
    expect(source).toContain("onClick={() => reset()}");
    expect(source).toContain("다시 시도");
    // A retry that keeps failing must not be a dead end.
    expect(source).toContain('href="/"');
    expect(source).toContain("대시보드로 가기");
    // 한국어 해요체 안내 (Next 기본 영문 화면 대체).
    expect(source).toContain("화면을 불러오지 못했어요");
    // 어드민 공통 스타일을 그대로 쓴다.
    expect(source).toContain("admin-page.module.css");
  });

  it("provides a global-error boundary that renders its own html/body (Next convention) and can retry", () => {
    const source = readSource("app/global-error.tsx");

    expect(source).toContain("use client");
    // global-error REPLACES the root layout, so it must supply the document
    // shell itself -- without these tags the fallback renders nothing at all.
    expect(source).toContain("<html");
    expect(source).toContain('lang="ko"');
    expect(source).toContain("<body");
    expect(source).toContain("onClick={() => reset()}");
    expect(source).toContain("다시 시도");
    expect(source).toContain('href="/"');
    expect(source).toContain("관리자 화면을 열지 못했어요");
    // 루트 레이아웃이 무너진 상황이므로 외부 스타일 의존 없이 렌더된다.
    expect(source).not.toContain("admin-page.module.css");
  });

  it("provides a Korean not-found screen with a link home and no misleading retry", () => {
    const source = readSource("app/not-found.tsx");

    expect(source).toContain("찾을 수 없는 화면이에요");
    expect(source).toContain('href="/"');
    expect(source).toContain("대시보드로 가기");
    expect(source).toContain("admin-page.module.css");
    // 404는 일시적 실패가 아니라서 reset()/"다시 시도"를 노출하지 않는다.
    expect(source).not.toContain("reset(");
    expect(source).not.toContain("다시 시도");
  });
});
