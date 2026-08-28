import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyChildSwitch,
  canSwitchChildFromHome,
  childSwitchOptionAccessibilityLabel,
  childSwitchTriggerAccessibilityLabel,
  CHILD_SCOPED_QUERY_KEY_PREFIXES,
  CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS,
  CHILD_SWITCH_HEADER_TRIGGER_HINT,
  CHILD_SWITCH_SHEET_TITLE,
  CHILD_SWITCH_TRIGGER_HINT,
  CHILD_SCOPE_LABEL_SEPARATOR,
  planChildSwitch,
  resolveChildScopeLabel,
  withChildScopeLabel
} from "./child-switch";
import { resolveNotificationChildLabel } from "../notifications/notification-child-label";

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

  it("라운드 38 H-8: 아이 2명 이상이어도 홈 제목 랜드마크(header)를 잃지 않는다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    // 카운터 헤더 분기(= 이 화면의 제목 줄)만 잘라 본다 -- 에러 화면의 보조 입구(H-9)는 제목을
    // 대신하지 않으므로 종전대로 버튼이다.
    const triggerBlock = homeSource.slice(
      homeSource.indexOf("{babyCounter ? ("),
      homeSource.indexOf('testID="home-baby-counter"')
    );
    // RN은 role을 하나만 준다 -- 랜드마크를 지키고 버튼성은 힌트·액션으로 전한다.
    expect(triggerBlock).toContain('accessibilityRole="header"');
    expect(triggerBlock).not.toContain('accessibilityRole="button"');
    expect(triggerBlock).toContain("accessibilityHint={CHILD_SWITCH_HEADER_TRIGGER_HINT}");
    expect(triggerBlock).toContain("accessibilityActions={CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS}");
    expect(triggerBlock).toContain('actionName === "activate"');
  });

  it("라운드 38 H-8: header role일 때 힌트가 '두 번 탭' 문장을 대신 말한다", () => {
    expect(CHILD_SWITCH_HEADER_TRIGGER_HINT).toBe("두 번 탭하면 아이를 전환할 수 있어요");
    expect(CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS).toEqual([{ name: "activate", label: CHILD_SWITCH_SHEET_TITLE }]);
  });

  it("라운드 38 H-9: 홈 로드 실패 화면에도 아이 전환 입구와 시트가 남는다", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    const errorBranch = homeSource.slice(
      homeSource.indexOf('if (hasSession && homePhase === "error") {'),
      homeSource.indexOf('if (hasSession && homePhase === "loading") {')
    );
    // 전환 직후 실패했을 때 원래 아이로 되돌아갈 길이 홈 안에 있어야 한다.
    expect(errorBranch).toContain('testID="home-child-switch-trigger"');
    expect(errorBranch).toContain("{childSwitchSheet}");
    // 오프라인 문구 배선(UX-N)은 그대로 -- 실패 카드는 loadErrorCopy를 계속 쓴다.
    expect(errorBranch).toContain("title={loadErrorCopy.title}");
    // 시트는 두 상태가 **같은 노드**를 그린다(두 벌로 적으면 한쪽만 고쳐진다).
    expect(homeSource.match(/testID="home-child-switch-sheet"/g) ?? []).toHaveLength(1);
    expect(homeSource.match(/\{childSwitchSheet\}/g) ?? []).toHaveLength(2);
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

describe("라운드 48 T4(D3) 다자녀 스코프 라벨", () => {
  const twoChildren = [
    { id: "c-1", nickname: "다온이" },
    { id: "c-2", nickname: "콩콩이" }
  ];

  it("아이가 2명 이상일 때만 라벨이 붙는다", () => {
    expect(resolveChildScopeLabel("c-2", twoChildren)).toBe("콩콩이");
  });

  it("아이가 하나면 null이다 -- 종전 화면과 한 글자도 달라지지 않는다", () => {
    expect(resolveChildScopeLabel("c-1", [{ id: "c-1", nickname: "다온이" }])).toBeNull();
    expect(withChildScopeLabel("리포트", resolveChildScopeLabel("c-1", [{ id: "c-1", nickname: "다온이" }]))).toBe(
      "리포트"
    );
  });

  it("목록을 아직/영영 해석할 수 없으면 아무것도 붙이지 않는다(캐시 미도착·조회 실패·비세션)", () => {
    expect(resolveChildScopeLabel("c-1", undefined)).toBeNull();
    expect(resolveChildScopeLabel("c-1", null)).toBeNull();
    expect(resolveChildScopeLabel("c-1", [])).toBeNull();
  });

  it("선택된 아이를 목록에서 못 찾거나 태명이 비면 이름을 지어내지 않는다", () => {
    expect(resolveChildScopeLabel(null, twoChildren)).toBeNull();
    expect(resolveChildScopeLabel(undefined, twoChildren)).toBeNull();
    expect(resolveChildScopeLabel("c-9", twoChildren)).toBeNull();
    expect(resolveChildScopeLabel("c-2", [twoChildren[0], { id: "c-2", nickname: "   " }])).toBeNull();
  });

  it("라벨은 문장 앞에 붙고(스크린리더가 누구의 숫자인지 먼저 읽는다), 없으면 원문 그대로다", () => {
    expect(withChildScopeLabel("2026년 8월 3건 · 합계 38,500원", "다온이")).toBe(
      "다온이 · 2026년 8월 3건 · 합계 38,500원"
    );
    expect(withChildScopeLabel("리포트", null)).toBe("리포트");
    expect(CHILD_SCOPE_LABEL_SEPARATOR).toBe(" · ");
  });

  it("알림함의 아이 표시와 같은 규칙을 쓴다(새 관례를 만들지 않는다)", () => {
    // 두 모듈 모두 '2명 이상 + 해석 가능한 이름'에서만 라벨을 낸다.
    expect(resolveNotificationChildLabel("c-2", twoChildren)).toBe(resolveChildScopeLabel("c-2", twoChildren));
    expect(resolveNotificationChildLabel("c-1", [{ id: "c-1", nickname: "다온이" }])).toBe(
      resolveChildScopeLabel("c-1", [{ id: "c-1", nickname: "다온이" }])
    );
  });
});

describe("라운드 48 T4(D3) 화면 배선", () => {
  it("기록 탭 월 요약이 보이는 문구와 스크린리더 라벨 모두에 라벨을 붙인다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    expect(recordsSource).toContain(
      'import { resolveChildScopeLabel, withChildScopeLabel } from "../../src/children/child-switch";'
    );
    // 새 요청 없이 이미 읽고 있는 ["children"] 캐시를 그대로 쓴다.
    expect(recordsSource).toContain("const childScopeLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);");
    expect(recordsSource).toContain("{withChildScopeLabel(monthSummary.text, childScopeLabel)}");
    expect(recordsSource).toContain(
      "accessibilityLabel={withChildScopeLabel(monthSummary.accessibilityLabel, childScopeLabel)}"
    );
    // 새 useQuery를 만들지 않았다 -- ["children"]는 여전히 한 번만 선언된다.
    expect(recordsSource.match(/queryKey: \["children"\]/g) ?? []).toHaveLength(1);
  });

  it("리포트 헤더는 세션·다자녀 조건 뒤에서만 바뀐다(REP-001 비세션 렌더 불변)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");
    expect(reportSource).toContain("const childScopeLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);");
    expect(reportSource).toContain('<Text style={reportReferenceHeaderStyle}>{withChildScopeLabel("리포트", childScopeLabel)}</Text>');
    // 아이 목록 쿼리는 세션이 있을 때만 돈다 -- 비세션 미리보기에서는 라벨이 나올 수 없다.
    expect(reportSource).toContain('queryKey: ["children"],\n    enabled: Boolean(authToken),');
    expect(reportSource.match(/queryKey: \["children"\]/g) ?? []).toHaveLength(1);
  });
});
