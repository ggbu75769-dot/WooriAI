import { cumulativeTotalPendingNoticeText } from "../home/cumulative-total";
import { formatKrw } from "../money";
import type { MonthlyInsight } from "./monthly-insight";
import type { PendingScopeBreakdown } from "./pending-scope-notice";

/**
 * UX-H: 리포트 탭의 **공유 문구 조립** — 마일스톤(100일/첫돌) 카드와 월간 인사이트 카드가
 * 같은 모양의 카카오톡 붙여넣기용 멀티라인 텍스트를 만든다.
 *
 * ## 왜 한 모듈인가
 * 두 카드는 서로 다른 API 응답을 읽지만, 받는 사람(배우자·가족)에게는 **같은 카드**로 보여야
 * 한다. 머리글 한 줄 → 금액 한 줄 → 맥락 한 줄 → 앱 한 줄. 문구가 카드마다 제각각이면
 * 붙여넣은 쪽에서 "이건 무슨 앱이지"가 되고, 앱 홍보 줄이 두 줄로 늘어나기도 쉽다.
 * 그래서 줄 조립기와 앱 서명 줄을 여기 한 곳에 둔다(마일스톤 문구 본체는 화면 배선 계약이
 * 가리키는 milestone-share.ts에 그대로 남고, 이 모듈의 조각들을 빌려 쓴다).
 *
 * ## 숫자는 화면과 같은 소스에서만 (DNC-013/015)
 * - 금액은 전부 `formatKrw`("1,245,700원", ₩ 없음)를 지난다. 공유 문구용 포맷을 따로 만들지
 *   않는다.
 * - 월간 요약의 문장은 화면이 이미 그린 `MonthlyInsight`를 **그대로** 받는다. 이 모듈은
 *   monthly-insight.ts를 타입으로만 참조하고 집계를 다시 하지 않는다 — 화면에 보이는 문장과
 *   보낸 문장이 다를 수 없다.
 * - 총액도 화면이 그린 값(월간 응답의 totalExpenseKrw)을 받아 쓴다.
 *
 * ## 진행 중인 달은 구간을 밝힌다 (허위 방지)
 * 8월 27일에 8월을 공유하면 "1,245,700원"은 **한 달치가 아니다**. 받는 사람은 그걸 알 길이
 * 없으므로 "8월 1일~27일 기준" 줄을 금액 바로 아래에 넣는다. 이미 끝난 달에는 머리글의
 * "2026년 8월"이 곧 구간이므로 그 줄을 넣지 않는다.
 *
 * 라운드 36 F-5: 그 구간 줄과 "진행 중인가"의 소스는 **인사이트 하나**다(`partialRangeLine` /
 * `monthStatus`). 예전에는 상태는 인사이트에서, 줄은 따로 받은 yearMonth/todayIso에서 만들어
 * 두 소스가 어긋나면 줄만 조용히 빠졌다 — 부분 합계가 한 달치처럼 나가는 fail-unsafe였다.
 * 이제 어긋난 인사이트(진행 중인데 구간 줄이 없음)를 만나면 **메시지 전체를 만들지 않는다**.
 *
 * ## 아직 반영되지 않은 기록도 같은 이유로 밝힌다 (GAP-064 #3)
 *
 * 부분 구간과 **부분 반영**은 같은 모양의 결함이다. 지하철에서 3건을 적고 리포트 탭을 열면
 * 화면 머리에는 "…기록 3건은 아래 숫자에 아직 반영되지 않았어요"가 서지만, 그 아래 [공유하기]가
 * 내보내는 것은 그 3건이 빠진 금액뿐이었다 — **보내는 사람은 고지를 봤고 받는 사람은 볼 근거가
 * 없다**. 이 모듈이 구간 줄로 이미 없앤 결함을 한 자리만 남겨 둔 셈이라, 같은 규율로 대기 줄을
 * 금액 아래에 넣는다(라운드 63이 화면 세 자리에 붙인 그 고지의 네 번째 자리다).
 *
 * - **건수는 화면이 이미 센 값 하나뿐이다.** 여기서 다시 세지 않는다 — 모집단·기간 규칙은
 *   src/reports/pending-scope-notice.ts 한 곳이고, 이 모듈은 그 결과 타입(`PendingScopeBreakdown`)만
 *   **타입으로** 받는다(인사이트를 타입으로만 참조하는 것과 같은 관례).
 * - **문구도 새로 만들지 않는다.** 같은 두 조각(주어 "동기화 대기 중인 기록 N건" / 영구 실패가
 *   섞이면 수식을 뗀 주어 + "그중 M건은 보낼 수 없는 기록이에요.", 약한 술어 "아직 반영되지
 *   않았어요")을 쓰는 함수를 그대로 부른다.
 * - **지시어는 자리가 정한다.** 화면 고지는 아래에 늘어선 숫자들을 짚어 "아래 숫자에"라고 하지만,
 *   이 줄은 바로 위 금액 한 줄 밑에 서므로 "이 금액에"다. 그 갈래를 이미 들고 있는 것이
 *   `cumulativeTotalPendingNoticeText`(src/home/cumulative-total.ts)라 그 함수를 부른다 —
 *   두 문장은 지시어 하나만 다른 한 벌이고(그 모듈의 테스트가 `replace("아래 숫자에", "이 금액에")`로
 *   못박고 있다), 여기서 세 번째 벌을 만들면 다음 라운드에 세 문장이 따로 갈린다.
 * - **0건이면 줄이 없다.** 대다수인 그 경우의 공유 문구는 종전과 **바이트가 같다**(아래 테스트가
 *   계약으로 고정한다).
 *
 * 공유를 접지는 않는다. 구간 줄은 **말할 수 없는** 사실이라 빠지면 fail-safe(F-5)로 공유 자체를
 * 접었지만, 대기 건수는 **말할 수 있는** 사실이다 — 말할 수 있는 것을 이유로 공유를 막는 것은
 * 과하다.
 *
 * 마일스톤(100일/첫돌) 공유 문구는 여기서 뺀다. 그 창(`[출생일, +100일)`)은 월/분기/연 스코프로도
 * 누적의 무기간 규칙으로도 셀 수 없는 제3의 기간이라, 창 경계를 여기서 다시 계산하는 순간 집계
 * 규칙이 두 벌이 된다(라운드 63의 판정 그대로 — src/home/cumulative-total.ts 머리말).
 *
 * ## 개인정보
 * 공유 텍스트에 들어가는 식별 정보는 **호출자가 넘긴 아이 이름/태명 하나뿐**이다(사용자가
 * 스스로 보내는 값). childId·이메일·계정 식별자는 입력으로 받지도, 출력에 넣지도 않는다.
 * 대기 고지가 싣는 것도 **건수 두 개(N·M)뿐**이다 — 대기 행의 품목명·금액·날짜·id는 이 모듈에
 * 들어오지도 않는다(입력 타입이 숫자 두 칸이라 구조적으로 불가능하다).
 *
 * ## 톤 (DNC-018)
 * 사실 서술 + 해요체. 평가("잘하고 있어요")·조언("줄여보세요")·죄책감 유발 문구 없음.
 * 앱 홍보는 마지막 한 줄뿐이다.
 */

