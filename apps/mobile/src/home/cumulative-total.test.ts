import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cumulativeTotalPendingNotice,
  cumulativeTotalPendingNoticeText,
  CUMULATIVE_TOTAL_SUBTITLE,
  CUMULATIVE_TOTAL_TITLE_PREFIX,
  evaluateHomeCumulativeTotal,
  HOME_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID,
  REPORT_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID,
  type CumulativeTotalPendingRow
} from "./cumulative-total";
import { reportPendingScopeNoticeText } from "../reports/pending-scope-notice";
import { evaluateMilestoneCountdown, milestoneSubtitleShowsTotal } from "./milestone-countdown";

/**
 * 라운드 48 B2 — 홈 누적 총액 카드.
 *
 * 고치는 문제: 홈은 이미 서버에서 전 기간 누적(`totalExpenseKrw`)을 받는데, 그 값을 화면에
 * 내는 곳이 마일스톤 카운트다운 부제 하나뿐이라 임신 단계·manual·첫돌 이후에는 어디에도
 * 나오지 않았다. 이 파일은 (1) 순수 판정, (2) 마일스톤 카드와의 중복 금지가 **실제 마일스톤
 * 모듈의 출력과 맞물리는지**, (3) 홈 배선(세션 게이트·요청 0)을 고정한다.
 */
const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const reportsSource = readFileSync(join(process.cwd(), "app/(tabs)/reports.tsx"), "utf8");

const base = { hasSession: true, totalExpenseKrw: 1_245_700, hasMilestoneCard: false } as const;

describe("B2 누적 총액 카드 판정 (evaluateHomeCumulativeTotal)", () => {
  it("마일스톤 카드가 없는 시기에는 누적 총액을 말한다", () => {
    const card = evaluateHomeCumulativeTotal(base);
    expect(card?.title).toBe("지금까지의 지출 합계 1,245,700원");
    expect(card?.subtitle).toBe("기록을 시작한 뒤의 지출을 모두 더했어요 (선물로 받은 건 제외)");
    expect(card?.accessibilityLabel).toBe(`${card?.title}. ${card?.subtitle}`);
  });

  /**
   * 라운드 48 QA(P2-3) — 문구가 사실과 어긋나지 않는지 못박는다. 금액 자체는 서버 집계를 그대로
   * 쓰므로 여기서 검증할 것은 **그 숫자를 뭐라고 부르는가** 하나다.
   */
  it("라운드 33 F5가 폐기한 '지금까지 함께한 지출'을 되살리지 않는다", () => {
    // 그 표현은 구간을 말하지 않아 마일스톤 리포트의 창 합계와 같은 숫자처럼 읽혔다.
    expect(CUMULATIVE_TOTAL_TITLE_PREFIX).not.toContain("함께한");
    expect(evaluateHomeCumulativeTotal(base)?.title).not.toContain("지금까지 함께한 지출");
  });

  it("부제가 시작점을 지어내지 않는다 — 출산 후 가입·manual 아이에게 '임신 때부터'는 거짓이다", () => {
    expect(CUMULATIVE_TOTAL_SUBTITLE).not.toContain("임신");
    // 확인 가능한 사실만 말한다: 이 앱에 기록을 남기기 시작한 시점부터다.
    expect(CUMULATIVE_TOTAL_SUBTITLE).toContain("기록을 시작한 뒤");
  });

  it("부제가 선물 제외를 숨기지 않는다(DNC-015 — totalExpenseKrw는 expenseType='expense'만 더한다)", () => {
    expect(CUMULATIVE_TOTAL_SUBTITLE).toContain("선물");
    // "전체 합계"라고 말하면 빠진 항목이 있다는 사실이 지워진다.
    expect(CUMULATIVE_TOTAL_SUBTITLE).not.toContain("전체 합계");
  });

  it("마일스톤 카드가 이미 같은 금액을 말하고 있으면 접는다(중복 금지)", () => {
    expect(evaluateHomeCumulativeTotal({ ...base, hasMilestoneCard: true })).toBeNull();
  });

  it("비세션 미리보기에서는 만들지 않는다(HOME-001 픽셀락)", () => {
    expect(evaluateHomeCumulativeTotal({ ...base, hasSession: false })).toBeNull();
  });

  it("누적을 모르면 만들지 않는다 — 0원이라고 말하지 않는다", () => {
    for (const totalExpenseKrw of [null, undefined, Number.NaN]) {
      expect(evaluateHomeCumulativeTotal({ ...base, totalExpenseKrw })).toBeNull();
    }
  });

  it("누적이 0원인 계정에도 만들지 않는다(첫 지출 유도 카드의 자리다)", () => {
    expect(evaluateHomeCumulativeTotal({ ...base, totalExpenseKrw: 0 })).toBeNull();
  });
});

