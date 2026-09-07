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
// 라운드 106 T7: 설명이 약속하는 것을 **실제 판정 함수**에 물어 대조한다(문자열끼리 맞추면
// 판정이 바뀌어도 테스트가 그대로 통과한다 — 그 자리가 이 라운드가 고친 결함이다).
import { budgetNotifications, recordGapNotification } from "./generators";
import { SEOUL_UTC_OFFSET_MS } from "./iso-week";
import { stagePreviewD7Notification, type StagePreviewD7Input } from "./stage-preview-d7";

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
  it("설정 화면의 7종은 generators가 만드는 종류와 1:1이고 순서가 고정돼 있다", () => {
    // GAP-054 #6: record_gap이 목록 끝에 합류했다 -- 새 종류는 기본 켬으로 들어오고(저장
    // 형태가 "꺼진 것들"이라) 사용자는 이 스위치로 끌 수 있다.
    // GAP-066 #8: monthly_wrapup(지난달 정리)이 같은 방식으로 그 뒤에 합류했다.
    expect(NOTIFICATION_TYPE_OPTIONS.map((option) => option.type)).toEqual([
      "budget_80",
      "budget_100",
      "stage_transition",
      "purchase_pending",
      "weekly_summary",
      "record_gap",
      "monthly_wrapup"
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

/**
 * 라운드 106 T7 — **스위치가 약속하는 것과 실제로 오는 것의 대조.**
 *
 * 이 파일은 지금까지 설명의 **형식**만 봤다(비어 있지 않다 · 해요체로 끝난다). 그런데 설정
 * 화면에서 사용자가 읽는 것은 형식이 아니라 **약속**이고, 이 저장소는 허위 표시를 계약으로
 * 금지한다. 그래서 두 자리를 값으로 묶는다 — 둘 다 "설명은 한 가지를 말하는데 판정은 다른
 * 것을 한다"였던 자리다.
 *
 * 숫자·이름을 이 테스트가 손으로 적지 않는 것이 요지다: 창의 일수는 판정 함수를 세어서 얻고,
 * 옆 스위치의 이름은 목록에서 읽는다. 판정이나 라벨이 바뀌면 설명이 여기서 걸린다.
 */
describe("라운드 106 T7 설명 ↔ 실제 발화 대조", () => {
  /** 생후 6→7개월(밴드 "0-6개월" → "6-12개월") 경계가 2026-08-10인 아이 — D-7 짝 테스트와 같은 픽스처. */
  const bornPreviewBase: StagePreviewD7Input = {
    childId: "child-1",
    childName: "다온이",
    stageMode: "born",
    birthDate: "2026-01-10",
    dueDate: null,
    todayIso: "2026-08-03"
  };

  it("'시기 변화 알림'은 전환 당일뿐 아니라 D-7 예고까지 끈다 — 설명이 그 창을 말한다", () => {
    const option = NOTIFICATION_TYPE_OPTIONS.find((entry) => entry.type === "stage_transition")!;

    // 예고도 같은 종류라, 이 스위치 하나가 둘을 함께 끈다(stage-preview-d7.ts의 종류 재사용).
    const preview = stagePreviewD7Notification(bornPreviewBase)!;
    expect(preview.type).toBe("stage_transition");
    expect(filterMutedNotificationCandidates([preview], ["stage_transition"])).toEqual([]);

    // 창의 상한을 **판정에서 센다**. 전환일(8월 10일)에서 하루씩 거슬러 올라가며 마지막으로
    // 서는 날이 곧 설명이 말해야 하는 일수다 — 숫자를 여기에 손으로 적지 않는다.
    let windowDays = 0;
    for (let daysUntil = 1; daysUntil <= 9; daysUntil += 1) {
      const todayIso = `2026-08-${String(10 - daysUntil).padStart(2, "0")}`;
      if (stagePreviewD7Notification({ ...bornPreviewBase, todayIso })) windowDays = daysUntil;
    }
    expect(windowDays).toBeGreaterThan(0);
    expect(option.description, "설명이 예고 창을 말한다").toContain(`${windowDays}일`);
  });

  it("'기록 리마인더'가 세는 축은 기록한 시각이 아니라 지출 날짜다 — 설명이 그 축을 말한다", () => {
    const option = NOTIFICATION_TYPE_OPTIONS.find((entry) => entry.type === "record_gap")!;
    // 서울 8월 10일에 평가하면, 마지막 **지출 날짜**가 8월 1일인 것만으로 발화한다 — 그 행을
    // 오늘 적었는지 여부는 판정의 입력에 아예 없다(라운드 54 P1-3).
    const candidate = recordGapNotification({
      childId: "child-1",
      lastRecordedOn: "2026-08-01",
      now: Date.UTC(2026, 7, 10, 12) - SEOUL_UTC_OFFSET_MS
    })!;
    expect(candidate.title).toBe("마지막 지출 기록이 9일 전이에요");
    // 제목이 말하는 축("마지막 지출")을 설명도 말한다.
    expect(option.description).toContain("마지막 지출");
  });

  it("'예산 80% 알림'은 100%를 넘어선 달에 서지 않는다 — 설명이 대신 서는 스위치를 가리킨다", () => {
    const eighty = NOTIFICATION_TYPE_OPTIONS.find((entry) => entry.type === "budget_80")!;
    const hundred = NOTIFICATION_TYPE_OPTIONS.find((entry) => entry.type === "budget_100")!;

    // 한 번의 지출로 80% 아래에서 100%를 넘어서면 후보는 budget_100 하나뿐이다.
    const jumped = budgetNotifications({
      childId: "child-1",
      yearMonth: "2026-08",
      budgetKrw: 1_000_000,
      spentKrw: 1_050_000
    });
    expect(jumped.map((entry) => entry.type)).toEqual(["budget_100"]);

    // 그래서 100% 알림만 꺼 둔 사용자는 80% 스위치를 켜 둔 채로 그 달에 아무것도 받지 못한다.
    expect(filterMutedNotificationCandidates(jumped, ["budget_100"])).toEqual([]);
    // 설명이 그 사실을 말하고, 갈 곳을 **옆 스위치의 이름으로** 가리킨다(라벨은 목록에서 읽는다).
    expect(eighty.description).toContain(hundred.label);
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
    // 라운드 99 F5(L-1)로 가드의 뜻이 좁아졌다: evaluated는 초기 경로·밸브 사이의 중복만 거르고,
    // rehydrate 완료 콜백은 가드를 지나지 않고 한 번 더 평가한다(늦은 rehydrate의 merge가 밸브
    // 평가의 ingest를 덮는 자리 — 상세·근거는 useHomeNotificationEvaluation.test.ts).
    expect(hookSource).toContain("let evaluated = false;");
    expect(hookSource).toContain("if (evaluated) return;");
    expect(hookSource).toContain("if (storesHydrated()) runEvaluation();");

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
