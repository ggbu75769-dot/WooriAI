import { formatKrw } from "../money";
import { computeCategoryShares, type CategoryShareInput } from "./category-share";

/**
 * 라운드 82 트랙 A: 리포트 탭 **분기·연간** 세그먼트의 한 문장 — 순수 조립 모듈.
 *
 * ## 왜 이 모듈인가
 * 인사이트 카드(승인 캡처 REP-001의 "절약 팁" 자리 = 구획 ⑤)는 월간에서만 살았다
 * (`app/(tabs)/reports.tsx`의 `period === "월간"` 게이트). 분기·연간에서는 그 자리가 통째로
 * 빈칸이라, 화면이 **더 넓은 기간을 보여 주면서 말은 덜 했다** — 총액·도넛·추이·누적이라는
 * 숫자 카드의 나열만 남고, "그래서 이 분기는 어땠는데?"는 사용자가 범례에서 퍼센트를 눈으로
 * 읽어 스스로 만들어야 했다. 그 상태가 바로 `monthly-insight.ts` 머리말이 이 모듈군의 존재
 * 이유로 적어 둔 상태다.
 *
 * ## 새 값을 만들지 않는다 (새 요청 0건 · 새 집계 0건 · 새 반올림 0건)
 * 화면은 이미 **보고 있는 기간의** 카테고리 분해를 손에 들고 있다 — `categoryPeriod`가
 * 세그먼트를 그대로 따라가므로(월간=yearMonth · 분기=year+quarter · 연간=year) 바로 위 도넛이
 * 그리는 그 배열이 곧 이 문장의 근거다. 그래서 이 모듈은 **도넛에 넘어가는 조각 배열을 그대로**
 * 받아 `computeCategoryShares`(범례와 같은 함수 · 같은 최대잔여법)를 지난다.
 * **반올림 규칙의 두 번째 벌을 만들지 않는 것이 이 모듈의 첫 규율이다** — 같은 화면의 문장과
 * 범례가 1% 어긋날 자리를 구조적으로 없앤다.
 *
 * ## 말하지 않는 것 (그리고 그 이유)
 * - **예산 문장 없음.** 화면이 이미 적어 둔 판정 그대로다 — *"분기·연간에는 합친 예산이라는
 *   것이 존재하지 않는다"*(reports.tsx). 없는 값을 지어내지 않는다.
 * - **비교 문장 없음.** 직전 분기·직전 해의 합계를 이 화면은 갖고 있지 않다(`quarterTrend`는
 *   그 분기 세 달만, `yearly`는 그 해 열두 달만 준다). 없는 값으로 비교를 짓는 것이
 *   `monthly-insight.ts`가 허위 비교로 규정한 바로 그 자리다.
 * - **공유 문구 없음.** 분기·연간 공유 문구는 별도 결정이다(`share-text.ts` 머리말의 "세 번째
 *   벌" 경고). 이 모듈은 화면에 그릴 문장만 낸다 — 그래서 카드에 공유 버튼도 서지 않는다.
 * - **월간 문장 없음.** 월간은 `monthly-insight.ts` 하나가 소유한다(`unit`이 "quarter" | "year"
 *   뿐인 것이 그 규율의 타입 표현이다 — 이 모듈로는 월간 문장을 만들 수 없다).
 *
 * ## 문장 규칙 (DNC-018)
 * 해요체, 사실 서술만. 평가·조언·죄책감 유발 문구 금지. 그리고 **근거가 없으면 문장이 아니라
 * 카드가 없다**(`null` 반환) — 기간 총액이 0원이거나, 카테고리 분해가 없거나(아직 안 왔거나
 * 전부 0원), 기간 라벨이 비면 아무것도 말하지 않는다. 월간과 **같은 규율**이다.
 *
 * 문장은 **하나로 시작한다**(`PERIOD_INSIGHT_MAX_SENTENCES`). 둘째 문장을 더하려면 그 문장이
 * 기대는 값이 이 화면에 실제로 있는지부터 재야 한다 — 위 "말하지 않는 것"이 그 목록이다.
 *
 * 순수 모듈인 이유는 이 폴더의 관례와 같다: 리포트 탭은 네이티브 바인딩이 없어 vitest에서
 * 렌더되지 않는다. 그래서 판정은 전부 여기 있고 화면은 배선만 한다(화면 프레임워크 의존 0건).
 */

