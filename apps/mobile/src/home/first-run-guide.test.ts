import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  countPendingOfflineCreates,
  countUnpreparedRecommendedItems,
  evaluateHomeFirstRunGuide,
  hasPendingOfflineCreate,
  holdHasAnyExpenseRecordDuringRefetch,
  homeGuideSpeaksForEmptyHome,
  homePendingSyncNoticeText,
  latchHasAnyExpenseRecord,
  shouldShowHomeRecentExpensesSection,
  FIRST_EXPENSE_GUIDE_TEST_ID,
  FIRST_ITEMS_GUIDE_DISMISS_LABEL,
  FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS,
  FIRST_ITEMS_GUIDE_TEST_ID,
  HOME_PENDING_SYNC_NOTICE_TEST_ID,
  HOME_RECENT_EXPENSES_LIMIT,
  VIEW_ONLY_GUIDE_TEST_ID,
  type HomeFirstRunGuideInput
} from "./first-run-guide";
import { EXPENSE_VIEW_ONLY_EMPTY_TITLE, EXPENSE_VIEW_ONLY_MESSAGE } from "../family/record-permissions";
import { shouldCelebrateFirstRecord } from "./first-record-celebration";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

function input(overrides: Partial<HomeFirstRunGuideInput> = {}): HomeFirstRunGuideInput {
  return {
    hasSession: true,
    hasAnyExpenseRecord: false,
    recommendedItemCount: 3,
    recentRecordCount: 1,
    // 라운드 36 F3: 전체 기간 신호. 기본값은 "정말 초기 사용자"(전체 1건).
    serverRecentExpenseCount: 1,
    itemsGuideDismissed: false,
    // 라운드 40 J-5: 기본값은 "기록할 수 있는 세션"이다 -- 잠금은 실세션 + 보기 전용 역할에서만
    // 참이고, 그때만 카드가 바뀐다.
    expenseEntryLocked: false,
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

  it("라운드 35 F6: 이번 달 기록이 이미 많으면 준비템 첫 안내를 띄우지 않는다 (기존 사용자 차단)", () => {
    const overrides = { hasAnyExpenseRecord: true as const, recommendedItemCount: 3 };

    expect(
      evaluateHomeFirstRunGuide(input({ ...overrides, recentRecordCount: FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS }))
        ?.variant
    ).toBe("first-items");
    expect(
      evaluateHomeFirstRunGuide(
        input({ ...overrides, recentRecordCount: FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS + 1 })
      )
    ).toBeNull();
    // 5년 사용자.
    expect(evaluateHomeFirstRunGuide(input({ ...overrides, recentRecordCount: 240 }))).toBeNull();
  });

  it("라운드 35 F6: 이번 달 기록 수를 아직 모르면 준비템 안내를 만들지 않는다 (모르는 상태에 첫 안내 금지)", () => {
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, recentRecordCount: null }))
    ).toBeNull();
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, recentRecordCount: Number.NaN }))
    ).toBeNull();
  });

  /**
   * 라운드 36 F3 — 월초 경계.
   *
   * `recentRecordCount`는 **이번 달** 기록 수라, 1년째 쓰는 사용자도 매달 1~2일에는 0건이 되어
   * "지금 시기 준비물 N개를 골라뒀어요" 첫 실행 안내가 되돌아왔다. 달이 바뀌는 것은 사용자의
   * 행동이 아닌데 안내가 그것에 반응한 셈이다.
   */
  it("F3: 기존 사용자는 매달 초(이번 달 0건)에도 준비템 첫 안내를 다시 보지 않는다", () => {
    const monthStart = { hasAnyExpenseRecord: true as const, recentRecordCount: 0, recommendedItemCount: 3 };

    // 전체 기간 신호가 서버 LIMIT에 닿아 있으면(=3건 이상일 수 있다) 총량을 모르므로 미노출.
    expect(
      evaluateHomeFirstRunGuide(input({ ...monthStart, serverRecentExpenseCount: HOME_RECENT_EXPENSES_LIMIT }))
    ).toBeNull();
    // 그 아래 값은 그게 곧 전체 건수다 -- 진짜 초기 사용자에게는 그대로 뜬다.
    expect(
      evaluateHomeFirstRunGuide(input({ ...monthStart, serverRecentExpenseCount: 1 }))?.variant
    ).toBe("first-items");
    expect(
      evaluateHomeFirstRunGuide(input({ ...monthStart, serverRecentExpenseCount: 2 }))?.variant
    ).toBe("first-items");
  });

  it("F3: 전체 기간 신호를 모르면(홈 응답 없음) 준비템 안내를 만들지 않는다", () => {
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, serverRecentExpenseCount: null }))
    ).toBeNull();
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: true, serverRecentExpenseCount: Number.NaN }))
    ).toBeNull();
  });

  it("H-5: 이번 달 기록이 0~2건일 때만 뜬다 (3건째부터는 이미 루프를 돌고 있는 사람)", () => {
    const overrides = { hasAnyExpenseRecord: true as const, recommendedItemCount: 3, serverRecentExpenseCount: 2 };

    for (const recentRecordCount of [0, 1, 2]) {
      expect(
        evaluateHomeFirstRunGuide(input({ ...overrides, recentRecordCount }))?.variant,
        `이번 달 ${recentRecordCount}건`
      ).toBe("first-items");
    }
    expect(evaluateHomeFirstRunGuide(input({ ...overrides, recentRecordCount: 3 }))).toBeNull();
  });

  it("F3: 두 신호는 AND다 -- 이번 달이 조용해도 전체가 많으면 첫 실행 안내가 아니다", () => {
    // 이번 달 1건 + 전체 3건 이상: 예전에는 떴다.
    expect(
      evaluateHomeFirstRunGuide(
        input({ hasAnyExpenseRecord: true, recentRecordCount: 1, serverRecentExpenseCount: 3 })
      )
    ).toBeNull();
    // 이번 달이 많으면 전체가 적어도(첫 달에 몰아 기록) 첫 실행 안내가 아니다 -- 종전 규칙 유지.
    expect(
      evaluateHomeFirstRunGuide(
        input({
          hasAnyExpenseRecord: true,
          recentRecordCount: FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS + 1,
          serverRecentExpenseCount: 2
        })
      )
    ).toBeNull();
  });

  it("F3: 전체 기간 신호의 상한은 서버 LIMIT과 같은 숫자 하나다", () => {
    expect(HOME_RECENT_EXPENSES_LIMIT).toBe(3);
  });

  /**
   * 라운드 38 H-5 — 두 경계가 정확히 3에서 부딪히던 자리를 **겹치지 않게** 떼어 놓는다.
   *
   * G-6은 "서버 목록이 3이어도 이번 달 기록이 3건이면 막 시작한 사람"이라는 예외로 그 충돌을
   * 풀었지만, 서버 목록은 LIMIT 3이라 "3건 이상"까지만 말해 준다 — 8개월째 쓰는 사용자가 이번
   * 달에 정확히 3건을 기록한 상태가 그 예외를 그대로 통과해 첫 실행 안내를 다시 받았다.
   * 이제 노출 상한(2)이 LIMIT(3)보다 작아 두 게이트가 겹칠 수 없고, 예외도 없다.
   */
  it("H-5: 노출 상한은 서버 LIMIT보다 하나 작다 (두 게이트의 경계가 겹치지 않는다)", () => {
    expect(FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS).toBe(2);
    expect(FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS).toBeLessThan(HOME_RECENT_EXPENSES_LIMIT);
  });

  it("H-5 진리표: 8개월 사용자의 '이번 달 3건'이 첫 실행으로 새지 않는다", () => {
    const cases = [
      // [이번 달 기록 수, 서버 recentExpenses 길이, 기대 variant]
      [1, 1, "first-items"],
      [2, 2, "first-items"],
      // 경계: 이번 달 3건 = 이미 루프를 돌고 있는 사람(신규인지 8개월째인지 서버 LIMIT 3으로는
      // 구별할 수 없다 -- 구별할 수 없는 두 상태에 다른 화면을 주지 않는다).
      [3, 3, null],
      // 장기 사용자의 월초: 이번 달 0건인데 서버 목록은 꽉 차 있다 = 나머지는 지난달 이전 기록.
      [0, 3, null],
      [1, 3, null],
      [2, 3, null],
      // 이번 달이 상한을 넘으면 전체가 적어도 첫 실행 안내가 아니다(종전 ① 규칙).
      [3, 2, null],
      [4, 2, null]
    ] as const;

    for (const [recentRecordCount, serverRecentExpenseCount, expected] of cases) {
      const guide = evaluateHomeFirstRunGuide(
        input({ hasAnyExpenseRecord: true, recommendedItemCount: 3, recentRecordCount, serverRecentExpenseCount })
      );
      expect(guide?.variant ?? null, `이번 달 ${recentRecordCount}건 · 서버 ${serverRecentExpenseCount}건`).toBe(
        expected
      );
    }
  });

  it("기록 수 게이트는 첫 지출 유도에는 걸리지 않는다 -- 기록이 0건인 것 자체가 그 카드의 조건이다", () => {
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false, recentRecordCount: null }))?.variant
    ).toBe("first-expense");
    expect(
      evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false, recentRecordCount: 900 }))?.variant
    ).toBe("first-expense");
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

