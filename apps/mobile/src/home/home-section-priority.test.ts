import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  homeMoreSectionsLabel,
  homePrepCardSubtitle,
  planHomeSections,
  resolveHomePrepCard,
  HOME_PREP_CARD_CTA_LABEL,
  HOME_PREP_CARD_TEST_ID,
  HOME_PREP_CARD_TITLE,
  HOME_SECTION_RANK,
  HOME_VISIBLE_SECTION_LIMIT,
  type HomePrepCardGuideLike,
  type HomePrepCardNudgeLike,
  type HomeSectionId
} from "./home-section-priority";

/**
 * DSN-053 P2-A — 홈 카드 다이어트.
 *
 * 화면(app/(tabs)/index.tsx)은 react-native 네이티브 바인딩 때문에 vitest에서 렌더할 수 없으므로,
 * 판정은 순수 모듈로 전부 고정하고 화면 쪽은 소스 계약(grep)으로 잡는다 -- prep-nudge.test.ts /
 * budget-warning.test.ts와 같은 관례다.
 */

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const sessionRender = homeSource.slice(homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)"));
/**
 * 라운드 55 트랙 C: 접힘 대상 카드의 렌더는 `renderHomeSection`의 switch 안에 있고, 그 함수는
 * 위 `sessionRender` 표식보다 **앞**에 선언된다(두 렌더 분기가 같은 함수를 쓴다). 그래서 정기
 * 지출 카드 블록은 case 표식 두 개로 따로 자른다.
 */
const recurringCardBlock = homeSource.slice(
  homeSource.indexOf('case "recurring-reminder":'),
  homeSource.indexOf('case "milestone":')
);
/** "무엇이 없어야 하는가"를 볼 때 쓰는 사본 -- 주석은 금지 사항 자체를 언급하며 이유를 적는다. */
const recurringCardCode = recurringCardBlock
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("planHomeSections 우선순위 판정", () => {
  it("활성 카드를 순위표대로 줄 세우고 상위 두 장만 펼친다", () => {
    const plan = planHomeSections({
      active: ["cumulative-total", "weekly-summary", "budget-warning", "last-month"]
    });
    expect(plan.visible).toEqual(["budget-warning", "weekly-summary"]);
    expect(plan.collapsed).toEqual(["last-month", "cumulative-total"]);
    expect(plan.entries.map((entry) => entry.id)).toEqual([
      "budget-warning",
      "weekly-summary",
      "last-month",
      "cumulative-total"
    ]);
  });

  it("근거를 값으로 싣는다 -- 각 카드의 순위와 펼침 여부가 결과에 남는다", () => {
    const plan = planHomeSections({ active: ["milestone", "budget-warning"] });
    expect(plan.entries).toEqual([
      { id: "budget-warning", rank: HOME_SECTION_RANK["budget-warning"], visible: true },
      { id: "milestone", rank: HOME_SECTION_RANK.milestone, visible: true }
    ]);
  });

  it("스펙이 정한 순서를 지킨다: 예산 경고 > (구매 확인) > 마일스톤 > 주간 요약", () => {
    expect(HOME_SECTION_RANK["budget-warning"]).toBeLessThan(HOME_SECTION_RANK.milestone);
    expect(HOME_SECTION_RANK.milestone).toBeLessThan(HOME_SECTION_RANK["weekly-summary"]);
    // 리포트 탭이 같은 숫자를 더 자세히 말하는 둘은 맨 뒤다(위임 가능).
    expect(HOME_SECTION_RANK["weekly-summary"]).toBeLessThan(HOME_SECTION_RANK["last-month"]);
    expect(HOME_SECTION_RANK["last-month"]).toBeLessThan(HOME_SECTION_RANK["cumulative-total"]);
  });

  /**
   * 라운드 55 트랙 C — 정기 지출 리마인더의 자리(설계 §1.5 순위표).
   *
   * 값 자체를 고정하는 이유: 순위는 "무엇이 무엇보다 중요한가"라는 판단이고, 이 판단이 바뀌면
   * 사용자가 보는 카드 순서가 바뀐다(§6 위험 6). 재번호가 조용히 일어나지 않게 표 전체를 적는다.
   */
  it("정기 지출 리마인더는 첫 실행 안내 다음, 마일스톤 앞이다 (설계 §1.5)", () => {
    expect(HOME_SECTION_RANK).toEqual({
      "budget-warning": 1,
      "first-run-guide": 2,
      "recurring-reminder": 3,
      milestone: 4,
      "weekly-summary": 5,
      "budget-nudge": 6,
      "last-month": 7,
      "cumulative-total": 8
    } satisfies Record<HomeSectionId, number>);
    // 근거: 미기록 정기 지출은 "지금 행동하지 않으면 이번 달 합계가 실제와 어긋나는" 사실이라
    // 날짜 안내(마일스톤)보다 금전적 결과가 크다. 다만 예산 경고·첫 실행 안내보다는 뒤다.
    expect(HOME_SECTION_RANK["first-run-guide"]).toBeLessThan(HOME_SECTION_RANK["recurring-reminder"]);
    expect(HOME_SECTION_RANK["recurring-reminder"]).toBeLessThan(HOME_SECTION_RANK.milestone);
  });

  it("수용 기준 7: 예산 경고 + 첫 실행 안내가 함께 서면 정기 지출 카드는 '더 보기' 뒤로 접힌다", () => {
    const plan = planHomeSections({
      active: ["recurring-reminder", "budget-warning", "first-run-guide"]
    });
    expect(plan.visible).toEqual(["budget-warning", "first-run-guide"]);
    expect(plan.collapsed).toEqual(["recurring-reminder"]);
  });

  it("두 장 이하이면 접히는 카드가 없다", () => {
    const plan = planHomeSections({ active: ["last-month", "budget-warning"] });
    expect(plan.collapsed).toEqual([]);
  });

  it("아무것도 활성이 아니면 빈 계획이다(빈 자리를 만들지 않는다)", () => {
    const plan = planHomeSections({ active: [] });
    expect(plan.visible).toEqual([]);
    expect(plan.collapsed).toEqual([]);
    expect(plan.entries).toEqual([]);
  });

  it("중복 id는 한 번만 센다 -- 같은 카드를 두 번 넘겨도 순위가 흔들리지 않는다", () => {
    const plan = planHomeSections({ active: ["milestone", "milestone", "budget-warning"] });
    expect(plan.entries.map((entry) => entry.id)).toEqual(["budget-warning", "milestone"]);
  });

  it("상한을 0으로 주면 전부 접힌다(펼침 자리를 다른 것이 이미 쓰고 있을 때)", () => {
    const plan = planHomeSections({ active: ["budget-warning", "milestone"], limit: 0 });
    expect(plan.visible).toEqual([]);
    expect(plan.collapsed).toEqual(["budget-warning", "milestone"]);
  });

  it("캡처의 '히어로 1장 + 구획 3개'가 상한의 근거다", () => {
    expect(HOME_VISIBLE_SECTION_LIMIT).toBe(2);
  });

  it("더 보기 문구가 접힌 장수를 밝힌다(무엇이 숨었는지 감추지 않는다)", () => {
    expect(homeMoreSectionsLabel(3)).toBe("카드 3개 더 보기");
  });
});

