import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildNextStagePreview } from "../items/next-stage-preview";
import { objectParticle, subjectParticle } from "../text/korean-particles";
import { evaluateHomeNotifications } from "./generators";
import { SEOUL_UTC_OFFSET_MS } from "./iso-week";
import { notificationTapRoute } from "./notification-route";
import { NOTIFICATION_TYPE_OPTIONS, useNotificationPreferencesStore } from "./notification-preferences.store";
import { useNotificationStore } from "./notification.store";
import { stagePreviewD7DedupeKey, stagePreviewD7Notification, type StagePreviewD7Input } from "./stage-preview-d7";

/**
 * 토스 이월 해소 트랙 T-F — 시기 전환 D-7 예고 인앱 알림.
 *
 * 고정하는 계약 다섯:
 *  1. 전환이 7일 이내로 들어온 때만 선다 — D-7은 서고 D-8은 서지 않으며, 당일(D-0)·지난 날은
 *     배너 판정 그대로 침묵한다.
 *  2. 판정은 next-stage-preview를 **소비**한다(복제 0건) — 임신 예외(리뷰 H-1)까지 그대로.
 *  3. 같은 전환에 1회만(dedupeKey = childId + 전환 시작일 — 오늘/D-N을 담지 않는다).
 *  4. 문구는 해요체(DNC-018)·중립적 준비 안내(DNC-020)이고, 아이 이름 인접 조사는 값에서 고른다.
 *  5. standalone 패리티: 순수 함수(시계 주입·요청 0건) — 서버 신규 엔드포인트 0건.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 서울(KST) 달력의 그 날짜·시각에 해당하는 epoch ms. */
const kst = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
  Date.UTC(year, month1 - 1, day, hour, minute) - SEOUL_UTC_OFFSET_MS;

/** 생후 6→7개월(밴드 "0-6개월" → "6-12개월") 경계가 2026-08-10인 아이 — 배너 테스트와 같은 픽스처. */
const bornBase: StagePreviewD7Input = {
  childId: "child-1",
  childName: "다온이",
  stageMode: "born",
  birthDate: "2026-01-10",
  dueDate: null,
  todayIso: "2026-08-03"
};

/** 출산 예정일이 2026-09-15인 임신 중 아이. */
const pregnantBase: StagePreviewD7Input = {
  childId: "child-1",
  childName: "튼튼",
  stageMode: "pregnant",
  dueDate: "2026-09-15",
  birthDate: null,
  todayIso: "2026-09-08"
};

describe("트랙 T-F: D-7 경계 (정확히 7일 / 8일 / 당일 / 지난 날)", () => {
  it("정확히 D-7에 선다 — 전환 날짜·밴드·아이를 담은 스냅숏 한 건", () => {
    expect(stagePreviewD7Notification(bornBase)).toEqual({
      type: "stage_transition",
      title: "『다온이』가 8월 10일에 6-12개월 시기에 들어서요.",
      body: "6-12개월 준비물을 미리 확인해 보세요.",
      dedupeKey: "stage_transition_d7:child-1:2026-08-10",
      childId: "child-1"
    });
  });

  it("D-8에는 아직 서지 않는다 (배너의 14일 창 안이어도 알림 창은 7일이다)", () => {
    // 같은 날 배너는 이미 서 있다 — 창이 갈리는 것은 이 알림 쪽 규칙 하나뿐임을 함께 문다.
    expect(
      buildNextStagePreview({
        stageMode: "born",
        birthDate: "2026-01-10",
        dueDate: null,
        todayIso: "2026-08-02",
        selectedBand: "0-6개월",
        celebrationVisible: false
      })?.daysUntil
    ).toBe(8);
    expect(stagePreviewD7Notification({ ...bornBase, todayIso: "2026-08-02" })).toBeNull();
  });

  it("D-1에도 서고, 키는 D-7과 같다 (키에 오늘이 들어 있지 않다)", () => {
    const d1 = stagePreviewD7Notification({ ...bornBase, todayIso: "2026-08-09" });
    expect(d1?.dedupeKey).toBe(stagePreviewD7Notification(bornBase)?.dedupeKey);
    expect(d1?.dedupeKey).toBe(stagePreviewD7DedupeKey("child-1", "2026-08-10"));
  });

  it("전환 당일과 지난 날에는 서지 않는다 (그날부터는 stage_transition 알림의 자리다)", () => {
    expect(stagePreviewD7Notification({ ...bornBase, todayIso: "2026-08-10" })).toBeNull();
    expect(stagePreviewD7Notification({ ...bornBase, todayIso: "2026-08-11" })).toBeNull();
  });

  it("문구에 시점어가 없다 — 목록에 얼어붙어도 참인 문장이다 (monthly_wrapup의 규칙 그대로)", () => {
    const candidate = stagePreviewD7Notification(bornBase)!;
    for (const word of ["곧", "오늘", "지금", "이번 주", "D-"]) {
      expect(candidate.title, word).not.toContain(word);
      expect(candidate.body, word).not.toContain(word);
    }
  });
});

