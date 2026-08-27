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

/** 링크가 하나라도 있어야 구매 CTA가 의미를 가진다. */
export function hasPurchasableLink(links: ReadonlyArray<unknown> | undefined | null): boolean {
  return Boolean(links && links.length > 0);
}

/* ------------------------------------------------------- 구매 CTA 옆 고지 문구 */

/**
 * 라운드 43 리뷰 M-1/M-2: 구매 CTA 옆 고지를 **링크 집합**으로 판정한다.
 *
 * 고치는 문제: 상세 화면은 `productLinks[0]?.disclosureText`만 읽고, 값이 없으면 컴포넌트
 * 기본 문구("이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.")를 그렸다. 그래서
 * 두 가지가 동시에 틀렸다.
 *
 *  - 허위 고지: 시드 링크 58개 중 34개가 제휴도 스폰서도 아닌 **일반 링크**다. 그런 링크만
 *    달린 화면이 "수수료를 받을 수 있어요"라고 말했다 — 받지 않는 돈을 받는다고 말하는 쪽도
 *    사실과 다른 표시다(DNC-010은 고지를 숨기지 말라는 계약이지, 고지 대상이 없는 자리에도
 *    띄우라는 계약이 아니다. 고지 대상 자체가 없을 때 렌더하지 않는 것은 C2의 "구매처 0개"
 *    근거와 같고, 은닉이 아니다).
 *  - 정렬 결합(M-2): 문구가 **index 0**에 달려 있으니, 워커 헬스로 깨진 링크를 뒤로 미는
 *    정렬(UX-W)이 바뀌면 고지 문구가 조용히 따라 바뀌었다. 고지는 어떤 링크가 맨 앞에
 *    왔는지가 아니라 **집합에 무엇이 있는지**로 정해져야 한다.
 *
 * 규칙:
 *  1. 집합에 스폰서도 제휴도 없으면 고지를 그리지 않는다(undefined).
 *  2. 있으면 스폰서 > 제휴 순서로 종별을 고르고, 그 종의 링크가 들고 있는 disclosureText를
 *     쓴다. 하나도 없으면 종별 기본 문구를 쓴다.
 *  3. 라운드 44 리뷰 N-2: 집합에 **제휴 링크가 하나라도 있으면** 최종 문구는 수수료 고지를
 *     반드시 포함한다. 2번만으로는 스폰서 문구가 수수료 문장을 통째로 **대체**했다 —
 *     운영이 넣어 둔 스폰서 커스텀 문구("스폰서 상품 예시예요.", seed-data.ts:1225)나
 *     수수료를 말하지 않는 어떤 문구든, 그 화면의 제휴 링크에 붙어야 할 CTA 인접 수수료
 *     고지를 지웠다(DNC-010 위반). 이미 수수료를 말하고 있으면 그대로 두고, 아니면 이어붙인다.
 *
 * 스폰서가 섞인 집합에서 제휴 사실이 사라지지 않는가(M-2): 사라지지 않는다. 판매처 행마다
 * `productLinkMarker`가 배지와 캡션을 따로 붙이므로, 스폰서 문구가 위에 뜨는 화면에서도
 * 제휴 링크 행에는 "제휴" 배지 + "제휴 링크" 캡션이 그대로 남는다(DNC-010·DNC-011).
 */
export type ProductLinkDisclosureInput = ProductLinkMarkerInput & {
  disclosureText?: string | null;
};

/** DNC-010의 고정 문구. 제휴 링크가 있는데 운영이 문구를 안 넣어 둔 경우의 기본값이다. */
export const AFFILIATE_DISCLOSURE_FALLBACK_TEXT = "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.";

/**
 * 스폰서가 섞인 집합의 기본값. 광고임을 먼저 밝히고(DNC-011) 수수료 고지를 그대로 잇는다
 * (DNC-010의 승인 문구를 문장째 포함한다). 해요체(DNC-018).
 */
export const SPONSORED_DISCLOSURE_FALLBACK_TEXT =
  "스폰서 광고 링크예요. 이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.";

