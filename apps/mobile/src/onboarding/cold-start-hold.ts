/**
 * 라운드 52 C-09 — 콜드 스타트의 흰 화면.
 *
 * 앱의 진입 라우트(app/index.tsx)는 리다이렉트를 내보내기 전에 세 가지를 기다린다: persist
 * 저장소 rehydrate, 실세션의 selectedChildId 복구(MOB-116), 서버 온보딩 진행도 조회(MOB-101).
 * 그동안 화면은 `return null`이었다 — 스플래시가 내려간 **뒤** 아무것도 그리지 않는다는 뜻이라,
 * 사용자에게는 그냥 흰 화면이다. 각 대기에는 3초 안전 밸브가 걸려 있어 최악의 경우
 * (rehydrate 3초 + 진행도 조회 3초) 6초 가까이 그 상태가 이어진다. 느린 안드로이드 기기의
 * 첫 실행에서 실제로 "앱이 죽었다"로 읽히는 구간이다.
 *
 * 이 모듈이 하는 일은 두 가지다.
 *
 * 1. **판정을 값으로 고정한다**: 어떤 상태에서 홀딩 뷰를 그리는가, 그리고 그때 무엇을
 *    이유로 대는가(`coldStartHoldReason`). app/index.tsx의 분기 순서를 그대로 옮긴 것이고,
 *    라우팅 판정 자체는 **한 줄도 바꾸지 않는다** — 예전에 null이던 자리가 정확히 지금
 *    홀딩 뷰가 되는 자리다.
 * 2. **문구를 한 곳에 둔다**(`COLD_START_HOLD_COPY`). 세 자리에서 같은 뷰를 그리므로 문구가
 *    갈릴 여지를 없앤다.
 *
 * ⚠️ 문구 규칙: 이 화면은 **아직 아무것도 모른다**. 아이 이름·이번 달 금액·예산처럼 저장소가
 * 아직 올라오지도 않은 사실은 절대 그리지 않는다(그럴듯한 자리 채움은 곧바로 허위 표시가 된다).
 * 말할 수 있는 것은 "지금 무엇을 하고 있는가" 한 줄뿐이고, 나머지는 D6 스켈레톤 실루엣이다.
 *
 * ⚠️ 픽셀락: `EXPO_PUBLIC_PIXEL_LOCK=1` 분기는 app/index.tsx의 **맨 위**에 있어 이 판정보다
 * 먼저 리다이렉트한다. 캡처 경로는 이 뷰를 지나지 않는다(`pixelLockMode`가 true면 여기서도
 * null이다 — 그 사실을 값으로도 박아 둔다).
 */

/** 홀딩 뷰를 그리는 세 가지 이유. app/index.tsx의 `return null` 세 자리와 1:1이다. */
export type ColdStartHoldReason =
  /** persist 저장소(세션·온보딩 진행도·선택된 아이·로컬 백엔드) rehydrate 대기. */
  | "hydration"
  /** MOB-116 실세션 selectedChildId 복구 진행 중(에러 카드는 별도 분기라 여기 오지 않는다). */
  | "child-recovery"
  /** MOB-101 서버 온보딩 진행도 조회 대기("idle" 포함 — FIX-118A). */
  | "onboarding-progress";

export type ColdStartHoldCopy = {
  /** 큰 줄. 세 이유가 같은 문장을 쓴다 — 사용자에게 중요한 것은 "멈춘 게 아니다"라는 사실뿐. */
  title: string;
  /** 지금 무엇을 하고 있는지. 아는 사실만 말한다. */
  body: string;
};

export const COLD_START_HOLD_TITLE = "불러오고 있어요";

export const COLD_START_HOLD_COPY: Record<ColdStartHoldReason, ColdStartHoldCopy> = {
  hydration: {
    title: COLD_START_HOLD_TITLE,
    body: "저장된 정보를 확인하고 있어요. 잠시만 기다려 주세요."
  },
  "child-recovery": {
    title: COLD_START_HOLD_TITLE,
    body: "아이 정보를 확인하고 있어요. 잠시만 기다려 주세요."
  },
  "onboarding-progress": {
    title: COLD_START_HOLD_TITLE,
    body: "이어서 시작할 곳을 찾고 있어요. 잠시만 기다려 주세요."
  }
};

/**
 * app/index.tsx가 지금 홀딩 뷰를 그리는 상태인가, 그렇다면 어떤 이유인가.
 *
 * 인자는 그 화면이 이미 들고 있는 값들을 그대로 옮긴 것이고, 검사 순서도 그 화면의 분기
 * 순서 그대로다(픽셀락 → rehydrate → 로그아웃 → 아이 복구 → 진행도 조회). null이면 그 렌더는
 * 홀딩이 아니다 — 리다이렉트든 복구 안내 카드든 **무언가를 그린다**.
 */
export type ColdStartHoldInput = {
  /** `EXPO_PUBLIC_PIXEL_LOCK === "1"` — 캡처 경로는 맨 위에서 리다이렉트한다. */
  pixelLockMode: boolean;
  /** 네 persist 저장소가 모두 올라왔는가(또는 3초 밸브가 열렸는가). */
  hydrated: boolean;
  /** 실토큰도 데모 세션도 없다 = 스플래시/로그인으로 리다이렉트하는 상태. */
  loggedOut: boolean;
  /** MOB-116 복구가 필요하고 아직 진행 중인가(에러 상태는 false — 재시도 카드를 그린다). */
  childRecoveryPending: boolean;
  /** MOB-101 진행도 조회를 기다리는가(`!hasReachedHome && progressToken && progressFetch !== "done"`). */
  onboardingProgressPending: boolean;
};

export function coldStartHoldReason(input: ColdStartHoldInput): ColdStartHoldReason | null {
  if (input.pixelLockMode) return null;
  if (!input.hydrated) return "hydration";
  if (input.loggedOut) return null;
  if (input.childRecoveryPending) return "child-recovery";
  if (input.onboardingProgressPending) return "onboarding-progress";
  return null;
}
