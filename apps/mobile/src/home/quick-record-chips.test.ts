import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildHomeQuickRecordChips,
  isQuickRecordPinToggleAction,
  quickRecordChipAccessibilityActions,
  quickRecordChipAccessibilityLabel,
  quickRecordPinToggleAnnouncement,
  quickRecordPinToggleHint,
  sanitizeQuickRecordPins,
  toggleQuickRecordPin,
  HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES,
  HOME_QUICK_RECORD_ITEM_SLOTS,
  HOME_QUICK_RECORD_MANUAL_LABEL,
  HOME_QUICK_RECORD_SECTION_TITLE
} from "./quick-record-chips";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

describe("DSN-053 P2-A 빠른 기록 칩", () => {
  it("칩은 언제나 4개다 -- 품목 3칸 + 직접 입력", () => {
    const chips = buildHomeQuickRecordChips([]);
    expect(chips).toHaveLength(HOME_QUICK_RECORD_ITEM_SLOTS + 1);
    expect(chips.at(-1)).toEqual({
      label: HOME_QUICK_RECORD_MANUAL_LABEL,
      itemName: null,
      pinned: false,
      testID: "home-quick-record-chip-manual"
    });
  });

  it("이력이 없으면 캡처의 고정 3종으로 채운다", () => {
    const chips = buildHomeQuickRecordChips(null);
    expect(chips.slice(0, 3).map((chip) => chip.label)).toEqual([...HOME_QUICK_RECORD_FALLBACK_ITEM_NAMES]);
  });

  it("이 기기의 최근 품목이 있으면 그것이 먼저 온다(고정값은 남은 칸만 채운다)", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "젖병 세정제" }]);
    expect(chips.map((chip) => chip.label)).toEqual([
      "젖병 세정제",
      "기저귀",
      "병원비",
      HOME_QUICK_RECORD_MANUAL_LABEL
    ]);
  });

  it("최근 품목이 3개 이상이면 고정값이 들어오지 않는다", () => {
    const chips = buildHomeQuickRecordChips([
      { itemName: "젖병 세정제" },
      { itemName: "손수건" },
      { itemName: "체온계" },
      { itemName: "쪽쪽이" }
    ]);
    expect(chips.map((chip) => chip.label)).toEqual([
      "젖병 세정제",
      "손수건",
      "체온계",
      HOME_QUICK_RECORD_MANUAL_LABEL
    ]);
  });

  it("이미 최근 품목으로 올라온 이름을 고정값이 다시 채우지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "기저귀" }, { itemName: "분유" }]);
    expect(chips.map((chip) => chip.label)).toEqual(["기저귀", "분유", "병원비", HOME_QUICK_RECORD_MANUAL_LABEL]);
  });

  it("빈 이름·공백 이름은 칸을 먹지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "   " }, { itemName: "" }, { itemName: "체온계" }]);
    expect(chips.map((chip) => chip.label)).toEqual(["체온계", "기저귀", "병원비", HOME_QUICK_RECORD_MANUAL_LABEL]);
  });

  it("품목 칩은 프리필할 이름과 핀 여부만 들고 간다 -- 보이지 않는 금액·분류를 몰래 채우지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "체온계" }]);
    expect(Object.keys(chips[0]).sort()).toEqual(["itemName", "label", "pinned", "testID"]);
    expect(chips[0].itemName).toBe("체온계");
    expect(chips[0].pinned).toBe(false);
  });
});