/**
 * GAP-062 #9 — 카드가 **오프라인 대기를 밝힌다.**
 *
 * 고치는 문제: 같은 화면의 히어로 금액은 재조정된 값인데(reconcileMonthlyExpenses) 이 카드는
 * 서버 집계를 그대로 쓴다. 오프라인으로 적은 직후 두 숫자가 서로 다른 시점을 말하는데, 부제는
 * 제외 항목을 밝히면서("선물로 받은 건 제외") 아직 반영되지 않은 기록은 밝히지 않았다.
 * 재집계는 금지다(누적은 전 기간이라 재조정할 모집단이 없다) — 그래서 숫자가 아니라 사실을 밝힌다.
 */
describe("GAP-062 #9 대기 고지", () => {
  const pending = (overrides: Partial<CumulativeTotalPendingRow> = {}): CumulativeTotalPendingRow => ({
    syncState: "pending",
    payload: { expenseType: "expense" },
    ...overrides
  });

  it("대기 행이 없으면 카드는 예전과 한 줄도 다르지 않다", () => {
    expect(evaluateHomeCumulativeTotal(base)?.pendingNotice).toBeNull();
    // 행을 아예 모르는 호출부(옛 배선·픽스처)도 같은 답을 받는다.
    expect(evaluateHomeCumulativeTotal({ ...base, pendingRows: [] })?.pendingNotice).toBeNull();
    expect(evaluateHomeCumulativeTotal(base)?.accessibilityLabel).toBe(
      `${CUMULATIVE_TOTAL_TITLE_PREFIX} 1,245,700원. ${CUMULATIVE_TOTAL_SUBTITLE}`
    );
  });

  it("대기 행이 있으면 이 금액이 그것을 모른다고 밝힌다(숫자는 서버 집계 그대로)", () => {
    const card = evaluateHomeCumulativeTotal({ ...base, pendingRows: [pending(), pending(), pending()] });
    expect(card?.title).toBe("지금까지의 지출 합계 1,245,700원");
    expect(card?.pendingNotice).toBe("동기화 대기 중인 기록 3건은 이 금액에 아직 반영되지 않았어요.");
    // TalkBack은 눈으로 보는 순서 그대로 듣는다(제목 → 부제 → 고지).
    expect(card?.accessibilityLabel).toBe(`${card?.title}. ${card?.subtitle}. ${card?.pendingNotice}`);
  });

  it("이 금액을 움직이지 않는 행(선물·환불)은 세지 않는다 — DNC-015, 합계와 같은 술어", () => {
    const card = evaluateHomeCumulativeTotal({
      ...base,
      pendingRows: [pending({ payload: { expenseType: "gift" } }), pending({ payload: { expenseType: "refund" } })]
    });
    expect(card?.pendingNotice).toBeNull();
    // 구분을 모르는 레거시 행은 종전대로 일반 지출로 센다.
    expect(
      evaluateHomeCumulativeTotal({ ...base, pendingRows: [pending({ payload: null })] })?.pendingNotice
    ).toContain("1건");
  });

  it("이미 반영된 행(synced)은 세지 않는다", () => {
    expect(
      evaluateHomeCumulativeTotal({ ...base, pendingRows: [pending({ syncState: "synced" })] })?.pendingNotice
    ).toBeNull();
  });

  it("삭제 대기·실패·충돌도 '아직 반영되지 않은' 차이라 함께 센다", () => {
    for (const syncState of ["pending", "syncing", "failed", "conflict"]) {
      expect(
        evaluateHomeCumulativeTotal({ ...base, pendingRows: [pending({ syncState })] })?.pendingNotice
      ).toContain("1건");
    }
  });

  it("영구 실패(4xx)가 섞이면 주어에서 '동기화 대기 중인'을 떼고 내역을 덧붙인다(라운드 59 어휘)", () => {
    const card = evaluateHomeCumulativeTotal({
      ...base,
      pendingRows: [
        pending(),
        pending({ syncState: "failed", lastErrorStatus: 400, lastError: "저장할 수 없어요" })
      ]
    });
    expect(card?.pendingNotice).toBe("기록 2건은 이 금액에 아직 반영되지 않았어요. 그중 1건은 보낼 수 없는 기록이에요.");
    // 기다려도 오지 않을 행을 "대기 중"이라고 부르지 않는다.
    expect(card?.pendingNotice).not.toContain("동기화 대기");
  });

  /**
   * 리포트 고지와 **같은 문장**이어야 사용자가 같은 상태를 같은 것으로 읽는다. 갈리는 것은
   * 지시어 하나뿐이다 — 리포트는 화면 아래 숫자들을, 이 카드는 바로 위 제목의 금액을 짚는다.
   */
  it("문장은 리포트 고지와 지시어만 다르다(술어·어휘는 같은 단일 소스)", () => {
    for (const [count, unsendable] of [
      [3, 0],
      [5, 2]
    ] as const) {
      const home = cumulativeTotalPendingNoticeText(count, unsendable);
      const report = reportPendingScopeNoticeText(count, unsendable);
      expect(home).toBe(report.replace("아래 숫자에", "이 금액에"));
      // 세게 말하지 않는다: 이 모집단에는 삭제 대기 행(금액에 아직 들어 있다)이 섞인다.
      expect(home).toContain("아직 반영되지 않았어요");
      expect(home).not.toContain("빠져 있어요");
    }
  });

  it("고지가 화면에 그려진다(0건이면 자리 자체가 없다)", () => {
    expect(homeSource).toContain("cumulativeTotal.pendingNotice ? (");
    expect(homeSource).toContain(`testID={HOME_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID}`);
    expect(HOME_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID).toBe("home-cumulative-total-pending-notice");
    // 행은 이미 구독 중인 스냅샷을 아이로 거른 것 그대로다 -- 새 요청도 새 구독도 없다.
    expect(homeSource).toContain("pendingRows: childOfflineRows");
  });

  it("숫자는 서버 집계 그대로다 — 홈이 누적을 다시 더하지 않는다(재집계 금지)", () => {
    const start = homeSource.indexOf("const cumulativeTotal = evaluateHomeCumulativeTotal({");
    const call = homeSource.slice(start, homeSource.indexOf("});", start));
    expect(call).toContain("totalExpenseKrw: home.data?.totalExpenseKrw ?? null");
    expect(call).not.toContain("reduce(");
  });
});

