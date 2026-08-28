import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  NOTIFICATION_TYPE_OPTIONS,
  filterMutedNotificationCandidates,
  isKnownNotificationType,
  isNotificationTypeEnabled,
  notificationTypeLabel,
  setNotificationTypeMuted,
  useNotificationPreferencesStore
} from "./notification-preferences.store";
import {
  addNotifications,
  useNotificationStore,
  type AppNotificationCandidate
} from "./notification.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const NOW = 1_700_000_000_000;

function candidate(overrides: Partial<AppNotificationCandidate> = {}): AppNotificationCandidate {
  return {
    type: "budget_80",
    title: "이번 달 예산의 80%를 사용했어요",
    body: "남은 예산을 확인해보세요.",
    dedupeKey: "budget_80:child-1:2026-08",
    ...overrides
  };
}

/**
 * 라운드 52 C-08 — 인앱 알림 종류별 끄기.
 *
 * 계약의 핵심 두 가지를 값으로 고정한다.
 *  1. 기본은 전부 켬이고, 스위치 목록은 generators.ts가 실제로 만드는 5종과 1:1이다.
 *  2. 끈 종류의 후보는 **dedupeKey를 소모하지 않고** 사라진다 -- 다시 켜면 다음 평가에서
 *     평소대로 발화한다("끄기"가 조용히 "영구 삭제"가 되면 안 된다).
 */
describe("라운드 52 C-08 알림 종류별 설정(순수 로직)", () => {
  it("설정 화면의 6종은 generators가 만드는 종류와 1:1이고 순서가 고정돼 있다", () => {
    // GAP-054 #6: record_gap이 목록 끝에 합류했다 -- 새 종류는 기본 켬으로 들어오고(저장
    // 형태가 "꺼진 것들"이라) 사용자는 이 스위치로 끌 수 있다.
    expect(NOTIFICATION_TYPE_OPTIONS.map((option) => option.type)).toEqual([
      "budget_80",
      "budget_100",
      "stage_transition",
      "purchase_pending",
      "weekly_summary",
      "record_gap"
    ]);
    // 라벨·설명은 사람이 읽는 단일 소스다: 비어 있거나 중복되면 스위치를 구분할 수 없다.
    const labels = NOTIFICATION_TYPE_OPTIONS.map((option) => option.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const option of NOTIFICATION_TYPE_OPTIONS) {
      expect(option.label.length, option.type).toBeGreaterThan(0);
      expect(option.description.length, option.type).toBeGreaterThan(0);
      // DNC-018 해요체.
      expect(option.description.endsWith("요."), `${option.type} 설명`).toBe(true);
    }
    expect(notificationTypeLabel("weekly_summary")).toBe("주간 요약 알림");
    // 모르는 종류에는 이름을 지어내지 않는다.
    expect(notificationTypeLabel("unknown_type")).toBeUndefined();
  });

  it("기본값은 전부 켬이고, 모르는 종류도 켠 것으로 본다", () => {
    for (const option of NOTIFICATION_TYPE_OPTIONS) {
      expect(isNotificationTypeEnabled([], option.type)).toBe(true);
    }
    // 설정 화면에 스위치가 없는 종류를 조용히 막으면 되살릴 방법이 없다.
    expect(isNotificationTypeEnabled(["budget_80"], "some_future_type")).toBe(true);
    expect(isNotificationTypeEnabled(["budget_80"], "budget_80")).toBe(false);
  });

  it("스위치 토글은 값이 바뀔 때만 새 배열을 만든다", () => {
    const none: readonly string[] = [];
    const muted = setNotificationTypeMuted(none, "weekly_summary", true);
    expect(muted).toEqual(["weekly_summary"]);
    // 같은 값으로 다시 끄면 그대로(구독자가 헛돌지 않는다).
    expect(setNotificationTypeMuted(muted, "weekly_summary", true)).toBe(muted);
    expect(setNotificationTypeMuted(muted, "weekly_summary", false)).toEqual([]);
    expect(setNotificationTypeMuted(none, "weekly_summary", false)).toBe(none);
  });

  it("blob 방어: 우리가 아는 종류의 문자열만, 중복 없이 살린다", () => {
    expect(isKnownNotificationType("budget_100")).toBe(true);
    expect(isKnownNotificationType("hacked")).toBe(false);
    expect(isKnownNotificationType(42)).toBe(false);

    const migrate = useNotificationPreferencesStore.persist.getOptions().migrate!;
    expect(migrate(undefined, 0)).toEqual({ mutedTypes: [] });
    expect(migrate({ mutedTypes: "corrupt" }, 0)).toEqual({ mutedTypes: [] });
    expect(migrate({ mutedTypes: ["weekly_summary", "weekly_summary", "hacked", 7, null] }, 0)).toEqual({
      mutedTypes: ["weekly_summary"]
    });
  });
});