/** 이 모듈이 말할 수 있는 기간 단위. 월간이 없는 것이 계약이다(위 머리말). */
export type PeriodInsightUnit = "quarter" | "year";

export type PeriodInsightInput = {
  /** 보고 있는 세그먼트. 월간은 이 모듈을 지나지 않는다. */
  unit: PeriodInsightUnit;
  /** 화면이 이미 그리고 있는 기간 라벨("2026년 3분기" · "2026년" — reports.tsx의 periodLabel). */
  periodLabel: string;
  /** 그 기간의 총 지출(화면의 activeTotal). 0원/모름이면 카드가 없다. */
  totalExpenseKrw: number | null | undefined;
  /**
   * **도넛에 넘어가는 그 조각 배열 그대로**(reports.tsx의 categorySegments).
   *
   * 이름이 아직 해석되지 않았으면(카테고리 캐시 미도착) 화면이 `undefined`를 넘긴다 —
   * "기타" 폴백으로 엉뚱한 카테고리를 지목하느니 문장을 만들지 않는다(월간과 같은 판단).
   */
  segments?: readonly CategoryShareInput[] | null;
};

export type PeriodInsight = {
  unit: PeriodInsightUnit;
  /** 카드 첫 줄. */
  headline: string;
  /**
   * 카드 둘째 줄. 이 모듈은 **언제나 null**이다(문장 하나).
   *
   * 타입에 남겨 두는 이유: 화면의 카드가 월간 인사이트와 같은 모양을 읽기 때문이다. 값이 아니라
   * **자리**를 맞춰 두어야 카드가 두 벌로 갈리지 않는다.
   */
  detail: null;
  /** 렌더 순서 그대로의 문장들(최대 1). */
  sentences: string[];
  /** 카드를 한 요소로 읽어 주는 TalkBack 라벨. */
  accessibilityLabel: string;
  /**
   * 문장이 지목한 카테고리 이름과 퍼센트 라벨.
   *
   * 화면은 이 값을 그리지 않는다 — **문장이 도넛 범례 1위와 같은 값을 말했는지 검산하는 테스트
   * 전용 값**이다(monthly-insight.ts의 elapsedDays·dailyAverageKrw와 같은 관례).
   */
  topCategoryLabel: string;
  topCategoryPercentLabel: string;
};

/** 카드가 담는 문장 수 상한 — "숫자 나열"로 되돌아가지 않으면서, 없는 값으로 늘리지도 않는다. */
export const PERIOD_INSIGHT_MAX_SENTENCES = 1;

/**
 * 라운드 82 리뷰 L-13 — **"전체의 47%"의 *전체*가 무엇인지 재고 말한다.**
 *
 * 문장의 퍼센트는 `computeCategoryShares`가 내고, 그 함수의 분모는 **조각들의 합**이다. 그런데
 * 문장이 서는 카드 바로 위에는 "총 지출" 카드가 있고 그 숫자는 `totalExpenseKrw`다 — 월간에서는
 * 두 값이 **한 응답**에서 오지만(월간 리포트가 총액과 categoryTop을 함께 준다), 분기·연간에서는
 * **엔드포인트가 둘**이다(총액은 trend/yearly · 분해는 category). 종전에는 `totalExpenseKrw`를
 * "0원인가"를 가리는 데만 쓰고 분모로는 쓰지 않았으므로, 두 응답이 서로 다른 시점의 스냅숏일 때
 * 문장의 *전체*와 화면의 *총 지출*이 조용히 다른 수를 뜻할 수 있었다.
 *
 * 두 수는 **구조적으로 같아야 한다**: 서버의 두 집계는 같은 술어(`deletedAt: null` ·
 * `expenseType: "expense"` — DNC-015)와 같은 기간 경계 위에서 도는 정수 원화 합계다
 * (`reporting-store.service.ts`의 getTrendReport·getYearlyReport·categoryBreakdown, 데모 거울도
 * 같다). 그래서 **허용 오차가 0원인 것이 이 검산의 정답**이다 — 1원이라도 갈렸다면 그것은
 * 반올림 오차가 아니라 두 응답 사이에 기록이 하나 들어왔다는 뜻이고, 그 창에서는 문장이 화면과
 * 다른 모집단을 말하게 된다. 그때는 말하지 않는다(카드 없음 — 다음 갱신에서 다시 선다).
 */
