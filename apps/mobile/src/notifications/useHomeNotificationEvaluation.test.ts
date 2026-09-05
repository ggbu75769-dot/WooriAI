import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { evaluateHomeNotifications } from "./generators";
import { isNotificationTypeEnabled, useNotificationPreferencesStore } from "./notification-preferences.store";
import { useNotificationStore, type AppNotificationCandidate } from "./notification.store";

/**
 * 라운드 99 F5 — 홈 알림 평가 훅의 두 구멍(L-1 · L-2).
 *
 * 훅 자체(useEffect)는 react-native 화면과 같은 이유로 vitest에서 렌더하지 않는 관례라
 * (notification-flow.test.ts 머리말), 배선은 소스 계약으로 잡고 **판정·순서의 결과**는 훅이
 * 실제로 부르는 저장소·순수 함수 조합을 그대로 돌려 값으로 고정한다(record-gap.test.ts의
 * "스토어 통합" 절과 같은 방식).
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const hookSource = () => source("src/notifications/useHomeNotificationEvaluation.ts");

// 2026-08-20 12:00 KST -- 주간 값은 undefined(아직 모름)로 넘겨 이 파일과 무관한 후보를 만들지 않는다.
const NOW = Date.UTC(2026, 7, 20, 3, 0, 0);

/**
 * 훅의 evaluate 본문이 하는 일을 같은 재료로 재현한다: 평가 → ingest → (L-2 게이트를 지나면)
 * recordSeenStage. lastSeenStageLabel도 훅과 같은 자리(lastSeenStageByChild)에서 읽는다.
 */
function evaluateLikeTheHook(stageLabel: string, now: number, recordSeenStageUnconditionally = false) {
  const store = useNotificationStore.getState();
  const candidates = evaluateHomeNotifications({
    child: { id: "child-1", nickname: "다온이", stageLabel },
    monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 100_000 },
    lastSeenStageLabel: store.lastSeenStageByChild["child-1"] ?? null,
    followupEntries: [],
    now,
    weekly: undefined
  });
  store.ingest(candidates, now);
  // 훅의 L-2 규율 그대로(소스 계약은 아래 it): stage_transition이 꺼져 있으면 기록을 미룬다.
  // recordSeenStageUnconditionally는 종전(라운드 99 전) 훅의 무조건 기록을 재현하는 대조군이다.
  if (
    recordSeenStageUnconditionally ||
    isNotificationTypeEnabled(useNotificationPreferencesStore.getState().mutedTypes, "stage_transition")
  ) {
    useNotificationStore.getState().recordSeenStage("child-1", stageLabel);
  }
}

const stageEntries = () =>
  useNotificationStore.getState().entries.filter((entry) => entry.type === "stage_transition");

beforeEach(() => {
  useNotificationStore.getState().resetAll();
  useNotificationPreferencesStore.getState().enableAll();
});

/**
 * L-2 — stage_transition을 꺼 둔 동안 recordSeenStage가 진행되면 **엣지가 소모된다**.
 *
 * muted 필터는 dedupeKey를 태우지 않는다는 계약(notification-preferences.store.ts)이 살아
 * 있어도, 이 알림만은 수준이 아니라 엣지(lastSeenStage와의 차이)로 발화하므로 꺼 둔 사이의
 * 기록이 곧 "다시 켜도 영영 미발화"였다 — 수준 기반인 예산·주간은 켜면 조건이 여전히 참이라
 * 돌아오는 것과 달리, 이 종류만 계약이 깨져 있었다.
 */
