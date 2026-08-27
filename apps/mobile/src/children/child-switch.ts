/**
 * MOB-118: pure child-switch planning for the settings "아이 관리" screen. Kept free of
 * react-native imports so it unit-tests under vitest (same discipline as src/lineChartMath.ts).
 *
 * Every screen keys its react-query caches with the selected childId (["home", childId],
 * ["expenses", childId, ...], ...), so switching the persisted selectedChildId already points
 * screens at different cache entries. The prefixes below are still invalidated on switch (and
 * after an edit that can move the child's stage) so any cached data for the newly selected
 * child is refetched fresh instead of served stale -- a birth/due-date fix changes the
 * server-computed stage, which drives 준비템 추천 밴드와 리포트 전부.
 */
export const CHILD_SCOPED_QUERY_KEY_PREFIXES: ReadonlyArray<ReadonlyArray<string>> = [
  ["home"],
  ["expenses"],
  ["expense"],
  ["budget"],
  ["items"],
  ["item-detail"],
  ["report"]
];

export type ChildSwitchPlan = {
  childId: string;
  /** TalkBack/VoiceOver announcement (A11Y-115 announceForA11y convention). */
  announcement: string;
  invalidateKeys: ReadonlyArray<ReadonlyArray<string>>;
};

/**
 * Returns what a tap on a child row should do, or null when the tap targets the already
 * selected child (no store write, no invalidation, no announcement -- a no-op tap must not
 * blow away warm caches).
 */
export function planChildSwitch(
  currentChildId: string | null,
  child: { id: string; nickname: string }
): ChildSwitchPlan | null {
  if (currentChildId === child.id) return null;
  return {
    childId: child.id,
    announcement: `${child.nickname}(으)로 전환했어요.`,
    invalidateKeys: CHILD_SCOPED_QUERY_KEY_PREFIXES
  };
}

/** 전환이 실제로 건드리는 바깥 세계. react-native/react-query를 여기로 들이지 않기 위해 주입받는다. */
export type ChildSwitchEffects = {
  setSelectedChildId: (childId: string) => void;
  invalidateQueries: (input: { queryKey: string[] }) => unknown;
  /** src/ui.tsx의 announceForA11y (A11Y-115 관례). */
  announce: (message: string) => void;
};

/**
 * HOME-138(라운드 38 UX-M): 전환의 **부수효과 순서까지** 한 곳에 모은다.
 *
 * 예전에는 계획(planChildSwitch)만 공유하고 "스토어 쓰기 → 아이 스코프 캐시 무효화 → 안내"
 * 세 줄은 화면마다 손으로 적었다. 홈 헤더 1탭 전환이 두 번째 호출부가 되면서 그 세 줄이 두
 * 벌이 됐고, 한쪽이 무효화를 빠뜨리면 아이 A의 홈/기록/리포트 캐시가 아이 B 화면에 그대로
 * 남는다(라운드 28에서 실제로 잡았던 A→B 캐시 오염). 순서와 누락 여부를 단위 테스트로 못
 * 박을 수 있게 여기로 옮긴다 — 화면은 이 함수만 부른다.
 *
 * 같은 아이를 다시 고르면 planChildSwitch가 null을 주고 **아무 일도 일어나지 않는다**
 * (따뜻한 캐시를 날리지 않는다). 그때 null을 돌려주므로 호출부가 "실제로 바뀌었는지"를 알 수 있다.
 */
export function applyChildSwitch(
  currentChildId: string | null,
  child: { id: string; nickname: string },
  effects: ChildSwitchEffects
): ChildSwitchPlan | null {
  const plan = planChildSwitch(currentChildId, child);
  if (!plan) return null;
  effects.setSelectedChildId(plan.childId);
  for (const key of plan.invalidateKeys) {
    effects.invalidateQueries({ queryKey: [...key] });
  }
  effects.announce(plan.announcement);
  return plan;
}

/**
 * 홈 헤더에서 아이를 바꿀 수 있는지. **2명 이상일 때만** true다 — 아이가 하나인 사용자에게는
 * 고를 것이 없으므로 헤더가 종전 그대로(터치 불가) 남는다(HOME-001 픽셀락 캡처는 비세션·1명
 * 미리보기라 이 판정이 항상 false다).
 */
export function canSwitchChildFromHome(children: ReadonlyArray<{ id: string }> | null | undefined): boolean {
  return (children?.length ?? 0) >= 2;
}

/** 홈 헤더 전환 시트의 제목. */
export const CHILD_SWITCH_SHEET_TITLE = "아이 전환";

/** 헤더 탭 대상의 accessibilityHint — "이걸 누르면 무슨 일이 일어나는가". */
export const CHILD_SWITCH_TRIGGER_HINT = "아이 전환";

/**
 * 라운드 38 H-8: 홈의 아이 카운터 줄은 이 화면의 **제목**(header 랜드마크)이자 전환 버튼이다.
 * react-native는 노드 하나에 접근성 role을 하나만 줄 수 있어, 그 줄을 Pressable로 감싸며
 * role="button"을 주는 순간 아이가 2명 이상인 사용자만 홈 제목 랜드마크를 잃었다(스크린리더의
 * "제목으로 이동"이 홈에서만 지나쳐 간다). 랜드마크가 사라지는 쪽이 더 큰 손실이라 role은
 * header로 두고, "누를 수 있다"는 사실은 힌트와 접근성 액션으로 전한다.
 *
 * 그래서 힌트가 이름표("아이 전환")가 아니라 **문장**이다 — role이 button이 아닐 때는
 * 스크린리더가 "두 번 탭하세요"를 스스로 붙여주지 않으므로 힌트가 그 말을 대신해야 한다.
 */
export const CHILD_SWITCH_HEADER_TRIGGER_HINT = "두 번 탭하면 아이를 전환할 수 있어요";

/**
 * header role을 유지한 채 TalkBack/VoiceOver의 액션 메뉴에 "아이 전환"을 노출한다(활성화
 * 제스처는 그대로 onPress로 들어온다). react-native의 `accessibilityActions`에 그대로 넘어가는
 * 순수 데이터라 여기(문구 단일 소스)에 둔다.
 */
export const CHILD_SWITCH_HEADER_ACCESSIBILITY_ACTIONS: ReadonlyArray<{ name: string; label: string }> = [
  { name: "activate", label: CHILD_SWITCH_SHEET_TITLE }
];

/** 헤더 탭 대상의 accessibilityLabel: 보이는 문구 + 무엇을 여는지. */
export function childSwitchTriggerAccessibilityLabel(headerText: string): string {
  return `${headerText}, ${CHILD_SWITCH_SHEET_TITLE}`;
}

/** 시트 안 한 줄의 accessibilityLabel. 현재 아이는 소리로도 구분된다. */
export function childSwitchOptionAccessibilityLabel(nickname: string, isCurrent: boolean): string {
  return isCurrent ? `${nickname}, 현재 선택` : `${nickname}(으)로 전환`;
}
