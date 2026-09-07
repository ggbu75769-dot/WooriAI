import { useEffect, useRef } from "react";
import { announceForA11y } from "../ui";

/**
 * A11Y-115 — **필드 검증 오류가 새로 생겼을 때 그 문장을 낭독한다.**
 *
 * ## 왜 필요한가, 그리고 왜 프롭 둘로는 부족한가
 *
 * 금액·날짜·길이를 잘못 치면 포커스는 **입력칸에 남고** 오류 한 줄이 그 아래에 새로 선다. 소리로만
 * 쓰는 사람에게는 그 줄을 만나러 갈 이유가 없어서, [저장]이 왜 잠겼는지 끝내 알 수 없다. 그 자리에
 * 프롭 둘(`accessibilityLiveRegion="polite"` + `accessibilityRole="alert"`)을 걸면 **안드로이드에서만**
 * 소리가 난다 — 앞의 것은 RN 문서가 `@platform android`로 표시한 프롭이고 뒤의 것에는 VoiceOver의
 * 대응 트레이트가 없다(라운드 79 리뷰 M-1의 그 판정 · `docs/operations/known-limitations.md` T-1).
 * 크로스플랫폼의 답은 이 저장소에 이미 있다: `src/ui.tsx`의 `announceForA11y`이고,
 * `app/(auth)/login.tsx`·`app/settings/children.tsx`·`app/settings/categories.tsx`가 **같은 이유**
 * (포커스가 방금 만진 컨트롤에 남는다)로 그것을 쓴다. 이 훅은 그 관례를 호출부마다 다시 적지
 * 않도록 한 벌로 올린 것이다 — `src/ui/use-transient-notice.ts`가 토스트 수명에 한 것과 같은 걸음.
 *
 * **새 한국어 문장 0건.** 읽히는 것은 화면이 이미 그리고 있는 그 문자열이다(문구의 단일 소스는
 * `src/expenses/amount-limit.ts`·`text-limits.ts`·`entry-form-guards.ts`가 그대로 진다).
 *
 * ## 재낭독 금지 — 의존 배열만으로는 부족한 이유
 *
 * 같은 문장이 **선 채로** 리렌더로 다시 서면 읽지 않아야 하고, 갈래가 **닫혔다 같은 문장으로 다시
 * 열리면**(오류를 고쳤다가 똑같이 다시 틀리는 창) 사용자에게는 새로 생긴 오류라 **다시** 읽혀야
 * 한다. 그래서 판정은 ref가 지고, 갈래가 닫히는 걸음에 기억을 지운다 —
 * `src/preparation/PreparationListParity.tsx`의 검색 결과 낭독(라운드 90 트랙 A · 리뷰 H-1)이 세운
 * 바로 그 규율이고, 이 훅은 그 모양을 글자 그대로 따른다.
 *
 * ⚠️ **훅은 언제나 조기 반환보다 위에서 부른다**(FIX-A) — 오류가 없을 때도 `null`을 넘겨 부른다.
 * 조건부 호출은 훅 순서를 깨고, 무엇보다 "갈래가 닫혔다"를 이 훅이 볼 수 없게 만든다(기억을 지우는
 * 걸음이 사라져 같은 오류가 두 번째부터 조용해진다).
 *
 * ⚠️ **안드로이드 이중 낭독은 소스가 답할 수 없다.** 프롭 둘은 그대로 남으므로(안드로이드에서 이미
 * 들리던 것을 끄는 것이 이 배선의 목적이 아니다) TalkBack에서는 라이브 리전과 이 낭독이 둘 다 소리를
 * 낸다. 큐가 겹치는지·앞의 것이 잘리는지는 런타임 큐잉이 정한다 — 라운드 89 리뷰 L-3이 이름 붙인
 * 물음이고, 짝 문서 §1-1 #131 ⓖ · #157 ⓓ · #162 ⓑ · #164 ⓓ가 **이미** 같은 질문을 열어 두고 있다
 * (이 트랙은 새 질문을 만들지 않는다 — 같은 관례에 자리만 여섯 더한다).
 */
export function useFieldErrorAnnouncement(message: string | null): void {
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (message) {
      if (announced.current === message) return;
      announced.current = message;
      announceForA11y(message);
    } else {
      announced.current = null;
    }
  }, [message]);
}
