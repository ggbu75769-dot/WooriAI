import { Alert, Linking } from "react-native";

/**
 * 라운드 71 리뷰 S-2 — **앱 밖으로 나가는 링크 한 벌.**
 *
 * 같은 여섯 줄이 화면 셋에 각자 살아 있었다(app/(tabs)/more.tsx의 `openSupportLink`,
 * app/settings/index.tsx의 `openSupportLink`, app/settings/privacy.tsx의 `openLegalDocument`).
 * 갈리는 것은 **실패 Alert의 두 문자열**뿐이고, 판정(열 수 있는가 → 열기 → 못 열면 말하기)은
 * 한 글자도 다르지 않았다. 세 벌은 갈릴 때까지만 같다 — 하나만 고치면 다른 둘이 조용히 남는다.
 *
 * 그래서 규칙은 여기 한 벌이고, 화면은 **자기 문구만** 넘긴다(문구 자체는 여전히 각 화면의 단일
 * 소스 상수에서 온다 — 이 모듈은 문장을 만들지 않는다).
 *
 * 지키는 것 둘:
 *  - **인앱 웹뷰를 만들지 않는다.** 여는 방법은 `Linking.openURL` 하나다(새 의존성 0건 —
 *    known-limitations A절).
 *  - **조용히 실패하지 않는다.** 열 브라우저가 없거나 주소가 잘못됐으면 그 사실을 말한다.
 *    아무 일도 일어나지 않는 행을 남기는 것이 이 자리의 원래 병이었다.
 *
 * ⚠ 이 모듈은 react-native(`Linking`·`Alert`)를 들고 있어 vitest(node)에서 import되지 않는다.
 * 그래서 배선은 이 저장소의 관례대로 소스 그렙 계약이 고정한다(support-links.test.ts).
 */
export type ExternalUrlFailureCopy = {
  /** 실패 Alert 제목. 화면의 단일 소스 상수를 그대로 넘긴다. */
  failTitle: string;
  /** 실패 Alert 본문. 화면의 단일 소스 상수를 그대로 넘긴다. */
  failMessage: string;
};

export async function openExternalUrl(url: string, { failTitle, failMessage }: ExternalUrlFailureCopy): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) throw new Error("cannot-open-url");
    await Linking.openURL(url);
  } catch {
    Alert.alert(failTitle, failMessage);
  }
}
