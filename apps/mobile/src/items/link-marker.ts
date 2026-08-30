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
 * C2: 구매처가 하나도 없는 준비템에서 화면이 말해야 할 것. 이 문구가 처음 선 라운드에는
 * 시드 62개 품목 중 4개(pregnancy_vitamin·diaper_stock·baby_food_maker·first_books)가
 * 링크 0개였다 — 라운드 82 B가 그 넷에 일반 링크를 채워 시드는 이제 62/62이지만,
 * 어드민이 링크를 비활성화하거나 운영 데이터가 시드와 다른 창에서는 여전히 도달한다.
 */
export const EMPTY_PRODUCT_LINKS_TEXT = "아직 등록된 구매처가 없어요.";

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
 *  - 허위 고지: 시드 링크 중 절반 이상이 제휴도 스폰서도 아닌 **일반 링크**다
 *    (라운드 43 당시 58개 중 34개 · 라운드 82 B 이후 62개 중 38개). 그런 링크만
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
 * 쓰이는 수수료 고지가 한 문장이 아니기 때문이다. 이 판정이 받는 문구의 **소스는 셋**이다.
 *
 *  1. 서버 시드 — `apps/api/prisma/seed-data.ts`의 productLinkSeeds.disclosureText
 *     ("제휴 링크 예시예요. 구매하시면 수수료가 발생할 수 있어요.")와, 링크가 문구를 비워 뒀을 때
 *     쓰이는 disclosureSeeds의 종별 기본값(affiliate_purchase / sponsored_product —
 *     items-catalog.service.ts의 `defaultDisclosureFor`가 붙인다).
 *  2. 데모(로컬 백엔드) 픽스처 — `src/api/local-fixtures.ts`
 *     ("이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요.").
 *  3. 운영의 런타임 편집 — `PUT /api/v1/admin/disclosures/:key`. 어드민이 종별 기본 문구를
 *     언제든 갈아끼울 수 있으므로, 여기 나열된 표현은 **지금 아는 문구의 목록**이지 닫힌 집합이
 *     아니다. 모르는 표현은 "고지 없음"으로 떨어져 승인 문구가 덧붙는다(안전한 방향).
 *
 * 문장째로 보면 1·2가 둘 다 "수수료 고지 없음"으로 판정돼 같은 말이 두 번 붙는다.
 *
 * 라운드 45 O-6: 그렇다고 "수수료" 한 낱말로 보면 반대쪽으로 틀린다. "배송 수수료는 별도예요"
 * 처럼 **사용자가 내는 비용**을 말하는 문구도 "이미 고지함"으로 판정돼, 그 화면의 제휴 고지가
 * 통째로 빠졌다 — 고지 누락 방향의 오탐이라 DNC-010에 직접 걸린다. 그래서 "우리가 수수료를
 * 받는다"는 뜻을 만드는 **어절 결합**만 본다.
 *
 * 라운드 46 Q-3: 그 어절 결합에서 "수수료가 발생"만은 아직 넓었다. 이 표현은 **누가 받는지를
 * 스스로 말하지 않아서**, 사용자 부담 비용을 안내하는 문구까지 "이미 고지함"으로 삼켰다 —
 * "결제 취소 시 수수료가 발생할 수 있어요", "해외 결제 수수료가 발생해요"가 그렇다(운영이
 * 3번 소스로 넣을 수 있는 실제 문장들이다). 그러면 O-6이 고친 것과 똑같은 고지 누락이
 * 되돌아온다. 그래서 "수수료가 발생"은 **수령 맥락 어절과 붙어 있을 때만** 인정한다 —
 * 구매(구매 시 / 구매하면 / 구매하시면 / 구매를 통해)나 제휴가 앞에 있어야 한다.
 * "수수료를 받/지급/제공받"은 어절 자체가 수령을 말하므로 그대로 둔다.
 */
