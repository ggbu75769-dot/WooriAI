import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyChildSwitch,
  canSwitchChildFromHome,
  childSwitchOptionAccessibilityLabel,
  childSwitchTriggerAccessibilityLabel,
  CHILD_SCOPED_QUERY_KEY_PREFIXES,
  CHILD_SWITCH_SHEET_TITLE,
  CHILD_SWITCH_TRIGGER_HINT,
  planChildSwitch
} from "./child-switch";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("MOB-118 child switch planning", () => {
  it("is a no-op when tapping the already selected child (keeps warm caches)", () => {
    expect(planChildSwitch("child-1", { id: "child-1", nickname: "다온이" })).toBeNull();
  });

  it("switches to a different child with an announcement and full child-scoped invalidation", () => {
    const plan = planChildSwitch("child-1", { id: "child-2", nickname: "튼튼이" });
    expect(plan).not.toBeNull();
    expect(plan!.childId).toBe("child-2");
    expect(plan!.announcement).toBe("튼튼이(으)로 전환했어요.");
    expect(plan!.invalidateKeys).toBe(CHILD_SCOPED_QUERY_KEY_PREFIXES);
  });

  it("switches even when nothing was selected yet", () => {
    const plan = planChildSwitch(null, { id: "child-1", nickname: "다온이" });
    expect(plan?.childId).toBe("child-1");
  });

  it("covers every child-scoped query key family used by the app's screens", () => {
    // Keys per the queryKey inventory across app/**: home, expenses (list) + expense (detail),
    // budget, items + item-detail, report. household-members/children are child-independent.
    const prefixes = CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => key[0]);
    expect(prefixes).toEqual(["home", "expenses", "expense", "budget", "items", "item-detail", "report"]);
  });
});

/**
 * HOME-138(라운드 38 UX-M) 홈 헤더 1탭 전환.
 *
 * 두 화면(설정 → 아이 관리, 홈 헤더)이 같은 전환을 일으키므로, 부수효과의 **순서와 빠짐 없음**을
 * 여기서 못 박는다. 무효화를 빠뜨린 경로가 하나라도 생기면 아이 A의 홈/기록/리포트 캐시가 아이
 * B 화면에 그대로 남는다(라운드 28의 A→B 캐시 오염).
 */
describe("HOME-138 applyChildSwitch (전환 부수효과 단일 경로)", () => {
  function recordingEffects() {
    const calls: string[] = [];
    const invalidated: string[][] = [];
    return {
      calls,
      invalidated,
      effects: {
        setSelectedChildId: (childId: string) => calls.push(`select:${childId}`),
        invalidateQueries: (input: { queryKey: string[] }) => {
          calls.push(`invalidate:${input.queryKey.join("/")}`);
          invalidated.push(input.queryKey);
        },
        announce: (message: string) => calls.push(`announce:${message}`)
      }
    };
  }

  it("스토어 쓰기 → 아이 스코프 캐시 전체 무효화 → 안내 순서로 실행한다", () => {
    const { calls, invalidated, effects } = recordingEffects();
    const plan = applyChildSwitch("child-1", { id: "child-2", nickname: "튼튼이" }, effects);

    expect(plan?.childId).toBe("child-2");
    expect(calls[0]).toBe("select:child-2");
    expect(calls[calls.length - 1]).toBe("announce:튼튼이(으)로 전환했어요.");
    expect(invalidated).toEqual(CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => [...key]));
  });

  it("같은 아이를 다시 고르면 아무 일도 하지 않는다(따뜻한 캐시 유지)", () => {
    const { calls, effects } = recordingEffects();
    expect(applyChildSwitch("child-1", { id: "child-1", nickname: "다온이" }, effects)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("무효화 키를 화면이 아니라 이 함수가 들고 있다(호출부가 손으로 다시 적지 않게)", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    const childrenSource = source("app/settings/children.tsx");
    for (const screen of [homeSource, childrenSource]) {
      expect(screen).toContain("applyChildSwitch(");
      expect(screen).not.toContain("plan.invalidateKeys");
    }
  });
});

describe("HOME-138 홈 헤더 전환 입구", () => {
  it("아이가 2명 이상일 때만 전환할 수 있다", () => {
    expect(canSwitchChildFromHome(null)).toBe(false);
    expect(canSwitchChildFromHome([])).toBe(false);
    expect(canSwitchChildFromHome([{ id: "child-1" }])).toBe(false);
    expect(canSwitchChildFromHome([{ id: "child-1" }, { id: "child-2" }])).toBe(true);
  });

  it("헤더 탭 대상은 보이는 문구와 여는 것을 함께 읽어준다", () => {
    expect(childSwitchTriggerAccessibilityLabel("다온이를 만나기까지 32일 남았어요")).toBe(
      "다온이를 만나기까지 32일 남았어요, 아이 전환"
    );
    expect(CHILD_SWITCH_TRIGGER_HINT).toBe("아이 전환");
    expect(CHILD_SWITCH_SHEET_TITLE).toBe("아이 전환");
  });

  it("시트의 현재 아이는 소리로도 구분된다", () => {
    expect(childSwitchOptionAccessibilityLabel("다온이", true)).toBe("다온이, 현재 선택");
    expect(childSwitchOptionAccessibilityLabel("튼튼이", false)).toBe("튼튼이(으)로 전환");
  });

  it("홈 화면은 아이가 2명 이상일 때만 헤더를 버튼으로 만들고 ['children'] 캐시를 재사용한다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("canSwitchChildFromHome(switchableChildren)");
    expect(homeSource).toContain('testID="home-child-switch-trigger"');
    expect(homeSource).toContain('testID="home-child-switch-sheet"');
    expect(homeSource).toContain("childrenQuery.data?.children ?? []");
    // 전환용 새 요청은 없다: 목록은 설정·리포트와 같은 ["children"] 캐시에서 온다.
    expect(homeSource.match(/queryKey: \["children"\]/g) ?? []).toHaveLength(1);
    // 1명이면 종전 헤더 그대로여야 한다(HOME-001 픽셀락 캡처는 비세션·1명 미리보기).
    expect(homeSource).toContain("<ScreenHeader");
  });

  it("전환 목록의 각 줄은 44dp 터치 타깃을 지킨다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    const styleBlock = homeSource.slice(
      homeSource.indexOf("const homeChildSwitchStyle"),
      homeSource.indexOf("// UX-A 이번 주 요약")
    );
    expect(styleBlock).toContain("minHeight: theme.touchTarget");
  });
});
