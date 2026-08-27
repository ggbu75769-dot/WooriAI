import type { ProductLink } from "../api/client";

/**
 * 라운드 43 UX-V (C3): 구매 링크 한 줄의 **표기 판정** 단일 소스.
 *
 * 고치는 문제: 상세 화면이 배지(스폰서/제휴/일반)와 캡션을 따로 계산해서, 제휴가 아닌
 * 일반 링크에도 "제휴 링크" 캡션이 그대로 붙었다 — 배지는 "일반"인데 바로 옆 문장은
 * "제휴 링크"라고 말하는, 서로 어긋나는 두 주장이 한 줄에 있었다(시드 62개 품목에 달린
 * 링크 58개 중 39개가 isAffiliate=false인 일반 링크다). 제휴가 아닌 링크에 제휴 고지를
 * 붙이는 것도, 제휴인 링크의 고지를 빼는 것도 둘 다 사실과 다르다.
 *
 * 규칙:
 * - 스폰서 링크는 언제나 광고임을 밝힌다(DNC-011: 스폰서 상품은 일반 추천과 구분하고
 *   광고/스폰서 표시를 한다). isAffiliate 값과 무관하게 스폰서 판정이 우선이다 — 광고비를
 *   받은 자리라는 사실이 제휴 수수료 여부보다 먼저 읽혀야 한다.
 * - 제휴 링크는 "제휴 링크"라고 밝힌다(DNC-010).
 * - 일반 링크는 배지만 남기고 캡션을 **비운다**. 고지할 대상이 없는 링크에 고지 문구를
 *   붙이지 않는 것이지 숨기는 것이 아니므로 DNC-010 위반이 아니다.
 *
 * 정렬·추천 점수와는 무관하다(DNC-009) — 이 모듈은 이미 정해진 순서의 링크를 "어떻게
 * 적어 줄지"만 정한다.
 */

export type LinkMarkerTone = "warning" | "neutral";

export type ProductLinkMarkerInput = Pick<ProductLink, "isAffiliate" | "isSponsored">;

export type ProductLinkMarker = {
  /** 배지에 찍히는 짧은 말. */
  badgeLabel: string;
  /** 스폰서만 경고 톤으로 시각 구분한다(DNC-011). */
  badgeTone: LinkMarkerTone;
  /** 붙일 고지 문구. 일반 링크에는 없다(undefined). */
  caption?: string;
};

export const SPONSORED_MARKER_LABEL = "스폰서";
export const AFFILIATE_MARKER_LABEL = "제휴";
export const GENERAL_MARKER_LABEL = "일반";
export const SPONSORED_MARKER_CAPTION = "광고/스폰서";
export const AFFILIATE_MARKER_CAPTION = "제휴 링크";

export function productLinkMarker(link: ProductLinkMarkerInput): ProductLinkMarker {
  if (link.isSponsored) {
    return { badgeLabel: SPONSORED_MARKER_LABEL, badgeTone: "warning", caption: SPONSORED_MARKER_CAPTION };
  }
  if (link.isAffiliate) {
    return { badgeLabel: AFFILIATE_MARKER_LABEL, badgeTone: "neutral", caption: AFFILIATE_MARKER_CAPTION };
  }
  return { badgeLabel: GENERAL_MARKER_LABEL, badgeTone: "neutral" };
}

/**
 * 판매처 행의 보조 한 줄로 쓰는 플랫폼 이름. 예전에는 이 자리에 "무료배송"이 하드코딩돼
 * 있었는데, 배송 조건은 API 어디에도 없는 값이라 근거 없는 주장이었다. 대신 응답이 실제로
 * 주는 `platform`(coupang/naver/custom)을 사람이 읽는 말로 옮긴다.
 *
 * 알 수 없는 값은 "기타"로 떨어진다 — 계약(ProductLink.platform)이 늘어나도 화면이
 * 빈칸이나 영문 코드를 그대로 노출하지 않게 하기 위해서다.
 */
export const PRODUCT_PLATFORM_LABELS: Record<ProductLink["platform"], string> = {
  coupang: "쿠팡",
  naver: "네이버",
  custom: "기타"
};

export const FALLBACK_PLATFORM_LABEL = PRODUCT_PLATFORM_LABELS.custom;

export function productPlatformLabel(platform: string | undefined | null): string {
  if (!platform) return FALLBACK_PLATFORM_LABEL;
  return PRODUCT_PLATFORM_LABELS[platform as ProductLink["platform"]] ?? FALLBACK_PLATFORM_LABEL;
}

/**
 * C2: 구매처가 하나도 없는 준비템에서 화면이 말해야 할 것. 시드 62개 품목 중 4개
 * (pregnancy_vitamin·diaper_stock·baby_food_maker·first_books)가 링크 0개다.
 */
export const EMPTY_PRODUCT_LINKS_TEXT = "아직 등록된 구매처가 없어요.";

/** C4: 세션 경로의 판매처 목록 제목. 값이 하나뿐인 "가격 비교"를 대신한다. */
export const PRODUCT_LINKS_SECTION_TITLE = "구매처";

/** 링크가 하나라도 있어야 구매 CTA와 제휴 고지가 의미를 가진다. */
export function hasPurchasableLink(links: ReadonlyArray<unknown> | undefined | null): boolean {
  return Boolean(links && links.length > 0);
}
