import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cumulativeTotalPendingNoticeText,
  CUMULATIVE_TOTAL_SUBTITLE,
  CUMULATIVE_TOTAL_TITLE_PREFIX,
  evaluateHomeCumulativeTotal,
  HOME_CUMULATIVE_TOTAL_PENDING_NOTICE_TEST_ID,
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