/**
 * 라운드 40 J-5 — 잠긴 세션에 뜨던 **닫을 수 없는 약속 카드**.
 *
 * 보기 전용 참여자(viewer·gift_participant)의 빈 홈에도 "첫 지출을 기록해 보세요 / 10초면
 * 돼요. 기록하면 …"이 dismissible: false로 떠 있었다. 이 사람이 그 조건을 만족시킬 방법은 없고,
 * 눌러도 "보기 전용으로 참여하고 있어요"라는 안내만 돌아온다. 같은 홈이 오프라인 실패 카드의
 * "기록은 지금도 남길 수 있어요"를 잠긴 세션에서 접은 것과 같은 규칙을, 여기서는 **접는 대신
 * 바꾸는** 방식으로 적용한다(빈 홈에 아무 설명도 없는 상태를 만들지 않기 위해).
 */
describe("라운드 40 J-5 보기 전용 세션의 빈 홈", () => {
  it("잠긴 세션 + 기록 0건 → 약속 대신 사실을 말하는 카드", () => {
    const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false, expenseEntryLocked: true }));

    expect(guide?.variant).toBe("view-only");
    expect(guide?.title).toBe(EXPENSE_VIEW_ONLY_EMPTY_TITLE);
    expect(guide?.subtitle).toBe(EXPENSE_VIEW_ONLY_MESSAGE);
    expect(guide?.testID).toBe(VIEW_ONLY_GUIDE_TEST_ID);
    // 지금 이 사람이 할 수 있는 행동이 없으므로 버튼을 만들지 않는다.
    expect(guide?.ctaLabel).toBeNull();
    expect(guide?.route).toBeNull();
    // 닫을 수 있게 하면 빈 홈에 정말 아무 설명도 없는 상태가 생긴다(첫 지출 카드와 같은 이유).
    expect(guide?.dismissible).toBe(false);
    // 약속형 문장이 한 조각도 남지 않는다.
    expect(`${guide?.title} ${guide?.subtitle}`).not.toContain("10초");
    expect(`${guide?.title} ${guide?.subtitle}`).not.toContain("기록해 보세요");
  });

  it("문구는 잠금 안내와 같은 단일 소스에서 온다 -- 카드와 Alert이 다른 말을 할 수 없다", () => {
    const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false, expenseEntryLocked: true }))!;

    expect(guide.accessibilityLabel).toBe(`${EXPENSE_VIEW_ONLY_EMPTY_TITLE}. ${EXPENSE_VIEW_ONLY_MESSAGE}`);
    // DNC-018: 해요체, 비난·재촉·재시도 권유 없음.
    for (const copy of [guide.title, guide.subtitle]) {
      expect(copy).toMatch(/요\.?$/);
      expect(copy).not.toMatch(/하세요|해야|아직도|늦었|안 하셨|다시 시도/);
    }
  });

  it("J-5 진리표: 잠금 × 기록 유무", () => {
    const cases = [
      // [잠김, 기록 있음, 기대 variant]
      [true, false, "view-only"],
      [false, false, "first-expense"],
      // 기록이 생기면 이 카드는 스스로 사라진다 -- 보기 전용 참여자에게도 마찬가지다.
      [true, true, null],
      [false, true, null]
    ] as const;

    for (const [expenseEntryLocked, hasAnyExpenseRecord, expected] of cases) {
      const guide = evaluateHomeFirstRunGuide(
        // 준비템 갈래를 끄고(추천 0개) 첫 지출 자리만 본다 -- 그 갈래는 아래에서 따로 고정한다.
        input({ expenseEntryLocked, hasAnyExpenseRecord, recommendedItemCount: 0 })
      );
      expect(guide?.variant ?? null, `잠김=${expenseEntryLocked} 기록=${hasAnyExpenseRecord}`).toBe(expected);
    }
  });

  it("준비템 안내는 잠금과 무관하다 -- 보기 전용 참여자도 준비템 탭은 볼 수 있다", () => {
    const guide = evaluateHomeFirstRunGuide(
      input({ hasAnyExpenseRecord: true, recommendedItemCount: 2, expenseEntryLocked: true })
    );

    expect(guide?.variant).toBe("first-items");
    expect(guide?.route).toBe("/(tabs)/items");
    // 그 카드의 문장은 아무것도 약속하지 않는다(기록을 조건으로 걸지 않는다).
    expect(guide?.subtitle).not.toContain("기록하면");
  });

  it("⚠ 픽셀락 HOME-001: 비세션에서는 잠금 값과 무관하게 아무 카드도 만들지 않는다", () => {
    for (const expenseEntryLocked of [true, false]) {
      expect(
        evaluateHomeFirstRunGuide(input({ hasSession: false, hasAnyExpenseRecord: false, expenseEntryLocked }))
      ).toBeNull();
    }
  });

  it("빈 홈의 그 자리를 대신 말하는 카드는 두 갈래다 -- 최근 지출 섹션·주간 카드가 같은 말을 반복하지 않는다", () => {
    expect(homeGuideSpeaksForEmptyHome("first-expense")).toBe(true);
    expect(homeGuideSpeaksForEmptyHome("view-only")).toBe(true);
    expect(homeGuideSpeaksForEmptyHome("first-items")).toBe(false);
    expect(homeGuideSpeaksForEmptyHome(null)).toBe(false);
    expect(homeGuideSpeaksForEmptyHome(undefined)).toBe(false);

    // 잠긴 빈 홈에서 "첫 기록을 남기면 …" 빈 상태가 되살아나지 않는다.
    const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord: false, expenseEntryLocked: true }));
    expect(
      shouldShowHomeRecentExpensesSection({
        serverRecentExpenseCount: 0,
        pendingOfflineCreateCount: 0,
        hasAnyExpenseRecord: false,
        guideVariant: guide?.variant ?? null
      })
    ).toBe(false);
  });

  it("J-5 진리표(2/2): 잠긴 세션에서도 섹션과 카드가 함께 사라지는 조합이 없다", () => {
    for (const serverRecentExpenseCount of [0, 1, 3]) {
      for (const pendingOfflineCreateCount of [0, 2]) {
        for (const hasAnyExpenseRecord of [
          serverRecentExpenseCount > 0 || pendingOfflineCreateCount > 0,
          null
        ]) {
          const guide = evaluateHomeFirstRunGuide(
            input({ hasAnyExpenseRecord, serverRecentExpenseCount, expenseEntryLocked: true })
          );
          const section = shouldShowHomeRecentExpensesSection({
            serverRecentExpenseCount,
            pendingOfflineCreateCount,
            hasAnyExpenseRecord,
            guideVariant: guide?.variant ?? null
          });
          expect(section || homeGuideSpeaksForEmptyHome(guide?.variant)).toBe(true);
          // 잠긴 세션에는 지출 CTA를 들고 있는 카드가 절대 나가지 않는다.
          expect(guide?.route).not.toBe("/expenses/new");
        }
      }
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

  it("F1: \"있다\"와 \"몇 건\"이 같은 규칙에서 나온다", () => {
    const rows = [
      { canonicalId: null, pendingDelete: false },
      { canonicalId: null, pendingDelete: false },
      { canonicalId: "expense-1", pendingDelete: false },
      { canonicalId: null, pendingDelete: true }
    ];

    expect(countPendingOfflineCreates(rows)).toBe(2);
    expect(hasPendingOfflineCreate(rows)).toBe(countPendingOfflineCreates(rows) > 0);
    expect(countPendingOfflineCreates([])).toBe(0);
  });
});

describe("라운드 35 F1 홈 동기화 대기 한 줄", () => {
  it("기록 탭과 같은 단어(\"동기화 대기\")로 건수만 말한다", () => {
    expect(homePendingSyncNoticeText(1)).toBe("동기화 대기 중인 기록 1건");
    expect(homePendingSyncNoticeText(3)).toBe("동기화 대기 중인 기록 3건");
    // 축하 배너와 같은 화면에 뜨는 문구이므로 "첫 기록을 남기면"류의 부정문이 없어야 한다.
    expect(homePendingSyncNoticeText(1)).not.toContain("첫 기록을 남기면");
  });

  it("testID가 고정되어 있다", () => {
    expect(HOME_PENDING_SYNC_NOTICE_TEST_ID).toBe("home-recent-pending-sync");
  });
});

describe("라운드 35 F3 latchHasAnyExpenseRecord", () => {
  it("한 번 참이었으면 그 뒤의 거짓 관찰을 흡수한다 (동기화 확정 순간의 true -> false -> true)", () => {
    expect(latchHasAnyExpenseRecord(false, true)).toBe(true);
    expect(latchHasAnyExpenseRecord(true, true)).toBe(true);
  });

  it("이력이 없으면 관찰값을 그대로 돌려준다", () => {
    expect(latchHasAnyExpenseRecord(false, false)).toBe(false);
    expect(latchHasAnyExpenseRecord(true, false)).toBe(true);
  });

  it("\"모른다\"(null)는 래치하지 않는다 -- 모르는 상태에 카드를 만들지 않는 규칙이 우선이다", () => {
    expect(latchHasAnyExpenseRecord(null, true)).toBeNull();
    expect(latchHasAnyExpenseRecord(null, false)).toBeNull();
  });
});

/**
 * 라운드 36 F2 — 래치가 만들던 "전부 삭제" 구멍.
 *
 * 예전에는 래치 하나가 축하 배너 · 안내 카드 · 최근 지출 섹션을 모두 정했다. 래치는 거짓으로
 * 돌아가지 않으므로, 기록 1건을 남겼다가 그 한 건을 지우면 홈이 앱 재시작 전까지 "기록이 있다"고
 * 믿었다 -- 최근 지출 섹션은 헤더째 접히고 첫 지출 유도 카드도 뜨지 않아, 지출로 가는 큰 입구가
 * 없는 화면이 남았다. 지금은 표시 판정이 관찰값을 쓰고, 깜빡임은 refetch 창 한정 가드가 막는다.
 */
describe("라운드 36 F2 프레임 가드 · 최근 지출 섹션", () => {
  it("refetch 창 안에서만 직전 확정값을 붙든다 (동기화 확정 프레임의 깜빡임 흡수)", () => {
    // 대기 행이 먼저 사라지고 서버 반영이 늦는 한 프레임: 관찰은 false지만 화면은 true를 유지.
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: false, isFetching: true, lastSettled: true })
    ).toBe(true);
    // refetch가 끝나면 즉시 손을 뗀다 -- 이것이 세션 래치와 다른 점이다.
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: false, isFetching: false, lastSettled: true })
    ).toBe(false);
  });

  it("붙드는 방향은 사라지는 쪽 하나뿐이다 -- 방금 남긴 기록은 refetch를 기다리지 않는다", () => {
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: true, isFetching: true, lastSettled: false })
    ).toBe(true);
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: false, isFetching: true, lastSettled: false })
    ).toBe(false);
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: false, isFetching: true, lastSettled: null })
    ).toBe(false);
  });

  it("\"모른다\"(null)는 어떤 경우에도 붙들지 않는다", () => {
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: null, isFetching: true, lastSettled: true })
    ).toBeNull();
    expect(
      holdHasAnyExpenseRecordDuringRefetch({ observed: null, isFetching: false, lastSettled: false })
    ).toBeNull();
  });

  it("섹션은 서버 행 · 대기 행 · \"할 말이 남은 빈 상태\" 셋 중 하나에서만 열린다", () => {
    const base = { serverRecentExpenseCount: 0, pendingOfflineCreateCount: 0, guideVariant: null } as const;

    // 1) 평소.
    expect(
      shouldShowHomeRecentExpensesSection({ ...base, serverRecentExpenseCount: 3, hasAnyExpenseRecord: true })
    ).toBe(true);
    // 2) 아직 올라가지 않은 대기 행.
    expect(
      shouldShowHomeRecentExpensesSection({ ...base, pendingOfflineCreateCount: 1, hasAnyExpenseRecord: true })
    ).toBe(true);
    // 3) 기록이 없고 유도 카드도 없다 -- 그 사실을 이 섹션이 말한다(MOB-117 빈 상태).
    expect(shouldShowHomeRecentExpensesSection({ ...base, hasAnyExpenseRecord: false })).toBe(true);
    // 유도 카드가 같은 말을 하고 있으면 접는다(큰 CTA 1개 + FAB).
    expect(
      shouldShowHomeRecentExpensesSection({ ...base, hasAnyExpenseRecord: false, guideVariant: "first-expense" })
    ).toBe(false);
  });

  /**
   * 이 파일의 핵심 진리표: **지출로 가는 큰 입구가 사라지는 조합이 없다**.
   * (섹션이 접혔다) → (첫 지출 유도 카드가 떠 있다) 이거나 (목록/대기 행이 이미 보인다).
   */
  it("F2 진리표: 확정된 어떤 조합에서도 섹션과 유도 카드가 함께 사라지지 않는다", () => {
    for (const serverRecentExpenseCount of [0, 1, 3]) {
      for (const pendingOfflineCreateCount of [0, 2]) {
        // refetch가 끝난 프레임에서는 관찰값이 두 개수와 항상 일치한다(래치가 아니므로).
        // "아직 모름"(null)도 같은 규칙을 통과해야 한다.
        for (const hasAnyExpenseRecord of [
          serverRecentExpenseCount > 0 || pendingOfflineCreateCount > 0,
          null
        ]) {
          const guide = evaluateHomeFirstRunGuide(input({ hasAnyExpenseRecord, serverRecentExpenseCount }));
          const section = shouldShowHomeRecentExpensesSection({
            serverRecentExpenseCount,
            pendingOfflineCreateCount,
            hasAnyExpenseRecord,
            guideVariant: guide?.variant ?? null
          });
          // 섹션이 접혔다면 그 자리를 대신 말하는 것이 반드시 있다.
          expect(section || guide?.variant === "first-expense").toBe(true);
        }
      }
    }
  });

  it("F2 시나리오: 기록 1건 → 마지막 기록 삭제 → refetch 완료에서 첫 지출 안내가 돌아온다", () => {
    // (1) 기록 1건이 있던 평소 상태.
    const before = holdHasAnyExpenseRecordDuringRefetch({ observed: true, isFetching: false, lastSettled: null });
    expect(before).toBe(true);
    expect(
      shouldShowHomeRecentExpensesSection({
        serverRecentExpenseCount: 1,
        pendingOfflineCreateCount: 0,
        hasAnyExpenseRecord: before,
        guideVariant: null
      })
    ).toBe(true);

    // (2) 삭제 직후 refetch 중 -- 서버 캐시는 아직 그 한 건을 들고 있어 화면이 흔들리지 않는다.
    expect(holdHasAnyExpenseRecordDuringRefetch({ observed: true, isFetching: true, lastSettled: true })).toBe(true);

    // (3) refetch 완료: 관찰값이 false로 확정된다.
    const after = holdHasAnyExpenseRecordDuringRefetch({ observed: false, isFetching: false, lastSettled: true });
    expect(after).toBe(false);

    // 첫 지출 유도 카드가 돌아오고,
    const guide = evaluateHomeFirstRunGuide(
      input({ hasAnyExpenseRecord: after, serverRecentExpenseCount: 0, recentRecordCount: 0 })
    );
    expect(guide?.variant).toBe("first-expense");
    // 그 카드가 지출 CTA를 들고 있으므로 최근 지출 섹션은 같은 말을 반복하지 않는다.
    expect(
      shouldShowHomeRecentExpensesSection({
        serverRecentExpenseCount: 0,
        pendingOfflineCreateCount: 0,
        hasAnyExpenseRecord: after,
        guideVariant: guide?.variant ?? null
      })
    ).toBe(false);
    // 유도 카드가 없었다면(예: 세션 밖) 섹션이 대신 그 자리를 말한다 -- 구멍이 남지 않는다.
    expect(
      shouldShowHomeRecentExpensesSection({
        serverRecentExpenseCount: 0,
        pendingOfflineCreateCount: 0,
        hasAnyExpenseRecord: after,
        guideVariant: null
      })
    ).toBe(true);
  });

  it("F2: 그 상태에서 축하 배너는 재발화하지 않는다 (래치가 남아 있는 유일한 이유)", () => {
    // 관찰값을 그대로 흘리면 "전부 삭제 후 다시 기록"이 새 false -> true 전이가 된다.
    expect(shouldCelebrateFirstRecord({ previous: false, next: true, alreadyCelebrated: false })).toBe(true);
    // 래치는 참을 붙들고 있으므로 스토어가 보는 값은 true -> true다(전이 자체가 생기지 않는다).
    expect(latchHasAnyExpenseRecord(false, true)).toBe(true);
    expect(shouldCelebrateFirstRecord({ previous: true, next: true, alreadyCelebrated: false })).toBe(false);
    // 설령 전이로 읽혀도 같은 세션에서 이미 축하했으면 다시 뜨지 않는다(이중 방어).
    expect(shouldCelebrateFirstRecord({ previous: false, next: true, alreadyCelebrated: true })).toBe(false);
  });
});

