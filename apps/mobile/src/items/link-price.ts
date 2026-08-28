import { getSeoulToday } from "@wooriai/domain";
import type { ProductLink } from "../api/client";
import { formatSpentOn } from "../expenses/records-list-view";
import { formatKrw } from "../money";

/**
 * 라운드 52 T1 (C-01): 판매처 행에 **가격과 그 확인 시각을 함께** 적기 위한 판정 단일 소스.
 *
 * 고치는 문제: 서버는 라운드 51 #9부터 판매처별 가격 스냅샷(`priceSnapshotKrw`)과 그 기준
 * 시각(`priceCheckedAt`)을 응답에 싣는데(apps/api/src/onboarding/items-catalog.service.ts
 * toProductLinkDto), 앱은 그 두 값을 한 번도 그리지 않았다 — 상세 화면의 판매처 행은 세션
 * 경로에서 가격 칸을 **빈 문자열**로 넘기고 있었다. 핵심 루프의 "구매 링크 클릭" 직전 칸에서
 * 사용자가 견줄 수 있는 값이 하나도 없던 셈이다.
 *
 * 표시 규칙(전부 정직성 제약이다):
 *
 *  1. **둘 다 있을 때만 그린다.** 스냅샷 가격은 "언젠가 확인한 값"이라, 언제 확인했는지를
 *     함께 말하지 않으면 사용자는 그것을 현재가로 읽는다 — 그 자체가 허위 표시다. 서버도
 *     계약도 같은 규칙을 강제하지만(둘 중 하나만 실은 응답은 계약 위반), 여기서 한 번 더
 *     판정한다: 화면이 "가격은 있는데 시각이 없으니 그냥 보여주자"를 고를 수 있는 자리를
 *     아예 만들지 않기 위해서다. 한쪽만 있으면 **둘 다** 그리지 않는다(null).
 *
 *  2. **값과 캡션은 한 덩어리로 나간다.** 이 함수는 `priceText`만 따로 내주지 않는다 —
 *     둘을 각각 뽑아 쓰면 언젠가 값만 크게 찍고 시각은 빠뜨리는 배선이 생기고, 그게 1번을
 *     우회하는 가장 쉬운 길이다. 호출부(app/items/[itemTemplateId].tsx)는 이 객체 하나에서
 *     `price`와 `caption`을 함께 꺼내 **같은 ProductComparisonRow**에 넘긴다. 그 컴포넌트는
 *     seller/caption 묶음과 price를 같은 flex 행에 나란히 그리므로(src/ui.tsx), 확인 시각은
 *     값과 같은 줄에서 같이 읽힌다. link-price.test.ts가 이 배선을 소스에서 고정한다.
 *
 *  3. **"확인"이라고만 말한다.** "최저가", "지금 가격", "실시간" 같은 말은 쓰지 않는다 —
 *     우리가 아는 것은 "그때 확인한 값"뿐이다. 오래된 값이면 캡션의 날짜가 그 사실을 그대로
 *     말한다(문구가 신선도를 대신 주장하지 않는다). 해가 바뀐 확인 시각에는 연도를 붙인다:
 *     "1월 2일 확인"은 올해 1월로 읽히지만 실제로는 작년일 수 있기 때문이다.
 *
 *  4. **DNC-009: 표시 전용.** 이 모듈이 만드는 값은 어떤 정렬·추천에도 들어가지 않는다.
 *     링크 순서는 서버가 정하고(displayOrder + 헬스 강등), 준비템 추천 점수는 링크를 아예
 *     보지 않는다(packages/domain sortRecommendedItems의 입력에 가격 필드가 없다).
 *     link-price.test.ts가 "정렬 소스에 가격 무유입"을 grep으로 고정한다.
 *
 * 시각 해석은 **서울 달력** 기준이다(getSeoulToday). `priceCheckedAt`은 UTC ISO 문자열이라
 * 기기 타임존으로 읽으면 하루가 밀릴 수 있고, 날짜 캡션에서 하루 오차는 곧 틀린 표시다.
 * "M월 D일" 표기는 기록 탭·홈과 같은 단일 소스(formatSpentOn)를 쓴다 — 같은 날짜가 화면마다
 * 다르게 보이지 않게(src/items/linked-expense.ts도 같은 함수를 쓴다).
 */

/** 판정에 필요한 최소 입력. `ProductLink`의 두 필드만 본다(나머지는 이 판정과 무관). */
export type LinkPriceDisplayInput = Pick<ProductLink, "priceSnapshotKrw" | "priceCheckedAt">;