describe("트랙 T-F: 판정 재사용 — next-stage-preview가 낸 답만 쓴다", () => {
  it("배너 판정과 날마다 같은 답이다 (7일 안이면 같은 전환, 밖이면 침묵)", () => {
    // 억제 없는 순수 판정을 얻으려고 목적지와 다른 칩을 넘긴다(배너 테스트의 관례).
    for (let day = 25; day <= 31; day += 1) {
      compareWithBanner(`2026-07-${String(day).padStart(2, "0")}`);
    }
    for (let day = 1; day <= 11; day += 1) {
      compareWithBanner(`2026-08-${String(day).padStart(2, "0")}`);
    }
  });

  function compareWithBanner(todayIso: string) {
    const banner = buildNextStagePreview({
      stageMode: "born",
      birthDate: "2026-01-10",
      dueDate: null,
      todayIso,
      selectedBand: "24개월+",
      celebrationVisible: false
    });
    const candidate = stagePreviewD7Notification({ ...bornBase, todayIso });
    if (banner === null || banner.daysUntil > 7) {
      expect(candidate, todayIso).toBeNull();
      return;
    }
    expect(candidate, todayIso).not.toBeNull();
    expect(candidate!.dedupeKey, todayIso).toBe(stagePreviewD7DedupeKey("child-1", banner.startDateIso));
    expect(candidate!.body, todayIso).toContain(banner.band);
  }

  it("월말 생일의 경계도 도메인 산술 그대로다 (1월 31일생의 7개월 경계는 8월 31일)", () => {
    const candidate = stagePreviewD7Notification({ ...bornBase, birthDate: "2026-01-31", todayIso: "2026-08-25" });
    expect(candidate?.title).toBe("『다온이』가 8월 31일에 6-12개월 시기에 들어서요.");
    expect(candidate?.dedupeKey).toBe("stage_transition_d7:child-1:2026-08-31");
  });

  it("수동 단계·모르는 값·날짜 형식 오류는 배너와 같이 침묵한다 (지어내지 않는다)", () => {
    expect(stagePreviewD7Notification({ ...bornBase, stageMode: "manual" })).toBeNull();
    expect(stagePreviewD7Notification({ ...bornBase, stageMode: undefined })).toBeNull();
    expect(stagePreviewD7Notification({ ...bornBase, stageMode: "unknown" })).toBeNull();
    expect(stagePreviewD7Notification({ ...bornBase, birthDate: null })).toBeNull();
    expect(stagePreviewD7Notification({ ...bornBase, birthDate: "not-a-date" })).toBeNull();
    expect(stagePreviewD7Notification({ ...bornBase, todayIso: "언젠가" })).toBeNull();
    expect(stagePreviewD7Notification({ ...pregnantBase, dueDate: "2026-9-15" })).toBeNull();
  });
});

