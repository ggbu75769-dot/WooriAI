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
 * toAdminProductLinkDto의 `defaultDisclosureFor`).
 *
 * 반대 방향의 오류도 막는다: 제휴도 스폰서도 아닌 일반 링크에는 **없는 고지를 지어내지
 * 않는다**(라운드 43 M-1 규율). 그 경우 복사 결과는 URL 한 줄 그대로다.
 */

/** 고지 문구와 URL을 잇는 줄바꿈. 두 줄로 나가는 이유는 위 DNC-010 문단. */
export const SHARE_TEXT_SEPARATOR = "\n";

/**
 * 복사 버튼이 클립보드에 넣는 문자열.
 *
 * 고지 문구가 있으면 `{고지}\n{url}`, 없으면 `{url}` 한 줄. URL이 없으면 null이고
 * (구버전 응답·코드 없는 행) 그때 화면은 버튼을 그리지 않는다 — 죽은 버튼을 만들지 않는다.
 */
export function buildShareCopyText(
  link: Pick<ProductLink, "redirectShareUrl" | "disclosureText">
): string | null {
  const url = link.redirectShareUrl?.trim();
  if (!url) return null;
  const disclosure = link.disclosureText?.trim();
  return disclosure ? `${disclosure}${SHARE_TEXT_SEPARATOR}${url}` : url;
}

/**
 * 복사 버튼 옆에 서는 안내. 고지 대상 링크에서는 "함께 복사된다"는 사실을 말하고,
 * 일반 링크에서는 덧붙일 말이 없다(빈 문자열 — 화면이 줄을 그리지 않는다).
 */
export function shareCopyHint(link: Pick<ProductLink, "disclosureText">): string {
  return link.disclosureText?.trim() ? "제휴 고지 문구가 링크와 함께 복사돼요." : "";
}

/** 공유 링크를 실제로 꺼낼 수 있는 행인가(서버가 URL을 실어 준 행). */
export function hasShareUrl(link: Pick<ProductLink, "redirectShareUrl">): boolean {
  return !!link.redirectShareUrl?.trim();
}
