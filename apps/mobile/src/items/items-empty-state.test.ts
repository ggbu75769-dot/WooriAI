import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customItemEntryLabel } from "./custom-item-form";
import { INTERESTED_FILTER_EMPTY_TEXT } from "./item-filters";
import { buildItemsAllEmptyCard, itemsListEmptyKind, showsStandingCustomItemEntry } from "./items-empty-state";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");

/**
 * 빈 상태 감사 — **준비템 탭의 전체 0건 카드**(ITEM-001 세션 렌더).
 *
 * 판정 기준 셋: ⓐ 무슨 일이 있었는지 말하는가 · ⓑ 다음에 무엇을 하면 되는지 말하는가 ·
 * ⓒ 그 행동으로 가는 버튼이 있는가.
 *
 * 종전 그 카드는 ⓐ만 참이었다("아직 볼 수 있는 준비템이 없어요." + `[홈으로 가기]`). 홈은
 * 준비템을 만들지 않으므로 다시 들어와도 같은 화면이고, 이 빈 상태를 실제로 푸는 행동(커스텀
 * 품목 추가)은 같은 스크롤 바로 아래에 이미 있었다.
 *
 * 화면은 vitest에서 렌더할 수 없으므로(react-native import) 이 저장소의 확립된 관례대로
 * 순수 모듈은 **값**으로, 배선은 **소스 문자열**로 붙든다(design-restore-p2b.test.ts 참고).
 * 자르는 구간은 전부 실재 확인을 먼저 지난다(라운드 78 규칙).
 */
const maskComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

describe("빈 상태 감사 ⓐ 갈래 판정 — 0건 셋을 한 곳에서 가른다", () => {
  it("목록이 하나라도 있으면 0건 갈래가 아니다", () => {
    expect(itemsListEmptyKind({ listedCount: 1, interestedEmpty: false, narrowedByFilter: false })).toBe(null);
    // 좁히기가 걸려 있어도 목록이 서 있으면 카드 자체가 서지 않는다.
    expect(itemsListEmptyKind({ listedCount: 7, interestedEmpty: true, narrowedByFilter: true })).toBe(null);
  });

  it("찜 0건 · 좁히기 0건 · 전체 0건을 화면의 종전 삼항과 같은 순서로 가른다", () => {
    expect(itemsListEmptyKind({ listedCount: 0, interestedEmpty: true, narrowedByFilter: false })).toBe("interested");
    expect(itemsListEmptyKind({ listedCount: 0, interestedEmpty: false, narrowedByFilter: true })).toBe("filtered");
    expect(itemsListEmptyKind({ listedCount: 0, interestedEmpty: false, narrowedByFilter: false })).toBe("all");
    // 화면에서는 배타적이지만(showInterestedEmptyState가 !isNarrowedByFilter를 이미 물었다),
    // 둘 다 참인 값이 들어와도 종전 렌더와 같은 갈래(찜 우선)로 떨어진다.
    expect(itemsListEmptyKind({ listedCount: 0, interestedEmpty: true, narrowedByFilter: true })).toBe("interested");
  });
});

describe("빈 상태 감사 ⓑⓒ 전체 0건 카드 — 주 행동이 이 빈 상태를 푼다", () => {
  it("제목은 종전 문장 그대로이고, 액션은 커스텀 품목 추가다", () => {
    expect(buildItemsAllEmptyCard()).toEqual({
      title: "아직 볼 수 있는 준비템이 없어요.",
      actionLabel: "준비물 직접 추가하기",
      action: "add-custom-item"
    });
  });

  it("라벨은 목록 아래 진입 버튼과 **같은 한 값**이다 (같은 동작이 두 이름으로 낭독되지 않는다)", () => {
    expect(buildItemsAllEmptyCard().actionLabel).toBe(customItemEntryLabel());
  });

  it("입구는 화면에 하나다 — 전체 0건에서만 아래 상시 버튼이 카드에 자리를 넘긴다", () => {
    expect(showsStandingCustomItemEntry("all")).toBe(false);
    expect(showsStandingCustomItemEntry("interested")).toBe(true);
    expect(showsStandingCustomItemEntry("filtered")).toBe(true);
    expect(showsStandingCustomItemEntry(null)).toBe(true);
  });
});

