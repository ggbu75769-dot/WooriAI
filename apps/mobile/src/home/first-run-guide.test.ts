import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateHomeFirstRunGuide,
  hasPendingOfflineCreate,
  FIRST_EXPENSE_GUIDE_TEST_ID,
  FIRST_ITEMS_GUIDE_DISMISS_LABEL,
  FIRST_ITEMS_GUIDE_TEST_ID,
  type HomeFirstRunGuideInput
} from "./first-run-guide";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

function input(overrides: Partial<HomeFirstRunGuideInput> = {}): HomeFirstRunGuideInput {
  return {
    hasSession: true,
    hasAnyExpenseRecord: false,
    recommendedItemCount: 3,
    itemsGuideDismissed: false,
    ...overrides
  };
}

describe("UX-G evaluateHomeFirstRunGuide", () => {
  it("기록이 하나도 없으면 첫 지출 유도 카드를 만든다 -- 10초라는 가벼움을 말한다", () => {
    const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false }));

    expect(guide?.variant).toBe("first-expense");
    expect(guide?.title).toBe("첫 지출을 기록해 보세요");
    expect(guide?.subtitle).toContain("10초");
    expect(guide?.route).toBe("/expenses/new");
    expect(guide?.testID).toBe(FIRST_EXPENSE_GUIDE_TEST_ID);
  });

  it("첫 지출 유도 카드는 닫을 수 없다 -- 기록이 생기면 스스로 사라지는 카드다", () => {
    expect(evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false }))?.dismissible).toBe(false);
  });

  it("기록이 없을 때는 준비템 안내보다 지출 기록이 항상 먼저다 (루프 1단계)", () => {
    const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false, recommendedItemCount: 3 }));

    expect(guide?.variant).toBe("first-expense");
    expect(guide?.route).not.toBe("/(tabs)/items");
  });

  it("기록이 생기면 준비템 첫 안내로 넘어가고, 개수는 서버가 실제로 고른 수를 그대로 말한다", () => {
    const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, recommendedItemCount: 2 }));

    expect(guide?.variant).toBe("first-items");
    expect(guide?.title).toBe("지금 시기 준비물 2개를 골라뒀어요");
    expect(guide?.route).toBe("/(tabs)/items");
    expect(guide?.testID).toBe(FIRST_ITEMS_GUIDE_TEST_ID);
    expect(guide?.dismissible).toBe(true);
  });

  it("추천이 0개면 준비템 안내를 만들지 않는다 -- \"0개를 확인해 보세요\"는 정보가 아니다", () => {
    expect(evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, recommendedItemCount: 0 }))).toBeNull();
    expect(evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, recommendedItemCount: -1 }))).toBeNull();
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, recommendedItemCount: Number.NaN }))
    ).toBeNull();
  });

  it("준비템 안내를 이미 닫았으면 다시 뜨지 않는다 (1회성)", () => {
    expect(evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, itemsGuideDismissed: true }))).toBeNull();
  });

  it("기록 여부를 아직 모르면(홈 응답 로딩/실패) 아무 카드도 만들지 않는다", () => {
    expect(evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: null }))).toBeNull();
  });

  it("비세션 픽셀락 미리보기에서는 언제나 null이다 -- HOME-001 캡처 불변", () => {
    expect(evaluateHomeFirstRunGuide(input({ hasSession: false, hasAnyExpenseRecord: false }))).toBeNull();
    expect(evaluateHomeFirstRunGuide(input({ hasSession: false, hasAnyExpenseRecord: true }))).toBeNull();
  });

  it("두 안내가 동시에 나오지 않는다 -- 어떤 입력이든 카드는 최대 하나다", () => {
    const combinations = [true, false, null].flatMap((hasAnyExpenseRecord) =>
      [0, 1, 3].flatMap((recommendedItemCount) =>
        [true, false].map((itemsGuideDismissed) =>
          evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord, recommendedItemCount, itemsGuideDismissed }))
        )
      )
    );

    for (const guide of combinations) {
      expect(guide === null || typeof guide.variant === "string").toBe(true);
    }
  });

  it("유도 경로는 핵심 루프의 1단계와 3단계뿐이다 (DNC-002)", () => {
    const routes = [
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false }))?.route,
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true }))?.route
    ];

    expect(routes).toEqual(["/expenses/new", "/(tabs)/items"]);
  });

  it("문구는 해요체이고 비난·재촉이 없다 (DNC-018)", () => {
    const guides = [
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false }))!,
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true }))!
    ];

    for (const guide of guides) {
      const copy = `${guide.title} ${guide.subtitle} ${guide.ctaLabel}`;
      expect(copy).not.toMatch(/하세요|해야|아직도|늦었|안 하셨/);
      expect(guide.accessibilityLabel).toBe(`${guide.title}. ${guide.subtitle}`);
    }
  });
});

