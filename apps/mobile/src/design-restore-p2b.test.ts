import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { childProfileReassuranceNotes } from "./children/child-form";

/**
 * DSN-053 P2-B — 준비템 목록(ITEM-001 "내 준비 목록")과 상세(ITEM-002)의 **승인 캡처 정합**
 * 계약, 그리고 그 전환에서 **잃지 않아야 할 기능**의 자리 계약.
 *
 * 이 저장소의 react-native 화면은 vitest에서 렌더할 수 없다(네이티브 바인딩 없음). 그래서
 * 다른 화면 계약들과 같은 관례로 소스 그렙을 쓴다(src/design-restore-p2d.test.ts 참고).
 *
 * 판정과 문구는 전부 순수 모듈이 지고 있고 각자의 테스트가 있다. 여기서 지키는 것은
 * "무엇이 어떤 순서로 서는가"와 "그 프레임 안에 기존 기능이 남아 있는가"뿐이다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");
const detailSource = () => source("app/items/[itemTemplateId].tsx");
const paritySource = () => source("src/preparation/PreparationListParity.tsx");

describe("ITEM-001 목록: 승인 프레임", () => {
  it("세션 렌더가 이식한 목록 화면을 그대로 쓴다(구조를 화면에 다시 적지 않는다)", () => {
    const items = itemsSource();
    expect(items).toContain('from "../../src/preparation/PreparationListParity"');
    expect(items).toContain("<PreparationListParity");
    // 목록/그리드/섹션 카드를 화면이 손으로 다시 그리지 않는다.
    expect(items).not.toContain("<ProductCard\n                    title={item.name}");
  });

  it("히어로 → 찜 한 줄 → 세그먼트 → 보조 칩 → 검색 → 섹션 순서가 프레임에 있다", () => {
    const parity = paritySource();
    const topBar = parity.indexOf('<TopAppBar eyebrow="준비 홈"');
    const hero = parity.indexOf(">나의 준비 진행률<");
    const beforeSegment = parity.indexOf("{beforeSegment}");
    const segment = parity.indexOf("<SegmentedControl onChange={setSortMode}");
    const auxiliary = parity.indexOf("{auxiliaryFilters}");
    const search = parity.indexOf('accessibilityLabel="준비물 통합 검색"');
    const notices = parity.indexOf("{notices}");

    for (const [name, position] of Object.entries({ topBar, hero, beforeSegment, segment, auxiliary, search, notices })) {
      expect(position, `${name} 구획을 찾지 못했다`).toBeGreaterThan(-1);
    }
    expect(topBar).toBeLessThan(hero);
    expect(hero).toBeLessThan(beforeSegment);
    expect(beforeSegment).toBeLessThan(segment);
    expect(segment).toBeLessThan(auxiliary);
    expect(auxiliary).toBeLessThan(search);
    expect(search).toBeLessThan(notices);
  });

  it("진행률 히어로의 수치는 화면의 정직한 계산 그대로다(프레임만 승인 디자인)", () => {
    const items = itemsSource();
    expect(items).toContain("const parityProgress = prepMilestone");
    expect(items).toContain("totalCount: prepMilestone.totalCount,");
    expect(items).toContain("completedCount: prepMilestone.resolvedCount,");
    expect(items).toContain("progress={parityProgress}");
    // 화면이 퍼센트를 다시 계산하지 않는다(캡 규칙은 prep-milestones 하나뿐이다).
    expect(items).not.toContain("Math.round((");
  });

  /**
   * T9(토스급 정비) — 진행률 히어로의 **퍼센트 숫자**.
   *
   * 종전 히어로는 바 폭과 progressbar의 accessibilityValue로만 진행률을 말했고, 눈으로 읽을
   * 숫자가 없었다. 새로 서는 28px 숫자는 **같은 값 하나**(progressPercent)에서 나온다 —
   * 캡 규칙(prep-milestones displayPercent)을 히어로가 다시 계산하지 않는다는 기존 계약
   * (prep-milestones.test.ts)이 이 숫자에도 그대로 적용된다.
   */
  it("T9: 진행률 히어로에 28px tabular-nums 퍼센트 숫자가 서고, 그 값은 progressPercent 하나다", () => {
    const parity = paritySource();
    const percentText =
      '<Text style={{ color: semanticColors.textInverse, fontSize: 28, fontVariant: ["tabular-nums"], fontWeight: "800", lineHeight: 34 }}>';
    expect(parity).toContain(percentText);
    expect(parity).toContain("{progressPercent}%");
    // 히어로 카드 안(제목과 progressbar 사이)에 선다.
    const hero = parity.indexOf(">나의 준비 진행률<");
    const percent = parity.indexOf(percentText);
    const bar = parity.indexOf('accessibilityRole="progressbar"');
    expect(hero).toBeGreaterThan(-1);
    expect(percent).toBeGreaterThan(hero);
    expect(bar).toBeGreaterThan(percent);
    // 새 퍼센트 계산식을 짓지 않는다 — displayPercent를 받는 기존 선언 하나뿐이다.
    expect(parity).toContain("const progressPercent = progress\n    ? progress.displayPercent");
  });

  /**
   * T9(토스급 정비) — **onBack은 옵셔널이다.**
   *
   * 유일한 호출부(준비템 탭)는 루트 탭이라 "뒤로"가 개념적으로 없는 자리인데, 필수 프롭이
   * 호출부에게 목적지를 지어내게 만들었다. 옵셔널화만 하고 기존 전달 경로의 렌더는 그대로다 —
   * TopAppBar(onBack 없으면 뒤로 버튼 노드가 서지 않는다)·EmptyStateCard(onPress 없으면 액션
   * 버튼이 서지 않는다)가 그 생략을 이미 받아 준다(가짜 버튼 금지 규율).
   */
  it("T9: onBack이 옵셔널이고, 그 생략을 받아 주는 두 소비자의 가드가 실재한다", () => {
    const parity = paritySource();
    expect(parity).toContain("onBack?: () => void;");
    // 전달 경로의 렌더 두 줄은 바이트 그대로다(preparation-restore.test.ts의 승인 렌더 계약).
    expect(parity).toContain('<TopAppBar eyebrow="준비 홈" onBack={onBack} title="내 준비 목록" trailing={topBarTrailing} />');
    expect(parity).toContain('emptyState ?? <EmptyStateCard actionLabel="준비 홈" onPress={onBack} title="5개 이상 확인된 준비 품목 그룹이 없어요." />');
    // 생략을 받아 주는 가드(둘 다 design-system 쪽 — 없으면 옵셔널화가 라벨 없는 버튼을 만든다).
    expect(source("src/design-system/components/ModV1Primitives.tsx")).toContain(
      '{onBack ? <IconButton accessibilityLabel="뒤로" icon="chevron-left" onPress={onBack} /> : null}'
    );
    expect(source("src/design-system/components/ApplicationPrimitives.tsx")).toContain(
      "onPress?: () => void }"
    );
  });

  it("분류 축은 지어낸 10그룹이 아니라 이 앱이 실제로 가진 지출 분류다", () => {
    const items = itemsSource();
    expect(items).toContain("buildCategoryNameLookup(categories.data?.categories)");
    expect(items).toContain("buildTileCategoryResolver(categories.data?.categories)");
    expect(items).toContain("categoryGroups={categoryGroups}");
    // 이름을 모르는 분류를 여러 섹션으로 흩뜨리지 않는다(같은 이름은 한 섹션).
    expect(items).toContain("const groupKeyOf = (item: ItemSummary) =>");
    // 공유 캐시 규약(CAT-124 전량)을 따른다.
    expect(items).toContain('queryKey: ["categories"]');
    expect(items).toContain("includeAll: true");
  });

  it("시기별 밴드는 서버 왕복 없이 지금 보고 있는 밴드 기준으로 판정한다", () => {
    const items = itemsSource();
    expect(items).toContain("timelineBucket: resolvePreparationTimelineBucket(rowItem, stageLabel)");
    const adapter = source("src/preparation/catalog-contract.ts");
    expect(adapter).toContain("export function resolvePreparationTimelineBucket(");
    // 밴드 ↔ 스테이지 매핑은 기존 모듈 하나뿐이다(복제 금지).
    expect(adapter).toContain('from "../items/stage-bands"');
  });
});

