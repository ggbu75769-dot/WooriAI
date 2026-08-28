/**
 * 라운드 65 후속(#1) — **필수 동의가 서버에 저장되지 않아 막힌 온보딩의 복구 규칙.**
 *
 * ## 무엇이 막혔나
 *
 * 로그인 화면은 동의 저장(`PUT /consents`)이 실패해도 그것을 로그인 실패로 승격하지 않고
 * 온보딩으로 보낸다(`app/(auth)/login.tsx` — 세션은 이미 만들어졌으므로 로그인은 실제로
 * 성공했다). 그때 서버에는 동의 기록이 없고, 온보딩 ONB-002의 `POST /children`은
 * `assertRequiredConsents`에 걸려 **403 CONSENT_REQUIRED**로 막힌다
 * (`apps/api/src/onboarding/onboarding-core.service.ts`).
 *
 * 그리고 앱에는 그 상태에서 동의를 다시 올릴 길이 **하나도 없었다**:
 *  - 이어하기 화면(ONB-006)은 `hasResumeWorthyProgress`가 `consentsAccepted`를 먼저 보므로
 *    (`src/onboarding/resume.ts`) 동의가 없는 계정은 그 문 앞에서 걸린다;
 *  - SET-003(설정 > 약관 및 개인정보)의 재동의 버튼은 **탭 안**에 있고, 탭은 온보딩을 마쳐야
 *    열린다(`app/index.tsx`).
 * 화면은 "저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요."와 [재시도]만
 * 내밀었고, 연결은 멀쩡했으며 몇 번을 눌러도 서버의 동의 기록이 저절로 생기지는 않았다 —
 * **복구 불가능한 막다른 길**이었다.
 *
 * ## 이 모듈이 고정하는 것
 *
 * 복구를 막힌 그 자리에 둔다: 저장이 `CONSENT_REQUIRED`로 실패하면 동의를 다시 올린 뒤 같은
 * 저장을 **정확히 한 번** 재시도한다. 규칙을 순수 함수로 빼 두는 이유는 그 "한 번"과 실패했을
 * 때 남는 오류가 **테스트로 고정돼야** 하기 때문이다 — 화면(.tsx)은 react-native를 끌고 와
 * vitest에서 실행되지 않는다. 화면은 이 함수에 두 개의 약속(저장·재동의)을 넘기기만 한다.
 */

import { hasApiErrorCode } from "../api/api-error";

/**
 * 이 실패가 **필수 동의 미저장** 때문인가. 판정 기준은 서버 봉투의 코드 하나다
 * (src/api/api-error.ts — 사람이 읽는 message 문구는 비교 기준으로 쓰지 않는다).
 * 권한 부족(`FORBIDDEN`)과 같은 403이지만 코드가 다르고, 복구 경로도 다르다.
 */
export function isOnboardingConsentRequired(error: unknown): boolean {
  return hasApiErrorCode(error, "CONSENT_REQUIRED");
}

/**
 * 사용자에게 보이는 문구. `ONBOARDING_SAVE_FORBIDDEN_MESSAGE`와 규율이 다르다: 권한 부족은
 * 이 사람이 스스로 풀 수 없어서 다음 행동이 "관리자에게 부탁하기"였지만, 미저장 동의는 **이
 * 화면에서 바로 풀 수 있다**. 그래서 문구가 복구를 안내하고, 그 복구를 실제로 수행하는 버튼이
 * 카드에 함께 선다. 해요체(DNC-018).
 */
export const ONBOARDING_CONSENT_REQUIRED_MESSAGE =
  "필수 동의가 아직 저장되지 않았어요. 다시 동의하고 저장하면 이어서 진행할 수 있어요.";

/** 그 복구를 실제로 하는 버튼의 라벨. "재시도"와 달리 무슨 일이 일어나는지 말한다. */
export const ONBOARDING_CONSENT_RETRY_ACTION_LABEL = "다시 동의하고 저장";

/**
 * 저장 → (CONSENT_REQUIRED면) 재동의 → 저장 1회 재시도.
 *
 * 규칙 셋을 값으로 고정한다.
 *  1. `CONSENT_REQUIRED`가 **아닌** 실패는 손대지 않는다(그대로 던진다).
 *  2. 자동 복구는 **정확히 1회**다 — 재시도가 또 `CONSENT_REQUIRED`로 실패해도 다시 돌지
 *     않는다(무한 루프 금지). 그 뒤는 사용자가 [다시 동의하고 저장]으로 직접 한 번 더 돈다.
 *  3. **재동의 자체가 실패하면 원래 실패를 그대로** 던진다. 네트워크 문구로 바뀌면 사용자는
 *     무엇을 눌러야 하는지 다시 잃는다 — 화면에는 "필수 동의가 아직 저장되지 않았어요"와 그
 *     복구 버튼이 남아야 한다.
 *
 * 재시도가 같은 요청을 두 번 보내도 안전한지는 호출부의 책임이다(ONB-002는 같은
 * Idempotency-Key를 그대로 재사용하므로 아이가 두 번 만들어질 수 없다 — MOB-101).
 */
export async function saveWithConsentRecovery<T>(
  save: () => Promise<T>,
  reconsent: () => Promise<unknown>
): Promise<T> {
  try {
    return await save();
  } catch (error) {
    if (!isOnboardingConsentRequired(error)) throw error;
    try {
      await reconsent();
    } catch {
      throw error;
    }
    return save();
  }
}
