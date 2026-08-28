import { describe, expect, it } from "vitest";
import { analyticsEventRegistry } from "@wooriai/contracts";
import {
  FUNNEL_KEY_BY_EVENT_NAME,
  type AdminAnalyticsFunnel
} from "../src/admin/analytics-summary.service";

/**
 * R27(L-5) 가드. `FUNNEL_KEY_BY_EVENT_NAME`의 주석은 오랫동안 "Must cover every
 * registry event name"이라고 주장했지만 ANA-127이 레지스트리에
 * `item_detail_viewed`/`purchase_followup_answered`를 덧붙이면서 거짓이 됐다
 * (화면은 byName으로 옮겨가서 기능 회귀는 없었다). 주석을 현실("별칭은 레거시
 * 6종 고정, 신규 이벤트는 byName으로만 노출")로 고치는 김에, 그 현실을 테스트로
 * 고정한다 — 다음에 누군가 이 맵을 "레지스트리 전체를 덮는 것"으로 오해하고
 * 손대면 여기서 걸린다.
 *
 * 고정하는 불변식은 두 방향이다.
 *  1) 별칭 6종 == 레지스트리의 **처음 6개** 이벤트 (레거시 집합의 정의).
 *  2) 그 뒤에 append된 이벤트는 별칭이 없다 (funnel 응답 형태 동결).
 *
 * DB도 Nest 앱도 필요 없다 — 순수 상수 대조.
 */

/** 레지스트리 append-only 규약(packages/contracts/src/analytics.ts) 상의 레거시 구간. */
const LEGACY_EVENT_COUNT = 6;

/**
 * `AdminAnalyticsFunnel`에 필드가 늘거나 줄면 이 리터럴이 **타입 에러**로 먼저
 * 깨진다(Record<keyof ...>는 누락도 초과도 허용하지 않는다). 응답 형태가
 * 동결이라는 주장을 런타임 assert 이전에 컴파일 타임으로 못박는 장치.
 */
const EXPECTED_FUNNEL_KEYS: Record<keyof AdminAnalyticsFunnel, true> = {
  appOpened: true,
  onboardingCompleted: true,
  expenseRecorded: true,
  itemStatusChanged: true,
  affiliateLinkClicked: true,
  expenseSynced: true
};

describe("R27(L-5) 어드민 퍼널 별칭 맵 ↔ 이벤트 레지스트리", () => {
  const registryNames = analyticsEventRegistry.map((entry) => entry.eventName);
  const aliasEventNames = Object.keys(FUNNEL_KEY_BY_EVENT_NAME);

  it("별칭 키는 레지스트리의 처음 6개 이벤트와 정확히 일치한다", () => {
    expect(registryNames.length).toBeGreaterThanOrEqual(LEGACY_EVENT_COUNT);
    // 별칭 맵의 선언 순서는 레지스트리 순서와 무관하므로(expense_synced /
    // item_status_changed가 서로 반대) 집합으로 비교한다. 응답의 순서를 정하는
    // 것은 byName이지 이 맵이 아니다.
    expect([...aliasEventNames].sort()).toEqual(
      [...registryNames.slice(0, LEGACY_EVENT_COUNT)].sort()
    );
  });

  it("ANA-127 이후 append된 이벤트에는 별칭이 없다 (byName으로만 노출)", () => {
    const appendedNames = registryNames.slice(LEGACY_EVENT_COUNT);
    // 회귀 방지의 핵심: 실제로 append된 이벤트가 존재하는 상태에서 검사한다.
    // 라운드 39 UX-P가 report_share_tapped를, 라운드 60 #9가 onboarding_step_viewed를
    // 같은 규칙으로 맨 뒤에 붙였다 -- 둘 다 별칭 없이 byName으로만 노출된다.
    expect(appendedNames).toEqual([
      "item_detail_viewed",
      "purchase_followup_answered",
      "report_share_tapped",
      "onboarding_step_viewed"
    ]);
    for (const name of appendedNames) {
      expect(FUNNEL_KEY_BY_EVENT_NAME[name]).toBeUndefined();
    }
  });

  it("별칭 값은 AdminAnalyticsFunnel의 키 6종과 1:1이다", () => {
    const aliasKeys = Object.values(FUNNEL_KEY_BY_EVENT_NAME);
    expect(new Set(aliasKeys).size).toBe(aliasKeys.length);
    expect([...aliasKeys].sort()).toEqual(Object.keys(EXPECTED_FUNNEL_KEYS).sort());
  });

  it("별칭 맵에 레지스트리에 없는 이벤트 이름이 섞여 있지 않다", () => {
    const registryNameSet = new Set(registryNames);
    for (const name of aliasEventNames) {
      expect(registryNameSet.has(name)).toBe(true);
    }
  });
});
