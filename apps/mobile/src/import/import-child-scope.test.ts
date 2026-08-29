import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChildScopeLabel, withChildScopeLabel } from "../children/child-switch";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 68 트랙 B(GAP-068 #5) — **엑셀 업로드 화면이 어느 아이에게 붙는지 말하지 않았다.**
 *
 * 검수 화면은 말한다(라운드 41 K-2의 `job.childId` → `resolveImportTargetChildName`). 여덟 화면도
 * 말한다(지출 기록·지출 상세·예산·정기 지출·준비템 상세·기록 탭·리포트 탭·CSV 내보내기 —
 * `resolveChildScopeLabel`). 빠진 자리는 업로드 화면 하나였다: `childId`를 읽어
 * `createExcelImport(authToken, childId, …)`로 넘기면서 그 아이를 어디에도 그리지 않았다.
 *
 * 라운드 67 #3이 되돌리기(뒷수습)를 만든 그 사고 — "200행을 확정했는데 둘째로 전환한 상태였다" —
 * 의 **앞막이**가 이 라벨이다. 이 계약이 잡는 것은 "라벨이 없다"가 아니라 **두 자리가 같은 규칙을
 * 쓰는가**이다: 여덟 화면이 쓰는 그 함수 한 벌인가, 그리고 라벨이 붙지 않아야 할 곳(외동·비로그인)
 * 에서 화면이 한 글자도 달라지지 않는가.
 */
describe("라운드 68 B(#5) 엑셀 업로드 화면의 아이 스코프 라벨", () => {
  const importSource = () => source("app/import/index.tsx");

  it("어휘는 여덟 화면과 같다: 이름이 먼저, 눈에는 줄표", () => {
    expect(withChildScopeLabel("엑셀 업로드", "다온이")).toBe("다온이 — 엑셀 업로드");
  });

  it("다자녀 가구에서만 붙는다 (외동·아이 모름·목록 없음이면 제목이 종전 그대로다)", () => {
    const children = [
      { id: "child-1", nickname: "다온이" },
      { id: "child-2", nickname: "하온이" }
    ];
    expect(resolveChildScopeLabel("child-1", children)).toBe("다온이");
    expect(resolveChildScopeLabel("child-1", [children[0]])).toBeNull();
    expect(resolveChildScopeLabel("child-1", undefined)).toBeNull();
    expect(resolveChildScopeLabel(null, children)).toBeNull();
    // 라벨이 없으면 원문 그대로 = 화면이 한 글자도 달라지지 않는다.
    expect(withChildScopeLabel("엑셀 업로드", null)).toBe("엑셀 업로드");
  });

  it("업로드 화면의 제목이 그 함수를 지나고, 라벨을 화면에서 다시 해석하지 않는다", () => {
    const src = importSource();
    expect(src).toContain('withChildScopeLabel("엑셀 업로드", childScopeLabel)');
    expect(src).toContain("const childScopeLabel = resolveChildScopeLabel(childId, cachedChildren);");
    // 새 어휘·직접 결합 금지(한 화면만 다른 규칙으로 어긋나는 것을 막는 계약).
    expect(src).not.toContain("childScopeLabel} — ");
    expect(src).not.toContain("nickname} — ");
  });

  it("아이 목록은 **새 요청 없이** 이미 채워진 캐시에서만 읽는다", () => {
    const src = importSource();
    expect(src).toContain('queryClient.getQueryData<{ children: Child[] }>(["children"])?.children');
    // 이 화면은 조회 쿼리를 만들지 않는다(업로드·되돌리기 뮤테이션뿐이다).
    expect(src).not.toContain("useQuery(");
  });

  it("IMP-003 비세션 캡처 불변: 캐시 읽기 자체가 authToken 뒤에 있다 (이중 게이트)", () => {
    const src = importSource();
    expect(src).toContain("const cachedChildren = authToken\n    ? queryClient.getQueryData");
    // 세션이 없으면 목록이 undefined -> 라벨 null -> 제목 문자열이 종전 그대로다.
    expect(resolveChildScopeLabel(null, undefined)).toBeNull();
  });

  it("픽셀락 자산·목업 게이트는 한 글자도 건드리지 않는다", () => {
    const src = importSource();
    expect(src).toContain("const showPreviewMockup = !canUpload;");
    expect(src).toContain("const excelPreviewRows = [");
    expect(src).toContain("function excelPreviewPixelFrameStyle()");
    expect(src).toContain('const importUploadScreenId = "pixel-screen-IMP-003 IMP-001 / IMP-002 / IMP-003";');
    expect(src).toContain('process.env.EXPO_PUBLIC_PIXEL_LOCK === "1"');
  });

  it("검수 화면의 방식(잡에 박힌 아이)을 흉내 내지 않는다 — 여기는 지금 고른 아이다", () => {
    // 라운드 41 K-2가 세운 구분: 두 화면이 말하는 사실이 다르고 그것이 맞다.
    expect(importSource()).not.toContain("resolveImportTargetChildName");
    expect(source("app/import/[importJobId].tsx")).toContain("resolveImportTargetChildName");
  });
});
