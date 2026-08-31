/**
 * 라운드 65 B(#4) — **동의 정의의 단일 소스는 서버다.**
 *
 * 종전에는 `{ type: "terms", version: "2026-07-06" }`이라는 같은 리터럴이 앱에 네 벌 있었고
 * (client.ts의 PUT 본문 두 줄 · local-backend.ts의 데모 정의·데모 upsert), 서버는 **type + version이
 * 정확히 일치하는 행만** 동의로 인정한다(apps/api onboarding-core.service.ts의 listConsents).
 * 그래서 약관을 개정해 버전이 올라가는 순간 기존 사용자 전원이 "동의 안 함"으로 뒤집히는데,
 * 앱은 여전히 옛 버전을 PUT하므로 **다시 동의할 방법 자체가 없었다**.
 *
 * 이 모듈은 그 리터럴을 대신하는 판정만 담는다 — 버전은 언제나 `GET /consents`가 준 정의에서
 * 오고(앱은 그것을 **그대로 되돌려준다**), 여기서는 "무엇을 되돌려줄지"만 고른다. 순수 함수인
 * 이유는 화면(로그인·SET-003)이 vitest에서 렌더되지 않기 때문이다 — 저장소의 다른 판정 모듈
 * (src/settings/consent-summary.ts)과 같은 관례다.
 *
 * `required`가 없는 응답(구 서버)은 필수도 선택도 아닌 것으로 둔다: 재동의 버튼도 스위치도
 * 만들지 않고 화면은 종전과 같다. **모르면 지어내지 않는다.**
 */

/** `GET /consents`(과 `GET /settings/privacy`의 consents)가 주는 한 항목. */
export type ConsentDefinitionView = {
  type: string;
  version: string;
  required: boolean;
  title: string;
  accepted: boolean;
  acceptedAt?: string | null;
};

/** `PUT /consents`가 받는 한 항목 — 서버가 준 type·version을 그대로 싣는다. */
export type ConsentUpsert = {
  type: string;
  version: string;
  accepted: boolean;
};

type PartialDefinition = Partial<ConsentDefinitionView>;

/** 되돌려 보낼 수 있는 항목인지: type·version이 둘 다 실제 문자열이어야 한다. */
function isAddressable(definition: PartialDefinition): boolean {
  return (
    typeof definition.type === "string" &&
    definition.type.length > 0 &&
    typeof definition.version === "string" &&
    definition.version.length > 0
  );
}

/** 필수인데 아직 동의되지 않은 항목(= 약관 개정으로 뒤집혔거나, 로그인 직후 PUT이 실패한 항목). */
export function pendingRequiredConsents(
  definitions: readonly PartialDefinition[] | null | undefined
): ConsentDefinitionView[] {
  return (definitions ?? []).filter(
    (definition): definition is ConsentDefinitionView =>
      Boolean(definition) && isAddressable(definition) && definition.required === true && definition.accepted !== true
  );
}

/** 필수 항목 중 아직 동의되지 않은 것만 "동의함"으로 되돌려준다. */
export function requiredConsentAcceptances(
  definitions: readonly PartialDefinition[] | null | undefined
): ConsentUpsert[] {
  return pendingRequiredConsents(definitions).map((definition) => consentAcceptance(definition, true));
}

/**
 * 이미 동의된 항목을 다시 보내지 않는 이유: 서버 upsert가 `acceptedAt`을 **매번 지금으로**
 * 덮어쓰므로(onboarding-core.service.ts), 재로그인할 때마다 "동의한 날"이 오늘로 밀린다.
 * 설정 화면의 동의 내역은 그 날짜를 사실로 보여준다 — 밀면 그 줄이 거짓이 된다.
 */
/**
 * ⚠ **테스트 전용 export**(라운드 71 리뷰 S-8 관례 · 라운드 88 트랙 D가 이유를 대장에서 여기로
 * 옮겼다). 화면이 `hasPendingRequiredConsents`를 부르지 않는 이유: 온보딩·설정은 "남았는가"(불리언)가 아니라
 * **"무엇이 남았는가"**(`pendingRequiredConsents`)와 **"무엇을 보낼 것인가"**
 * (`requiredConsentAcceptances`)를 묻고, 목록을 이미 손에 쥔 자리에서는 길이를 보면 된다.
 * **지우지 않는다** — 바로 위 문단이 적은 "왜 다시 보내지 않는가"의 술어판이라, 그 조건을
 * 계약이 이름으로 잡아 둘 자리가 필요하다.
 */
export function hasPendingRequiredConsents(
  definitions: readonly PartialDefinition[] | null | undefined
): boolean {
  return pendingRequiredConsents(definitions).length > 0;
}

/** 선택 항목(필수가 아님이 **명시된** 것만). 설정 화면이 스위치로 그리는 대상이다. */
export function optionalConsents(
  definitions: readonly PartialDefinition[] | null | undefined
): ConsentDefinitionView[] {
  return (definitions ?? []).filter(
    (definition): definition is ConsentDefinitionView =>
      Boolean(definition) && isAddressable(definition) && definition.required === false
  );
}

/** 한 항목의 동의/철회 본문 — 버전은 정의에서 온 값 그대로다. */
export function consentAcceptance(
  definition: { type: string; version: string },
  accepted: boolean
): ConsentUpsert {
  return { type: definition.type, version: definition.version, accepted };
}
