import type { ProductLink } from "./admin-api";

/**
 * GAP-064 #4 — 상품 링크 표의 **가격 열**이 쓰는 순수 표시 로직.
 *
 * 고치는 문제: 가격을 쓰는 유일한 경로가 CSV 일괄 교체인데(admin-api.ts
 * PRODUCT_LINK_BULK_CSV_HEADER · 서버 product-link-bulk.service.ts) 어드민 어디에도
 * 그 값을 되읽는 자리가 없었다. 셋이 함께 다쳤다 — ⓐ 500행을 적용하고 받는 것은
 * `{applied, skipped, errors}` 숫자 셋뿐이라 **쓰기 확인 불가**, ⓑ 앱이 만료 창을 지난
 * 스냅샷을 그리지 않는데 그 사실이 **아무에게도 보고되지 않는 조용한 만료**,
 * ⓒ 몇 개 품목에 가격이 있는지 세는 수단이 없는 **커버리지 불가시**.
 *
 * 표시 규칙(전부 정직성 제약이다):
 *
 *  1. **어드민에는 반쪽짜리 상태도 보여준다.** 앱 응답은 "가격과 확인 시각이 둘 다
 *     있을 때만" 싣지만(items-catalog.service.ts toProductLinkDto), 어드민이 봐야 하는
 *     것은 정확히 그 규칙에 걸려 **앱에서 사라진 행**이다. 그래서 값은 그대로 싣되
 *     그 상태를 이름으로 말한다: "시각 없음"(앱에 안 나감) / "만료"(보존 창 경과).
 *
 *  2. **문턱 숫자를 여기에 다시 박지 않는다.** 만료 여부는 서버가 계약
 *     (`@wooriai/contracts` LINK_PRICE_MAX_AGE_DAYS)을 읽어 판정한 `priceExpired`
 *     불리언을 그대로 쓴다 — 어드민이 자기 숫자를 들면 다음 라운드에 앱과 갈린다
 *     (라운드 63 #9의 교훈). 그래서 이 파일에는 만료 문턱 수 자체가 등장하지 않는다.
 *
 *  3. **모르는 것을 지어내지 않는다.** 가격이 없으면 "-"이고, 추정도 합계도 없다.
 *
 * DNC-009: 이 값들은 표시 전용이다. 링크 정렬은 서버가 정하고(displayOrder + 헬스
 * 강등) 이 모듈은 어떤 정렬·필터에도 관여하지 않는다.
 */

export type LinkPriceState =
  /** 가격이 없다(확인 시각만 있는 행 포함 — 가리킬 값이 없다). */
  | "none"
  /** 가격은 있는데 확인 시각이 없다 → 앱은 이 가격을 아예 내려받지 못한다. */
  | "undated"
  /** 확인한 지 문턱을 넘겼다 → 앱이 그리지 않는다(조용한 만료). */
  | "expired"
  /** 가격 + 확인 시각이 있고 나이도 문턱 안 → 앱에 그대로 보인다. */
  | "fresh";

/** 상태 뒤에 붙는 짧은 이름. "정상"인 값에는 이름을 붙이지 않는다(열이 시끄러워진다). */
export const LINK_PRICE_STATE_LABELS: Record<Exclude<LinkPriceState, "none" | "fresh">, string> = {
  undated: "시각 없음",
  expired: "만료"
};

/** 가격이 없을 때 셀에 남기는 문자. */
export const LINK_PRICE_EMPTY_TEXT = "-";

export function linkPriceState(link: Pick<ProductLink, "priceSnapshotKrw" | "priceCheckedAt" | "priceExpired">): LinkPriceState {
  const price = link.priceSnapshotKrw;
  if (typeof price !== "number") return "none";
  if (!link.priceCheckedAt) return "undated";
  return link.priceExpired ? "expired" : "fresh";
}

/** "159,000원". 가격이 없으면 "-". 금액 표기는 어드민의 다른 표와 같은 ko-KR 관례. */
export function linkPriceText(link: Pick<ProductLink, "priceSnapshotKrw">): string {
  const price = link.priceSnapshotKrw;
  if (typeof price !== "number") return LINK_PRICE_EMPTY_TEXT;
  return `${price.toLocaleString("ko-KR")}원`;
}

/**
 * 가격 셀의 캡션 — 확인 시각과 그 상태. 값이 없으면 빈 문자열(줄이 없다).
 *
 * 날짜는 "YYYY-MM-DD"까지만 적는다. 헬스 배지의 상대 시각("3시간 전")과 달리 가격의
 * 기준은 **날짜 단위**이고(앱의 만료 판정도 서울 달력 날짜로 센다), 상대 표기는
 * 반년 전 값을 "며칠 전" 셈으로 읽게 만들어 오히려 덜 읽힌다.
 */
export function linkPriceCaption(
  link: Pick<ProductLink, "priceSnapshotKrw" | "priceCheckedAt" | "priceExpired">
): string {
  const state = linkPriceState(link);
  if (state === "none") return "";
  if (state === "undated") return LINK_PRICE_STATE_LABELS.undated;
  const checkedOn = (link.priceCheckedAt ?? "").slice(0, 10);
  return state === "expired" ? `${checkedOn} 확인 · ${LINK_PRICE_STATE_LABELS.expired}` : `${checkedOn} 확인`;
}

/**
 * 이 가격이 지금 **앱 화면에 그려지는가**. `false`인 상태(시각 없음·만료)가 운영이
 * 보지 못하던 사각이므로, 화면은 이 판정으로 셀을 흐리게 그린다.
 */
export function isLinkPriceVisibleInApp(
  link: Pick<ProductLink, "priceSnapshotKrw" | "priceCheckedAt" | "priceExpired">
): boolean {
  return linkPriceState(link) === "fresh";
}

/**
 * 목록 머리말의 커버리지 한 줄(#4ⓒ) — "가격 있는 링크 n건 · 앱에 보이는 가격 m건".
 *
 * 두 수를 **함께** 말하는 것이 요점이다: 하나만 말하면 "가격을 넣었는데 앱에 안 보이는"
 * 구간이 그대로 가려진다(그 구간이 이 후보가 든 조용한 만료다).
 */
export function linkPriceCoverageSummary(links: Array<Pick<ProductLink, "priceSnapshotKrw" | "priceCheckedAt" | "priceExpired">>): string {
  const withPrice = links.filter((link) => linkPriceState(link) !== "none").length;
  const visible = links.filter((link) => isLinkPriceVisibleInApp(link)).length;
  return `가격 있는 링크 ${withPrice}건 · 앱에 보이는 가격 ${visible}건`;
}