/**
 * 중복 금지의 **양쪽 끝**을 실제 마일스톤 모듈로 검산한다. 두 모듈이 각자 "부제가 금액을
 * 말하는 조건"을 들고 있으면 언젠가 갈려서, 같은 금액이 홈에 두 번 뜨거나(중복) 기록이 없는
 * 달에는 아무 데도 안 뜬다(구멍).
 */
describe("B2 마일스톤 카드와의 맞물림", () => {
  const BIRTH_DATE = "2026-06-01";
  const milestoneInput = { stageMode: "born", nickname: "다온이", birthDate: BIRTH_DATE } as const;

  it("출생 후 100일 전: 마일스톤이 금액을 말하므로 누적 카드는 접힌다", () => {
    const countdown = evaluateMilestoneCountdown({
      ...milestoneInput,
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_245_700
    });
    expect(countdown?.subtitle).toContain("1,245,700원");
    expect(
      evaluateHomeCumulativeTotal({
        hasSession: true,
        totalExpenseKrw: 1_245_700,
        hasMilestoneCard: countdown !== null
      })
    ).toBeNull();
  });

  it("임신 단계: 마일스톤 카드 자체가 없으므로 누적 카드가 그 자리를 맡는다", () => {
    const countdown = evaluateMilestoneCountdown({
      stageMode: "pregnant",
      nickname: "다온이",
      birthDate: null,
      todayIso: "2026-08-27",
      totalExpenseKrw: 3_400_000
    });
    expect(countdown).toBeNull();
    const card = evaluateHomeCumulativeTotal({
      hasSession: true,
      totalExpenseKrw: 3_400_000,
      hasMilestoneCard: countdown !== null
    });
    expect(card?.title).toBe("지금까지의 지출 합계 3,400,000원");
  });

  it("첫돌 다음 날: 마일스톤 카드가 사라진 뒤에도 누적은 계속 보인다", () => {
    const countdown = evaluateMilestoneCountdown({
      ...milestoneInput,
      todayIso: "2027-06-02",
      totalExpenseKrw: 12_800_000
    });
    expect(countdown).toBeNull();
    expect(
      evaluateHomeCumulativeTotal({
        hasSession: true,
        totalExpenseKrw: 12_800_000,
        hasMilestoneCard: countdown !== null
      })
    ).not.toBeNull();
  });

  it("기록이 0건이면 마일스톤 부제는 권유 문장이고, 누적 카드도 뜨지 않는다(구멍이 아니라 의도)", () => {
    const countdown = evaluateMilestoneCountdown({ ...milestoneInput, todayIso: "2026-08-27", totalExpenseKrw: 0 });
    expect(countdown?.subtitle).not.toContain("원");
    expect(milestoneSubtitleShowsTotal(0)).toBe(false);
    expect(
      evaluateHomeCumulativeTotal({ hasSession: true, totalExpenseKrw: 0, hasMilestoneCard: countdown !== null })
    ).toBeNull();
  });
});