export const PERIOD_INSIGHT_TOTAL_TOLERANCE_KRW = 0;

function normalizedAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * 문장에 들어가는 분류 이름을 **한 줄로** 접는다(`trim` + 내부 연속 공백 1칸).
 *
 * 종전(그때는 참): 이 모듈은 도넛에 넘어가는 조각의 `label`을 그대로 문장에 끼웠고, 그때는
 * 분류 이름이 시드 21행의 고정 문자열뿐이라 개행이 섞일 자리가 없었다.
 * → 이제: 이름은 **운영자·사용자가 적는 자유 문자열**이고, 같은 슬라이스의 다른 두 끝은 이미
 * 가드를 갖고 있다(라운드 106 T6이 share-text.ts의 마일스톤 줄에, 그 후속이 월간 문장에 같은
 * 두 줄을 넣었다). 형제 경로인 이 분기·연간 문장만 비어 있었다.
 *
 * **유입 경로 ⚠️ 두 시점 — *종전*(그때는 참): 두 쓰기 경로 중 하나가 개행을 접지 않았다.**
 *  · 가구 커스텀 분류 — `apps/api/src/finance/dto/custom-categories.dto.ts`의 `@Transform`이
 *    `normalizeCustomCategoryName`(= `trim + /\s+/gu → " "`)을 하므로 개행이 들어올 수 없다
 *    (이 줄은 오늘도 참이다).
 *  · **어드민 분류 이름 변경** — `apps/api/src/admin/dto/admin-categories.dto.ts`의 `@Transform`이
 *    `.trim()`뿐이라 `"기저귀\n위생"`이 `@MinLength(1)`·`@MaxLength(50)`을 통과했고, 저장
 *    직전(`admin-categories.service.ts`)도 `input.name?.trim()`이었다 — 라운드 107 D6의 중복
 *    검사(`duplicateKey`)는 **비교 키에서만** 공백을 접고 저장값을 손대지 않아 그 구멍을
 *    막지 못했다. 그 이름은 `GET /categories` → `buildCategoryNameLookup`(`src/categories.ts` —
 *    역시 `.trim()`만 했다) → 화면의 `categorySegments.label` → 이 문장으로 왔다.
 *
 * **→ *이제*(라운드 109 — 오늘 두 소스에서 직접 재확인): 위 둘째 줄의 두 문장은 모두
 * 거짓이다.** 그 라운드가 서버 유입 지점과 앱의 해석기를 **함께** 고쳤다:
 *  ⓐ 서버 — `AdminUpdateCategoryDto.name`의 `@Transform`은 이제 커스텀 쪽과 **같은 함수**
 *    (`normalizeDisplayName`)를 부르고, 접힌 뒤에도 남는 `\p{Cc}`/`\p{Cf}`/`\p{Cs}`는
 *    `@IsSafeDisplayName`이 400으로 **거절한다**(그 DTO의 라운드 109 주석 — RLO·NEL·ZWSP를
 *    실측으로 잡은 그 걸음).
 *  ⓑ 앱 — `buildCategoryNameLookup`은 이제 `displaySafeCategoryName`을 지난다(`src/categories.ts`):
 *    제어·서식 문자를 공백 한 칸으로 바꿔 놓고 `\s+`를 접는다. 즉 **화면 경로로** 들어오는
 *    라벨은 이 모듈에 닿기 전에 이미 한 줄이다.
 *
 * **그래도 아래 가드는 그대로 둔다** — 이 함수가 라벨을 받는 길이 그 경로 하나가 아니다:
 *  · 이 모듈은 **순수 함수**고 라벨은 호출부가 넘긴다. 오늘 앱의 호출부가 하나라는 것과
 *    (`app/(tabs)/reports.tsx`) 그 호출부가 lookup을 지난 값을 넘긴다는 것은 **호출부의 사실**이지
 *    이 함수의 계약이 아니다(테스트는 라벨을 그대로 넘긴다).
 *  · ⓑ의 손질을 지나지 않는 이름이 아직 남는다: `["categories"]` 캐시에는 **ⓐ 이전에 저장된
 *    값**이 실려 올 수 있고, 데모/로컬 대역(`src/api/local-backend.ts`)은 서버 DTO를 지나지 않으며,
 *    가구 커스텀 분류의 서버 유입 지점에는 아직 그 거절이 없다(그 세 사유를
 *    `displaySafeCategoryName` 주석이 값으로 들고 있다).
 * 즉 이 두 줄은 오늘 **둘째 겹**이다 — 유일하지 않을 뿐 없어도 되는 것이 아니다.
 *
 * **깨지는 자리(값).** 개행이 하나 섞이면 ① 카드의 한 문장이 두 줄로 갈라지고
 * (`reportInsightHeadlineStyle` Text), ② `accessibilityLabel`(카드를 한 요소로 읽어 주는 값)에
 * 낭독을 끊는 제어문자가 들어간다. 월간의 셋째 자리(공유 문구가 한 줄 늘어나는 것)는 **여기서
 * 해당 없음**이다 — 이 카드에는 공유 버튼이 서지 않는다(머리말 "말하지 않는 것").
 *
 * **왜 월간의 헬퍼를 import 하지 않는가.** `monthly-insight.ts`의 같은 이름 함수는 export 되어
 * 있지 않고, 이 모듈은 **월간 문장의 단일 소스를 침범하지 않는다**는 계약을 지고 있다(이 폴더의
 * 테스트가 `monthly-insight` import 자체를 금지한다). 그래서 규칙만 같은 한 벌을 여기 둔다 —
 * 두 자리가 갈리면 같은 이름이 월간과 분기에서 다르게 읽힌다. (두 시점: 두 모듈이 공유 모듈
 * 하나를 볼 수 있게 되는 라운드에 한 벌로 접는다.)
 *
 * 정상 이름("기저귀/위생", "분유 · 이유식")의 바이트는 바뀌지 않는다 — DNC-018(관찰형 어투)·
 * DNC-020(의료) 무접촉.
 */
