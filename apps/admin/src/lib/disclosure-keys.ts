/**
 * GAP-065 #9 — 고지 CMS 목록에서 **앱이 실제로 읽는 키**를 구분해 보여 준다.
 *
 * 고치는 문제: `PUT /admin/disclosures/:key`는 키를 검증하지 않고 upsert한다
 * (apps/api/src/onboarding/items-catalog.service.ts `adminUpdateDisclosure`).
 * 그래서 `affiliate_purchse` 같은 오타로 저장해도 화면은 "저장했어요"라고 답하는데
 * 앱이 읽는 값은 그대로다 — 운영은 고지를 고쳤다고 믿고, 앱에는 옛 문구가 남는다(DNC-010).
 *
 * 왜 검증이 아니라 표시인가: 모르는 키를 막으면 **나중에 쓸 키를 미리 막는다**
 * (지금도 `nutrition_supplement`처럼 시드에는 있지만 아직 어느 화면도 읽지 않는 키가 있다).
 * 그래서 저장은 종전 그대로 두고, 사실만 배지로 적는다 — 허위 표시 금지의 반대 방향이다:
 * "이 키를 앱이 읽는다/아직 읽지 않는다"는 저장소가 확실히 아는 사실이다.
 *
 * 단일 소스: `defaultDisclosureFor`(items-catalog.service.ts)가 링크의 `disclosure_text`가
 * 비었을 때 고르는 두 키다. 그 값이 앱 상세·클릭 응답·어드민 공유 문구에 그대로 실린다.
 * 서버가 그 목록을 API로 내보내지 않으므로 여기서는 사본을 든다 — 사본이 갈리는 것을
 * 막으려고 `disclosure-keys.test.ts`가 두 키의 철자와 개수를 고정한다.
 */

/** 앱이 링크 고지 기본값으로 읽는 키. 순서는 어드민 표시 순서와 무관하다. */
export const APP_READ_DISCLOSURE_KEYS = ["affiliate_purchase", "sponsored_product"] as const;

export type AppReadDisclosureKey = (typeof APP_READ_DISCLOSURE_KEYS)[number];

export type DisclosureKeyBadge = {
  /** 배지에 적히는 한 줄(해요체). */
  label: string;
  /** 강조 여부 — 앱이 읽는 키만 true. 화면은 이 값으로 배지 색을 고른다. */
  appRead: boolean;
  /** 배지 옆 보조 설명. 목록에서 왜 이 표시가 붙는지 한 줄로 답한다. */
  hint: string;
};

export function isAppReadDisclosureKey(key: string): key is AppReadDisclosureKey {
  return (APP_READ_DISCLOSURE_KEYS as readonly string[]).includes(key.trim());
}

/**
 * 목록 행 하나에 붙일 배지. 두 상태뿐이고 **어느 쪽도 저장을 막지 않는다**.
 *
 * - 앱이 읽는 키: 이 문구를 고치면 앱 구매 CTA 옆 문구가 바로 바뀐다는 뜻이다.
 * - 그 밖의 키: 아직 어느 화면도 읽지 않는다는 사실만 적는다. 오타일 수도, 앞으로 쓸
 *   키일 수도 있어 어느 쪽으로도 단정하지 않는다(둘을 구분할 근거가 서버에 없다).
 */
export function disclosureKeyBadge(key: string): DisclosureKeyBadge {
  if (isAppReadDisclosureKey(key)) {
    return {
      label: "앱이 이 키를 읽어요",
      appRead: true,
      hint: "고치면 앱 구매 링크 옆 고지 문구가 바로 바뀌어요."
    };
  }
  return {
    label: "앱이 아직 읽지 않는 키예요",
    appRead: false,
    hint: "키 철자가 앱이 읽는 값과 다르면, 저장해도 앱 화면은 그대로예요."
  };
}
