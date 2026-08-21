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