describe("UX-G hasPendingOfflineCreate", () => {
  it("아직 서버에 올라가지 않은 신규 행이 있으면 true", () => {
    expect(hasPendingOfflineCreate([{ canonicalId: null, pendingDelete: false }])).toBe(true);
  });

  it("이미 동기화된 행은 서버 목록이 이미 알고 있으므로 세지 않는다", () => {
    expect(hasPendingOfflineCreate([{ canonicalId: "expense-1", pendingDelete: false }])).toBe(false);
  });

  it("삭제 대기 중인 행은 곧 사라질 기록이라 세지 않는다", () => {
    expect(hasPendingOfflineCreate([{ canonicalId: null, pendingDelete: true }])).toBe(false);
  });

  it("행이 없으면 false", () => {
    expect(hasPendingOfflineCreate([])).toBe(false);
  });
});

describe("UX-G 홈 화면 배선", () => {
  it("홈이 순수 모듈로 카드를 고르고, 서버 응답의 추천 개수를 그대로 넘긴다", () => {
    expect(homeSource).toContain('from "../../src/home/first-run-guide"');
    expect(homeSource).toContain("const firstRunGuide = evaluateHomeFirstRunGuide({");
    expect(homeSource).toContain("recommendedItemCount: home.data?.recommendedItems.length ?? 0");
  });

  it("기록 유무 판정에 서버 최근 지출 + 오프라인 대기 신규 행을 함께 본다", () => {
    expect(homeSource).toContain(
      "home.data.recentExpenses.length > 0 || hasPendingOfflineCreate(childOfflineRows)"
    );
  });

  it("첫 지출 유도가 떠 있는 동안에는 주간 카드가 같은 말을 반복하지 않는다", () => {
    expect(homeSource).toContain('const weeklySummary = hasSession && firstRunGuide?.variant !== "first-expense"');
  });

  it("최근 지출 섹션의 빈 상태(MOB-117)는 그대로 남는다 -- 섹션 자신의 정직한 빈 상태다", () => {
    expect(homeSource).toContain("recentExpenses.length === 0");
    expect(homeSource).toContain("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
  });

  it("카드 전체에 소리용 라벨이 붙고 CTA는 버튼 역할을 갖는다", () => {
    expect(homeSource).toContain("testID={firstRunGuide.testID}");
    expect(homeSource).toContain("accessibilityLabel={firstRunGuide.accessibilityLabel}");
    expect(homeSource).toContain("label={firstRunGuide.ctaLabel}");
    expect(homeSource).toContain("router.push(firstRunGuide.route)");
  });

  it("준비템 안내는 눌러도·닫아도 1회성 플래그가 남는다", () => {
    expect(homeSource).toContain('if (firstRunGuide.variant === "first-items") dismissItemsGuide(childId)');
    expect(homeSource).toContain("label={FIRST_ITEMS_GUIDE_DISMISS_LABEL}");
    expect(FIRST_ITEMS_GUIDE_DISMISS_LABEL).toBe("닫기");
  });
});
