import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");
const reportsSource = () => source("app/(tabs)/reports.tsx");
const uiSource = () => source("src/ui.tsx");

/**
 * 라운드 105 트랙 ITEMS(라운드 104 스카우트 A **F5**) — **준비템·리포트 탭의 상시 기록 입구.**
 *
 * ## 무엇이 없었나
 * 핵심 루프는 `기록 → 총액 → 준비템 → 구매 → 기록`인데, 그 4·5단계를 밟는 사람이 서 있는
 * 화면에는 지출을 적기 시작할 자리가 하나도 없었다. FAB 실측(`grep -c FloatingActionButton`):
 * 홈 **3** · 기록 **2** · 준비템 **0** · 리포트 **0**.
 *  · 준비템 탭의 유일한 기록 입구는 상태를 바꾼 **뒤에** 뜨는 "지출도 기록할까요?" 한 줄이라,
 *    목록을 훑다가 "아 이거 어제 샀지"를 떠올린 사람은 탭을 옮기거나 상세로 들어가야 했다.
 *  · 리포트 탭의 입구는 **그 기간에 기록이 0건일 때만** 서는 빈 기간 카드의 액션이었다 —
 *    "총액이 왜 이렇게 적지 → 아 그거 안 적었네"를 알아채는 정상 상태에는 0개였다.
 *
 * ## 이 파일이 지키는 것 — **픽셀락 무접촉의 근거가 곧 이 계약이다**
 * ITEM-001·REP-001 캡처는 둘 다 **비세션 렌더**다(`app/pixel-lock.tsx`가 세션을 지우고 찍는다).
 * `src/ui.tsx`의 AppScreen은 `floatingAction` 슬롯에 아무것도 넘기지 않으면 **래퍼 노드 자체를
 * 만들지 않는다**(`if (!floatingAction) return scroller;`). 그래서 두 화면이 그 슬롯을 세션에서만
 * 채우면 두 캡처의 렌더 트리는 노드 하나도 달라지지 않는다 — 실기기 재캡처 없이 값으로 확인할 수
 * 있는 사실이 정확히 이것이라, 여기서 **양쪽 끝**(슬롯을 넘기는 화면 · 슬롯이 없으면 노드를 만들지
 * 않는 AppScreen)을 함께 문다(라운드 78 관례).
 *
 * 두 화면의 게이트 모양이 서로 다른 것은 **캡처 갈래의 모양이 다르기 때문**이고, 그 차이도 아래에
 * 값으로 적는다:
 *  · 준비템 탭은 비세션이 `if (!hasSession)` **조기 반환**이라 캡처가 이 JSX에 닿기 전에 끝난다
 *    — 게이트는 자리(구조) 자체다.
 *  · 리포트 탭은 비세션 미리보기가 **같은 AppScreen** 안에 있어 슬롯에 `hasSession ? … : undefined`
 *    를 넘긴다 — 바로 위 `refreshControl`이 이미 쓰는 그 관례다.
 *
 * 화면은 vitest에서 렌더할 수 없으므로(react-native 네이티브 바인딩 없음) 이 저장소의 확립된
 * 관례대로 소스 계약으로 고정한다(src/items/items-tab-root-back.test.ts 참고).
 */