/**
 * 홈 배선 계약(소스 검증) — weekly-summary.test.ts / milestone-countdown.test.ts와 같은 관례다
 * (react-native 네이티브 바인딩이 없어 화면을 vitest에서 렌더할 수 없다).
 */
describe("B2 홈 배선 계약", () => {
  it("카드는 홈이 이미 받은 totalExpenseKrw만 쓴다(추가 요청 0)", () => {
    expect(homeSource).toContain("evaluateHomeCumulativeTotal({");
    expect(homeSource).toContain("hasMilestoneCard: milestoneCountdown !== null");
    // 새 쿼리로 누적을 다시 받아오지 않는다 -- 홈 캐시의 서버 집계 그대로다.
    expect(homeSource).not.toContain("getCumulativeReport");
  });

  it("세션 게이트를 통과한다(비세션 미리보기에 카드가 늘지 않는다)", () => {
    const start = homeSource.indexOf("evaluateHomeCumulativeTotal({");
    const call = homeSource.slice(start, homeSource.indexOf("});", start));
    expect(call).toContain("hasSession");
  });

  it("카드가 화면에 그려진다", () => {
    expect(homeSource).toContain('testID="home-cumulative-total"');
    expect(homeSource).toContain("cumulativeTotal.accessibilityLabel");
  });
});

/**
 * GAP-063 트랙 A — **같은 숫자를 그리는 나머지 자리도 같은 말을 한다.**
 *
 * 고치는 문제: 라운드 62의 고지는 이 카드 한 장에만 붙었는데, 이 카드는 마일스톤 카드가 서면
 * 접힌다(위 중복 금지). 그래서 대상 사용자의 대다수가 머무는 **생후 0일~첫돌** 구간에서는
 * 고지가 구조적으로 절대 뜨지 않았다 — 라운드 62가 없애려던 그림이 카드만 바뀐 채 남았다.
 * 리포트 탭의 누적 카드도 같은 숫자를 말없이 그렸고, 그 탭 머리의 고지는 **선택한 기간**만
 * 세므로 무기간인 이 숫자를 가리키지 못한다.
 *
 * 답은 재집계가 아니라(전 기간에는 재조정할 모집단이 없다) **같은 문장을 같은 함수로** 세
 * 자리에 세우는 것이다.
 */