describe("트랙 T-F: 임신 예외 (리뷰 H-1 그대로)", () => {
  it("임신 갈래는 D-7에 선다 — 목적지 밴드가 기본 칩과 같아도 (밴드 동일성 억제의 예외)", () => {
    expect(stagePreviewD7Notification(pregnantBase)).toEqual({
      type: "stage_transition",
      title: "『튼튼』을 만날 예정일이 9월 15일이에요.",
      body: "0-6개월 준비물을 미리 확인해 보세요.",
      dedupeKey: "stage_transition_d7:child-1:2026-09-15",
      childId: "child-1"
    });
  });

  it("임신 갈래도 창은 같다 — D-8·당일·지난 뒤에는 서지 않는다", () => {
    expect(stagePreviewD7Notification({ ...pregnantBase, todayIso: "2026-09-07" })).toBeNull();
    expect(stagePreviewD7Notification({ ...pregnantBase, todayIso: "2026-09-15" })).toBeNull();
    expect(stagePreviewD7Notification({ ...pregnantBase, todayIso: "2026-09-16" })).toBeNull();
  });

  it("문구는 중립적 준비 안내만이다 (DNC-020 — 의료·발달 정보 0글자, 구매 재촉 0글자)", () => {
    for (const candidate of [stagePreviewD7Notification(pregnantBase)!, stagePreviewD7Notification(bornBase)!]) {
      for (const word of ["병원", "진료", "검진", "발달", "성장", "구매", "할인", "사세요"]) {
        expect(candidate.title, word).not.toContain(word);
        expect(candidate.body, word).not.toContain(word);
      }
    }
  });
});

describe("트랙 T-F: 아이 이름 인접 조사는 값에서 갈린다", () => {
  it("출생 갈래 주격: 받침 있는 이름은 『지훈』이, 없는 이름은 『서아』가", () => {
    expect(stagePreviewD7Notification({ ...bornBase, childName: "지훈" })?.title).toBe(
      "『지훈』이 8월 10일에 6-12개월 시기에 들어서요."
    );
    expect(stagePreviewD7Notification({ ...bornBase, childName: "서아" })?.title).toBe(
      "『서아』가 8월 10일에 6-12개월 시기에 들어서요."
    );
  });

  it("임신 갈래 목적격: 받침 있는 이름은 『튼튼』을, 없는 이름은 『서아』를", () => {
    expect(stagePreviewD7Notification({ ...pregnantBase, childName: "튼튼" })?.title).toContain("『튼튼』을");
    expect(stagePreviewD7Notification({ ...pregnantBase, childName: "서아" })?.title).toContain("『서아』를");
  });

  it("판정은 korean-particles 한 벌이다 (여기서 받침 규칙을 다시 적지 않는다)", () => {
    for (const name of ["지훈", "서아", "튼튼", "다온이", "Ben"]) {
      expect(stagePreviewD7Notification({ ...bornBase, childName: name })?.title).toContain(
        `『${name}』${subjectParticle(name)} `
      );
      expect(stagePreviewD7Notification({ ...pregnantBase, childName: name })?.title).toContain(
        `『${name}』${objectParticle(name)} `
      );
    }
  });
});