/** 모든 공유 카드의 마지막 줄. 앱 홍보는 여기 한 줄로 끝난다. */
export const SHARE_APP_LINE = "— 우리아이 앱에서";

/** 금액 줄. 마일스톤·월간이 같은 문구를 써서 두 카드가 한 가족으로 읽힌다. */
export function shareTotalLine(totalKrw: number): string {
  return `함께한 지출 ${formatKrw(totalKrw)}`;
}

/**
 * "가장 많이 준비한 것: 기저귀/위생" — 이름이 하나도 없으면 줄 자체를 만들지 않는다
 * (근거 없는 줄은 넣지 않는다).
 */
export function shareTopCategoryLine(categoryNames: readonly string[]): string | null {
  const names = categoryNames.map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) return null;
  // 카테고리 이름 자체에 "/"가 들어가므로(기저귀/위생) 구분자는 "·"를 쓴다.
  return `가장 많이 준비한 것: ${names.join("·")}`;
}

/** 빈 줄(null/공백)을 걸러 개행으로 잇는다. 카카오톡에 그대로 붙여넣는 형태. */
export function joinShareLines(lines: ReadonlyArray<string | null | undefined>): string {
  return lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0).join("\n");
}

export type MonthlyShareInput = {
  /** 화면 머리글과 같은 라벨("2026년 8월") — 공유 문구가 화면과 다른 달 이름을 쓰지 않게. */
  monthLabel: string;
  /** 아이 닉네임/태명. 사용자가 스스로 보내는 값이라 그대로 싣는다. */
  childName: string;
  /** 월간 리포트 totalExpenseKrw — 화면의 "총 지출" 카드와 같은 값. */
  totalExpenseKrw: number;
  /** 화면이 이미 그린 인사이트 카드. null이면 공유할 문장이 없다. */
  insight: MonthlyInsight | null;
  /**
   * GAP-064 #3 — **이 달**의 대기 건수. 화면 머리의 고지가 이미 센 값
   * (pending-scope-notice.ts 판정 함수의 결과)을 그대로 넘긴다. 대기가 없거나(0건) 셀 수
   * 없으면(아이를 모름·비세션) `null`이고, 그때 공유 문구는 종전과 바이트가 같다.
   *
   * **선택이 아니라 필수다.** 라운드 63이 화면 세 자리에 같은 고지를 붙이면서 얻은 교훈이
   * 그대로 적용된다(src/home/cumulative-total.ts의 `cumulativeTotalPendingNotice` 머리말):
   * 선택으로 두면 다음에 공유 경로를 하나 더 붙이는 사람이 이 칸을 다시 빠뜨리고, 빠뜨린 자리는
   * **고지 없는 금액**이라 조용히 틀린다. 넘길 것이 없다는 판단도 `null`로 한 번 적게 한다.
   *
   * 넘기는 건수의 **기간은 호출부 책임**이다 — 이 카드는 `monthLabel`의 한 달을 말하므로
   * 월 스코프로 센 값이어야 한다(분기/연 스코프의 건수를 넘기면 이 카드가 다른 기간의 사실을
   * 말하게 된다). 그 게이트는 배선 계약으로 app/(tabs)/reports.tsx에 못박혀 있다.
   */
  pending: PendingScopeBreakdown | null;
};

