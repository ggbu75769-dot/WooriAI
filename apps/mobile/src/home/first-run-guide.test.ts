import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  countPendingOfflineCreates,
  countUnpreparedRecommendedItems,
  evaluateHomeFirstRunGuide,
  hasPendingOfflineCreate,
  homePendingSyncNoticeText,
  latchHasAnyExpenseRecord,
  FIRST_EXPENSE_GUIDE_TEST_ID,
  FIRST_ITEMS_GUIDE_DISMISS_LABEL,
  FIRST_ITEMS_GUIDE_MAX_RECENT_RECORDS,
  FIRST_ITEMS_GUIDE_TEST_ID,
  HOME_PENDING_SYNC_NOTICE_TEST_ID,
  type HomeFirstRunGuideInput
} from "./first-run-guide";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

function input(overrides: Partial<HomeFirstRunGuideInput> = {}): HomeFirstRunGuideInput {
  return {
    hasSession: true,
    hasAnyExpenseRecord: false,
    recommendedItemCount: 3,
    recentRecordCount: 1,
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
  });

  it("기록 유무 판정에 서버 최근 지출 + 오프라인 대기 신규 행을 함께 본다", () => {
    expect(homeSource).toContain(
      "home.data.recentExpenses.length > 0 || hasPendingOfflineCreate(childOfflineRows)"
    );
  });

  it("F3: 홈이 그 판정을 세션 이력으로 래치해 동기화 확정 순간의 재점멸을 막는다", () => {
    expect(homeSource).toContain(
      "const hasAnyExpenseRecord = latchHasAnyExpenseRecord(observedHasAnyExpenseRecord, everHadExpenseRecord);"
    );
    expect(homeSource).toContain("state.everHadRecordChildIds[childId]");
    // 래치는 홈 쪽에서만 흡수한다 -- sync-controller의 갱신 순서는 건드리지 않는다.
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    expect(controllerSource).not.toContain("latchHasAnyExpenseRecord");
  });

  it("첫 지출 유도가 떠 있는 동안에는 주간 카드가 같은 말을 반복하지 않는다", () => {
    expect(homeSource).toContain('const weeklySummary = hasSession && firstRunGuide?.variant !== "first-expense"');
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
    // 접은 자리가 고장난 것처럼 보인다. 래치가 "기록이 있다"고 아는 한 프레임(F3)도 같이 접힌다.
    expect(homeSource).toContain("const showRecentExpensesSection =");
    expect(homeSource).toContain('(!hasAnyExpenseRecord && firstRunGuide?.variant !== "first-expense")');
    expect(homeSource).toContain("{showRecentExpensesSection ? (");
    expect(homeSource).toContain("{!showRecentExpensesSection ? null : visibleHome.recentExpenses.length === 0 ? (");
    // FAB는 전역 관례라 유지한다 -- 근거가 주석으로 남아 있어야 다음 라운드가 다시 지우지 않는다.
    expect(homeSource).toContain("<FloatingActionButton onPress={() => router.push(\"/expenses/new\")} />");
    expect(homeSource).toContain("전역 관례");
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