export type LinkPriceDisplay = {
  /** 행의 가격 칸 — "89,000원"(앱 금액 표기 단일 소스 formatKrw, '₩' 없음). */
  priceText: string;
  /** 같은 행의 캡션에 붙는 기준 시각 — "8월 20일 확인" / 해가 다르면 "2025년 1월 2일 확인". */
  checkedAtCaption: string;
};

/** 캡션 꼬리말. "최저가"도 "현재가"도 아니다 — 우리가 아는 것은 확인 사실뿐이다(규칙 3). */
export const LINK_PRICE_CHECKED_SUFFIX = "확인";

/** 판매처 캡션에서 기존 라벨(플랫폼)과 확인 시각을 잇는 구분자. */
export const LINK_PRICE_CAPTION_SEPARATOR = " · ";

/**
 * 그릴 수 있는 금액인가. 계약은 0 이상의 정수를 허용하지만(productLinkSchema), 화면은
 * **양의 정수만** 그린다: "0원"은 판매가로 읽을 수 없고, 그렇게 찍으면 "무료"라는 없는
 * 주장이 된다. 값을 감추는 쪽은 종전 동작(가격 칸 비움)으로 떨어질 뿐이라 안전하다.
 */
function isDisplayablePriceKrw(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * UTC ISO 시각 → "8월 20일 확인". 파싱할 수 없으면 null(= 가격도 그리지 않는다).
 *
 * `today`는 연도 표기 판정에만 쓴다(기본값은 서울 기준 오늘). 테스트가 고정 값을 넘길 수
 * 있게 인자로 열어 두되, 호출부는 인자 없이 부른다.
 */
function checkedAtCaptionOf(checkedAt: string, today: string): string | null {
  const millis = Date.parse(checkedAt);
  if (!Number.isFinite(millis)) return null;

  let seoulDate: string;
  try {
    // 서울 달력의 날짜로 옮긴다(기기 타임존과 무관). Intl이 실패하면 던지므로 감싼다 —
    // 가격 캡션 하나 때문에 상세 화면이 죽지 않는다.
    seoulDate = getSeoulToday(new Date(millis));
  } catch {
    return null;
  }

  const dayLabel = formatSpentOn(seoulDate);
  // formatSpentOn은 파싱 실패 시 원본을 그대로 돌려준다 -- 그 경우 날짜처럼 읽히지 않는
  // 문자열이 캡션에 박히므로 아예 그리지 않는다.
  if (dayLabel === seoulDate) return null;

  const year = seoulDate.slice(0, 4);
  const label = year === today.slice(0, 4) ? dayLabel : `${year}년 ${dayLabel}`;
  return `${label} ${LINK_PRICE_CHECKED_SUFFIX}`;
}

/**
 * 판매처 행에 그릴 가격 표시. 가격과 확인 시각이 **둘 다** 쓸 수 있을 때만 값이 나온다.
 *
 * 한쪽만 있거나(계약 위반 응답·구버전 서버), 값이 판매가로 읽을 수 없는 수이거나, 시각을
 * 해석할 수 없으면 null이다 — 그때 화면은 종전 그대로 가격 칸을 비운다(모르는 것을 아는
 * 척하지 않는다).
 */
export function resolveLinkPriceDisplay(
  link: LinkPriceDisplayInput | null | undefined,
  today: string = getSeoulToday()
): LinkPriceDisplay | null {
  if (!link) return null;
  if (!isDisplayablePriceKrw(link.priceSnapshotKrw)) return null;
  if (typeof link.priceCheckedAt !== "string" || link.priceCheckedAt.length === 0) return null;

  const checkedAtCaption = checkedAtCaptionOf(link.priceCheckedAt, today);
  if (!checkedAtCaption) return null;

  return { priceText: formatKrw(link.priceSnapshotKrw), checkedAtCaption };
}

/**
 * 판매처 행 캡션 — 기존 라벨(플랫폼 이름)에 확인 시각을 잇는다: "쿠팡 · 8월 20일 확인".
 *
 * 가격을 그리지 않는 행은 캡션도 종전 그대로다(라벨만). 반대로 가격만 있고 캡션이 비는
 * 경우는 만들 수 없다 — 캡션의 재료가 가격과 같은 판정 객체에서만 나오기 때문이다(규칙 2).
 */
export function withLinkPriceCaption(
  baseCaption: string | undefined,
  display: LinkPriceDisplay | null
): string | undefined {
  if (!display) return baseCaption;
  const base = baseCaption?.trim();
  if (!base) return display.checkedAtCaption;
  return `${base}${LINK_PRICE_CAPTION_SEPARATOR}${display.checkedAtCaption}`;
}
