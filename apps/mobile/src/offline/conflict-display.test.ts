import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCAL_CATEGORY_DETERGENT } from "../api/local-fixtures";
import { categoryCatalog } from "../categories";
import {
  buildConflictValueFormatter,
  CONFLICT_EMPTY_VALUE_LABEL,
  CONFLICT_UNKNOWN_CATEGORY_LABEL,
  conflictUnknownCategoryLabel
} from "./conflict-display";
import type { ExpensePayload } from "./types";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

// 서버가 시드한 정식 카테고리(“["categories"] 캐시”의 한 행)는 DB마다 id가 다르다.
const serverCategories = [{ id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000001", name: "임신/산모" }];

/**
 * 라운드 45 UX-AA(후보 4): 충돌 화면이 두 후보 값을 String()으로 그려 UUID·원시 숫자·enum 원문을
 * 보여주던 문제. 표시만 바꾸고 저장 값은 그대로여야 한다.
 */
describe("buildConflictValueFormatter (동기화 충돌 값 표시)", () => {
  const format = buildConflictValueFormatter(serverCategories);

  it("금액은 앱 전역 formatKrw 규칙으로 말한다", () => {
    expect(format("amountKrw", 45900)).toBe("45,900원");
  });

  it("카테고리는 캐시된 서버 이름 · 정적 8타일 · 데모 픽스처 순으로 이름을 찾는다", () => {
    expect(format("categoryId", serverCategories[0].id)).toBe("임신/산모");
    expect(format("categoryId", categoryCatalog[0].id)).toBe("기저귀");
    expect(format("categoryId", LOCAL_CATEGORY_DETERGENT)).toBe("유아용 세제");
  });

  it("아는 이름이 없는 categoryId는 '기타'로 뭉뚱그리지 않고 모른다고 말한다", () => {
    // 두 후보를 구별하라는 화면이라 서로 다른 UUID가 같은 라벨("기타")로 보이면 안 된다.
    const unknown = format("categoryId", "00000000-dead-4bee-8fff-000000000000");
    expect(unknown).toContain(CONFLICT_UNKNOWN_CATEGORY_LABEL);
    // 캐시가 아예 없을 때(오프라인 첫 실행)도 마찬가지 -- 새 요청 없이 아는 것만 말한다.
    const noCache = buildConflictValueFormatter(undefined);
    expect(noCache("categoryId", serverCategories[0].id)).toContain(CONFLICT_UNKNOWN_CATEGORY_LABEL);
    expect(noCache("categoryId", categoryCatalog[1].id)).toBe(categoryCatalog[1].label);
  });

  it("라운드 45 O-4: 미지 id가 둘이면 서로 다른 라벨이다 (같은 글자면 고를 수가 없다)", () => {
    const left = format("categoryId", "00000000-dead-4bee-8fff-00000000a1b2");
    const right = format("categoryId", "00000000-dead-4bee-8fff-00000000c3d4");

    expect(left).not.toBe(right);
    expect(left).toBe("알 수 없는 분류 (a1b2)");
    expect(right).toBe("알 수 없는 분류 (c3d4)");
    // 꼬리표는 구별용이라 UUID 전체를 그리지 않는다 -- 다시 읽을 수 없는 값이 되면 안 된다.
    expect(left).not.toContain("00000000-dead");
  });

  it("conflictUnknownCategoryLabel: 붙일 꼬리가 없으면 기본 라벨 그대로", () => {
    expect(conflictUnknownCategoryLabel("   ")).toBe(CONFLICT_UNKNOWN_CATEGORY_LABEL);
    expect(conflictUnknownCategoryLabel("---")).toBe(CONFLICT_UNKNOWN_CATEGORY_LABEL);
    // 4자보다 짧은 id도 있는 그대로 붙인다(잘라낼 것이 없다).
    expect(conflictUnknownCategoryLabel("ab")).toBe(`${CONFLICT_UNKNOWN_CATEGORY_LABEL} (ab)`);
  });

  it("구분 · 결제 수단은 입력 화면과 같은 한국어 라벨, 모르는 값은 원문 그대로", () => {
    expect(format("expenseType", "expense")).toBe("지출");
    expect(format("expenseType", "gift")).toBe("선물");
    expect(format("paymentMethod", "card")).toBe("카드");
    expect(format("paymentMethod", "mobile_pay")).toBe("모바일 결제");
    expect(format("paymentMethod", "crypto")).toBe("crypto");
  });

  it("날짜는 기록 행과 같은 형식, 읽을 수 없으면 원본 통과", () => {
    expect(format("spentOn", "2026-08-04")).toBe("8월 4일");
    expect(format("spentOn", "언젠가")).toBe("언젠가");
  });

  it("빈 값은 '-'가 아니라 없음이라고 말한다", () => {
    for (const empty of [null, undefined, "", "   "] as const) {
      expect(format("memo", empty)).toBe(CONFLICT_EMPTY_VALUE_LABEL);
    }
    expect(format("merchant", "쿠팡")).toBe("쿠팡");
  });

  it("표시 전용이다 -- 저장될 페이로드를 건드리지 않는다", () => {
    const server: ExpensePayload = {
      childId: "child-1",
      categoryId: serverCategories[0].id,
      amountKrw: 45900,
      spentOn: "2026-08-04",
      itemName: "기저귀",
      paymentMethod: "card",
      expenseType: "expense"
    };
    const before = JSON.stringify(server);

    for (const field of Object.keys(server)) {
      format(field, (server as Record<string, unknown>)[field]);
    }

    expect(JSON.stringify(server)).toBe(before);
  });
});

describe("app/sync-status.tsx 충돌 화면 wiring (source contract)", () => {
  const screenSource = source("app/sync-status.tsx");

  it("두 후보 값을 포매터로 그린다 (예전의 String(...) 표시는 사라졌다)", () => {
    expect(screenSource).toContain("formatValue(entry.field, entry.localValue)");
    expect(screenSource).toContain("formatValue(entry.field, entry.serverValue)");
    expect(screenSource).not.toContain("String(entry.localValue ?? \"-\")");
    expect(screenSource).not.toContain("String(entry.serverValue ?? \"-\")");
  });

  it("저장되는 merged 값은 여전히 원시 serverValue다", () => {
    // 포맷된 문자열이 저장으로 새면 서버에 "45,900원"/"카드"가 올라간다.
    expect(screenSource).toContain("(merged as Record<string, unknown>)[entry.field] = entry.serverValue;");
    expect(screenSource).not.toContain("[entry.field] = formatValue(");
  });

  it("카테고리 이름은 이미 있는 캐시에서만 읽고 새 요청을 만들지 않는다", () => {
    // 라운드 45 O-5: 렌더 1회 스냅샷(getQueryData)이 아니라 캐시 **구독**이다. enabled:false +
    // skipToken이라 요청은 여전히 0건이면서, 다른 화면이 목록을 받아 오면 이 화면도 따라간다.
    // 라운드 46 Q-5: 낱개 toContain은 **JSDoc만으로도** 통과했다 -- 바로 위 주석에
    // `enabled:false` + `queryFn: skipToken`이 적혀 있어서, 코드에서 옵션을 지워도 초록이었다.
    // 두 줄이 실제로 붙어 있는 **코드 형태**로 고정한다(주석은 이 모양을 만들지 못한다).
    expect(screenSource).toContain('queryKey: ["categories"]');
    expect(screenSource).toMatch(/enabled:\s*false,\s*\n\s*queryFn:\s*skipToken/);
    expect(screenSource).not.toContain('getQueryData<{ categories: CategoryListItem[] }>(["categories"])');
    expect(screenSource).not.toContain("listCategories(");
  });
});
