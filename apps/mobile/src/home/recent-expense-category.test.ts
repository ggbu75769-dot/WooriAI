import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHomeCategoryLabelResolver } from "./recent-expense-category";
import { categoryCatalog, categoryNameFor } from "../categories";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const viewSource = readFileSync(join(process.cwd(), "src/expenses/records-list-view.ts"), "utf8");

/** `GET /categories?includeAll=1` 응답 모양의 최소 부분집합(이 해석기가 실제로 읽는 두 필드). */
const serverCategories = [
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000001", name: "기저귀/위생" },
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000002", name: "수유/이유식" },
  // 퀵타일 별칭 8행도 같은 응답에 들어 있다(apps/api/prisma/seed-data.ts `c0a7e901-…`).
  { id: categoryCatalog[0].id, name: "기저귀" }
];

describe("라운드 105 트랙 HOME(정찰 C #6) 홈 최근 기록의 분류 이름 해석", () => {
  it("서버 목록이 아는 id는 그 이름을 그대로 말한다", () => {
    const resolve = buildHomeCategoryLabelResolver(serverCategories);
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000001")).toBe("기저귀/위생");
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000002")).toBe("수유/이유식");
  });

  it("퀵타일로 적은 지출도 같은 한 벌로 해석된다(별칭 8행이 같은 응답에 있다)", () => {
    const resolve = buildHomeCategoryLabelResolver(serverCategories);
    expect(resolve(categoryCatalog[0].id)).toBe("기저귀");
  });

  /* ------------------------------------------------------------------------------------------ */
  /* 지어내기 가드 — 이 세 개가 이 모듈의 존재 이유다.                                            */
  /* ------------------------------------------------------------------------------------------ */

  it("⚠️ 모르는 id에 '기타'를 지어내지 않는다 -- 같은 id를 categoryNameFor는 '기타'라고 답한다", () => {
    const unknownId = "0f3d0f1a-1f2b-4c3d-8e4f-0000000000ff";
    // 함정이 실재한다는 것을 값으로 먼저 못 박는다(src/categories.ts categoryNameFor의 마지막 줄).
    expect(categoryNameFor(unknownId)).toBe("기타");
    // 그리고 이 해석기는 그 폴백을 타지 않는다.
    const resolve = buildHomeCategoryLabelResolver(serverCategories);
    expect(resolve(unknownId)).toBeNull();
    expect(resolve(unknownId)).not.toBe("기타");
  });

  it("⚠️ 캐시가 아직 비어 있는 콜드 스타트에서 세 줄이 전부 '기타'가 되지 않는다", () => {
    // ["home"]과 ["categories"]는 서로 다른 조회라 도착 순서가 정해져 있지 않다 -- 목록이 없는
    // 동안에도 최근 기록 세 줄은 그려진다. 그때 화면은 분류를 **말하지 않는다**.
    for (const empty of [null, undefined, []] as const) {
      const resolve = buildHomeCategoryLabelResolver(empty);
      for (const id of [categoryCatalog[0].id, "0f3d0f1a-1f2b-4c3d-8e4f-000000000001", "무엇이든"]) {
        expect(resolve(id), `${String(empty)} / ${id}`).toBeNull();
        expect(resolve(id)).not.toBe("기타");
      }
    }
  });

  it("⚠️ 이름이 비어 있거나 공백뿐인 행은 없는 것으로 본다(빈 토큰을 부제에 끼워 넣지 않는다)", () => {
    const resolve = buildHomeCategoryLabelResolver([
      { id: "blank", name: "   " },
      { id: "empty", name: "" }
    ]);
    expect(resolve("blank")).toBeNull();
    expect(resolve("empty")).toBeNull();
  });

  it("서버가 실제로 '기타'라고 이름 붙인 분류는 그대로 '기타'라고 말한다(사실을 숨기지 않는다)", () => {
    // 지어내기 가드는 "이름을 못 구했을 때"의 규칙이지 "기타라는 낱말 금지"가 아니다.
    const resolve = buildHomeCategoryLabelResolver([{ id: "etc-real", name: "기타" }]);
    expect(resolve("etc-real")).toBe("기타");
  });

  it("id가 없으면(null · undefined · 빈 문자열) 아무 말도 하지 않는다", () => {
    const resolve = buildHomeCategoryLabelResolver(serverCategories);
    expect(resolve(null)).toBeNull();
    expect(resolve(undefined)).toBeNull();
    expect(resolve("")).toBeNull();
  });

  it("이름은 앞뒤 공백을 떼고 말한다(응답 그대로 그리지 않는다)", () => {
    const resolve = buildHomeCategoryLabelResolver([{ id: "padded", name: "  병원/약  " }]);
    expect(resolve("padded")).toBe("병원/약");
  });

  it("같은 id가 두 번 오면 뒤에 온 행이 이긴다(마지막 응답 한 벌만 남는다)", () => {
    const resolve = buildHomeCategoryLabelResolver([
      { id: "dup", name: "옛 이름" },
      { id: "dup", name: "새 이름" }
    ]);
    expect(resolve("dup")).toBe("새 이름");
  });
});

