import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canSwitchChildFromScreen,
  CHILD_SCOPED_QUERY_KEY_PREFIXES,
  resolveChildScopeLabel,
  withChildScopeLabel
} from "../children/child-switch";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");

/**
 * 라운드 51 #10 — 준비템 탭의 아이 스코프 + 전환 입구.
 *
 * 고치는 문제: 준비템은 아이마다 목록도 준비율도 통째로 다른데, 화면 어디에도 "누구의
 * 준비물인가"가 없었고 전환하려면 홈으로 나갔다 돌아와야 했다(둘째 준비물을 보는 가장 흔한
 * 동작이 가장 먼 길이었다 — 라운드 49 C-09가 기록·리포트에서 없앤 그 왕복이다).
 *
 * 새 코드를 만들지 않는다: 시트·상태·부수효과는 src/children/ChildSwitchSheet.tsx 한 벌을,
 * 라벨과 무효화 키는 src/children/child-switch.ts를 그대로 쓴다.
 */
describe("#10 준비템 탭 아이 스코프", () => {
  it("아이가 하나이거나 모를 때는 라벨이 없다 = 헤더가 종전과 같다", () => {
    expect(resolveChildScopeLabel("child-1", [{ id: "child-1", nickname: "다온이" }])).toBeNull();
    expect(resolveChildScopeLabel("child-1", undefined)).toBeNull();
    expect(withChildScopeLabel("추천", null)).toBe("추천");
  });

  it("다자녀 가구에서만 이름이 붙고 전환 입구가 열린다", () => {
    const children = [
      { id: "child-1", nickname: "다온이" },
      { id: "child-2", nickname: "하온이" }
    ];
    expect(resolveChildScopeLabel("child-1", children)).toBe("다온이");
    expect(withChildScopeLabel("추천", "다온이")).toBe("다온이 — 추천");
    expect(canSwitchChildFromScreen(children)).toBe(true);
    expect(canSwitchChildFromScreen([children[0]])).toBe(false);
  });

  it("전환은 준비템 캐시를 통째로 무효화한다 (아이 A의 목록·준비율이 B 화면에 남지 않는다)", () => {
    const prefixes = CHILD_SCOPED_QUERY_KEY_PREFIXES.map(([prefix]) => prefix);
    expect(prefixes).toContain("items");
    expect(prefixes).toContain("item-detail");
    expect(prefixes).toContain("home");
  });

  /**
   * ITEM-001 픽셀락: 캡처는 비세션 렌더라 canSwitch가 false이고 childScopeLabel도 null이라,
   * 헤더는 종전의 <Text>추천</Text> 그대로다(Pressable로 감싸지도 않는다). 리포트 탭(REP-001)이
   * 쓰는 것과 **같은 이중 게이트**다.
   */
  it("화면은 세션 AND 2명 이상일 때만 헤더를 전환 입구로 바꾼다", () => {
    const items = itemsSource();
    expect(items).toContain("const childSwitch = useChildSwitchSheet({");
    expect(items).toContain("{childSwitch.canSwitch && childScopeLabel ? (");
    expect(items).toContain("{childSwitch.canSwitch && childSwitch.isOpen ? (");
    expect(items).toContain('testID="items-child-switch-trigger"');
    expect(items).toContain('testID="items-child-switch-sheet"');
    // 라벨/접근성 문구는 순수 모듈에서만 온다(리포트 탭과 같은 관례).
    expect(items).toContain('withChildScopeLabel("추천", childScopeLabel)');
    expect(items).toContain('withSpokenChildScopeLabel("추천", childScopeLabel)');
    expect(items).toContain("childSwitchTriggerAccessibilityLabel(");
    expect(items).toContain("accessibilityHint={CHILD_SWITCH_TRIGGER_HINT}");
  });

  it("전환 시트와 부수효과를 화면에 복제하지 않는다 (공용 한 벌만 쓴다)", () => {
    const items = itemsSource();
    expect(items).toContain('from "../../src/children/ChildSwitchSheet"');
    // 스토어 쓰기·무효화·안내를 손으로 다시 적으면 한쪽만 고쳐지는 날 캐시가 오염된다.
    expect(items).not.toContain("applyChildSwitch(");
    expect(items).not.toContain("setSelectedChildId");
  });

  it("아이 목록은 새 요청이 아니라 이미 있는 ['children'] 캐시를 읽는다", () => {
    const items = itemsSource();
    expect(items).toContain('queryKey: ["children"]');
    expect(items).toContain("queryFn: () => listChildren(authToken!)");
  });
});