describe("ITEM-001 목록: 기능 보존", () => {
  it("오프라인 대기 배지와 상태 변경이 타일 아래 슬롯에 남는다", () => {
    const items = itemsSource();
    expect(items).toContain("renderItemFooter={(parityItem) => {");
    expect(items).toContain('<StatusBadge label={pendingStatus.badgeLabel} tone="warning" />');
    expect(items).toContain("{pendingStatus.noticeText}");
    expect(items).toContain('label="준비했어요"');
    expect(items).toContain('label="괜찮아요"');
    // 낙관 반영된 값이 상태 변경 판정의 입력이다.
    expect(items).toContain('onPress={() => requestStatusChange(rowItem, "prepared")}');
  });

  it("보기 전용 게이트·찜·필수도·출산 전·아이 전환이 모두 제자리에 있다", () => {
    const items = itemsSource();
    expect(items).toContain("const itemStatusGate = useItemStatusGate();");
    expect(items).toContain("label={INTERESTED_FILTER_LABEL}");
    expect(items).toContain("NECESSITY_FILTER_OPTIONS.map");
    expect(items).toContain("label={PRE_BIRTH_FILTER_LABEL}");
    expect(items).toContain('testID="items-child-switch-trigger"');
    expect(items).toContain('testID="items-child-switch-sheet"');
  });

  it("지출 프리필(분류 포함)과 빈 화면 탈출구가 남는다", () => {
    const items = itemsSource();
    expect(items).toContain("categoryId: item.categoryId");
    expect(items).toContain("emptyState={");
    expect(items).toContain("title={INTERESTED_FILTER_EMPTY_TEXT}");
    expect(items).toContain('actionLabel="필터 초기화"');
  });

  it("비세션 미리보기(ITEM-001 픽셀 락 캡처)는 종전 렌더 그대로 먼저 반환된다", () => {
    const items = itemsSource();
    const previewReturn = items.indexOf("if (!hasSession) {");
    const parityRender = items.indexOf("<PreparationListParity");
    expect(previewReturn).toBeGreaterThan(-1);
    expect(parityRender).toBeGreaterThan(previewReturn);
    expect(items).toContain("testID={recommendationScreenId}");
    expect(items).toContain("recommendationPixelScaleFrameStyle()");
    expect(items).toContain("<ProductCard");
    expect(items).toContain('label="‹ 더 많은 추천 보기"');
  });
});

