import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateHomeNotifications,
  hasPendingRecordsForChild,
  latestRecordedOn,
  recordGapNotification,
  RECORD_GAP_MIN_DAYS
} from "./generators";
import { SEOUL_UTC_OFFSET_MS } from "./iso-week";
import { notificationTapRoute } from "./notification-route";
import {
  NOTIFICATION_TYPE_OPTIONS,
  notificationTypeLabel,
  useNotificationPreferencesStore
} from "./notification-preferences.store";
import { useNotificationStore } from "./notification.store";

/**
 * GAP-054 #6 — 기록 리마인더(record_gap).
 *
 * 고정하는 계약: 3일 공백에 발화 / 주 1회(같은 주 재발화 없음) / 설정에서 끌 수 있고 끈 동안에는
 * dedupeKey를 소모하지 않는다 / 기록이 0건인 신규 사용자에게는 발화하지 않는다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 서울(KST) 달력의 그 날짜·시각에 해당하는 epoch ms. */
const kst = (year: number, month1: number, day: number, hour = 12) =>
  Date.UTC(year, month1 - 1, day, hour) - SEOUL_UTC_OFFSET_MS;

// 2026-08-20(목) KST = 서울 ISO 2026-W34.
const NOW = kst(2026, 8, 20);

describe("GAP-054 #6 record_gap 발화 규칙", () => {
  it("마지막 기록에서 3일 이상 지나면 그 일수를 사실대로 말한다", () => {
    const candidate = recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-08-17", now: NOW });
    expect(candidate).toEqual({
      type: "record_gap",
      title: "마지막 지출 기록이 3일 전이에요",
      body: "기록 탭에서 지난 며칠을 함께 확인해볼까요?",
      dedupeKey: "record_gap:child-1:2026-W34",
      childId: "child-1"
    });
    // 공백이 길면 길다고 말한다(지어내지 않고 실제 일수를 센다).
    expect(recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-08-10", now: NOW })!.title).toBe(
      "마지막 지출 기록이 10일 전이에요"
    );
  });

  it("경계: 2일까지는 조용하고 3일부터 말한다", () => {
    expect(RECORD_GAP_MIN_DAYS).toBe(3);
    // 오늘(2026-08-20) 기준 어제·그저께는 아직 공백이 아니다.
    for (const lastRecordedOn of ["2026-08-20", "2026-08-19", "2026-08-18"]) {
      expect(recordGapNotification({ childId: "child-1", lastRecordedOn, now: NOW }), lastRecordedOn).toBeNull();
    }
    expect(recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-08-17", now: NOW })).not.toBeNull();
    // 달·해를 건너뛰는 공백도 달력으로 센다.
    expect(recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-07-31", now: NOW })!.title).toBe(
      "마지막 지출 기록이 20일 전이에요"
    );
  });

  it("기록이 하나도 없는 신규 사용자에게는 발화하지 않는다(첫 기록 유도는 홈 카드의 몫)", () => {
    expect(recordGapNotification({ childId: "child-1", lastRecordedOn: null, now: NOW })).toBeNull();
    // 호출부가 값을 넘기지 않은 경우(판정 불가)도 같다.
    expect(recordGapNotification({ childId: "child-1", now: NOW })).toBeNull();
  });

  it("미래 날짜·깨진 날짜에는 말하지 않는다", () => {
    expect(recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-08-25", now: NOW })).toBeNull();
    for (const broken of ["2026-08", "20260817", "2026-02-31", "어제"]) {
      expect(recordGapNotification({ childId: "child-1", lastRecordedOn: broken, now: NOW }), broken).toBeNull();
    }
  });

  /**
   * GAP-054 라운드 54 P1-3 (a) — 이 기기에 아직 올라가지 않은 기록이 있으면 침묵한다.
   *
   * 이 알림의 유일한 입력(`/home`의 최신 3건)은 오프라인 대기 행을 모른다. 며칠째 연결 없이
   * 로컬로만 적어 온 사용자에게 "마지막 지출 기록이 N일 전"이라고 말하면 방금 적은 기록을
   * 앱이 통째로 부정하는 셈이다.
   */
  it("오프라인 대기 행이 하나라도 있으면 발화하지 않는다", () => {
    const base = { childId: "child-1", lastRecordedOn: "2026-08-10", now: NOW };
    // 억제가 없으면 뜨는 상황이라는 것을 먼저 못박는다.
    expect(recordGapNotification(base)).not.toBeNull();
    expect(recordGapNotification({ ...base, hasPendingLocalRecords: true })).toBeNull();
    // false·미지정은 종전 동작 그대로다.
    expect(recordGapNotification({ ...base, hasPendingLocalRecords: false })).not.toBeNull();
  });

  it("억제 판정은 이 아이의 미동기화 행만 본다 (다른 아이·이미 동기화된 행은 세지 않는다)", () => {
    const row = (childId: string, syncState: string) => ({ childId, syncState });
    expect(hasPendingRecordsForChild([row("child-1", "pending")], "child-1")).toBe(true);
    for (const state of ["syncing", "failed", "conflict"]) {
      expect(hasPendingRecordsForChild([row("child-1", state)], "child-1"), state).toBe(true);
    }
    // 이미 서버가 아는 행은 근거가 아니다.
    expect(hasPendingRecordsForChild([row("child-1", "synced")], "child-1")).toBe(false);
    // 다른 아이의 대기 행이 이 아이의 알림을 막지 않는다.
    expect(hasPendingRecordsForChild([row("child-2", "pending")], "child-1")).toBe(false);
    // 모르면(아이 미상·목록 없음) 억제하지 않는다 -- 없는 사실을 만들지 않는다.
    expect(hasPendingRecordsForChild([row("child-1", "pending")], null)).toBe(false);
    expect(hasPendingRecordsForChild(null, "child-1")).toBe(false);
    expect(hasPendingRecordsForChild([null, undefined, {}], "child-1")).toBe(false);
  });

  /**
   * GAP-054 라운드 54 P1-3 (b) — 소급 입력 시나리오에서 문장이 거짓이 되지 않는다.
   *
   * 3주 전 영수증을 오늘 적으면 `lastRecordedOn`은 3주 전 날짜다. 예전 제목
   * ("21일 동안 기록이 없어요")은 방금 기록한 사용자에게 명백한 거짓이었다. 지금 제목은
   * 판정이 실제로 세는 것(지출 날짜)을 말하므로 그 순간에도 참이다.
   */
  it("소급 입력 직후에도 문장이 참이다 — 세는 것은 지출 날짜다", () => {
    const candidate = recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-07-30", now: NOW });
    expect(candidate!.title).toBe("마지막 지출 기록이 21일 전이에요");
    // "기록이 없어요"라는 단언은 더 이상 하지 않는다(방금 적은 사람에게 반박당하는 문장).
    expect(candidate!.title).not.toContain("기록이 없어요");
    // 죄책감·명령형 없이 초대만 한다(DNC-018).
    expect(candidate!.body).toBe("기록 탭에서 지난 며칠을 함께 확인해볼까요?");
    for (const blamed of ["잊", "안 하", "하세요", "해야"]) {
      expect(`${candidate!.title} ${candidate!.body}`, blamed).not.toContain(blamed);
    }
  });

  it("dedupeKey는 아이·서울 ISO 주 단위다(주 1회, 아이별로 따로)", () => {
    const key = (childId: string, now: number) =>
      recordGapNotification({ childId, lastRecordedOn: "2026-08-01", now })!.dedupeKey;
    // 같은 주(월요일~일요일)는 같은 키.
    expect(key("child-1", kst(2026, 8, 17))).toBe("record_gap:child-1:2026-W34");
    expect(key("child-1", kst(2026, 8, 23, 23))).toBe("record_gap:child-1:2026-W34");
    // 월요일 00:00 KST에 다음 주 키로 갈린다.
    expect(key("child-1", kst(2026, 8, 24, 0))).toBe("record_gap:child-1:2026-W35");
    // 아이가 다르면 서로를 억제하지 않는다.
    expect(key("child-2", NOW)).toBe("record_gap:child-2:2026-W34");
  });
});

describe("GAP-054 #6 마지막 기록 날짜 뽑기", () => {
  it("최신 3건 목록에서 가장 늦은 날짜를 고르고, 비어 있으면 null이다", () => {
    expect(latestRecordedOn([])).toBeNull();
    // 정렬 순서에 기대지 않는다.
    expect(
      latestRecordedOn([{ spentOn: "2026-08-11" }, { spentOn: "2026-08-17" }, { spentOn: "2026-08-02" }])
    ).toBe("2026-08-17");
  });

  it("깨진 값은 건너뛰고, 살아 있는 날짜만으로 판단한다", () => {
    expect(latestRecordedOn([null, undefined, { spentOn: null }, { spentOn: "어제" }])).toBeNull();
    expect(latestRecordedOn([{ spentOn: "2026-13-01" }, { spentOn: "2026-08-05" }])).toBe("2026-08-05");
  });
});

describe("GAP-054 #6 기존 알림 평가 경로 합류(새 백그라운드 작업 없음)", () => {
  const home = {
    child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 100_000 },
    lastSeenStageLabel: "24개월",
    followupEntries: [],
    now: NOW,
    weekly: null
  };

  it("같은 평가 한 번에 다른 알림들과 함께 만들어진다", () => {
    const candidates = evaluateHomeNotifications({ ...home, lastRecordedOn: "2026-08-16" });
    expect(candidates.map((candidate) => candidate.type)).toEqual(["weekly_summary", "record_gap"]);
    expect(candidates.at(-1)!.dedupeKey).toBe("record_gap:child-1:2026-W34");
  });

  it("기록이 0건이면(recentExpenses 빈 목록) 그 알림만 빠진다", () => {
    const candidates = evaluateHomeNotifications({ ...home, lastRecordedOn: latestRecordedOn([]) });
    expect(candidates.map((candidate) => candidate.type)).toEqual(["weekly_summary"]);
  });

  it("훅이 홈 스냅샷에서 값을 뽑아 넘긴다 -- 새 요청도 새 구독도 없다", () => {
    const hookSource = source("src/notifications/useHomeNotificationEvaluation.ts");
    expect(hookSource).toContain("lastRecordedOn: latestRecordedOn(home.recentExpenses)");
    // P1-3: 억제 근거도 같은 평가 한 번에 실려 나간다(훅은 offline 모듈을 import하지 않는다).
    expect(hookSource).toContain("hasPendingLocalRecords");
    // 훅은 여전히 offline 모듈을 import하지 않는다(그 모듈이 react-native를 정적으로 끌고
    // 들어와 이 테스트 파일에서 훅을 읽을 수 없게 된다) -- 값은 홈이 계산해 넘긴다.
    expect(hookSource).not.toMatch(/^import .*from "\.\.\/offline\//m);
    // 평가 자리는 종전 그대로다(새 훅·새 타이머·새 백그라운드 작업 없음).
    expect(hookSource).toContain("evaluateHomeNotifications(");
    expect(hookSource).not.toContain("setInterval(");
    expect(hookSource).not.toContain("registerTaskAsync");
    // 홈 화면 호출부는 손대지 않았다(인자 2개 그대로).
    // 라운드 54 P1-3에서 인자가 셋이 됐다 — 세 번째는 홈이 **이미 구독 중인** 스냅샷에서
    // 나온 순수 판정이라, 화면이 새로 부르는 요청·구독은 여전히 0건이다.
    const homeScreen = source("app/(tabs)/index.tsx");
    expect(homeScreen).toContain(
      "const hasPendingLocalRecords = hasPendingRecordsForChild(offlineSyncSnapshot.rows, childId);"
    );
    expect(homeScreen).toContain(
      "useHomeNotificationEvaluation(hasSession ? home.data : undefined, weeklySpendForNotification, hasPendingLocalRecords)"
    );
  });
});

describe("GAP-054 #6 스토어 통합: 주 1회 · 끄기 · 딥링크", () => {
  const ingest = (now: number, lastRecordedOn: string | null) =>
    useNotificationStore
      .getState()
      .ingest(
        evaluateHomeNotifications({
          child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
          monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
          lastSeenStageLabel: "24개월",
          followupEntries: [],
          now,
          weekly: null,
          lastRecordedOn
        }),
        now
      );
  const gapEntries = () => useNotificationStore.getState().entries.filter((entry) => entry.type === "record_gap");

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
    useNotificationPreferencesStore.getState().enableAll();
  });

  it("같은 주에는 몇 번을 평가해도 한 건이고, 다음 주에 한 번 더 온다", () => {
    ingest(NOW, "2026-08-16");
    ingest(NOW, "2026-08-16");
    ingest(kst(2026, 8, 21), "2026-08-16");
    expect(gapEntries()).toHaveLength(1);
    expect(gapEntries()[0]!.title).toBe("마지막 지출 기록이 4일 전이에요");

    // 공백이 이어지면 다음 주에 한 번 더(매일이 아니라 주 1회).
    ingest(kst(2026, 8, 25), "2026-08-16");
    expect(gapEntries().map((entry) => entry.dedupeKey)).toEqual([
      "record_gap:child-1:2026-W35",
      "record_gap:child-1:2026-W34"
    ]);
  });

  it("설정에서 끄면 만들어지지 않고, 그 주의 dedupeKey도 소모되지 않는다", () => {
    useNotificationPreferencesStore.getState().setTypeEnabled("record_gap", false);
    ingest(NOW, "2026-08-16");
    expect(gapEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("record_gap:child-1:2026-W34");

    // 다시 켜면 같은 주에도 평소대로 발화한다("끄기"가 "영구 삭제"가 되지 않는다).
    useNotificationPreferencesStore.getState().setTypeEnabled("record_gap", true);
    ingest(NOW, "2026-08-16");
    expect(gapEntries()).toHaveLength(1);
  });

  /**
   * GAP-054 라운드 54 P1-4 — 알림함 목록에서 이 종류만 아이콘 칸이 비어 행이 어긋나던 자리.
   *
   * 아이콘 맵의 타입(`Record<AppNotification["type"], …>`)은 유니온에 `(string & {})`가 있어
   * 사실상 `Record<string, …>`이라 **컴파일러가 누락을 잡아 주지 않는다.** 그래서 목록을
   * 테스트로 대조한다: 저장본 검증(VALID_TYPES)이 아는 종류는 화면도 전부 알아야 한다.
   */
  it("알림함 아이콘 맵이 저장본 검증 목록의 모든 종류를 안다", () => {
    const screen = source("app/notifications.tsx");
    expect(screen).toContain('record_gap: "time-outline"');

    const storeSource = source("src/notifications/notification.store.ts");
    const validTypesBlock = storeSource.slice(
      storeSource.indexOf("const VALID_TYPES"),
      storeSource.indexOf("];", storeSource.indexOf("const VALID_TYPES"))
    );
    const validTypes = [...validTypesBlock.matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
    expect(validTypes).toEqual([
      "budget_80",
      "budget_100",
      "stage_transition",
      "purchase_pending",
      "weekly_summary",
      "record_gap"
    ]);
    const iconMap = screen.slice(screen.indexOf("const notificationIconByType"));
    for (const type of validTypes) {
      expect(iconMap.slice(0, iconMap.indexOf("};")), type).toContain(`${type}:`);
    }
  });

  it("설정 목록에 이름이 있고, 탭하면 기록 탭 달력으로 간다", () => {
    expect(NOTIFICATION_TYPE_OPTIONS.some((option) => option.type === "record_gap")).toBe(true);
    expect(notificationTypeLabel("record_gap")).toBe("기록 리마인더");
    // 라운드 56 D#10: 목적지는 그대로 기록 탭이고, 거기에 "달력으로 열어 달라"가 실린다 --
    // 이 알림이 가리키는 **빈 며칠**은 리스트에 없는 것이라 달력에서만 보인다.
    expect(notificationTapRoute({ type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" })).toEqual({
      pathname: "/(tabs)/records",
      params: { view: "calendar" }
    });
  });

  it("저장본 검증(sanitize)이 새 종류를 살려 둔다 -- 앱을 다시 열어도 목록에 남는다", () => {
    ingest(NOW, "2026-08-16");
    const stored = useNotificationStore.getState().entries;
    expect(stored).toHaveLength(1);
    // notification.store.ts의 VALID_TYPES에 등록돼 있어야 재수화에서 살아남는다.
    expect(source("src/notifications/notification.store.ts")).toContain('"record_gap"');
  });
});