describe("라운드 105 F5 — 준비템·리포트 탭의 상시 기록 입구", () => {
  it("두 화면이 홈·기록 탭과 **같은 한 줄**을 쓴다 (새 컴포넌트·새 게이트·새 문구 0건)", () => {
    const fab = '<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />';
    expect(itemsSource()).toContain(fab);
    expect(reportsSource()).toContain(fab);
    // 같은 줄이 이미 서 있는 자리들 — 목적지·게이트가 화면마다 갈라지지 않는다는 다른 쪽 끝이다.
    expect(source("app/(tabs)/index.tsx")).toContain(fab);
    expect(source("app/(tabs)/records.tsx")).toContain(fab);
    // 판정 훅은 화면마다 다시 적지 않는다(UX-R(M) 계약 — src/family/record-permissions.test.ts).
    for (const screen of [itemsSource(), reportsSource()]) {
      expect(screen).toContain("useExpenseEntryGate");
    }
  });

  it("버튼은 AppScreen의 floatingAction 슬롯으로 간다 (스크롤 마지막 줄이 아니다)", () => {
    for (const screen of [itemsSource(), reportsSource()]) {
      expect(screen).toContain("floatingAction={");
    }
  });

  /**
   * ⚠️ 픽셀락 무접촉의 **다른 쪽 끝**. 이 갈래가 사라지면 "슬롯을 안 넘기면 노드가 안 생긴다"는
   * 위 근거가 통째로 거짓이 되므로, 화면 쪽 배선과 같은 파일에서 함께 확인한다.
   */
  it("AppScreen은 슬롯이 비면 래퍼 노드를 만들지 않는다 (src/ui.tsx — 근거의 반대편)", () => {
    const ui = uiSource();
    const guardAt = ui.indexOf("if (!floatingAction) {");
    expect(guardAt).toBeGreaterThan(-1);
    const guardBlock = ui.slice(guardAt, guardAt + 60);
    expect(guardBlock).toContain("return scroller;");
    // 슬롯이 옵트인이라는 사실(프롭이 optional)도 함께 — 필수가 되면 캡처 갈래가 값을 지어내야 한다.
    expect(ui).toContain("floatingAction?: React.ReactNode;");
  });

  it("준비템 탭: 버튼은 **비세션 조기 반환 뒤**에만 선다 (ITEM-001 캡처는 이 JSX에 닿지 않는다)", () => {
    const items = itemsSource();
    const previewReturnAt = items.indexOf("if (!hasSession) {");
    const slotAt = items.indexOf("floatingAction={");
    const buttonAt = items.indexOf("<FloatingActionButton");
    expect(previewReturnAt).toBeGreaterThan(-1);
    expect(slotAt).toBeGreaterThan(previewReturnAt);
    expect(buttonAt).toBeGreaterThan(previewReturnAt);
    // 슬롯을 채우는 자리는 세션 렌더 하나뿐이다 — 조기 반환 넷(아이 미선택·조회 실패·로딩·
    // 비세션 미리보기)의 <AppScreen>은 전부 슬롯 없이 열린다.
    expect(items.match(/floatingAction=\{/g) ?? []).toHaveLength(1);
    expect(items.match(/<FloatingActionButton/g) ?? []).toHaveLength(1);
    // 줄 전체가 `<AppScreen>`인 자리 = 슬롯 없이 열리는 조기 반환 넷(주석 안의 인용은 세지 않는다).
    expect(items.match(/^ {6}<AppScreen>$/gm) ?? []).toHaveLength(4);
  });

  it("리포트 탭: 미리보기와 같은 AppScreen을 쓰므로 **세션 게이트**로 넘긴다 (REP-001 캡처 불변)", () => {
    const reports = reportsSource();
    expect(reports).toContain(
      'hasSession ? <FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} /> : undefined'
    );
    // 비세션 미리보기 블록은 같은 AppScreen 안이다 — 이 사실이 게이트가 필요한 이유다.
    const slotAt = reports.indexOf("floatingAction={");
    const previewAt = reports.indexOf("{!hasSession ? (");
    expect(slotAt).toBeGreaterThan(-1);
    expect(previewAt).toBeGreaterThan(slotAt);
    // 바로 위 refreshControl이 이미 쓰는 관례(같은 게이트·같은 undefined)를 그대로 따른다.
    expect(reports).toContain("hasSession ? (\n          <RefreshControl");
  });

  /**
   * ⚠️ 바닥 여백 — 기록 탭이 이미 값으로 적어 둔 관례를 그대로 가져온다.
   * `records.tsx`는 목록 자신이 스크롤러라(PERF-102) contentContainerStyle에
   * `theme.spacing.screen + theme.ctaHeight + 8`을 적는다. 두 화면은 AppScreen을 쓰고 그
   * 스크롤러가 이미 `padding: theme.spacing.screen`을 주므로, **나머지(ctaHeight + 8)만** 더한다.
   */
  it("바닥 여백: 떠 있는 버튼이 마지막 줄을 덮지 않는다 (기록 탭과 같은 값)", () => {
    // 관례의 원본이 오늘도 그 값이다(양쪽 끝 존재 가드).
    expect(source("app/(tabs)/records.tsx")).toContain(
      "paddingBottom: theme.spacing.screen + theme.ctaHeight + 8"
    );
    // AppScreen이 이미 주는 몫 — 두 화면이 나머지만 더한다는 판단의 근거다.
    expect(uiSource()).toContain("padding: theme.spacing.screen");
    for (const screen of [itemsSource(), reportsSource()]) {
      expect(screen).toContain("style={{ height: theme.ctaHeight + 8 }}");
    }
    // 값 하나는 디자인 토큰에서 온다(하드코딩된 56이 아니다 — DNC-017 관례).
    expect(source("src/theme.ts")).toContain("ctaHeight: 56");
  });

  it("리포트 탭의 여백은 버튼과 **같은 세션 게이트**다 (여백만 남고 버튼은 없는 화면을 만들지 않는다)", () => {
    expect(reportsSource()).toContain(
      '{hasSession ? <View style={{ height: theme.ctaHeight + 8 }} /> : null}'
    );
  });
});