describe("트랙 T-F: 홈 평가 합류 · 멱등 (스토어 통합)", () => {
  const ingest = (now: number, stagePreviewSource?: { stageMode: unknown; dueDate?: unknown; birthDate?: unknown }) =>
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({
        child: { id: "child-1", nickname: "다온이", stageLabel: "0-6개월" },
        monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
        lastSeenStageLabel: "0-6개월",
        followupEntries: [],
        now,
        weekly: null,
        stagePreviewSource
      }),
      now
    );
  const bornSource = { stageMode: "born", birthDate: "2026-01-10", dueDate: null };
  const previewEntries = () =>
    useNotificationStore.getState().entries.filter((entry) => entry.dedupeKey.startsWith("stage_transition_d7:"));

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
    useNotificationPreferencesStore.getState().enableAll();
  });

  it("같은 평가 한 번에 합류하고, 단계 입력을 넘기지 않는 호출부는 종전과 한 글자도 다르지 않다", () => {
    expect(
      evaluateHomeNotifications({
        child: { id: "child-1", nickname: "다온이", stageLabel: "0-6개월" },
        monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
        lastSeenStageLabel: "0-6개월",
        followupEntries: [],
        now: kst(2026, 8, 3),
        weekly: null
      })
    ).toEqual([]);
    ingest(kst(2026, 8, 3), bornSource);
    expect(previewEntries()).toHaveLength(1);
    expect(previewEntries()[0].title).toBe("『다온이』가 8월 10일에 6-12개월 시기에 들어서요.");
  });

  it("같은 전환은 D-7~D-1 사이 몇 번을 재평가해도 1건이다 (멱등 키 = childId + 전환 시작일)", () => {
    ingest(kst(2026, 8, 3), bornSource);
    ingest(kst(2026, 8, 6), bornSource);
    ingest(kst(2026, 8, 9), bornSource);
    expect(previewEntries()).toHaveLength(1);
    expect(useNotificationStore.getState().seenDedupeKeys).toContain("stage_transition_d7:child-1:2026-08-10");
  });

  it("전환일이 달라지면 새 사실로 다시 선다 (예정일 수정 — 키가 시작일에서 갈린다)", () => {
    ingest(kst(2026, 9, 8), { stageMode: "pregnant", dueDate: "2026-09-15", birthDate: null });
    ingest(kst(2026, 9, 11), { stageMode: "pregnant", dueDate: "2026-09-18", birthDate: null });
    expect(previewEntries().map((entry) => entry.dedupeKey)).toEqual([
      "stage_transition_d7:child-1:2026-09-18",
      "stage_transition_d7:child-1:2026-09-15"
    ]);
  });

  it("오늘은 서울 달력에서 나온다 — now 하나를 주입받고 시계를 읽지 않는다", () => {
    // KST 8월 3일 00:30 = UTC 8월 2일 15:30. UTC로 판정하면 아직 D-8이라 서지 않는다 —
    // 서는 것 자체가 서울 파생의 증거다(monthly_wrapup의 달 경계 테스트와 같은 방식).
    ingest(kst(2026, 8, 3, 0, 30), bornSource);
    expect(previewEntries()).toHaveLength(1);
  });

  it("설정의 '시기 변화 알림' 스위치가 예고까지 함께 끈다 — 끈 동안 키를 소모하지 않는다", () => {
    // 새 종류를 세우지 않고 stage_transition을 재사용하는 근거: 같은 주제(시기 변화)를 두
    // 스위치로 쪼개지 않고, 저장본 검증(VALID_TYPES)·아이콘 맵·목적지 관례를 그대로 얻는다.
    expect(NOTIFICATION_TYPE_OPTIONS.some((option) => option.type === "stage_transition")).toBe(true);
    useNotificationPreferencesStore.getState().setTypeEnabled("stage_transition", false);
    ingest(kst(2026, 8, 3), bornSource);
    expect(previewEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("stage_transition_d7:child-1:2026-08-10");
    useNotificationPreferencesStore.getState().setTypeEnabled("stage_transition", true);
    ingest(kst(2026, 8, 4), bornSource);
    expect(previewEntries()).toHaveLength(1);
  });

  it("실제 전환 알림(stage_transition)과 키가 겹치지 않는다 — 예고 뒤에 전환도 평소대로 뜬다", () => {
    ingest(kst(2026, 8, 3), bornSource);
    // 8월 10일: 시기 라벨이 실제로 갈리면 기존 stage_transition이 자기 키로 발화한다.
    useNotificationStore.getState().ingest(
      evaluateHomeNotifications({
        child: { id: "child-1", nickname: "다온이", stageLabel: "6-12개월" },
        monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
        lastSeenStageLabel: "0-6개월",
        followupEntries: [],
        now: kst(2026, 8, 10),
        weekly: null,
        stagePreviewSource: bornSource
      }),
      kst(2026, 8, 10)
    );
    const stageEntries = useNotificationStore.getState().entries.filter((entry) => entry.type === "stage_transition");
    expect(stageEntries.map((entry) => entry.dedupeKey)).toEqual([
      "stage_transition:child-1:6-12개월",
      "stage_transition_d7:child-1:2026-08-10"
    ]);
  });
});