describe("ITEM-002 상세: 승인 프레임", () => {
  it("히어로 카드 → 이름 → 예상 가격대 → 탭 밴드 → 판매처 행 순서다", () => {
    const detail = detailSource();
    const hero = detail.indexOf("<Card style={productDetailHeroCardStyle()}>");
    const name = detail.indexOf("{visibleDetail.name}</Text>");
    const priceLabel = detail.indexOf(">예상 가격대<");
    const band = detail.indexOf('accessibilityRole="tablist"');
    const rows = detail.indexOf("<ProductComparisonRow");

    for (const [key, position] of Object.entries({ hero, name, priceLabel, band, rows })) {
      expect(position, `${key} 구획을 찾지 못했다`).toBeGreaterThan(-1);
    }
    expect(hero).toBeLessThan(name);
    expect(name).toBeLessThan(priceLabel);
    expect(priceLabel).toBeLessThan(band);
    expect(band).toBeLessThan(rows);
  });

  it("판매처 한 줄만 채워진 구매하기다(나머지는 외곽선) — 그 한 줄은 첫 비스폰서 링크다", () => {
    const detail = detailSource();
    expect(detail).toContain("const filledPurchaseRowIndex = primaryPurchaseLinkIndex(visibleDetail.productLinks);");
    expect(detail).toContain("primaryAction={hasSession && index === filledPurchaseRowIndex}");
    // 순서만 보고 채우면 스폰서가 1위일 때 광고 자리만 강한 CTA를 갖는다(DNC-011 역행).
    expect(detail).not.toContain("primaryAction={hasSession && index === 0}");
    expect(source("src/ui.tsx")).toContain('label="구매하기"');
  });

  it("채워진 구매하기는 기본 mainCoral을 쓴다(coral[400] 오버라이드 없음 — 대비 4.5:1)", () => {
    const ui = source("src/ui.tsx");
    // PrimaryButton 기본 배경이 mainCoral(#C94627)이고, 판매처 행이 그걸 덮지 않는다.
    expect(ui).toContain("backgroundColor: disabled ? theme.colors.gray300 : theme.colors.mainCoral");
    expect(ui).not.toContain("backgroundColor: theme.colors.coral[400], minWidth: 72");
    expect(ui).toContain("style={{ minWidth: 72 }}");
  });

  it("실가격과 확인 시각은 한 판정에서 함께 오고 캡션 슬롯에 남는다", () => {
    const detail = detailSource();
    expect(detail).toContain("const linkPrice = hasSession ? resolveLinkPriceDisplay(link) : null;");
    expect(detail).toContain("caption={hasSession ? withLinkPriceCaption(productPlatformLabel(link.platform), linkPrice) : undefined}");
  });

  it("고지는 구매 CTA 바로 위에 있고 하단은 2버튼 한 줄이다 (DNC-010)", () => {
    const detail = detailSource();
    const disclosure = detail.indexOf("{affiliateDisclosureText ? <AffiliateDisclosure");
    const saveButton = detail.indexOf('label={isInterested ? "찜해제" : "찜하기"}');
    const buyButton = detail.indexOf('label="바로 구매하기"');
    expect(disclosure).toBeGreaterThan(-1);
    expect(saveButton).toBeGreaterThan(disclosure);
    expect(buyButton).toBeGreaterThan(saveButton);
    // 고지와 CTA 사이에는 아무것도 끼우지 않는다.
    expect(detail.slice(disclosure, saveButton)).not.toContain("<Card");
  });

  /**
   * FIX-C(2026-09-03) — 두 시점 이관.
   * ① 원 계약은 설명 카드 셋의 순서(왜 필요해요 → 안 사도 돼요 → 신뢰 카드)를 고정했다.
   * ② FIX-C: 안내 카드를 "왜 필요해요?" + 중고 구매 안내 둘로 줄이면서 가운데 카드
   *    (skipReasonText)의 렌더가 지워졌다(부재 계약은 src/items-commerce-flow.test.ts
   *    COM-101 이관 케이스가 진다). 남은 순서 계약은 "왜 필요해요 → 신뢰 카드"다.
   */
  it("설명 카드는 같은 문법으로 이어진다(왜 필요해요 → 신뢰 카드)", () => {
    const detail = detailSource();
    const why = detail.indexOf("왜 필요해요?");
    const trust = detail.indexOf("itemTrustNotes({");
    expect(why).toBeGreaterThan(-1);
    expect(trust).toBeGreaterThan(why);
  });
});

