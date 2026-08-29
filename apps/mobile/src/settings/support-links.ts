/**
 * 라운드 71 트랙 D(GAP-071 #4) — **앱 안에 도움을 구할 길이 0건이었다.**
 *
 * `src/`·`app/` 어디에도 "문의"·"고객"·"도움말"·"FAQ"가 사용자 화면 문자열로 없었다. 더보기 탭의
 * 마지막 행("앱 정보")이 띄우는 것은 버전 한 줄이고, 예전에 있던 "고객센터"는 /settings/privacy로
 * 가는 눈속임 라우팅이라 라운드 UX-5B-9가 걷어냈다(app/(tabs)/more.tsx의 그 주석). 가짜 입구를
 * 없앤 것은 옳았고, 그 뒤로 **진짜 입구가 생기지 않았다.**
 *
 * 갈 곳은 이미 저장소에 있다(SITE-113): `infra/site/support.html`(문의 안내 + 계정·데이터 삭제
 * 절차 — Play Console 지원 URL 대상) · `infra/site/faq.html`(자주 묻는 질문). 그런데 그 페이지의
 * **호스팅 URL은 사용자 자산**이라 이 라운드가 만들 수 없다.
 *
 * 그래서 이 저장소가 이미 세 번 쓴 형식을 네 번째로 쓴다 — 푸시 토글(자산 없음 → 정직한 비활성) ·
 * 약관 링크(URL 없음 → 링크 없음) · 공유 URL(health 없음 → 버튼 없음)과 같은 **"고칠 수 없어서
 * 감춘다"**이다. 값이 주입되지 않은 빌드에서는 행 자체가 서지 않으므로 화면이 종전과 한 글자도
 * 다르지 않고, 죽은 링크도 지어낸 이메일 주소도 생기지 않는다(`[지원 이메일]`은 아직 placeholder다 —
 * 출시 준비 현황 §사용자 액션 5. 앱이 아는 것은 URL 하나까지다).
 *
 * 형식은 `src/consent/legal-links.ts`에서 **값이 아니라 형식만** 가져왔다(그 파일은 동의 문서의
 * 소유물이라 이 트랙이 손대지 않는다): 정규화 규칙 · 읽는 시점 · 멤버 표현식 유지가 같다.
 *
 * 문서 본문을 앱 번들에 복사하지 않는 이유도 같다 — `infra/site/*.html`이 단일 소스이고, 두 벌이
 * 되면 개정할 때 갈린다. 그래서 인앱 웹뷰도 만들지 않는다(`Linking.openURL` 하나 — 새 의존성은
 * known-limitations A절).
 *
 * ## 주입 방법
 *
 * 빌드에 아래 두 키를 넣는다(값이 없으면 종전 화면 그대로):
 *   EXPO_PUBLIC_SUPPORT_URL=https://.../support.html
 *   EXPO_PUBLIC_FAQ_URL=https://.../faq.html
 *
 * `EXPO_PUBLIC_*`는 babel-preset-expo가 **번들 시점에 인라인**하므로 멤버 표현식을 리터럴로
 * 유지한다(legal-links.ts · push-token-source.ts와 같은 규칙 — 키를 변수로 계산해 넣는 동적
 * 접근은 번들에서 값이 통째로 사라진다).
 */

export type SupportLinkKind = "support" | "faq";

/**
 * 열 수 있는 값만 URL로 인정한다. 빈 값·공백·`http(s)`가 아닌 스킴은 전부 null이다 —
 * 링크를 그렸는데 열리지 않는 것이 링크가 없는 것보다 나쁘다(legal-links.ts와 같은 규칙).
 */
export function normalizeSupportUrl(raw: string | undefined | null): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  return /^https?:\/\/\S+$/i.test(value) ? value : null;
}

/** 지금 빌드에 주입된 두 URL(없으면 null). 호출 시점에 읽으므로 테스트가 env를 바꿔 검증할 수 있다. */
export function supportLinkUrls(): Record<SupportLinkKind, string | null> {
  return {
    support: normalizeSupportUrl(process.env.EXPO_PUBLIC_SUPPORT_URL),
    faq: normalizeSupportUrl(process.env.EXPO_PUBLIC_FAQ_URL)
  };
}

/** 한 종류의 URL(없으면 null). */
export function supportLinkUrl(kind: SupportLinkKind): string | null {
  return supportLinkUrls()[kind];
}

/**
 * 행 이름과 부제 — **더보기 탭과 설정 화면이 같은 값을 읽는다.**
 *
 * 더보기 세션 메뉴는 제목만 그리고(그 행 문법에는 부제가 없다), 설정 화면은 다른 행들처럼 부제까지
 * 그린다. 문장은 그 페이지가 실제로 담고 있는 것만 말한다(infra/site/faq.html · support.html) —
 * 앱이 답을 해 준다고 약속하지 않는다.
 */
export const SUPPORT_LINK_LABELS: Record<SupportLinkKind, { title: string; subtitle: string }> = {
  faq: { title: "자주 묻는 질문", subtitle: "앱 사용 중 자주 나오는 질문과 답을 모았어요" },
  support: { title: "고객 지원", subtitle: "문의 방법과 계정 · 데이터 삭제 절차를 안내해요" }
};

/**
 * 열지 못했을 때(브라우저 부재·잘못된 URL) 뜨는 알림. **조용히 넘기지 않는다** —
 * 아무 일도 일어나지 않는 행을 남기면 그것이 곧 가짜 버튼이다(app/settings/privacy.tsx의 관례).
 */
export const SUPPORT_LINK_FAILED_TITLE = "링크를 열지 못했어요";
export const SUPPORT_LINK_FAILED_MESSAGE = "잠시 후 다시 시도해 주세요.";