describe("라운드 102 F6b 칩 핀 — 병합 규칙(핀 우선·중복 제거·상한)의 단일 소스", () => {
  it("핀이 최근 이력보다 앞칸에 서고, 이력에 없는 핀도 칸을 얻는다", () => {
    const chips = buildHomeQuickRecordChips(
      [{ itemName: "젖병 세정제" }, { itemName: "손수건" }, { itemName: "체온계" }],
      ["분유"]
    );
    expect(chips.map((chip) => chip.label)).toEqual(["분유", "젖병 세정제", "손수건", HOME_QUICK_RECORD_MANUAL_LABEL]);
    expect(chips.map((chip) => chip.pinned)).toEqual([true, false, false, false]);
  });

  it("핀이 최근 이력과 겹치면 핀 칸 하나로 합쳐진다(중복 제거)", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "분유" }, { itemName: "손수건" }], ["분유"]);
    expect(chips.map((chip) => chip.label)).toEqual(["분유", "손수건", "기저귀", HOME_QUICK_RECORD_MANUAL_LABEL]);
    expect(chips[0].pinned).toBe(true);
  });

  it("핀 3개면 품목 칸 전부가 핀이다 -- 최근·고정값이 들어오지 않는다", () => {
    const chips = buildHomeQuickRecordChips([{ itemName: "쪽쪽이" }], ["분유", "젖병", "물티슈"]);
    expect(chips.map((chip) => chip.label)).toEqual(["분유", "젖병", "물티슈", HOME_QUICK_RECORD_MANUAL_LABEL]);
    expect(chips.slice(0, 3).every((chip) => chip.pinned)).toBe(true);
  });

  it("sanitize: 문자열 아님·공백·중복은 걸러지고 상한은 3이다(복원 양끝과 추가 경로가 같은 한 벌)", () => {
    expect(sanitizeQuickRecordPins(null)).toEqual([]);
    expect(sanitizeQuickRecordPins("분유")).toEqual([]);
    expect(sanitizeQuickRecordPins([3, "  ", " 분유 ", "분유", "젖병", "물티슈", "체온계"])).toEqual([
      "분유",
      "젖병",
      "물티슈"
    ]);
  });

  it("토글: 없으면 끝에 추가, 있으면 해제 -- 먼저 고정한 것이 앞칸을 지킨다", () => {
    const one = toggleQuickRecordPin([], "분유");
    expect(one).toEqual(["분유"]);
    const two = toggleQuickRecordPin(one, " 젖병 ");
    expect(two).toEqual(["분유", "젖병"]);
    expect(toggleQuickRecordPin(two, "분유")).toEqual(["젖병"]);
  });

  it("변화 없는 토글(빈 이름 · 상한에서의 추가)은 원본 배열 참조를 그대로 돌려준다", () => {
    const pins = ["분유", "젖병", "물티슈"];
    expect(toggleQuickRecordPin(pins, "   ")).toBe(pins);
    // 상한 갈래는 UI로는 닿지 않는다(핀 3개면 화면의 모든 품목 칩이 핀) -- 손상 저장본 방어다.
    expect(toggleQuickRecordPin(pins, "체온계")).toBe(pins);
    // 상한에서도 해제는 언제나 된다.
    expect(toggleQuickRecordPin(pins, "젖병")).toEqual(["분유", "물티슈"]);
  });

  it("낭독: 핀 상태가 소리로도 구분되고, 액션 라벨이 다음 동작을 말한다(해요체 힌트)", () => {
    const [pinnedChip] = buildHomeQuickRecordChips(null, ["분유"]);
    expect(quickRecordChipAccessibilityLabel(pinnedChip)).toBe("분유, 홈에 고정됨");
    const unpinnedChip = buildHomeQuickRecordChips(null, ["분유"])[1];
    expect(quickRecordChipAccessibilityLabel(unpinnedChip)).toBe(unpinnedChip.label);

    const pinnedActions = quickRecordChipAccessibilityActions(pinnedChip);
    const unpinnedActions = quickRecordChipAccessibilityActions(unpinnedChip);
    expect(pinnedActions).toHaveLength(1);
    expect(pinnedActions[0].label).toBe("고정 해제");
    expect(unpinnedActions[0].label).toBe("홈에 고정");
    // 액션 이름은 화면이 문자열을 다시 적지 않고 이 판정 하나로 비교한다.
    expect(isQuickRecordPinToggleAction(pinnedActions[0].name)).toBe(true);
    expect(isQuickRecordPinToggleAction("activate")).toBe(false);
    expect(quickRecordPinToggleHint()).toBe("길게 누르면 이 품목을 홈에 고정하거나 해제할 수 있어요");
  });

  it("라운드 102 리뷰 L-핀: 토글 뒤 확인 문장은 **결과 목록**이 정한다(이름 뒤 조사 없음)", () => {
    expect(quickRecordPinToggleAnnouncement("분유", ["분유"])).toBe("분유 홈에 고정했어요");
    expect(quickRecordPinToggleAnnouncement("분유", ["젖병"])).toBe("분유 고정을 해제했어요");
    // 화면이 "무엇을 했는지"를 따로 기억하지 않아도 되도록 사실 하나(결과 목록)로 판정한다.
    expect(quickRecordPinToggleAnnouncement(" 분유 ", ["분유"])).toBe("분유 홈에 고정했어요");
    // 말할 대상이 없으면 문장도 없다("직접 입력" 칩은 애초에 이 경로에 오지 않는다).
    for (const empty of [null, undefined, "   "]) {
      expect(quickRecordPinToggleAnnouncement(empty, ["분유"])).toBeNull();
    }
  });
});