describe("빈 상태 감사 — 화면 배선(app/(tabs)/items.tsx)", () => {
  it("전체 0건 카드가 제목·라벨을 모듈 산출에서 읽고, 목적지가 그 라벨이 말한 일이다", () => {
    const items = itemsSource();
    const at = items.indexOf("title={allItemsEmptyCard.title}");
    expect(at, "전체 0건 카드").toBeGreaterThan(-1);
    const tag = items.slice(items.lastIndexOf("<EmptyStateCard", at), items.indexOf("/>", at));
    expect(tag, "라벨").toContain("actionLabel={allItemsEmptyCard.actionLabel}");
    // 목적지는 커스텀 품목 시트이고, 보기 전용 게이트를 **먼저** 지난다(라운드 51 #8의 그 판정
    // 하나를 그대로 감싼다 — 화면이 제 나름의 잠금 조건을 다시 세우지 않는다).
    expect(tag, "목적지").toContain("onPress={itemStatusGate.guard(() => setShowCustomItemSheet(true))}");
    // 라벨↔onPress 짝(GAP-071 #5) — 낭독되는 가짜 버튼이 아니다.
    expect(tag).toContain("actionLabel");
    expect(tag).toContain("onPress");
  });

  it("화면이 문구를 다시 적지 않는다 (제목 리터럴은 모듈에만 있다)", () => {
    const rendered = maskComments(itemsSource());
    expect(rendered, "화면이 다시 적은 제목").not.toContain("아직 볼 수 있는 준비템이 없어요.");
    expect(rendered, "화면이 다시 적은 라벨").not.toContain('actionLabel="준비물 직접 추가하기"');
  });

  it("이 카드는 더 이상 화면을 떠나지 않는다 (홈으로 가기 없음)", () => {
    const rendered = maskComments(itemsSource());
    expect(rendered).not.toContain('actionLabel="홈으로 가기"');
    expect(rendered, "홈 탭으로 나가는 push").not.toContain('router.push("/(tabs)")');
  });

  it("목록 아래 상시 진입 버튼이 같은 판정 하나를 읽는다", () => {
    const items = itemsSource();
    const gate = items.indexOf("showsStandingCustomItemEntry(itemsEmptyKind)");
    const entryButton = items.indexOf("label={customItemEntryLabel()}");
    expect(gate, "노출 판정").toBeGreaterThan(-1);
    expect(entryButton, "진입 버튼").toBeGreaterThan(gate);
    // 갈래 판정 자체도 화면이 인라인으로 다시 세우지 않는다.
    expect(items).toContain("const itemsEmptyKind = itemsListEmptyKind({");
    expect(items).toContain("listedCount: listedItems.length,");
  });

  /**
   * 찜 0건·좁히기 0건 두 갈래는 이번 감사의 대상이 아니다 — 그 둘은 이미 자기 빈 상태를 푸는
   * 행동을 가리키고 있었다. 문구·액션이 한 글자도 움직이지 않았음을 값으로 남긴다.
   */
  it("찜 0건 · 좁히기 0건 카드는 문구도 액션도 종전 그대로다", () => {
    const items = itemsSource();
    expect(items).toContain("title={INTERESTED_FILTER_EMPTY_TEXT}");
    expect(items).toContain('actionLabel="준비템 목록 보기"');
    expect(items).toContain("onPress={() => setShowInterestedOnly(false)}");
    expect(items).toContain('title="검색·필터에 맞는 준비템이 없어요."');
    expect(items).toContain('actionLabel="필터 초기화"');
    // 찜 0건 문구의 단일 소스도 그대로다(그 모듈은 이 트랙이 열지 않는다).
    expect(INTERESTED_FILTER_EMPTY_TEXT).toBe("아직 찜한 준비템이 없어요.");
  });

  /**
   * ITEM-001 픽셀락 무접촉의 근거는 **자리**다: 캡처는 세션을 지우고 찍는 비세션 렌더이고
   * (app/pixel-lock.tsx의 clearSession), 그 갈래는 `if (!hasSession)`에서 previewItems만 그리고
   * 먼저 반환한다. 이번에 손댄 두 자리(emptyState · 아래 진입 버튼)는 그 반환 **뒤**에 있다.
   */
  it("ITEM-001 캡처 경로 무접촉 — 손댄 자리 둘이 비세션 반환 뒤에 있다", () => {
    const items = itemsSource();
    const previewReturn = items.indexOf("if (!hasSession) {");
    const parityRender = items.indexOf("<PreparationListParity");
    const emptyCard = items.indexOf("title={allItemsEmptyCard.title}");
    const standingEntry = items.indexOf("showsStandingCustomItemEntry(itemsEmptyKind)");
    expect(previewReturn, "비세션 프리뷰 갈래").toBeGreaterThan(-1);
    expect(parityRender, "목록 프레임").toBeGreaterThan(previewReturn);
    expect(emptyCard, "전체 0건 카드").toBeGreaterThan(parityRender);
    expect(standingEntry, "목록 아래 진입 버튼").toBeGreaterThan(parityRender);
    // 캡처가 그리는 픽스처 경로는 그대로다.
    expect(items).toContain("const visibleItems = hasSession ? items.data!.items : previewItems;");
    expect(source("app/pixel-lock.tsx")).toContain("clearSession();");
  });
});