/**
 * 금액 줄 아래에 서는 대기 고지 한 줄. 0건이면 **null**이라 줄 자체가 없다 —
 * "0건이 아직 반영되지 않았어요"는 소음이고, 대다수인 그 경우에 카드를 한 줄 키울 이유가 없다
 * (화면 고지·누적 카드와 같은 규칙).
 *
 * 문구는 만들지 않고 빌려 온다(위 머리말의 "지시어는 자리가 정한다").
 */
export function monthlySharePendingLine(pending: PendingScopeBreakdown | null | undefined): string | null {
  if (!pending || pending.count <= 0) return null;
  return cumulativeTotalPendingNoticeText(pending.count, pending.unsendableCount);
}

/**
 * 월간 요약 공유 문구. 화면의 인사이트 카드가 없으면(= 말할 근거가 없으면) null이라 공유
 * 버튼도 붙지 않는다.
 *
 * 예)
 *   📊 다온이의 2026년 8월
 *   함께한 지출 1,245,700원
 *   8월 1일~27일 기준
 *   이번 달은 기저귀/위생에 가장 많이 썼어요 (84,200원 · 전체의 32%)
 *   — 우리아이 앱에서
 *
 * 대기 3건이 있으면 금액 아래 한 줄이 더 선다(GAP-064 #3 — 그 외에는 위와 같다):
 *   함께한 지출 1,245,700원
 *   8월 1일~27일 기준
 *   동기화 대기 중인 기록 3건은 이 금액에 아직 반영되지 않았어요.
 *
 * 카드의 문장 중 **카테고리 1위 문장(`shareableHeadline`)만** 싣는다. 나머지(예산 달성률·하루
 * 평균·지난달 비교)는 화면에서 읽는 개인 목표에 가깝다 — 가족에게 보내는 카드에 예산을 얹지
 * 않고, 줄 수도 붙여넣기 좋은 다섯 줄 안에 묶어 둔다(대기 줄이 서는 달만 여섯 줄이다 — 그 줄은
 * 이 금액이 무엇을 아직 세지 않았는지를 말하므로 "붙여넣기 좋은 길이"보다 앞선다).
 *
 * 라운드 36 F-1: 여기서 `headline`(= 살아남은 첫 문장)을 쓰면 안 된다. 카테고리 분해가 아직
 * 안 온 달에는 예산 문장이 headline 자리로 올라와 "예산의 67%를 썼고, 하루 평균 37,037원이에요"가
 * 그대로 단톡방으로 나간다. 문장 종류를 인사이트가 태그해 주고(`shareableHeadline`), 없으면
 * 그 줄 자체를 생략한다.
 */
export function buildMonthlyShareMessage(input: MonthlyShareInput): string | null {
  const { insight } = input;
  if (!insight) return null;
  if (!Number.isFinite(input.totalExpenseKrw) || input.totalExpenseKrw <= 0) return null;
  // F-5 fail-safe: 진행 중인 달인데 구간 줄이 없으면 부분 합계를 한 달치처럼 보내게 된다.
  // 줄 하나를 조용히 빼는 대신 공유 자체를 접는다(호출부는 null이면 버튼을 붙이지 않는다).
  if (insight.monthStatus === "in-progress" && insight.partialRangeLine === null) return null;

  return joinShareLines([
    `📊 ${input.childName}의 ${input.monthLabel}`,
    shareTotalLine(input.totalExpenseKrw),
    // 금액을 한정하는 두 줄이 나란히 선다. 순서는 **구간 → 반영 여부**다: 먼저 어느 구간의
    // 합계인지 말하고(구간 줄은 금액에 딱 붙는 짧은 조각이다), 그 다음 그 구간 안에서 아직
    // 세지 않은 것이 있는지 말한다. 둘 다 바로 위 금액 한 줄을 짚는다("이 금액에").
    insight.partialRangeLine,
    monthlySharePendingLine(input.pending),
    insight.shareableHeadline,
    SHARE_APP_LINE
  ]);
}