describe("라운드 99 F5(L-2) 꺼 둔 동안의 시기 변화는 엣지를 소모하지 않는다", () => {
  it("꺼짐 → 시기 변화 → 켬 → 다음 평가에서 정확히 한 번 발화한다", () => {
    // 켠 상태의 첫 목격: 기록만 하고 발화하지 않는다(generators의 첫 목격 규칙 그대로).
    evaluateLikeTheHook("24개월", NOW);
    expect(stageEntries()).toEqual([]);
    expect(useNotificationStore.getState().lastSeenStageByChild["child-1"]).toBe("24개월");

    // 끔 → 시기 변화: 후보는 ingest 앞에서 걸러지고(키 소모 없음), **엣지도 남는다**.
    useNotificationPreferencesStore.getState().setTypeEnabled("stage_transition", false);
    evaluateLikeTheHook("36개월", NOW + 1_000);
    expect(stageEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("stage_transition:child-1:36개월");
    // 여기가 L-2의 계약이다: 꺼진 평가는 lastSeenStage를 갱신하지 않는다.
    expect(useNotificationStore.getState().lastSeenStageByChild["child-1"]).toBe("24개월");

    // 켬 → 다음 평가: 남아 있는 엣지로 발화하고, 그때서야 기록한다.
    useNotificationPreferencesStore.getState().setTypeEnabled("stage_transition", true);
    evaluateLikeTheHook("36개월", NOW + 2_000);
    expect(stageEntries().map((entry) => entry.dedupeKey)).toEqual(["stage_transition:child-1:36개월"]);
    expect(useNotificationStore.getState().lastSeenStageByChild["child-1"]).toBe("36개월");

    // 같은 시기는 두 번 발화하지 않는다(dedupe 메모리 -- 재평가는 멱등).
    evaluateLikeTheHook("36개월", NOW + 3_000);
    expect(stageEntries()).toHaveLength(1);
  });

  it("대조: 종전처럼 꺼진 동안에도 기록하면 켠 뒤에 영영 발화하지 않는다 (이 라운드가 고친 증상)", () => {
    evaluateLikeTheHook("24개월", NOW);
    useNotificationPreferencesStore.getState().setTypeEnabled("stage_transition", false);
    // 종전 훅: muted 여부와 무관하게 recordSeenStage가 돌았다.
    evaluateLikeTheHook("36개월", NOW + 1_000, true);
    expect(useNotificationStore.getState().lastSeenStageByChild["child-1"]).toBe("36개월");

    useNotificationPreferencesStore.getState().setTypeEnabled("stage_transition", true);
    evaluateLikeTheHook("36개월", NOW + 2_000);
    // 엣지가 이미 소모돼 후보 자체가 만들어지지 않는다 -- muted 필터의 "키를 태우지 않는다"
    // 계약만으로는 이 종류를 지키지 못했다는 근거다.
    expect(stageEntries()).toEqual([]);
  });

  it("훅은 muted를 평가 시점 getState()로 읽고(구독 추가 금지), 게이트가 recordSeenStage를 감싼다", () => {
    const src = hookSource();
    expect(src).toContain(
      'if (isNotificationTypeEnabled(useNotificationPreferencesStore.getState().mutedTypes, "stage_transition")) {'
    );
    expect(src).toContain("store.recordSeenStage(home.child.id, home.child.stageLabel)");
    // 구독을 늘리지 않는다: 이 훅이 설정 스토어를 읽는 방식은 getState()·persist 대기뿐이다
    // (셀렉터 구독이 생기면 설정 토글마다 재평가가 돈다 -- 평가 시점 값이면 충분하다).
    expect(src).not.toContain("useNotificationPreferencesStore((");
  });
});

/**
 * L-1 — 3초 밸브가 먼저 평가한 뒤 **늦게 끝난 rehydrate**가 그 평가의 ingest를 저장본으로 덮는
 * 자리. 종전에는 evaluated 가드가 rehydrate 완료 콜백의 재평가까지 막아, 덮인 알림이 되살아날
 * 기회가 없었다(알림함이 조용히 빈다). 콜백은 이제 가드를 지나지 않고 한 번 더 평가한다.
 */
describe("라운드 99 F5(L-1) 밸브 뒤 늦은 rehydrate의 재평가", () => {
  it("rehydrate 완료 콜백은 evaluated 가드를 지나지 않는다 (밸브·초기 경로만 가드를 쓴다)", () => {
    const src = hookSource();
    // 가드의 새 뜻: 초기 경로·밸브 사이의 중복만 거른다.
    expect(src).toContain(
      ["    const evaluate = () => {", "      if (evaluated) return;", "      runEvaluation();", "    };"].join("\n")
    );
    // 밸브는 종전 그대로 가드를 지난다(hydration이 정상적으로 먼저 끝났으면 두 번 돌지 않는다).
    expect(src).toContain("const valve = setTimeout(evaluate, NOTIFICATION_HYDRATION_VALVE_MS);");
    // 두 저장소의 완료 콜백은 둘 다 가드 없는 runEvaluation을 부른다.
    expect(src.match(/if \(storesHydrated\(\)\) runEvaluation\(\);/g) ?? []).toHaveLength(2);
    expect(src).not.toContain("if (storesHydrated()) evaluate();");
  });

  it("한 번 더 돌아도 안전한 근거(dedupe 멱등)로 덮인 알림이 되살아난다 -- 저장소 수준 재현", () => {
    const candidate: AppNotificationCandidate = {
      type: "budget_80",
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해보세요.",
      dedupeKey: "budget_80:child-1:2026-08",
      childId: "child-1"
    };
    // 밸브 평가: pre-hydration 상태에 ingest.
    useNotificationStore.getState().ingest([candidate], NOW);
    expect(useNotificationStore.getState().entries).toHaveLength(1);

    // 늦은 rehydrate의 merge가 그 ingest를 저장본(비어 있음)으로 덮는다.
    useNotificationStore.setState({ entries: [], seenDedupeKeys: [], lastSeenStageByChild: {} });

    // L-1의 재평가: 같은 후보가 되살아나고, 한 번 더 돌아도 두 줄이 되지 않는다.
    useNotificationStore.getState().ingest([candidate], NOW + 1_000);
    useNotificationStore.getState().ingest([candidate], NOW + 2_000);
    expect(useNotificationStore.getState().entries.map((entry) => entry.dedupeKey)).toEqual([
      "budget_80:child-1:2026-08"
    ]);
  });
});