describe("resolveHomePrepCard — 준비 현황 카드 한 자리", () => {
  const guide = (variant: HomePrepCardGuideLike["variant"]): HomePrepCardGuideLike => ({
    variant,
    title: "준비물, 지금 시기에 맞게 골라뒀어요",
    subtitle: "3개를 확인해 보세요",
    ctaLabel: "준비물 확인하기",
    testID: "home-items-guide",
    dismissible: true
  });
  const nudge: HomePrepCardNudgeLike = {
    title: "지금 시기 준비템을 골라뒀어요",
    subtitle: "카시트 · 그림책",
    ctaLabel: "준비템 탭에서 확인하기",
    testID: "home-prep-nudge",
    accessibilityLabel: "지금 시기 준비템을 골라뒀어요. 카시트 · 그림책"
  };

  it("첫 실행 안내(first-items)가 있으면 그 카드가 이 자리를 쓴다", () => {
    const card = resolveHomePrepCard({
      hasSession: true,
      firstRunGuide: guide("first-items"),
      prepNudge: nudge,
      unpreparedItemCount: 3
    });
    expect(card?.source).toBe("first-run-guide");
    expect(card?.title).toBe("준비물, 지금 시기에 맞게 골라뒀어요");
    expect(card?.ctaLabel).toBe("준비물 확인하기");
    // 1회성 안내라 닫을 수 있다(그 카드가 원래 갖고 있던 성질).
    expect(card?.dismissible).toBe(true);
  });

  it("지출 갈래·보기 전용 갈래는 이 자리를 쓰지 않는다(준비템 이야기가 아니다)", () => {
    for (const variant of ["first-expense", "view-only"] as const) {
      const card = resolveHomePrepCard({
        hasSession: true,
        firstRunGuide: guide(variant),
        prepNudge: nudge,
        unpreparedItemCount: 3
      });
      expect(card?.source).toBe("prep-nudge");
    }
  });

  it("안내가 없으면 준비템 넛지의 구체적인 문구를 쓴다", () => {
    const card = resolveHomePrepCard({
      hasSession: true,
      firstRunGuide: null,
      prepNudge: nudge,
      unpreparedItemCount: 2
    });
    expect(card).toEqual({
      source: "prep-nudge",
      title: nudge.title,
      subtitle: nudge.subtitle,
      ctaLabel: nudge.ctaLabel,
      route: "/(tabs)/items",
      testID: nudge.testID,
      dismissible: false,
      accessibilityLabel: nudge.accessibilityLabel
    });
  });

  it("둘 다 없으면 캡처의 기본 문구로 개수만 말한다", () => {
    const card = resolveHomePrepCard({
      hasSession: true,
      firstRunGuide: null,
      prepNudge: null,
      unpreparedItemCount: 3
    });
    expect(card?.source).toBe("recommended-count");
    expect(card?.title).toBe(HOME_PREP_CARD_TITLE);
    expect(card?.subtitle).toBe(homePrepCardSubtitle(3));
    expect(card?.subtitle).toBe("지금 필요한 준비템 3개");
    expect(card?.ctaLabel).toBe(HOME_PREP_CARD_CTA_LABEL);
    expect(card?.testID).toBe(HOME_PREP_CARD_TEST_ID);
    expect(card?.dismissible).toBe(false);
  });

  it("할 말이 없으면 카드를 만들지 않는다 -- '0개'를 말하려고 자리를 세우지 않는다", () => {
    expect(
      resolveHomePrepCard({ hasSession: true, firstRunGuide: null, prepNudge: null, unpreparedItemCount: 0 })
    ).toBeNull();
  });

  it("비세션 미리보기(HOME-001 캡처 경로)에는 이 카드가 없다", () => {
    expect(
      resolveHomePrepCard({ hasSession: false, firstRunGuide: null, prepNudge: nudge, unpreparedItemCount: 3 })
    ).toBeNull();
  });
});