/**
 * T9(토스급 정비) — 온보딩 아이 정보(ONB-002)의 **안심 문구** 계약.
 *
 * 첫 실행에서 가장 민감한 값(태명·예정일/출생일)을 요구하는 화면이 그 값의 공개 범위와
 * 되돌릴 수 있음(수정·삭제)을 말하지 않았다. 문장의 단일 소스는 순수 모듈
 * (src/children/child-form.ts)이고 화면은 그리기만 한다 — 문장이 말하는 사실의 근거는
 * 그 모듈의 주석에 있다(지어낸 약속 금지).
 */
describe("T9 ONB-002: 아이 정보 안심 문구", () => {
  it("문구는 두 줄(공개 범위 · 수정/삭제)이고 해요체이며 사용자를 탓하지 않는다(DNC-018)", () => {
    const notes = childProfileReassuranceNotes();
    expect(notes).toHaveLength(2);
    const [visibility, mutability] = notes;
    // 공개 범위: 누가 보는지(가족)와 밖으로 나가지 않는다는 사실을 함께 말한다.
    expect(visibility).toContain("가족에게만 보여요");
    expect(visibility).toContain("공개되지 않아요");
    // 되돌릴 수 있음: 수정과 삭제 둘 다, 목적지는 "설정"까지만(아이 관리/개인정보 두 화면에
    // 갈려 있어 더 좁히면 한쪽이 거짓이 된다 — 모듈 주석의 그 판단).
    expect(mutability).toContain("설정");
    expect(mutability).toContain("바꾸거나 삭제할 수 있어요");
    for (const note of notes) {
      expect(note.endsWith("요.")).toBe(true);
      for (const blaming of ["잘못", "오류", "실패", "안 됩니다"]) expect(note).not.toContain(blaming);
    }
  });

  it("화면은 모듈의 문장을 그리기만 한다(화면 안에 그 한국어 리터럴 0글자)", () => {
    const screen = source("app/(onboarding)/child-profile.tsx");
    expect(screen).toContain("childProfileReassuranceNotes");
    expect(screen).toContain("{childProfileReassuranceNotes().map((note) => (");
    for (const note of childProfileReassuranceNotes()) {
      expect(screen, "문장은 모듈에만 있다").not.toContain(note);
    }
  });
});

/**
 * T9(토스급 정비) — 날짜 픽커의 **월 점프**(달 라벨 → 월 선택 시트) 계약.
 *
 * 픽커의 달 이동이 ‹ › 한 칸씩뿐이라 예정일(만삭 ≈ 아홉 달 뒤)·오래된 영수증에 닿는 데
 * 같은 버튼을 아홉 번 눌러야 했다. 기록·리포트 탭·내보내기 카드가 이미 쓰는 월 선택 시트를
 * **읽기 전용으로 소비**한다(네 번째 소비처 — 시트·month-jump 순수 모듈은 무접촉).
 */