function singleLineCategoryLabel(rawLabel: string): string {
  return rawLabel.trim().replace(/\s+/gu, " ");
}

/**
 * 분해에서 **금액이 가장 큰 조각**. 서버가 내림차순으로 주지만 순서에 기대지 않는다(동률은 먼저
 * 온 조각 — `computeCategoryShares`가 입력 순서를 그대로 보존하므로 범례 1위와 같은 조각이다).
 */
function topShare(segments: readonly CategoryShareInput[]) {
  const shares = computeCategoryShares(segments);
  if (shares.length === 0) return null;
  return {
    top: shares.reduce((best, slice) => (slice.amountKrw > best.amountKrw ? slice : best), shares[0]),
    // 퍼센트의 **분모** 그대로다 — 그 함수가 세는 조각(0·음수·비유한 값 제외)만 더한다.
    denominator: shares.reduce((sum, slice) => sum + slice.amountKrw, 0)
  };
}

/**
 * 분기·연간 인사이트 카드 한 장을 만든다. 말할 근거가 없으면 null(카드 미렌더).
 */
export function buildPeriodInsight(input: PeriodInsightInput): PeriodInsight | null {
  const periodLabel = input.periodLabel.trim();
  // 기간을 이름으로 부를 수 없으면 문장의 주어가 없다.
  if (periodLabel.length === 0) return null;

  // 그 기간에 지출이 하나도 없으면 요약할 것이 없다 — 빈 기간 문구는 화면의 몫이다
  // (src/reports/empty-period-card.ts).
  const totalExpenseKrw = normalizedAmount(input.totalExpenseKrw);
  if (totalExpenseKrw === null || totalExpenseKrw <= 0) return null;

  const breakdown = topShare(input.segments ?? []);
  if (breakdown === null) return null;
  const { top, denominator } = breakdown;

  // 라운드 82 리뷰 L-13: 문장이 말하는 "전체"와 화면의 "총 지출"이 같은 수일 때만 말한다
  // (근거·허용 오차의 이유는 PERIOD_INSIGHT_TOTAL_TOLERANCE_KRW 주석).
  if (Math.abs(denominator - totalExpenseKrw) > PERIOD_INSIGHT_TOTAL_TOLERANCE_KRW) return null;

  // 종전(그때는 참): 1위 조각의 `label`을 그대로 문장에 끼웠다 — 이름이 시드 고정 문자열뿐일
  // 때는 참이었다. → 이제: 라벨은 호출부가 넘기는 자유 문자열이라 문장에 들어가기 직전에 한 줄로
  // 접는다. ⚠️ 종전 이 자리는 그 이유를 "어드민 이름 변경 경로로 내부 개행이 들어올 수 있으므로"
  // 라고 적었는데, 그 문장은 라운드 109 이후 거짓이다(그때는 참이었다 — 서버 DTO와
  // buildCategoryNameLookup이 함께 고쳐졌다). 접기가 남는 이유는 유입 경로가 아니라 **이 함수가
  // 순수 함수라는 것**이다(근거 전부는 singleLineCategoryLabel 주석의 두 시점).
  // **금액은 손대지 않는다.** 접기는 1위 조각의 이름 하나에만 걸리고, 위 `denominator`와
  // `top.amountKrw`·`top.percentLabel`은 이 줄 이전에 이미 굳은 값이다 — 이름이 깨진 조각도
  // 떨어뜨리지 않으므로 "전체의 47%"의 *전체*가 달라지지 않는다(DNC: 허위 데이터 표시 금지).
  const topLabel = singleLineCategoryLabel(top.label);
  // 이름이 접고 나서 비면 지목할 대상이 없다 — 이 모듈의 "근거가 없으면 카드가 없다" 규율
  // 그대로다(빈 이름으로 "2026년 3분기에는 에 가장 많이 썼어요"를 만들지 않는다). 문장이
  // 하나뿐이라 문장 생략 = 카드 미렌더다(월간은 그 자리에 예산 문장이 올라올 수 있었다).
  if (topLabel.length === 0) return null;

  const sentence = `${periodLabel}에는 ${topLabel}에 가장 많이 썼어요 (${formatKrw(top.amountKrw)} · 전체의 ${top.percentLabel})`;
  const sentences = [sentence].slice(0, PERIOD_INSIGHT_MAX_SENTENCES);

  return {
    unit: input.unit,
    headline: sentences[0],
    detail: null,
    sentences,
    accessibilityLabel: sentences.join(" "),
    // 종전(그때는 참): 조각의 원본 `label`을 그대로 냈다 — 문장에 들어간 값과 같았다.
    // → 이제: 문장은 접힌 이름을 말하므로 검산값도 **문장이 실제로 말한 그 이름**이어야 한다.
    // 원본을 내면 "문장이 범례 1위와 같은 값을 말했는가"라는 이 필드의 뜻이 거짓이 된다.
    topCategoryLabel: topLabel,
    topCategoryPercentLabel: top.percentLabel
  };
}