describe("라운드 52 C-08 muted 필터는 dedupeKey를 소모하지 않는다", () => {
  it("꺼진 종류만 떨어뜨리고, 아무것도 꺼지지 않았으면 원본 배열 그대로다", () => {
    const candidates = [candidate(), candidate({ type: "weekly_summary", dedupeKey: "weekly:1" })];
    expect(filterMutedNotificationCandidates(candidates, [])).toBe(candidates);
    expect(filterMutedNotificationCandidates(candidates, ["weekly_summary"])).toEqual([candidates[0]]);
    expect(filterMutedNotificationCandidates(candidates, ["budget_80", "weekly_summary"])).toEqual([]);
  });

  it("걸러진 후보는 dedupe 메모리에 닿지 않는다(다시 켜면 그 달 알림을 그대로 받는다)", () => {
    const weekly = candidate({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" });
    const muted = filterMutedNotificationCandidates([weekly], ["weekly_summary"]);
    const afterMutedEvaluation = addNotifications([], [], muted, NOW);
    expect(afterMutedEvaluation.entries).toEqual([]);
    // 여기가 계약이다: 키가 남지 않는다.
    expect(afterMutedEvaluation.seenDedupeKeys).toEqual([]);

    // 사용자가 다시 켠 뒤의 평가 -- 같은 후보가 평소대로 발화한다.
    const afterUnmute = addNotifications(
      afterMutedEvaluation.entries,
      afterMutedEvaluation.seenDedupeKeys,
      filterMutedNotificationCandidates([weekly], []),
      NOW + 1000
    );
    expect(afterUnmute.entries.map((entry) => entry.dedupeKey)).toEqual(["weekly_summary:child-1:2026-W34"]);
  });
});

describe("라운드 52 C-08 스토어 배선", () => {
  beforeEach(() => {
    useNotificationPreferencesStore.getState().enableAll();
    useNotificationStore.getState().resetAll();
  });

  it("setTypeEnabled(false)가 ingest를 막고, 다시 켜면 같은 후보가 들어온다", () => {
    const weekly = candidate({ type: "weekly_summary", dedupeKey: "weekly_summary:child-1:2026-W34" });

    useNotificationPreferencesStore.getState().setTypeEnabled("weekly_summary", false);
    expect(useNotificationPreferencesStore.getState().mutedTypes).toEqual(["weekly_summary"]);
    useNotificationStore.getState().ingest([weekly, candidate()], NOW);
    // 예산 알림은 그대로 들어오고, 꺼 둔 주간 요약만 빠진다.
    expect(useNotificationStore.getState().entries.map((entry) => entry.type)).toEqual(["budget_80"]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("weekly_summary:child-1:2026-W34");

    useNotificationPreferencesStore.getState().setTypeEnabled("weekly_summary", true);
    expect(useNotificationPreferencesStore.getState().mutedTypes).toEqual([]);
    useNotificationStore.getState().ingest([weekly], NOW + 1000);
    expect(useNotificationStore.getState().entries.map((entry) => entry.type)).toEqual([
      "weekly_summary",
      "budget_80"
    ]);
  });

  it("persist 관례가 저장소의 다른 스토어와 같다(이름·버전·방어적 migrate/merge)", () => {
    const storeSource = source("src/notifications/notification-preferences.store.ts");
    expect(storeSource).toContain('name: "wooriai-notification-preferences"');
    expect(storeSource).toContain("createJSONStorage(() => persistStorage)");
    expect(storeSource).toContain("version: 1");
    expect(storeSource).toContain("migrate: (persisted) => sanitizedState(persisted)");
    expect(storeSource).toContain("merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })");
  });
});

describe("라운드 52 C-08 화면·훅 배선 (source verification -- 화면은 vitest에서 렌더하지 않는 관례)", () => {
  it("필터는 ingest의 유일한 유입구에, addNotifications보다 앞에 걸린다", () => {
    const storeSource = source("src/notifications/notification.store.ts");
    expect(storeSource).toContain("filterMutedNotificationCandidates(candidates, useNotificationPreferencesStore.getState().mutedTypes)");
    const ingestBlock = storeSource.slice(
      storeSource.indexOf("ingest: (candidates, now = Date.now())"),
      storeSource.indexOf("markAllRead: (now = Date.now())")
    );
    // 필터 결과가 addNotifications의 인자다 -- 걸러진 후보는 dedupe 메모리를 볼 수 없다.
    expect(ingestBlock).toContain("addNotifications(");
    expect(ingestBlock.indexOf("addNotifications(")).toBeLessThan(
      ingestBlock.indexOf("filterMutedNotificationCandidates(")
    );
  });

  it("홈 평가 훅은 두 저장소가 모두 rehydrate된 뒤에만 평가한다", () => {
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    // 기존 계약(NOTI-102)은 그대로 남아 있어야 한다.
    expect(hookSource).toContain("useNotificationStore.persist.hasHydrated()");
    expect(hookSource).toContain("useNotificationStore.persist.onFinishHydration");
    // C-08: 설정 스토어도 함께 기다린다 -- 아니면 꺼 둔 알림이 콜드 스타트마다 한 번 새어 나가고
    // 그 dedupeKey까지 소모된다.
    expect(hookSource).toContain("useNotificationPreferencesStore.persist.hasHydrated()");
    expect(hookSource).toContain("useNotificationPreferencesStore.persist.onFinishHydration");
  });

  /**
   * 라운드 52 QA P3-5 — 그 대기가 **영원히** 풀리지 않는 기기.
   *
   * zustand persist는 저장소 읽기가 실패하거나 저장본이 깨졌을 때 onFinishHydration을 부르지도,
   * hasHydrated를 세우지도 않는다. 밸브가 없으면 이 앱에서 알림이 만들어지는 **유일한 자리**가
   * 조용히 멎어, 예산 초과조차 알려주지 못한 채 알림함이 그냥 비어 있게 된다.
   */
  it("rehydrate가 끝나지 않아도 3초 뒤에는 평가가 진행된다(muted 기본값 = 전부 켬)", async () => {
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    // app/index.tsx의 두 밸브와 같은 상수·같은 규율(3초).
    expect(hookSource).toContain("export const NOTIFICATION_HYDRATION_VALVE_MS = 3000;");
    expect(hookSource).toContain("const valve = setTimeout(evaluate, NOTIFICATION_HYDRATION_VALVE_MS);");
    // 언마운트/재실행 시 타이머를 반드시 정리한다(사라진 화면에서 평가가 깨어나지 않게).
    expect(hookSource).toContain("clearTimeout(valve);");
    // 밸브가 열린 뒤 늦게 도착한 rehydrate 콜백이 같은 평가를 두 번 돌리지 않는다.
    expect(hookSource).toContain("let evaluated = false;");
    expect(hookSource).toContain("if (evaluated) return;");

    const { NOTIFICATION_HYDRATION_VALVE_MS } = await import("./useHomeNotificationEvaluation");
    expect(NOTIFICATION_HYDRATION_VALVE_MS).toBe(3000);

    // 밸브가 열렸을 때 읽히는 muted 목록은 **스토어의 기본값**이다 -- 새 판단을 지어내지 않고,
    // 그 기본값이 "전부 켬"이라는 사실은 이 파일의 다른 테스트가 이미 고정한다.
    expect(useNotificationPreferencesStore.getInitialState().mutedTypes).toEqual([]);
  });

  it("설정 화면이 5종 스위치를 푸시 카드 위에 그린다", () => {
    const screenSource = source("app/settings/notifications.tsx");
    expect(screenSource).toContain("NOTIFICATION_TYPE_OPTIONS.map((option)");
    expect(screenSource).toContain("setNotificationTypeEnabled(option.type, next)");
    expect(screenSource).toContain("isNotificationTypeEnabled(mutedNotificationTypes, option.type)");
    // 라벨·설명을 화면이 다시 적지 않는다(단일 소스).
    for (const option of NOTIFICATION_TYPE_OPTIONS) {
      expect(screenSource, `${option.type} 라벨을 화면이 손으로 적지 않는다`).not.toContain(option.label);
    }
    // 섹션은 푸시 카드보다 위에 있다(지금 켤 수 없는 것보다 지금 끌 수 있는 것이 먼저).
    expect(screenSource.indexOf("앱 알림함</Text>")).toBeGreaterThan(-1);
    expect(screenSource.indexOf("앱 알림함</Text>")).toBeLessThan(screenSource.indexOf("푸시 알림</Text>"));
    // A11Y: 스위치마다 한국어 라벨 + 역할 + 상태.
    expect(screenSource).toContain("accessibilityLabel={option.label}");
    expect(screenSource).toContain("accessibilityState={{ checked: enabled }}");
    // 정직한 푸시 비활성 안내는 그대로 남아 있다.
    expect(screenSource).toContain("앱 업데이트 후 사용할 수 있어요");
  });

  it("홈의 예산 경고 배너는 이 설정과 무관하다(같은 사실을 두 층에서 끄지 않는다)", () => {
    // 필터는 알림 '생성'에만 걸린다 -- 홈 화면은 이 스토어를 아예 모른다.
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).not.toContain("notification-preferences.store");
    expect(homeSource).not.toContain("mutedTypes");
  });
});