describe("라운드 105 트랙 HOME(정찰 C #6) 홈 배선 (source contract)", () => {
  it("이미 구독 중인 ['categories'] 캐시 한 벌로 이름까지 고른다 -- 추가 요청 0건", () => {
    // 글리프 해석기와 **같은 입력**이다. 새 useQuery가 붙지 않았다는 것이 "추가 요청 0건"의 값.
    expect(homeSource).toContain("buildTileCategoryIdResolver(categoriesQuery.data?.categories)");
    expect(homeSource).toContain("buildHomeCategoryLabelResolver(categoriesQuery.data?.categories)");
    expect(homeSource).toContain('import { buildHomeCategoryLabelResolver } from "../../src/home/recent-expense-category";');
    // 조회 자체가 하나뿐이다 -- 이름을 말하려고 요청을 하나 더 붙이지 않았다는 사실의 값.
    // (`invalidateQueries({ queryKey: ["categories"] })`는 조회가 아니므로 useQuery만 센다.)
    expect(
      homeSource.match(/useQuery\(\{\n\s*queryKey: \["categories"\]/g) ?? [],
      "['categories'] useQuery는 하나뿐이다"
    ).toHaveLength(1);
  });

  it("세션 렌더의 세 줄만 분류 이름을 함께 넘긴다", () => {
    // 슬라이스 두 끝 가드(라운드 78) -- 표식이 실재해야 아래 단언이 산다.
    const sessionStart = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)");
    expect(sessionStart, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    const sessionRender = homeSource.slice(sessionStart);
    expect(sessionRender.length, "세션 렌더 슬라이스가 비어 있어요").toBeGreaterThan(0);
    expect(sessionRender).toContain(
      "subtitle={homeRecentExpenseSubtitle(expense, resolveRecentExpenseCategoryLabel(expense.categoryId))}"
    );
  });

  it("HOME-001 픽셀락: 비세션 프리뷰 렌더는 인자 하나짜리 호출 그대로다(캡처 무접촉)", () => {
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로) — **무변경**.");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)", previewStart);
    expect(previewStart, "비세션 프리뷰 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(previewEnd, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    // 캡처가 지나는 그 줄은 종전 그대로 -- 분류 해석기가 이 갈래에 들어오지 않는다.
    expect(preview).toContain("subtitle={homeRecentExpenseSubtitle(expense)}");
    expect(preview).not.toContain("resolveRecentExpenseCategoryLabel");
    expect(preview).not.toContain("buildHomeCategoryLabelResolver");
  });

  it("공용 헬퍼의 분류 인자는 옵셔널이다 -- 넘기지 않은 호출부는 종전 출력 그대로다", () => {
    expect(viewSource).toContain(
      [
        "export function homeRecentExpenseSubtitle(",
        "  expense: { expenseType?: string | null; spentOn: string },",
        "  categoryLabel?: string | null",
        "): string {"
      ].join("\n")
    );
    // 낡은 근거 주석을 두 시점으로 고쳐 남긴다(그때는 참이었다 → 이제 거짓이다).
    expect(viewSource).toContain("구독하지 않으므로");
    expect(viewSource).toContain("그 전제가 **거짓이다**");
  });
});