/**
 * 라운드 44 리뷰 N-2: "이 문구가 이미 수수료를 말하고 있는가"를 판정하는 표현 집합.
 *
 * 문장째 비교(`includes(AFFILIATE_DISCLOSURE_FALLBACK_TEXT)`)를 쓰지 않는 이유는, 실제로
 * 쓰이는 수수료 고지가 한 문장이 아니기 때문이다 — 서버 시드는 "…구매하시면 수수료가 발생할 수
 * 있어요."이고 데모 픽스처는 "…제휴수수료를 받을 수 있어요."다. 문장째로 보면 둘 다
 * "수수료 고지 없음"으로 판정돼 같은 말이 두 번 붙는다.
 *
 * 라운드 45 O-6: 그렇다고 "수수료" 한 낱말로 보면 반대쪽으로 틀린다. "배송 수수료는 별도예요"
 * 처럼 **사용자가 내는 비용**을 말하는 문구도 "이미 고지함"으로 판정돼, 그 화면의 제휴 고지가
 * 통째로 빠졌다 — 고지 누락 방향의 오탐이라 DNC-010에 직접 걸린다. 그래서 "우리가 수수료를
 * 받는다"는 뜻을 만드는 **어절 결합**만 본다(받는다 / 발생한다 / 지급받는다). 여기 없는 새 표현은
 * "고지 없음"으로 판정돼 승인 문구가 덧붙는 쪽으로 틀린다 — 안전한 방향이다.
 */
export const AFFILIATE_DISCLOSURE_CORE_TERMS = [
  "수수료를 받",
  "수수료가 발생",
  "수수료를 지급",
  "수수료를 제공받"
] as const;

/** 이 문구가 이미 "수수료를 받는다"는 사실을 말하고 있는가. */
export function statesAffiliateCommission(text: string): boolean {
  return AFFILIATE_DISCLOSURE_CORE_TERMS.some((term) => text.includes(term));
}

/** 문장 끝에 종결부호가 없으면 붙인다 — 두 문장을 잇기 전에 경계를 만든다. */
function endSentence(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/**
 * 수수료 고지를 **반드시 포함하는** 문구로 만든다. 이미 말하고 있으면 그대로 둔다
 * (같은 말을 두 번 적지 않는다). 제휴 링크가 있는 집합에서만 부른다 — 제휴가 아닌 자리에
 * 수수료를 받는다고 적는 것도 똑같이 사실과 다른 표시다.
 */
export function withAffiliateDisclosure(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return AFFILIATE_DISCLOSURE_FALLBACK_TEXT;
  if (statesAffiliateCommission(trimmed)) return trimmed;
  return `${endSentence(trimmed)} ${AFFILIATE_DISCLOSURE_FALLBACK_TEXT}`;
}

function firstDisclosureText(links: ReadonlyArray<ProductLinkDisclosureInput>): string | undefined {
  for (const link of links) {
    const text = link.disclosureText?.trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * 구매 CTA 옆에 그릴 고지 문구. 고지 대상이 하나도 없으면 undefined(= 렌더하지 않는다).
 *
 * 순서 비의존: 같은 집합이면 어떤 순서로 들어와도 같은 값이 나온다.
 */
export function productLinksDisclosureText(
  links: ReadonlyArray<ProductLinkDisclosureInput> | undefined | null
): string | undefined {
  if (!links || links.length === 0) return undefined;

  // 수수료 고지가 필요한지는 **집합 전체**가 정한다. 스폰서 링크 자신이 제휴이기도 한
  // 경우(시드·데모 픽스처의 흔한 조합)와 스폰서 옆에 별도 제휴 링크가 있는 경우를 함께 덮는다.
  const hasAffiliate = links.some((link) => link.isAffiliate);

  const sponsored = links.filter((link) => link.isSponsored);
  if (sponsored.length > 0) {
    const text = firstDisclosureText(sponsored) ?? SPONSORED_DISCLOSURE_FALLBACK_TEXT;
    return hasAffiliate ? withAffiliateDisclosure(text) : text;
  }

  if (hasAffiliate) {
    const affiliate = links.filter((link) => link.isAffiliate);
    return withAffiliateDisclosure(firstDisclosureText(affiliate) ?? AFFILIATE_DISCLOSURE_FALLBACK_TEXT);
  }

  return undefined;
}
