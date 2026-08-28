import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateHomeNotifications,
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
      title: "3일 동안 기록이 없어요",
      body: "기록 탭에서 지난 며칠을 함께 확인해볼까요?",
      dedupeKey: "record_gap:child-1:2026-W34",
      childId: "child-1"
    });
    // 공백이 길면 길다고 말한다(지어내지 않고 실제 일수를 센다).
    expect(recordGapNotification({ childId: "child-1", lastRecordedOn: "2026-08-10", now: NOW })!.title).toBe(
      "10일 동안 기록이 없어요"
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
      "20일 동안 기록이 없어요"
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
    // 평가 자리는 종전 그대로다(새 훅·새 타이머·새 백그라운드 작업 없음).
    expect(hookSource).toContain("evaluateHomeNotifications(");
    expect(hookSource).not.toContain("setInterval(");
    expect(hookSource).not.toContain("registerTaskAsync");
    // 홈 화면 호출부는 손대지 않았다(인자 2개 그대로).
    expect(source("app/(tabs)/index.tsx")).toContain(
      "useHomeNotificationEvaluation(hasSession ? home.data : undefined, weeklySpendForNotification)"
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
    expect(gapEntries()[0]!.title).toBe("4일 동안 기록이 없어요");

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

  it("설정 목록에 이름이 있고, 탭하면 기록 탭으로 간다", () => {
    expect(NOTIFICATION_TYPE_OPTIONS.some((option) => option.type === "record_gap")).toBe(true);
    expect(notificationTypeLabel("record_gap")).toBe("기록 리마인더");
    expect(notificationTapRoute({ type: "record_gap", dedupeKey: "record_gap:child-1:2026-W34" })).toBe(
      "/(tabs)/records"
    );
  });

  it("저장본 검증(sanitize)이 새 종류를 살려 둔다 -- 앱을 다시 열어도 목록에 남는다", () => {
    ingest(NOW, "2026-08-16");
    const stored = useNotificationStore.getState().entries;
    expect(stored).toHaveLength(1);
    // notification.store.ts의 VALID_TYPES에 등록돼 있어야 재수화에서 살아남는다.
    expect(source("src/notifications/notification.store.ts")).toContain('"record_gap"');
  });
});
