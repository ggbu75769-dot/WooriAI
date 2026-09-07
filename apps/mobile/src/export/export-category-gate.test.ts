import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Expense } from "../api/client";
import { buildCategoryNameLookup } from "../categories";
import { buildExpenseCsv } from "./expense-csv";

/**
 * 라운드 106 F3 — **분류 목록이 없으면 CSV를 만들지 않는다.**
 *
 * 무엇이 있었나: 내보내기의 유일한 게이트가 `canExport = Boolean(authToken && childId)`였다.
 * 카테고리 이름 목록(`["categories"]` 캐시)이 아직 도착하지 않은 창에서 [CSV 텍스트로 공유]를
 * 누르면 `buildCategoryNameLookup(undefined)`가 만들어지고, 서버 시드 카테고리는 DB마다 랜덤
 * UUID라 앱의 정적 8타일 매핑에 하나도 걸리지 않아 **전 행의 카테고리 열이 "기타"** 로 무너진
 * 파일이 나갔다(`categoryNameFor`의 마지막 줄 `return "기타";` — src/categories.ts).
 *
 * 화면이라면 목록이 도착한 다음 렌더에서 저절로 고쳐진다. 파일은 아니다: 가계부에 옮기거나
 * 배우자에게 보낸 뒤에는 고칠 방법이 없다. 그래서 같은 갈래를 이미 막아 둔 두 자리
 * (리포트 탭의 카테고리 1위 문장 · 라운드 105의 홈 최근 지출 분류)와 같은 규칙을 여기에도 건다.
 *
 * 이 파일이 두 종류의 단언을 함께 두는 이유: 모바일 화면은 vitest에서 렌더되지 않으므로
 * (react-native 네이티브 바인딩 없음 — src/export-flow.test.ts 머리말의 그 관례) **피해는
 * 실제 모듈로** 재현하고, **게이트는 소스로** 붙든다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const cardSource = source("src/export/ExpenseCsvExport.tsx");

/** 서버가 시드하는 정식 카테고리 — 고정 id가 없어 DB마다 랜덤 UUID다(그래서 8타일에 안 걸린다). */
const serverCategories = [
  { id: "3f1b0a5e-9c2d-4f11-b6a7-51c0d9e28a01", name: "기저귀/위생" },
  { id: "7a2c4d6e-1b3f-4a22-9c8d-62e1f0a37b02", name: "수유/이유식" }
];

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e-1",
    childId: "child-1",
    categoryId: serverCategories[0].id,
    amountKrw: 45900,
    spentOn: "2026-08-01",
    itemName: "기저귀 대형",
    merchant: null,
    memo: null,
    expenseType: "expense",
    source: "manual",
    version: 1,
    ...overrides
  };
}

