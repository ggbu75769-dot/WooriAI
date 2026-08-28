/**
 * 라운드 65 B(#5) — **동의하라고 요구하는 문서를 읽을 수 있게 한다.**
 *
 * 로그인 화면의 필수 체크박스 둘(이용약관 · 개인정보 수집·이용)과 SET-003의 동의 내역 카드에는
 * 링크가 한 개도 없었다. 문서 자체는 저장소에 있지만(infra/legal/terms-of-service.html ·
 * privacy-policy.html) 호스팅 URL은 **사용자 자산**이라 이 라운드가 만들 수 없다.
 *
 * 그래서 푸시 토글과 같은 관례를 쓴다(src/notifications/push-token-source.ts) — **자산이 없으면
 * 정직하게 감춘다.** 값이 주입되지 않은 빌드에서는 링크를 그리지 않으므로 화면이 종전과 한 글자도
 * 다르지 않고, 죽은 링크가 생기지 않는다.
 *
 * 본문을 앱 번들에 복사하지 않는 이유: `infra/legal/*.html`이 단일 소스이고, 두 벌이 되면 개정할 때
 * 갈린다.
 *
 * ## 주입 방법
 *
 * 빌드에 아래 두 키를 넣는다(값이 없으면 종전 화면 그대로):
 *   EXPO_PUBLIC_TERMS_URL=https://.../terms-of-service.html
 *   EXPO_PUBLIC_PRIVACY_POLICY_URL=https://.../privacy-policy.html
 *
 * `EXPO_PUBLIC_*`는 babel-preset-expo가 **번들 시점에 인라인**하므로 멤버 표현식을 리터럴로
 * 유지한다(kakao-login.ts의 getKakaoEnvConfig · push-token-source.ts와 같은 규칙 —
 * 키를 변수로 계산해 넣는 동적 접근은 번들에서 값이 통째로 사라진다).
 */

export type LegalDocumentKind = "terms" | "privacy";

/** 링크 접근성 라벨에 쓰는 문서 이름. */
export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentKind, string> = {
  terms: "이용약관",
  privacy: "개인정보 처리방침"
};

/**
 * 열 수 있는 값만 URL로 인정한다. 빈 값·공백·`http(s)`가 아닌 스킴은 전부 null이다 —
 * 링크를 그렸는데 열리지 않는 것이 링크가 없는 것보다 나쁘다.
 */
export function normalizeLegalDocumentUrl(raw: string | undefined | null): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  return /^https?:\/\/\S+$/i.test(value) ? value : null;
}

/** 지금 빌드에 주입된 두 문서 URL(없으면 null). 호출 시점에 읽으므로 테스트가 env를 바꿔 검증할 수 있다. */
export function legalDocumentUrls(): Record<LegalDocumentKind, string | null> {
  return {
    terms: normalizeLegalDocumentUrl(process.env.EXPO_PUBLIC_TERMS_URL),
    privacy: normalizeLegalDocumentUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)
  };
}

/** 한 종류의 URL(없으면 null). */
export function legalDocumentUrl(kind: LegalDocumentKind): string | null {
  return legalDocumentUrls()[kind];
}

/**
 * 동의 항목(type)이 가리키는 문서. 서버 정의의 `terms`·`privacy`만 문서를 갖고,
 * `marketing`처럼 읽을 문서가 없는 항목은 null이라 링크가 생기지 않는다.
 */
export function legalKindForConsentType(type: string | null | undefined): LegalDocumentKind | null {
  if (type === "terms") return "terms";
  if (type === "privacy") return "privacy";
  return null;
}
