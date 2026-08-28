import type { ProductLink } from "./admin-api";

/**
 * GAP-064 #8 — 공개 리다이렉트(`GET /r/:code`)의 **공유 링크**를 어드민이 꺼내 쓰는 자리.
 *
 * 고치는 문제: 그 라우트는 처음부터 완성돼 있었다 — 인증 없는 공개 경로, 오픈 리다이렉트
 * 방어, 도메인 allowlist, 익명 클릭 기록까지(apps/api/src/items-commerce/redirect.controller.ts).
 * 그런데 `product_links.redirect_code`를 읽는 곳이 저장소 전체에서 그 컨트롤러의 조회
 * 한 줄뿐이라, 코드를 알아내는 방법이 12자 hex를 맞히는 것밖에 없었다 — **도달 불가**.
 * 컨트롤러 주석이 스스로 적어 둔 목적("meant to be shared/clicked by anyone, including
 * someone with no WooriAI account")이 하나도 실현되지 않았다.
 *
 * **DNC-010이 이 기능의 필수 조건이다.** 공개 링크가 운영의 손으로 뿌려지기 시작하면
 * 고지가 앱 밖에 남지 않는다 — 앱 안에서는 구매 CTA 바로 옆에 고지가 서지만, 카카오톡에
 * 붙여넣은 URL 옆에는 "인접"이라 부를 자리 자체가 없다. 그래서 복사 버튼은 URL만
 * 복사하지 않는다: 고지 대상 링크는 **고지 문구와 URL을 한 덩어리로** 복사한다.
 * 서버가 그 문구를 이미 해석해 실어 준다(종별 기본 문구까지 — items-catalog.service.ts
 * toAdminProductLinkDto의 `shareDisclosureText` — 제휴 수수료 문장까지 포함된 값이다).
 *
 * 반대 방향의 오류도 막는다: 제휴도 스폰서도 아닌 일반 링크에는 **없는 고지를 지어내지
 * 않는다**(라운드 43 M-1 규율). 그 경우 복사 결과는 URL 한 줄 그대로다.
 *
 * 라운드 64 M-1 — 읽는 필드가 `disclosureText`에서 `shareDisclosureText`로 바뀌었다.
 * 종전에는 운영이 쓴 원문을 그대로 복사했는데, 그러면 **앱보다 약한 고지**가 앱보다 넓게
 * 나갔다: 앱의 `purchaseLinkShareMessage`는 `withAffiliateDisclosure`를 지나 제휴 링크에
 * 수수료 문장을 반드시 포함시키는데(라운드 44 N-2), 어드민 복사에는 그 규율이 없어서
 * 수수료를 말하지 않는 커스텀 문구가 붙은 제휴 링크가 그대로 카카오톡·블로그로 나갔다.
 * 판정은 어드민이 아니라 **서버 한 곳**에 있다(apps/api src/items-commerce/share-disclosure.ts)
 * — 여기서 문구를 짓거나 고치지 않는 것이 이 모듈의 규율이고, 그래서 문구 사본이 늘지 않는다.
 */

/** 고지 문구와 URL을 잇는 줄바꿈. 두 줄로 나가는 이유는 위 DNC-010 문단. */
export const SHARE_TEXT_SEPARATOR = "\n";

/**
 * 이 행에서 **앱 밖으로 함께 나갈 고지 문구**. 서버가 정한 값을 그대로 쓴다.
 *
 * `shareDisclosureText` 이전에 캐시된 응답에는 이 키가 없다 — 그때는 `disclosureText`로
 * 물러선다. 고지를 통째로 잃는 것보다 종전(약한) 문구라도 함께 나가는 쪽이 DNC-010에
 * 가깝고, 새 응답에서는 서버가 항상 이 키를 싣는다.
 */
function shareDisclosureOf(link: Pick<ProductLink, "shareDisclosureText" | "disclosureText">): string {
  return (link.shareDisclosureText ?? link.disclosureText)?.trim() ?? "";
}

/**
 * 복사 버튼이 클립보드에 넣는 문자열.
 *
 * 고지 문구가 있으면 `{고지}\n{url}`, 없으면 `{url}` 한 줄. URL이 없으면 null이고
 * (비활성 링크·구버전 응답·코드 없는 행) 그때 화면은 버튼을 그리지 않는다 — 죽은 버튼을
 * 만들지 않는다.
 */
export function buildShareCopyText(
  link: Pick<ProductLink, "redirectShareUrl" | "shareDisclosureText" | "disclosureText">
): string | null {
  const url = link.redirectShareUrl?.trim();
  if (!url) return null;
  const disclosure = shareDisclosureOf(link);
  return disclosure ? `${disclosure}${SHARE_TEXT_SEPARATOR}${url}` : url;
}

/**
 * 복사 버튼 옆에 서는 안내. 고지 대상 링크에서는 "함께 복사된다"는 사실을 말하고,
 * 일반 링크에서는 덧붙일 말이 없다(빈 문자열 — 화면이 줄을 그리지 않는다).
 */
export function shareCopyHint(link: Pick<ProductLink, "shareDisclosureText" | "disclosureText">): string {
  return shareDisclosureOf(link) ? "제휴 고지 문구가 링크와 함께 복사돼요." : "";
}

/** 공유 링크를 실제로 꺼낼 수 있는 행인가(서버가 URL을 실어 준 행). */
export function hasShareUrl(link: Pick<ProductLink, "redirectShareUrl">): boolean {
  return !!link.redirectShareUrl?.trim();
}