describe("라운드 35 F6 countUnpreparedRecommendedItems", () => {
  it("준비 완료 계열(prepared/gifted/not_needed)은 세지 않는다 -- 준비템 탭 축하와 어긋나지 않게", () => {
    expect(
      countUnpreparedRecommendedItems([
        { status: "not_prepared" },
        { status: "interested" },
        { status: "prepared" },
        { status: "gifted" },
        { status: "not_needed" }
      ])
    ).toBe(2);
  });

  it("전부 준비했으면 0 -- 그때 카드는 아예 만들어지지 않는다", () => {
    const items = [{ status: "prepared" as const }, { status: "gifted" as const }];

    expect(countUnpreparedRecommendedItems(items)).toBe(0);
    expect(
      evaluateHomeFirstRunGuide(
        input({ hasAnyExpenseRecord: true, recommendedItemCount: countUnpreparedRecommendedItems(items) })
      )
    ).toBeNull();
  });

  it("빈 목록은 0", () => {
    expect(countUnpreparedRecommendedItems([])).toBe(0);
  });
});

describe("UX-G 홈 화면 배선", () => {
  it("홈이 순수 모듈로 카드를 고르고, 서버 응답에서 아직 준비되지 않은 추천만 센다 (F6)", () => {
    expect(homeSource).toContain('from "../../src/home/first-run-guide"');
    expect(homeSource).toContain("const firstRunGuide = evaluateHomeFirstRunGuide({");
    expect(homeSource).toContain(
      "recommendedItemCount: countUnpreparedRecommendedItems(home.data?.recommendedItems ?? [])"
    );
    // 요청을 늘리지 않는다 -- 기록 수 게이트는 주간 카드가 이미 쓰는 재조정 결과를 재사용한다.
    expect(homeSource).toContain("recentRecordCount: weeklyThisMonthRecords?.length ?? null");
    // 라운드 36 F3: 전체 기간 신호도 홈이 이미 들고 있는 응답에서 읽는다(요청 추가 없음).
    expect(homeSource).toContain("serverRecentExpenseCount: home.data ? home.data.recentExpenses.length : null");
  });

  it("기록 유무 판정에 서버 최근 지출 + 오프라인 대기 신규 행을 함께 본다", () => {
    expect(homeSource).toContain(
      "home.data.recentExpenses.length > 0 || hasPendingOfflineCreate(childOfflineRows)"
    );
  });

  it("F3 → 36 F2: 세션 이력 래치는 축하 배너에만 흘러간다", () => {
    expect(homeSource).toContain(
      "const latchedHasAnyExpenseRecord = latchHasAnyExpenseRecord(observedHasAnyExpenseRecord, everHadExpenseRecord);"
    );
    expect(homeSource).toContain("state.everHadRecordChildIds[childId]");
    // 래치의 유일한 소비자는 축하 배너 스토어다(표시 판정은 관찰값을 쓴다 -- F2).
    expect(homeSource).toContain("observeFirstRecord(childId, latchedHasAnyExpenseRecord);");
    // 래치는 홈 쪽에서만 흡수한다 -- sync-controller의 갱신 순서는 건드리지 않는다.
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    expect(controllerSource).not.toContain("latchHasAnyExpenseRecord");
  });

  it("F2: 표시 판정은 관찰값 + refetch 창 한정 프레임 가드를 쓴다 (래치 아님)", () => {
    expect(homeSource).toContain("const hasAnyExpenseRecord = holdHasAnyExpenseRecordDuringRefetch({");
    expect(homeSource).toContain("observed: observedHasAnyExpenseRecord,");
    expect(homeSource).toContain("isFetching: home.isFetching,");
    // 직전 확정값은 아이별로 기억한다 -- 아이를 바꾸면 다른 아이의 사실을 붙들면 안 된다.
    expect(homeSource).toContain("settledHasAnyExpenseRecord");
  });

  it("첫 지출 유도가 떠 있는 동안에는 주간 카드가 같은 말을 반복하지 않는다", () => {
    // 라운드 40 J-5: 잠긴 세션의 `view-only` 카드도 같은 자리를 말하므로 함께 접는다 --
    // 판정은 순수 모듈 하나(homeGuideSpeaksForEmptyHome)가 갖고, 화면은 문자열 비교를 하지 않는다.
    expect(homeSource).toContain(
      "const weeklySummary = hasSession && !homeGuideSpeaksForEmptyHome(firstRunGuide?.variant) ? weeklySpend : null;"
    );
    expect(homeSource).not.toContain('firstRunGuide?.variant !== "first-expense" ? weeklySpend');
  });

  it("라운드 40 J-5: 홈이 잠금 판정을 순수 모듈에 넘기고, 버튼 없는 카드를 그릴 수 있다", () => {
    expect(homeSource).toContain("expenseEntryLocked: expenseGate.locked");
    // 카드 안 버튼은 ctaLabel·route가 모두 있을 때만 그린다(`view-only`는 둘 다 null).
    expect(homeSource).toContain("const firstRunGuideCta =");
    expect(homeSource).toContain("{firstRunGuideCta ? (");
    expect(homeSource).toContain("label={firstRunGuideCta.label}");
    expect(homeSource).toContain("router.push(firstRunGuideCta.route)");
    // 잠금 문구를 화면에서 다시 적지 않는다(문구 단일 소스는 record-permissions.ts).
    expect(homeSource).not.toContain("가족이 기록하면 여기에 쌓여요");
  });

  it("최근 지출 섹션의 빈 상태(MOB-117) 문구는 남아 있되, 사실일 때만 그린다", () => {
    expect(homeSource).toContain("recentExpenses.length === 0");
    expect(homeSource).toContain("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
  });

  it("F1: 서버 목록이 비어도 대기 행이 있으면 빈 상태 대신 동기화 대기 한 줄을 그린다", () => {
    expect(homeSource).toContain("const pendingOfflineCreateCount = countPendingOfflineCreates(childOfflineRows);");
    expect(homeSource).toContain("pendingOfflineCreateCount > 0 ? (");
    expect(homeSource).toContain("testID={HOME_PENDING_SYNC_NOTICE_TEST_ID}");
    expect(homeSource).toContain("homePendingSyncNoticeText(pendingOfflineCreateCount)");
    // 축하 배너와 "첫 기록을 남기면 …"이 한 화면에 같이 뜨던 경로가 닫혔는지: 대기 행 분기가
    // EmptyStateCard보다 앞에 온다.
    const pendingIndex = homeSource.indexOf("testID={HOME_PENDING_SYNC_NOTICE_TEST_ID}");
    const emptyIndex = homeSource.indexOf("첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요.");
    expect(pendingIndex).toBeGreaterThan(-1);
    expect(pendingIndex).toBeLessThan(emptyIndex);
  });

  it("F2: 첫 지출 유도 카드가 떠 있는 동안에는 최근 지출 섹션을 헤더째 접는다 (큰 CTA 1개 + FAB)", () => {
    // 섹션을 그리는 조건 하나로 모은다 -- 본문만 지우고 제목("최근 지출 / 전체 보기")을 남기면
    // 접은 자리가 고장난 것처럼 보인다. 라운드 36 F2: 판정은 순수 모듈이 하고, 유도 카드와
    // **같은 관찰값**을 본다(래치를 쓰면 마지막 기록 삭제 후 둘 다 사라지는 구멍이 남았다).
    expect(homeSource).toContain("const showRecentExpensesSection = shouldShowHomeRecentExpensesSection({");
    expect(homeSource).toContain("guideVariant: firstRunGuide?.variant ?? null");
    expect(homeSource).not.toContain('(!hasAnyExpenseRecord && firstRunGuide?.variant !== "first-expense")');
    expect(homeSource).toContain("{showRecentExpensesSection ? (");
    expect(homeSource).toContain("{!showRecentExpensesSection ? null : visibleHome.recentExpenses.length === 0 ? (");
    // FAB는 전역 관례라 유지한다 -- 근거가 주석으로 남아 있어야 다음 라운드가 다시 지우지 않는다.
    // UX-R(M): FAB 자체는 그대로 서 있고 목적지도 그대로다. 눌렀을 때만 보기 전용 판정을
    // 거친다(expenseGate.guard) -- 잠금은 실세션 + 보기 전용 역할에서만 발동하므로 이 자리의
    // "FAB는 사라지지 않는다"는 계약은 그대로다.
    expect(homeSource).toContain(
      '<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />'
    );
    expect(homeSource).toContain("전역 관례");
  });

  it("카드 전체에 소리용 라벨이 붙고 CTA는 버튼 역할을 갖는다", () => {
    expect(homeSource).toContain("testID={firstRunGuide.testID}");
    expect(homeSource).toContain("accessibilityLabel={firstRunGuide.accessibilityLabel}");
    expect(homeSource).toContain("accessibilityLabel={firstRunGuideCta.label}");
    expect(homeSource).toContain("label={firstRunGuideCta.label}");
    expect(homeSource).toContain("router.push(firstRunGuideCta.route)");
  });

  it("준비템 안내는 눌러도·닫아도 1회성 플래그가 남는다", () => {
    expect(homeSource).toContain('if (firstRunGuide.variant === "first-items") dismissItemsGuide(childId)');
    expect(homeSource).toContain("label={FIRST_ITEMS_GUIDE_DISMISS_LABEL}");
    expect(FIRST_ITEMS_GUIDE_DISMISS_LABEL).toBe("닫기");
  });
});