describe("GAP-063 같은 금액을 그리는 세 자리가 같은 고지를 쓴다", () => {
  const pending = (overrides: Partial<CumulativeTotalPendingRow> = {}): CumulativeTotalPendingRow => ({
    syncState: "pending",
    payload: { expenseType: "expense" },
    ...overrides
  });

  it("공용 함수는 누적 카드가 만드는 고지와 언제나 같은 값을 낸다", () => {
    const cases: ReadonlyArray<readonly CumulativeTotalPendingRow[]> = [
      [],
      [pending()],
      [pending(), pending(), pending()],
      [pending(), pending({ syncState: "failed", lastErrorStatus: 400, lastError: "저장할 수 없어요" })],
      [pending({ payload: { expenseType: "gift" } })],
      [pending({ syncState: "synced" })]
    ];
    for (const rows of cases) {
      expect(cumulativeTotalPendingNotice(rows, base.totalExpenseKrw)).toBe(
        evaluateHomeCumulativeTotal({ ...base, pendingRows: rows })?.pendingNotice ?? null
      );
    }
    // 행을 아예 모르는 호출부(아이 미선택·비세션)는 아무것도 세지 않는다.
    expect(cumulativeTotalPendingNotice(undefined, base.totalExpenseKrw)).toBeNull();
    expect(cumulativeTotalPendingNotice(null, base.totalExpenseKrw)).toBeNull();
  });

  /**
   * 라운드 63 리뷰 #3 — **짚을 금액이 없으면 고지도 없다(세 자리 같은 규칙).**
   *
   * 문장이 "이 금액에 아직 반영되지 않았어요"이므로 금액이 0원이거나 모르면 가리킬 것이 없다.
   * 홈의 두 자리는 각자 그 게이트를 갖고 있었는데(누적 카드는 카드 자체를 만들지 않고, 마일스톤
   * 카드는 부제가 권유 문장일 때 고지를 뗀다) 세 번째 자리(리포트 탭)만 금액을 보지 않아 규칙이
   * 갈렸다. 이제 판정은 공용 함수 한 곳이 진다.
   */
  it("누적이 0원·모름이면 세 자리 어디에도 고지가 서지 않는다", () => {
    const rows = [pending(), pending()];
    for (const totalExpenseKrw of [0, null, undefined, Number.NaN]) {
      expect(cumulativeTotalPendingNotice(rows, totalExpenseKrw), String(totalExpenseKrw)).toBeNull();
      // 홈 누적 카드는 종전대로 카드 자체가 없고,
      expect(evaluateHomeCumulativeTotal({ ...base, totalExpenseKrw, pendingRows: rows })).toBeNull();
      // 마일스톤 카드도 종전대로 고지를 떼어 낸다(부제가 권유 문장이다).
      const countdown = evaluateMilestoneCountdown({
        stageMode: "born",
        nickname: "다온이",
        birthDate: "2026-06-01",
        todayIso: "2026-08-27",
        totalExpenseKrw,
        pendingNotice: cumulativeTotalPendingNotice(rows, totalExpenseKrw)
      });
      expect(countdown?.pendingNotice, String(totalExpenseKrw)).toBeNull();
    }
    // 금액이 있으면 종전 그대로 선다.
    expect(cumulativeTotalPendingNotice(rows, 1_245_700)).toBe(
      "동기화 대기 중인 기록 2건은 이 금액에 아직 반영되지 않았어요."
    );
  });

  /**
   * 이 라운드가 고친 결함 그 자체를 고정한다: 마일스톤 카드가 서는 날 홈은 여전히 대기를 밝힌다.
   */
  it("생후 0일~첫돌: 누적 카드가 접혀도 같은 문장이 마일스톤 부제 아래에 남는다", () => {
    const rows = [pending(), pending(), pending()];
    const notice = cumulativeTotalPendingNotice(rows, base.totalExpenseKrw);
    const countdown = evaluateMilestoneCountdown({
      stageMode: "born",
      nickname: "다온이",
      birthDate: "2026-06-01",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_245_700,
      pendingNotice: notice
    });
    const card = evaluateHomeCumulativeTotal({
      ...base,
      hasMilestoneCard: countdown !== null,
      pendingRows: rows
    });

    // 종전 그대로 누적 카드는 접힌다(중복 금지는 건드리지 않았다).
    expect(card).toBeNull();
    // 그런데 고지는 사라지지 않는다 — 접은 카드가 하던 말을 남은 카드가 이어받는다.
    expect(countdown?.subtitle).toContain("1,245,700원");
    expect(countdown?.pendingNotice).toBe("동기화 대기 중인 기록 3건은 이 금액에 아직 반영되지 않았어요.");
    expect(countdown?.accessibilityLabel).toContain(notice!);
  });

  it("첫돌 이후·임신 단계: 마일스톤 카드가 없으면 종전대로 누적 카드가 그 말을 한다", () => {
    const rows = [pending()];
    for (const todayIso of ["2027-06-03", "2030-01-01"]) {
      const countdown = evaluateMilestoneCountdown({
        stageMode: "born",
        nickname: "다온이",
        birthDate: "2026-06-01",
        todayIso,
        totalExpenseKrw: 1_245_700,
        pendingNotice: cumulativeTotalPendingNotice(rows, 1_245_700)
      });
      expect(countdown, todayIso).toBeNull();
      expect(
        evaluateHomeCumulativeTotal({ ...base, hasMilestoneCard: false, pendingRows: rows })?.pendingNotice,
        todayIso
      ).toBe(cumulativeTotalPendingNotice(rows, base.totalExpenseKrw));
    }
  });
});