/** 파일 본문에서 각 행의 3번째 열(카테고리)만 뽑는다 — 헤더는 버린다. */
function categoryColumn(csv: string): string[] {
  return csv
    .split("\r\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split(",")[2]);
}

describe("라운드 106 F3 — 분류 목록이 없는 CSV는 만들어질 수 없다", () => {
  const expenses = [
    makeExpense(),
    makeExpense({ id: "e-2", categoryId: serverCategories[1].id, itemName: "분유" }),
    makeExpense({ id: "e-3", categoryId: serverCategories[1].id, itemName: "쌀미음" })
  ];

  it("⚠️ 막으려는 피해 자체 — 목록 없이 만들면 전 행이 '기타'로 무너진다", () => {
    const built = buildExpenseCsv(expenses, { categoryName: buildCategoryNameLookup(undefined) });
    // 세 행의 분류가 실제로는 둘인데 파일에서는 구별이 사라진다(같은 글자로 적힌다).
    expect(categoryColumn(built.csv)).toEqual(["기타", "기타", "기타"]);
    expect(new Set(categoryColumn(built.csv)).size).toBe(1);
  });

  it("목록이 도착하면 같은 기록이 자기 이름으로 적힌다 — 이것이 나가야 할 파일이다", () => {
    const built = buildExpenseCsv(expenses, { categoryName: buildCategoryNameLookup(serverCategories) });
    expect(categoryColumn(built.csv)).toEqual(["기저귀/위생", "수유/이유식", "수유/이유식"]);
    expect(categoryColumn(built.csv)).not.toContain("기타");
  });

  it("게이트 형식은 리포트 탭의 그것이다 (새 판정을 짓지 않는다)", () => {
    expect(cardSource).toContain("const categoryNamesReady = categories.isSuccess;");
    // 리포트 탭이 같은 사실을 같은 모양으로 이미 막고 있다 — 이름을 모르면 말하지 않는다.
    expect(source("app/(tabs)/reports.tsx")).toContain("categoryTop: categories.isSuccess ? monthly.data.categoryTop : undefined");
  });

  it("슬라이스 양쪽 끝에 같은 조건이 선다 (버튼 · 파일을 만드는 함수)", () => {
    // ① 화면 끝: 공유 버튼이 잠긴다.
    expect(cardSource).toContain("disabled={controller.busy || !controller.categoryNamesReady}");
    // ② 동작 끝: 컨트롤러가 밖으로 내보내는 runExport 자신도 막는다.
    expect(cardSource).toContain("if (!authToken || !childId || !categoryNamesReady || busy) return;");
    // 그 조기 반환이 CSV 생성·공유보다 **앞에** 있어야 의미가 있다.
    const guardAt = cardSource.indexOf("!categoryNamesReady || busy) return;");
    const buildAt = cardSource.indexOf("buildExpenseCsv(collected.expenses");
    const shareAt = cardSource.indexOf("shareExpenseCsv(built.csv)");
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(buildAt);
    expect(guardAt).toBeLessThan(shareAt);
    // 게이트 값이 컨트롤러로 나가야 카드가 그것을 읽을 수 있다.
    expect(cardSource).toContain("categoryNamesReady: boolean;");
    expect(cardSource).toMatch(/return \{[\s\S]*categoryNamesReady,[\s\S]*\};/);
  });

  /**
   * ⚠️ SET-001 픽셀락 무접촉.
   *
   * ① 캡처 라우트는 **비로그인 경로**로 찍힌다(app/pixel-lock.tsx가 `clearSession()`과
   *    `clearSelectedChildId()`를 부른 뒤 /(tabs)/more로 replace한다).
   * ② 그 상태에서는 `canExport`가 false라 카드 자체가 `null`을 반환한다 — 이번에 손댄 버튼은
   *    캡처가 지나는 갈래에 **그려지지도 않는다**.
   * ③ `canExport`의 식은 종전 그대로다. 그 값이 갈리면 두 소비 화면의 메뉴 행이
   *    EXPORT_SIGNED_OUT_CAPTION으로 바뀌어 캡처가 아니라도 로그인한 사람에게 거짓말을 한다.
   * ④ 새 문구·새 상수는 없다. 잠김은 이 카드가 이미 쓰는 opacity 문법으로만 말한다.
   */
  it("픽셀락 캡처가 지나는 갈래를 건드리지 않는다 (SET-001)", () => {
    const pixelLockSource = source("app/pixel-lock.tsx");
    expect(pixelLockSource).toContain('"SET-001": "/(tabs)/more"');
    expect(pixelLockSource).toContain("clearSession();");
    expect(pixelLockSource).toContain("clearSelectedChildId();");
    // 비세션이면 카드가 통째로 그려지지 않는다(버튼도 없다).
    expect(cardSource).toContain("if (!controller.canExport || !controller.cardOpen) return null;");
    // 메뉴 행의 판정은 한 글자도 바뀌지 않았다.
    expect(cardSource).toContain("const canExport = Boolean(authToken && childId);");
    // 두 소비 화면은 이 게이트를 알 필요가 없다(공용 모듈을 부르기만 한다).
    for (const screen of ["app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      expect(source(screen), `${screen}는 이 트랙의 무접촉 대상이다`).not.toContain("categoryNamesReady");
    }
    // 새 문구를 세우지 않는다 — 잠김은 스테퍼 화살표와 같은 opacity 0.35로만 말한다.
    expect(cardSource).toContain("style={controller.categoryNamesReady ? undefined : { opacity: 0.35 }}");
    expect(cardSource).toContain('label={controller.busy ? "내보내는 중" : EXPORT_SHARE_BUTTON_LABEL}');
  });
});