describe("DSN-053 P2-A 홈 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  it("접힘은 렌더만이다 -- 판정 훅과 데이터는 하나도 줄지 않는다", () => {
    // 훅·쿼리는 종전 그대로(요청 수 계약은 prep-nudge.test.ts가 5개로 고정한다).
    for (const evaluation of [
      "evaluateBudgetWarning",
      "evaluateHomeFirstRunGuide",
      "evaluateMilestoneCountdown",
      "evaluateWeeklySummary",
      "buildHomeBudgetNudge",
      "evaluateLastMonthComparison",
      "evaluateHomeCumulativeTotal",
      "evaluateHomePrepNudge",
      "evaluateBabyCounter",
      "useHomeNotificationEvaluation",
      "resolveThisMonthUsedKrw"
    ]) {
      expect(homeSource, evaluation).toContain(evaluation);
    }
    // 순위·상한은 화면이 짐작하지 않는다 -- 값은 순수 모듈에서 온다.
    expect(homeSource).toContain('from "../../src/home/home-section-priority"');
    expect(homeSource).toContain("const sectionPlan = planHomeSections({ active: activeSections });");
    expect(homeSource).toContain(
      "const renderedSections = sectionsExpanded ? sectionPlan.entries.map((entry) => entry.id) : sectionPlan.visible;"
    );
  });

  it("접힌 카드는 같은 화면의 '더 보기'로 전부 펼쳐진다(다른 화면으로 떠넘기지 않는다)", () => {
    expect(homeSource).toContain("testID={HOME_MORE_SECTIONS_TEST_ID}");
    expect(homeSource).toContain("homeMoreSectionsLabel(collapsedSectionCount)");
    expect(homeSource).toContain("HOME_SECTIONS_COLLAPSE_LABEL");
    expect(homeSource).toContain("accessibilityState={{ expanded: sectionsExpanded }}");
  });

  it("여덟 카드가 모두 우선순위 목록을 지난다(새 카드를 몰래 히어로 밑에 세우지 않는다)", () => {
    const pushes = (homeSource.match(/activeSections\.push\("([a-z-]+)"\)/g) ?? []).map((line) =>
      line.replace(/activeSections\.push\("|"\)/g, "")
    );
    expect(pushes.sort()).toEqual(
      (
        [
          "budget-nudge",
          "budget-warning",
          "cumulative-total",
          "first-run-guide",
          "last-month",
          "milestone",
          // 라운드 55 트랙 C: 정기 지출 리마인더도 예외 없이 같은 순위표를 지난다.
          "recurring-reminder",
          "weekly-summary"
        ] satisfies HomeSectionId[]
      ).sort()
    );
  });

  /**
   * 라운드 55 트랙 C — 정기 지출 리마인더 카드의 배선 계약.
   *
   * 판정과 문구는 순수 모듈이 갖고 있으므로(recurring-template.test.ts) 여기서 잡는 것은 화면이
   * 그 값을 **어떻게 넘기고 어떻게 쓰는가**뿐이다. 특히 두 가지가 조용히 뒤집히기 쉽다:
   * `monthExpenses`의 `?? []`(정직성)와 카드의 `accessibilityRole="alert"`(A11Y).
   */
  it("정기 지출 카드: 이번 달 캐시가 없으면 undefined를 그대로 넘긴다 (`?? []` 금지)", () => {
    expect(homeSource).toContain("monthExpenses: thisMonthExpenses.data?.expenses,");
    // `?? []`를 붙이면 "캐시 미도착"과 "이번 달 0건"이 한 값으로 뭉개져 틀린 N을 말하게 된다.
    expect(homeSource).not.toContain("monthExpenses: thisMonthExpenses.data?.expenses ?? []");
    // 오프라인 대기 행은 이미 구독 중인 스냅숏 그대로다(추가 요청 0건). 아이 필터·삭제 대기
    // 제외는 순수 모듈이 하므로 화면이 다시 짜지 않는다.
    expect(homeSource).toContain("pendingRows: offlineSyncSnapshot.rows");
    expect(homeSource).toContain("buildRecurringReminder({");
  });

  it("정기 지출 카드: 문구·접근성 라벨을 화면이 다시 적지 않는다", () => {
    expect(homeSource).toContain('from "../../src/expenses/recurring-template"');
    expect(recurringCardBlock).toContain("{recurringReminder.title}");
    expect(recurringCardBlock).toContain("accessibilityLabel={row.recordAccessibilityLabel}");
    expect(recurringCardBlock).toContain("accessibilityLabel={row.skipAccessibilityLabel}");
    expect(recurringCardBlock).toContain("{row.label}");
    expect(recurringCardBlock).toContain("{RECURRING_RECORD_ACTION_LABEL}");
    expect(recurringCardBlock).toContain("{RECURRING_SKIP_ACTION_LABEL}");
  });

  it("정기 지출 카드: alert가 아니다 (일시적 알림이 아니라 이번 달 내내 서 있는 사실)", () => {
    expect(recurringCardCode).not.toContain('accessibilityRole="alert"');
    expect(recurringCardCode).not.toContain("accessibilityLiveRegion");
  });

  it("정기 지출 카드: 기록하기는 게이트를 지나 프리필로 열고, 건너뛰기는 지출을 만들지 않는다", () => {
    // 보기 전용 참여자에게는 홈의 다른 기록 입구와 **같은 게이트**가 안내로 답한다(UX-R(M)).
    expect(recurringCardBlock).toContain("expenseGate.guard(");
    expect(recurringCardBlock).toContain("recurringPrefillParams(row.template)");
    expect(recurringCardBlock).toContain('router.push({ pathname: "/expenses/new", params });');
    // DNC-013: "이미 기록했어요"는 그 달을 목록에서 빼기만 한다 -- 지출을 만들지 않는다.
    expect(recurringCardBlock).toContain("skipRecurringThisMonth(row.template.id, recurringReminder.yearMonth)");
    expect(recurringCardCode).not.toContain("createExpense");
    expect(recurringCardCode).not.toContain("enqueue");
    // 관리 화면 입구는 카드 하단 텍스트 버튼 하나(설계 §1.5).
    expect(recurringCardBlock).toContain('router.push("/expenses/recurring")');
    expect(recurringCardBlock).toContain("{RECURRING_MANAGE_LABEL}");
  });

  it("정기 지출 카드는 비세션 프리뷰(HOME-001 캡처 경로)에 존재하지 않는다", () => {
    // 라운드 78 트랙 E: 두 표식은 소스 주석이다 — 주석 한 줄이 손질되면 -1이 되고,
    // 시작이 -1이면 구간이 **빈 문자열**이라 아래 부정 단언이 영원히 초록이 된다.
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로)");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)", previewStart);
    expect(previewStart, "비세션 프리뷰 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(previewEnd, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    expect(preview).not.toContain("recurringReminder");
    // 모듈 쪽 게이트: 세션이 없으면 childId를 넘기지 않아 판정 자체가 null이다.
    expect(homeSource).toContain("childId: hasSession ? childId : null,");
  });

  it("캡처 문법: coral[50] 풀블리드 캔버스 위에 히어로 1장 + 구획 3개", () => {
    expect(homeSource).toContain("backgroundColor: theme.colors.coral[50]");
    expect(homeSource).toContain("margin: -theme.spacing.screen");
    expect(homeSource).toContain("padding: theme.spacing.screen");
    // ② 히어로: mainCoral · radius 22(theme.radii.card) · 금액 27/800.
    // 배경은 mainCoral이다 — coral[500] 위의 흰 소형 텍스트(12/700·11)는 3.43:1로 AA 미달이었다.
    expect(homeSource).toContain("backgroundColor: theme.colors.mainCoral");
    expect(homeSource).not.toContain("backgroundColor: theme.colors.subCoral");
    expect(homeSource).toContain("borderRadius: theme.radii.card");
    expect(sessionRender).toContain('testID="home-hero-summary"');
    expect(sessionRender).toContain("<Text style={homeHeroStyle.amount}>{formatKrw(monthlyUsed)}</Text>");
    // 트랙 coral[200] h8, 채움은 흰색.
    expect(homeSource).toContain("backgroundColor: theme.colors.coral[200]");
    expect(homeSource).toContain('accessibilityRole="progressbar"');
    // ③④⑤ 세 구획.
    expect(sessionRender).toContain("HOME_QUICK_RECORD_SECTION_TITLE}");
    expect(sessionRender).toContain("{prepCard ? (");
    expect(sessionRender).toContain("최근 기록\n");
  });

  it("예산이 없는 달에는 퍼센트 대신 예산 넛지가 히어로 안에 들어간다(허위 표시 금지 · 입구 유지)", () => {
    expect(sessionRender).toContain("{budgetProgress.hasBudget ? (");
    expect(sessionRender).toContain('testID="home-set-budget-cta"');
    expect(sessionRender).toContain("onPress={() => router.push(budgetNudge.route)}");
    // 예산이 있는 달의 사용률 넛지만 접힘 후보다.
    expect(homeSource).toContain('if (budgetProgress.hasBudget) activeSections.push("budget-nudge");');
  });

  it("최근 기록 행은 파스텔 원 아이콘을 쓰고 부제는 공용 헬퍼가 만든다", () => {
    expect(homeSource).toContain('import { expenseCategoryVisual } from "../../src/preparation/item-visuals";');
    // 서버 시드 분류 UUID도 code를 거쳐 타일로 해석한다(items 탭과 같은 경로 --
    // src/categories.ts buildTileCategoryIdResolver). 캐시가 비면 중립 글리프 폴백.
    expect(homeSource).toContain("buildTileCategoryIdResolver(categoriesQuery.data?.categories)");
    expect(sessionRender).toContain("resolveExpenseTileCategoryId(expense.categoryId) ?? expense.categoryId");
    expect(sessionRender).toContain("iconBackgroundColor={visual.iconBackgroundColor}");
    expect(sessionRender).toContain("subtitle={homeRecentExpenseSubtitle(expense)}");
  });

  it("SyncStatusBar가 최하단에 선다(스펙 §통합 지점)", () => {
    expect(sessionRender).toContain("<SyncStatusBar onPress={() => router.push(\"/sync-status\")} status={homeSyncStatus} />");
    const sync = sessionRender.indexOf("<SyncStatusBar");
    expect(sync).toBeGreaterThan(sessionRender.indexOf("최근 기록\n"));
  });

  it("비세션 프리뷰(HOME-001 캡처 경로)는 종전 렌더 그대로 남는다", () => {
    // 라운드 78 트랙 E: 위 테스트와 같은 자리 — 자르기 전에 두 표식의 실재를 묻는다.
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로)");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)", previewStart);
    expect(previewStart, "비세션 프리뷰 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(previewEnd, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    expect(preview).toContain("<ScreenHeader");
    expect(preview).toContain("<HeroSummaryCard");
    expect(preview).toContain("<QuickActionIconButton");
    expect(preview).toContain('title="최근 지출"');
    // 캡처 경로에는 새 문법이 하나도 들어가지 않는다.
    expect(preview).not.toContain("homeHeroStyle");
    expect(preview).not.toContain("SyncStatusBar");
    expect(preview).not.toContain("quickRecordChips");
  });
});