describe("빠른 기록 화면 배선 계약 (app/(tabs)/index.tsx)", () => {
  it("칩 목록은 지출 기록 화면과 같은 최근 품목 계산을 재사용한다(새 요청 0)", () => {
    expect(homeSource).toContain('import { buildRecentItemChips } from "../../src/expenses/recent-items";');
    expect(homeSource).toContain("buildHomeQuickRecordChips(");
    expect(homeSource).toContain(
      "buildRecentItemChips(offlineSyncSnapshot.rows, childId, { serverRows: thisMonthExpenses.data?.expenses })"
    );
  });

  it("칩 문구·제목은 순수 모듈이 단일 소스다", () => {
    expect(homeSource).toContain("HOME_QUICK_RECORD_SECTION_TITLE");
    // 이력이 0건이면 이 목록은 고정 3종으로 채워진다 -- 그 화면에 "자주 기록해요"라고 적으면
    // 사용자가 한 적 없는 습관을 단언하는 문구가 된다.
    expect(HOME_QUICK_RECORD_SECTION_TITLE).toBe("빠른 기록");
    expect(HOME_QUICK_RECORD_SECTION_TITLE).not.toBe("자주 기록해요");
    // 화면이 "기저귀"·"분유" 같은 고정 문자열을 다시 적지 않는다.
    expect(homeSource).not.toContain('label="기저귀"');
  });

  it("탭하면 품목명만 프리필한 지출 기록 화면이 열린다(저장은 그 화면에서만)", () => {
    expect(homeSource).toContain('router.push({ pathname: "/expenses/new", params: { itemName: chip.itemName } });');
    expect(homeSource).toContain('router.push("/expenses/new");');
  });

  it("라운드 102 F6b: 핀 배선 — persist 스토어 하나 + 길게 누르기 + 커스텀 액션(낭독 보완)", () => {
    // 값의 원천은 기기 단위 persist 스토어 하나다(화면 로컬 state 금지 -- records-view 관례).
    expect(homeSource).toContain('import { useQuickRecordPinsStore } from "../../src/stores/quick-record-pins.store";');
    expect(homeSource).toContain(
      "const pinnedQuickRecordItemNames = useQuickRecordPinsStore((state) => state.pinnedItemNames);"
    );
    expect(homeSource).toContain("const toggleQuickRecordPin = useQuickRecordPinsStore((state) => state.togglePin);");
    // 병합 규칙은 순수 모듈에 넘긴다(핀 우선·중복 제거·상한).
    expect(homeSource).toContain("pinnedQuickRecordItemNames\n      ),");
    // 길게 누르기 = 토글(기록 행 롱프레스 액션과 같은 관례). "직접 입력" 칩(itemName null)은 제외.
    // ⚠️ 두 시점(라운드 102 리뷰 L-핀): 종전에는 두 입구가 스토어 액션을 **직접** 불렀다
    // (`toggleQuickRecordPin(chip.itemName!)`). 이제 확인 신호(촉각+낭독)를 함께 내는 한
    // 함수를 지난다 — 아래 계약이 그 함수의 본문을 문다.
    expect(homeSource).toContain(
      "onLongPress={chip.itemName ? () => toggleQuickRecordPinWithFeedback(chip.itemName!) : undefined}"
    );
    expect(homeSource).toContain("toggleQuickRecordPinWithFeedback(chip.itemName!);");
    // 길게 누르기를 못 듣는 보조기술: 힌트 문장 + 커스텀 액션이 같은 일을 노출한다.
    expect(homeSource).toContain("accessibilityHint={chip.itemName ? quickRecordPinToggleHint() : undefined}");
    expect(homeSource).toContain(
      "accessibilityActions={chip.itemName ? quickRecordChipAccessibilityActions(chip) : undefined}"
    );
    expect(homeSource).toContain("if (isQuickRecordPinToggleAction(event.nativeEvent.actionName)) {");
    // 낭독 라벨은 핀 상태를 함께 말한다(글리프 단독 전달 금지).
    expect(homeSource).toContain("accessibilityLabel={quickRecordChipAccessibilityLabel(chip)}");
    // 핀 표시는 글리프 + 낭독의 한 쌍이다(coral 소형 표면은 700만 -- A11Y-117).
    expect(homeSource).toContain(
      '{chip.pinned ? <AppIcon color={theme.colors.coral[700]} name="pin" size={12} /> : null}'
    );
  });

  it("라운드 102 F6b: 핀 UI는 세션 갈래에만 있다 -- 비세션 프리뷰 렌더(HOME-001)는 무접촉", () => {
    // 슬라이스 두 끝 가드 -- 비세션 프리뷰 렌더의 시작과 끝 앵커가 실재해야 부정 단언이 산다.
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로) — **무변경**.");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)");
    expect(previewStart).toBeGreaterThan(-1);
    expect(previewEnd).toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    expect(preview).not.toContain("onLongPress");
    expect(preview).not.toContain("quickRecordChips");
    expect(preview).not.toContain("toggleQuickRecordPin");
  });

  it("캡처 수치: white · gray300 테두리 · pill · 최소 48 터치 타깃 · 11/700", () => {
    const chipStyle = homeSource.slice(
      homeSource.indexOf("const homeQuickRecordStyle = StyleSheet.create({"),
      homeSource.indexOf("const homePrepCardStyle")
    );
    expect(chipStyle).toContain("backgroundColor: theme.colors.white");
    expect(chipStyle).toContain("borderColor: theme.colors.gray300");
    expect(chipStyle).toContain("borderRadius: theme.radii.pill");
    expect(chipStyle).toContain("minHeight: theme.touchTarget");
    expect(chipStyle).toContain("fontSize: 11");
    expect(chipStyle).toContain('fontWeight: "700"');
  });
});