export const AFFILIATE_DISCLOSURE_CORE_TERMS = [
  // 어절 자체가 "받는다"를 말한다.
  "수수료를 받",
  "수수료를 지급",
  "수수료를 제공받",
  // "발생"은 주체가 비어 있으므로 수령 맥락과 붙은 형태만 인정한다(Q-3).
  "구매 시 수수료가 발생",
  "구매하면 수수료가 발생",
  "구매하시면 수수료가 발생",
  "구매하실 때 수수료가 발생",
  "구매를 통해 수수료가 발생",
  "제휴 수수료가 발생",
  "제휴수수료가 발생"
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

export type ProductLinkFillInput = Pick<ProductLink, "isSponsored">;

/**
 * 판매처 목록에서 **채워진 "구매하기" 버튼**을 받을 행의 인덱스. 없으면 -1.
 *
 * 승인 캡처(ITEM-002)는 판매처 첫 줄만 채운 CTA고 나머지는 외곽선이다. 그런데 그 "첫 줄"을
 * 순서만으로 정하면, 스폰서 링크가 displayOrder 1위로 올라온 순간 **광고 자리만** 화면에서
 * 가장 강한 버튼을 갖는다 — 스폰서를 일반 추천과 구분해 표시하라는 DNC-011의 취지를
 * 거꾸로 뒤집는 결과다(구분은 하되, 구분이 우대가 되면 안 된다).
 *
 * 그래서 채움은 **첫 번째 비스폰서 링크**가 받는다. 스폰서 링크는 순서와 무관하게 외곽선
 * 버튼이고, 전부 스폰서면 채워진 버튼이 하나도 없다(-1). 정렬 자체는 건드리지 않는다 —
 * 이 함수는 이미 정해진 순서에서 "어느 줄을 강조할지"만 고른다(DNC-009).
 */
export function primaryPurchaseLinkIndex(
  links: ReadonlyArray<ProductLinkFillInput> | undefined | null
): number {
  if (!links || links.length === 0) return -1;
  return links.findIndex((link) => !link.isSponsored);
}

/* ------------------------------------------------------- 앱 밖으로 나가는 구매 링크 */

/**
 * 라운드 64 #5ⓐ: 구매 링크를 **앱 밖으로** 보낼 때 함께 나가는 한 줄.
 *
 * 고치는 문제: 링크를 자동으로 열지 못했을 때 뜨는 카드의 "링크 공유하기"가 리다이렉트 URL
 * **한 줄만** 보냈다. 받는 사람은 그것이 제휴 링크라는 사실을 한 번도 듣지 못한 채 그 URL로
 * 구매한다. DNC-010은 "구매 CTA 인접 위치의 제휴 고지를 숨기지 않는다"는 계약인데, 앱 밖으로
 * 나간 링크에는 **인접이라 부를 자리 자체가 없다** — 그러면 문장을 링크와 함께 보내는 것
 * 말고 그 계약을 지킬 방법이 없다.
 *
 * 문구를 새로 만들지 않는다: 화면의 `AffiliateDisclosure`가 쓰는 그 판정
 * (`productLinksDisclosureText`)을 **공유되는 그 링크 하나**에 그대로 적용한다. 그래서
 *  - 제휴 링크에는 수수료 고지가 반드시 붙고(N-2의 규율이 여기서도 그대로 돈다),
 *  - 스폰서 링크는 광고임을 먼저 밝히며(DNC-011),
 *  - 제휴도 스폰서도 아닌 일반 링크는 **종전 그대로 URL 한 줄**이다 — 고지 대상이 없는
 *    자리에 고지를 지어내지 않는다(라운드 43 M-1과 같은 근거).
 *
 * 서버 클릭 응답이 그 링크의 문구를 함께 주면(`disclosureText`) 그것이 우선이다 — 운영이
 * 어드민에서 편집한 값이 앱의 기본값보다 앞선다. 다만 그 값도 같은 판정을 지나므로, 수수료를
 * 말하지 않는 커스텀 문구가 제휴 링크의 수수료 고지를 지우는 일은 없다.
 *
 * 순수 함수다(Share/Linking 무접촉) — 조립이 한 자리에만 있어 문구가 두 벌이 되지 않는다.
 */
export function purchaseLinkShareMessage(input: {
  url: string;
  link: ProductLinkDisclosureInput;
  /** 클릭 응답이 준 그 링크의 고지 문구(있으면 링크 자신의 값보다 우선). */
  disclosureText?: string | null;
}): string {
  const notice = productLinksDisclosureText([
    {
      isAffiliate: input.link.isAffiliate,
      isSponsored: input.link.isSponsored,
      disclosureText: input.disclosureText ?? input.link.disclosureText
    }
  ]);
  if (!notice) return input.url;
  return `${notice}\n${input.url}`;
}

/**
 * 라운드 68 C(#4) — **내보낼 수 있는 주소가 실제로 있는가.**
 *
 * 서버는 `/r/:code`의 절대 주소(`shareUrl`)를 스스로 조립해 클릭 응답에 싣는데, 그 자리에
 * 조건이 하나 늘었다: 워커가 눌러 보고 4xx를 받은 링크(`health_status = "broken"`)에는 그 값을
 * 싣지 않는다(apps/api/.../items-catalog.service.ts의 `shareableRedirectUrl`). 즉 이 앱이 보는
 * "`shareUrl`이 없다"는 세 가지를 한꺼번에 뜻한다 — 서버가 죽은 줄 아는 링크 · 코드가 없는 옛
 * 데이터 · `shareUrl`을 아직 보내지 않는 구버전 서버.
 *
 * **셋 다 답은 같다: 내보내지 않는다.** 종전에는 이 자리에서 `redirectUrl`(= 저장된 원문 제휴
 * URL)로 떨어졌는데, 그것은 라운드 67 #4가 없애려던 바로 그 값이다 — 그 사본으로 산 구매는
 * `affiliate_clicks`에 흔적이 없고(우리가 만든 유입인데 우리 숫자에는 없다), 어드민이 링크를
 * 내려도 이미 나간 사본은 영영 산다. broken인 경우에는 거기에 더해 **우리가 죽은 줄 아는 주소**를
 * 친구에게 보내는 셈이다. 공유할 수 있는 주소가 없다는 것이 사실이므로, 없는 것을 대신 지어내지
 * 않는다(화면은 이 판정이 false면 공유 버튼을 아예 그리지 않는다).
 *
 * ⚠️ 링크를 목록에서 감추거나 "깨졌어요"라고 적는 일과는 무관하다 — 이 판정이 정하는 것은
 * **앱 밖으로 나가는 사본** 하나뿐이고, 여는 URL·링크 목록·개수·정렬은 종전 그대로다.
 *
 * 곁가지: 데모 백엔드(src/api/local-backend.ts)는 `shareUrl`을 아예 주지 않으므로 데모에서는
 * 이 판정이 늘 false다. 그쪽은 서버 흉내라 `/r/:code`로 응답할 것이 없고, 없는 주소를 내보내지
 * 않는 것이 그 화면에서도 사실이다(그 파일은 이 변경의 무접촉 대상이다).
 */
export function canSharePurchaseLink(shareUrl: string | null | undefined): shareUrl is string {
  return typeof shareUrl === "string" && shareUrl.trim().length > 0;
}

/** 내보낼 주소가 없을 때 실패 카드가 그 자리에서 말하는 사실. 판매처를 탓하지 않는다. */
export const LINK_SHARE_UNAVAILABLE_NOTICE = "지금은 공유할 수 있는 주소가 없어요.";

/** 링크를 열지 못했고 **공유는 할 수 있는** 상태의 문구(종전 문장 그대로). */
export const LINK_OPEN_FAILED_SHAREABLE_NOTICE = "링크를 열지 못했어요. 링크를 공유하거나 다시 시도해 주세요.";

/**
 * 링크를 열지 못했고 **내보낼 주소도 없는** 상태의 문구.
 *
 * 클릭 기록 자체가 실패했을 때의 문장("링크를 열지 못했어요. **잠시 후** 다시 시도해 주세요." —
 * app/items/[itemTemplateId].tsx의 `clickLink.onError`)과는 다른 갈래다: 그쪽은 서버 왕복이
 * 실패해 잠시 뒤면 될 수도 있는 상태이고, 이쪽은 주소는 이미 받았는데 기기가 열지 못한 상태라
 * 기다림이 답이 아니다.
 */
export const LINK_OPEN_FAILED_NOTICE = "링크를 열지 못했어요. 다시 시도해 주세요.";

/**
 * 링크 열기 실패 문구. 공유 버튼이 서지 않는 상태에서 "링크를 공유하거나"라고 말하면 화면의 두
 * 주장이 어긋난다(있지도 않은 버튼을 가리킨다) — 그래서 같은 판정에서 갈린다. 공유가 가능한
 * 종전 경로의 문장은 **한 글자도 바뀌지 않는다**.
 */
export function linkOpenFailureNotice(shareUrl: string | null | undefined): string {
  return canSharePurchaseLink(shareUrl) ? LINK_OPEN_FAILED_SHAREABLE_NOTICE : LINK_OPEN_FAILED_NOTICE;
}