describe("트랙 T-F: 목적지 · standalone 패리티 (서버 신규 엔드포인트 0건)", () => {
  it("탭하면 준비템 탭으로 간다 (stage_transition의 목적지 관례 그대로)", () => {
    const candidate = stagePreviewD7Notification(bornBase)!;
    expect(notificationTapRoute({ type: candidate.type, dedupeKey: candidate.dedupeKey })).toBe("/(tabs)/items");
    // 키 접두가 갈려도 헛읽는 자리가 없다 — 키를 파싱하는 목적지는 purchase/monthly 둘뿐이다.
    expect(notificationTapRoute({ type: candidate.type, dedupeKey: candidate.dedupeKey }, 3, "2026-08-03")).toBe(
      "/(tabs)/items"
    );
  });

  it("판정 모듈은 순수하다 — 시계·요청·화면 import 0건, 판정 복제 0건, export const 0건", () => {
    const moduleSource = source("src/notifications/stage-preview-d7.ts");
    // 시계를 읽지 않는다(todayIso 주입 — next-stage-preview와 같은 관례).
    expect(moduleSource).not.toContain("Date.now");
    expect(moduleSource).not.toContain("new Date(");
    // 요청을 내지 않는다: standalone(로컬 백엔드) 세션에서도 실계정과 똑같이 돈다.
    expect(moduleSource).not.toContain("fetch(");
    expect(moduleSource).not.toContain('from "../api');
    expect(moduleSource).not.toContain("react-native");
    // 판정은 import해서 소비한다 — 경계 산술을 옮겨 적지 않는다.
    expect(moduleSource).toContain('} from "../items/next-stage-preview"');
    expect(moduleSource).toContain("buildNextStagePreview({ ...base");
    expect(moduleSource).not.toContain("calculateChildStage");
    expect(moduleSource).not.toContain("bandForStage");
    expect(moduleSource).not.toContain("daysBetween(");
    // 앱 소스 규율: 새 export const 없이 export function만 세운다.
    expect(moduleSource).not.toContain("export const");
  });

  it("홈 평가가 단계 입력을 흘리고 서울 오늘을 now에서 뽑는다 (배선은 값 전달뿐이다)", () => {
    const generatorsSource = source("src/notifications/generators.ts");
    expect(generatorsSource).toContain('import { stagePreviewD7Notification } from "./stage-preview-d7";');
    expect(generatorsSource).toContain("const stagePreviewCandidate = stagePreviewD7Notification({");
    expect(generatorsSource).toContain("todayIso: seoulCalendarDate(input.now)");
    expect(generatorsSource).toContain("if (stagePreviewCandidate) candidates.push(stagePreviewCandidate);");
  });

  it("입력 셋은 로컬 백엔드도 서빙하는 아이 행이다 — 데모/스탠드얼론 세션에서도 같은 판정이 돈다", () => {
    // 판정 입력(stageMode·dueDate·birthDate)은 ["children"] 캐시의 행이고, 로컬 백엔드가 같은
    // 필드를 채워 준다(src/api/local-backend.ts의 LocalChildRecord). 새 엔드포인트는 없다.
    const localBackend = source("src/api/local-backend.ts");
    for (const field of ["stageMode", "dueDate", "birthDate"]) {
      expect(localBackend, field).toContain(field);
    }
    // 저장본 검증(VALID_TYPES)이 이 항목을 살려 둔다 — 재사용한 종류가 목록에 있다.
    expect(source("src/notifications/notification.store.ts")).toContain('"stage_transition"');
  });
});
