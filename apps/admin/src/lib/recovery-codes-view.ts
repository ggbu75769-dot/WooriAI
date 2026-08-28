/**
 * GAP-064 #7 — 헤더 계정 영역이 말하는 **남은 복구 코드 장수**의 순수 표시 로직.
 *
 * 고치는 문제: 라운드 63 #3이 재등록 입구를 세우면서 화면이 "복구 코드는 한 번만 쓸 수
 * 있어요"라고 말하기 시작했는데, 몇 장 남았는지는 어디에도 없었다. 서버는 알고 있었다 —
 * 로그인 때 쓴 코드를 목록에서 빼고 남은 배열을 다시 쓴다(admin-auth.service.ts
 * verifyMfaCode) — 그런데 세션 응답이 나르는 것은 `mfaEnabled` 불리언 하나뿐이라 화면이
 * 물어볼 자리가 없었다. 그래서 폰을 바꾼 운영자는 **마지막 한 장을 쓴 사실을 다 쓴 뒤에야**
 * 알았고, 그 시점엔 재등록 입구조차 코드를 요구하므로 DB 직접 수정 말고는 길이 없었다.
 *
 * 규칙:
 *  1. **모르면 말하지 않는다.** 잔량이 undefined면(이 필드 이전에 캐시된 응답) 줄이 없다 —
 *     0으로 단정하면 멀쩡한 계정에 "다 썼어요"가 뜬다.
 *  2. **임계 이하에서는 지금 하라고 말한다.** 남은 길이 있을 때 안내해야 의미가 있고,
 *     그 출구는 라운드 63 #3이 세운 바로 그 자리(같은 헤더의 "인증 앱 다시 등록")다 —
 *     새 화면도, 코드 재발급만 하는 별도 경로도 만들지 않는다(SEC-101의 "해제 → 즉시
 *     재등록" 순서를 흐리지 않는다).
 *  3. **개수만 다룬다.** 이 모듈은 코드 값을 아예 받지 않는다(서버도 보내지 않는다).
 */

/** 이 장수 이하면 재등록을 권한다. 마지막 한 장은 "그 한 장으로 들어와 재등록할 수 있는
 * 마지막 기회"라 그때 말해야 늦지 않는다. */
export const RECOVERY_CODES_LOW_THRESHOLD = 1;

export type RecoveryCodesNotice = {
  /** "남은 복구 코드 3장" — 항상 개수만 말한다. */
  text: string;
  /** 임계 이하(재등록을 권해야 하는 상태)인가. */
  low: boolean;
  /** 임계 이하일 때만 붙는 한 줄. 그 외에는 빈 문자열이다. */
  actionText: string;
};

/**
 * 잔량 표기. `remaining`이 undefined이거나 수가 아니면 null(줄을 그리지 않는다).
 *
 * 0장은 "지금 인증 앱을 잃으면 들어올 방법이 없다"는 뜻이라 임계와 같은 자리에서 더
 * 강하게 말한다 — 다만 문장을 두 벌로 늘리지 않고 같은 안내를 쓴다(들어와 있는 지금이
 * 재등록할 수 있는 유일한 시점이라는 사실은 두 경우 모두 같다).
 */
export function recoveryCodesNotice(remaining: number | undefined): RecoveryCodesNotice | null {
  if (typeof remaining !== "number" || !Number.isFinite(remaining) || remaining < 0) return null;
  const low = remaining <= RECOVERY_CODES_LOW_THRESHOLD;
  return {
    text: `남은 복구 코드 ${remaining}장`,
    low,
    actionText: low
      ? "복구 코드가 거의 없어요. 로그인해 있는 지금 '인증 앱 다시 등록'으로 새 복구 코드를 받아 두세요."
      : ""
  };
}
