/**
 * 라운드 64 M-1 — **앱 밖으로 나가는 구매 링크에 붙는 고지 문구**의 서버 쪽 규율.
 *
 * 고치는 문제: 같은 링크가 두 경로로 앱 밖에 나가는데 고지 강도가 서로 달랐다.
 *
 *  - 앱: `apps/mobile/src/items/link-marker.ts`의 `purchaseLinkShareMessage`가
 *    `withAffiliateDisclosure`를 지난다 — 제휴 링크면 수수료 문장이 **반드시** 포함된다
 *    (라운드 44 N-2). 운영이 넣어 둔 커스텀 문구가 수수료를 말하지 않아도 뒤에 이어붙는다.
 *  - 어드민: 링크 표의 "공유 링크 복사"는 서버가 준 `disclosureText` **원문만** 실었다.
 *    그래서 수수료를 말하지 않는 커스텀 문구가 붙은 제휴 링크는, 앱보다 **약한 고지**가
 *    붙은 채로 카카오톡·블로그 등 앱 밖으로 더 넓게 퍼졌다(DNC-010).
 *
 * 판정을 **서버 한 곳**으로 모은다. 모바일의 `AFFILIATE_DISCLOSURE_CORE_TERMS`(어절 목록)를
 * 서버에 복제하지 않는 것이 요점이다 — 그 목록이 두 벌이 되면 다음 라운드에 갈린다. 대신
 * 서버가 이미 들고 있는 **종별 기본 고지**(`disclosures` 테이블의 `affiliate_purchase` —
 * 시드 문구 자체가 "수수료를 받을 수 있어요"라고 말한다)를 그대로 재사용해 규칙 한 줄로 만든다:
 *
 *   제휴 링크의 공유 문구가 그 기본 수수료 문장을 아직 담고 있지 않으면, 뒤에 이어붙인다.
 *
 * 그래서 문구 사본은 늘지 않는다(새 문자열 리터럴이 이 파일에 없다). 판정이 어절이 아니라
 * **문장 포함**이라 모바일보다 좁다 — 다른 말로 수수료를 말하는 커스텀 문구에는 같은 뜻이
 * 한 번 더 붙을 수 있지만, 그 방향은 고지가 **넘치는** 쪽이라 DNC-010에 걸리지 않는다
 * (누락 방향의 오탐이 없다는 것이 이 규칙이 지키는 것이다).
 *
 * 순수 함수다(Nest·Prisma 무접촉) — 그래서 어드민의 대조 테스트가 이 규칙을 그대로 불러
 * 앱 경로와 맞대 볼 수 있다(apps/admin/src/lib/link-share.test.ts).
 */

/** 문장 끝에 종결부호가 없으면 붙인다 — 두 문장을 잇기 전에 경계를 만든다. */
function endSentence(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/**
 * 제휴 링크의 공유용 고지 문구를 만든다.
 *
 * @param resolvedText 그 링크에 이미 해석된 고지 문구(커스텀 값 또는 종별 기본 문구). 없으면 undefined.
 * @param commissionText 수수료를 말하는 종별 기본 문구(`disclosures.affiliate_purchase`).
 *
 * 기본 문구가 비어 있으면(운영이 고지 CMS에서 비운 이상 상태) 서버가 실을 수수료 문장이
 * 없으므로 원문을 그대로 돌려준다 — 없는 문장을 지어내지 않는다. 그 상태는 시드가 막고
 * (`apps/api/prisma/seed-data.ts` disclosureSeeds), 모바일의 link-marker.test.ts가
 * "affiliate_purchase 시드가 수수료를 말한다"를 따로 고정한다.
 */
export function withCommissionDisclosure(
  resolvedText: string | null | undefined,
  commissionText: string | null | undefined
): string | undefined {
  const base = resolvedText?.trim();
  const commission = commissionText?.trim();
  if (!commission) return base || undefined;
  if (!base) return commission;
  if (base.includes(commission)) return base;
  return `${endSentence(base)} ${commission}`;
}
