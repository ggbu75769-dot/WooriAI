import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("판매처 첫 줄이 채워진 구매하기다(나머지는 외곽선)", () => {
    expect(detailSource()).toContain("primaryAction={hasSession && index === 0}");
    expect(source("src/ui.tsx")).toContain('label="구매하기"');
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

  it("설명 카드는 같은 문법으로 이어진다(왜 필요해요 → 안 사도 돼요 → 신뢰 카드)", () => {
    const detail = detailSource();
    const why = detail.indexOf("왜 필요해요?");
    const skip = detail.indexOf("이런 경우엔 안 사도 돼요");
    const trust = detail.indexOf("itemTrustNotes({");
    expect(why).toBeGreaterThan(-1);
    expect(skip).toBeGreaterThan(why);
    expect(trust).toBeGreaterThan(skip);
  });
});