/**
 * 리포트 탭 배선 계약(소스 검증) — 이 화면도 vitest에서 렌더할 수 없다(홈과 같은 관례).
 */
describe("GAP-063 리포트 탭 누적 카드 배선 계약", () => {
  it("고지도 부제도 홈 카드의 단일 소스를 그대로 부른다(문구 두 벌 금지)", () => {
    expect(reportsSource).toContain('from "../../src/home/cumulative-total"');
    expect(reportsSource).toContain(
      "cumulativeTotalPendingNotice(\n        offlineSyncSnapshot.rows.filter((row) => row.childId === childId),\n        cumulative.data?.totalExpenseKrw ?? null\n      )"
    );
    expect(reportsSource).toContain("{CUMULATIVE_TOTAL_SUBTITLE}");
    expect(reportsSource).toContain(`testID={REPORT_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID}`);
    expect(REPORT_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID).toBe("reports-cumulative-total-pending-notice");
  });

  it("고지 판정은 세션·아이가 있을 때만 돈다(모르면 세지 않는다)", () => {
    expect(reportsSource).toContain("const cumulativePendingNotice = hasSession");
  });

  it("숫자는 서버 집계 그대로다 — 리포트가 누적을 다시 더하지 않는다(재집계 금지)", () => {
    const start = reportsSource.indexOf("const cumulativePendingNotice = hasSession");
    const block = reportsSource.slice(start, start + 400);
    expect(block).not.toContain("reduce(");
    expect(block).not.toContain("amountKrw");
    // 새 요청도 새 구독도 없다 -- 기간 고지가 이미 쓰는 그 스냅숏이다.
    expect(reportsSource).toContain("const offlineSyncSnapshot = useOfflineSyncSnapshot();");
    expect(reportsSource.match(/useOfflineSyncSnapshot\(\)/g) ?? []).toHaveLength(1);
  });

  it("카드 안의 순서는 금액 → 부제 → 고지다(TalkBack이 눈과 같은 순서로 듣는다)", () => {
    const amountAt = reportsSource.indexOf("누적 기록 {formatKrw(cumulative.data.totalExpenseKrw)}");
    const subtitleAt = reportsSource.indexOf("{CUMULATIVE_TOTAL_SUBTITLE}", amountAt);
    const noticeAt = reportsSource.indexOf("{cumulativePendingNotice}", subtitleAt);
    expect(amountAt).toBeGreaterThan(-1);
    expect(subtitleAt).toBeGreaterThan(amountAt);
    expect(noticeAt).toBeGreaterThan(subtitleAt);
  });

  /**
   * 마일스톤 **리포트** 카드는 창 합계(`[출생일, 출생일+100일)`)라 제3의 모집단이다. 창 경계를
   * 클라이언트에서 다시 계산하는 순간 집계 규칙이 두 벌이 되므로 이 라운드는 그 카드에 고지를
   * 붙이지 않는다 — 모르는 것을 세는 척하지 않는다. 그래서 그 카드의 **공유 문자열도 그대로**다
   * (공유 카드에 개인정보를 늘리지 않는다는 계약도 함께 보존된다: 실린 식별 정보는 종전처럼
   * 호출자가 넘긴 아이 이름 하나뿐이다).
   */
  it("창 합계 카드(마일스톤 리포트)와 그 공유 문구에는 이 고지를 붙이지 않는다", () => {
    const milestoneCardAt = reportsSource.indexOf("style={reportMilestoneCardStyle}");
    expect(milestoneCardAt).toBeGreaterThan(-1);
    // 누적 카드 고지는 마일스톤 카드보다 **앞**에 있고, 그 뒤로는 다시 나오지 않는다.
    expect(reportsSource.indexOf("{cumulativePendingNotice}")).toBeLessThan(milestoneCardAt);
    expect(reportsSource.indexOf("{cumulativePendingNotice}", milestoneCardAt)).toBe(-1);

    const shareSource = readFileSync(join(process.cwd(), "src/reports/milestone-share.ts"), "utf8");
    const shareTextSource = readFileSync(join(process.cwd(), "src/reports/share-text.ts"), "utf8");
    // 창 합계(마일스톤) 공유는 종전 그대로 전면 금지다 — 셀 수 없는 모집단.
    expect(shareSource).not.toContain("cumulativeTotalPendingNotice");
    expect(shareSource).not.toContain("반영되지 않았어요");
    // 월간 공유(share-text.ts)는 라운드 64 #3이 **단일 소스 함수를 통해서만** 고지를
    // 싣도록 허용했다 — 허용된 것은 cumulativeTotalPendingNoticeText 호출 하나이고,
    // 행을 직접 세는 일은 여전히 금지다(그 계약은 share-text.test.ts가 마저 고정한다).
    expect(shareTextSource).toContain('import { cumulativeTotalPendingNoticeText } from "../home/cumulative-total"');
    for (const source of [shareSource, shareTextSource]) {
      // 대기 행은 공유 문구 모듈에 들어오지 않는다(모집단을 못 세면서 세는 척하지 않는다).
      expect(source).not.toContain("syncState");
      expect(source).not.toContain("offlineSyncSnapshot");
    }
    // 공유 카드 개인정보 계약도 그대로다: 실리는 식별 정보는 아이 이름 하나뿐이다.
    expect(shareTextSource).toContain("childId·이메일·계정 식별자는 입력으로 받지도, 출력에 넣지도 않는다");
  });

  it("REP-001 비세션 미리보기 블록은 한 글자도 달라지지 않는다(픽셀락)", () => {
    const previewStart = reportsSource.indexOf("{!hasSession ? (");
    const previewEnd = reportsSource.indexOf(") : activeIsLoading ? (", previewStart);
    expect(previewStart).toBeGreaterThan(-1);
    expect(previewEnd).toBeGreaterThan(previewStart);
    const previewBlock = reportsSource.slice(previewStart, previewEnd);
    expect(previewBlock).toContain(">다온이와의 오늘도 소중한 하루였어요<");
    expect(previewBlock).toContain("누적 기록 {formatKrw(cumulativeTotal)}");
    expect(previewBlock).not.toContain("CUMULATIVE_TOTAL_SUBTITLE");
    expect(previewBlock).not.toContain("cumulativePendingNotice");
  });

  it("HOME-001 비세션 미리보기 렌더에도 새 줄이 닿지 않는다(카드 자체가 없다)", () => {
    const previewStart = homeSource.indexOf("if (!authToken) {");
    expect(previewStart).toBeGreaterThan(-1);
    const previewBlock = homeSource.slice(previewStart);
    expect(previewBlock).not.toContain("milestoneCountdown");
    expect(previewBlock).not.toContain("cumulativeTotal");
  });
});