describe("T9 날짜 픽커: 월 점프 시트 소비", () => {
  const pickerSource = () => source("src/expenses/ExpenseDatePicker.tsx");

  it("트리거는 기존 세 소비처와 같은 문법이다(순수 모듈 라벨·힌트·expanded 상태·48dp)", () => {
    const picker = pickerSource();
    const triggerAt = picker.indexOf('testID="expense-date-picker-month-jump-trigger"');
    expect(triggerAt).toBeGreaterThan(-1);
    const start = picker.lastIndexOf("<Pressable", triggerAt);
    expect(start).toBeGreaterThan(-1);
    const triggerBlock = picker.slice(start, triggerAt);
    expect(triggerBlock).toContain('accessibilityRole="button"');
    expect(triggerBlock).toContain("monthJumpTriggerAccessibilityLabel(monthLabel)");
    expect(triggerBlock).toContain("MONTH_JUMP_TRIGGER_HINT");
    expect(triggerBlock).toContain("accessibilityState={{ expanded: monthJumpOpen }}");
    // 글자 한 줄이 48dp를 채운다(기록 탭 트리거의 그 보정).
    expect(picker).toContain("minHeight: 48\n  },");
  });

  it("시트는 그대로 소비하고, 닫혀 있으면 격자 렌더가 종전 그대로다", () => {
    const picker = pickerSource();
    expect(picker).toContain('import { MonthJumpSheet } from "../MonthJumpSheet";');
    expect(picker).toContain("{monthJumpOpen ? (");
    expect(picker).toContain('testID="expense-date-picker-month-jump-sheet"');
    // 시트가 닫힌 갈래가 종전 격자다(같은 프롭 다섯).
    expect(picker).toContain("<ExpenseDatePickerGrid");
    expect(picker).toContain('selectedIso={selectedIso ?? ""}');
    // 달을 고르면 보고 있는 달만 옮긴다 — 폼의 날짜(onSelectDate)는 건드리지 않는다.
    const sheetTagStart = picker.indexOf("<MonthJumpSheet");
    const sheetTagEnd = picker.indexOf("/>", sheetTagStart);
    expect(sheetTagStart, "시트 태그 시작이 실재해야 자르는 구간이 참이다").toBeGreaterThan(-1);
    expect(sheetTagEnd, "시트 태그 닫힘이 실재해야 자르는 구간이 참이다").toBeGreaterThan(sheetTagStart);
    const sheetTag = picker.slice(sheetTagStart, sheetTagEnd);
    expect(sheetTag).toContain("setPickerYearMonth(yearMonth);");
    expect(sheetTag).not.toContain("onSelectDate(");
  });

  it("시트에 넘기는 경계는 픽커 자신의 상한·하한과 같은 단일 소스에서 파생한다", () => {
    const picker = pickerSource();
    // 하한(20년): ‹ 이동이 멈추는 그 달 — MAX_PAST_MONTHS를 그대로 옮겨 적는다.
    expect(picker).toContain("-EXPENSE_DATE_PICKER_MAX_PAST_MONTHS");
    // 미래 방향 상한(만삭): › 이동의 latestSelectableIso와 같은 산술이다.
    expect(picker).toContain("shiftIsoDate(todayIso, EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS) ?? todayIso");
    // 하한 문장은 기록 탭의 기본 문장("아이 기록이 시작되기 전…")을 덮어쓴다 — 이 달력의
    // 사실이 아니기 때문이다. 연 수는 도메인 단일 소스에서 읽는다.
    expect(picker).toContain("beforeEarliestHint: BEFORE_FLOOR_MONTH_HINT");
    expect(picker).toContain("${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 달이라 고를 수 없어요");
    // 미래 방향의 시트 안내 한 줄은 만삭 경계를 말하고, 주차 수는 도메인에서 읽은 값이다.
    expect(picker).toContain("만삭(${EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS}주)보다 먼 달은 고를 수 없어요.");
    expect(picker).toContain('hint={direction === "future" ? DUE_DATE_MONTH_JUMP_HINT : undefined}');
    // 기준일 이동의 대가(미래 방향에서 "이번 달" 표기가 만삭 달에 선다)는 소스 주석이 기록으로
    // 진다 — 시트는 읽기 전용 소비라 여기서 끌 수 없다.
    expect(picker).toContain("만삭이 든 달");
  });
});
