import { getOnboardingProgress, type OnboardingProgress } from "../api/client";

/**
 * FIX-119B/F5 (R19 L-1) — 삭제된/무효한 selectedChildId로 인한 온보딩 오리다이렉트 방지.
 *
 * app/index.tsx는 R19-C(F1) 이후 진행도를 `getOnboardingProgress(token, selectedChildId)`로
 * 아이 스코프로 물어본다. 그런데 그 childId가 이미 서버에서 사라졌거나(다른 기기에서 아이 삭제 →
 * 404 CHILD_NOT_FOUND), 가구가 바뀌어 접근 권한이 없거나(403 FORBIDDEN), 예전 버전이 남긴
 * 비-UUID 값이면(400 VALIDATION_ERROR — 서버 DTO가 @IsUUID다) 요청이 실패한다. 예전에는 그
 * 실패를 `.catch(() => undefined)`가 통째로 삼켜서 "진행도 없음"으로 처리했고, 온보딩을 이미 끝낸
 * 사용자가 ONB-001로 되돌아갔다(그리고 selectedChildId가 그대로 남아 있어 다음 실행에도 반복).
 *
 * 여기서는 그 세 부류의 실패만 골라 **childId 없이 1회 재시도**한다(= 가구 첫째 기준, R19-C 이전과
 * 동일한 하위호환 경로). 재시도가 성공하면 호출자에게 `childScopeRejected`를 알려 주고, 호출자는
 * 무효한 selectedChildId를 지운다 -- 그러면 다음 렌더에서 MOB-116 복구(selected-child-recovery.ts)가
 * GET /children 목록으로 아이를 다시 골라 준다.
 *
 * 네트워크/타임아웃/401 등 "아이 스코프 때문이 아닌" 실패는 그대로 던져서 기존 오프라인 관용 동작
 * (로컬 zustand persist 폴백)을 조금도 바꾸지 않는다.
 */

/**
 * client.ts의 requestJson은 비-2xx를 `new Error(JSON.stringify(body))`로 던진다(status를 따로
 * 들고 있지 않다). 서버 오류 봉투는 GlobalExceptionFilter가 항상 `{error: {code, message, ...}}`
 * 로 직렬화하므로, 메시지를 파싱해 code로 판별하는 것이 지금 계약에서 가능한 유일한 방법이다.
 * 파싱 실패(네트워크 오류·타임아웃 등 JSON이 아닌 메시지)는 곧바로 false다.
 */
const CHILD_SCOPE_REJECTION_CODES: ReadonlySet<string> = new Set([
  // 404: 삭제됐거나 존재하지 않는 아이 (ChildAccessService.requireChildAccess)
  "CHILD_NOT_FOUND",
  "NOT_FOUND",
  // 403: 다른 가구의 아이 (같은 곳)
  "FORBIDDEN",
  // 400: @IsUUID 실패 — 예전 버전이 남긴 비-UUID selectedChildId
  "VALIDATION_ERROR"
]);

export function isChildScopeRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : null;
  if (!message) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return false;
  }
  const code = (parsed as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" && CHILD_SCOPE_REJECTION_CODES.has(code);
}

export type OnboardingProgressFetch = (token: string, childId?: string) => Promise<OnboardingProgress>;

export type ScopedOnboardingProgress = {
  progress: OnboardingProgress;
  /** true면 넘긴 selectedChildId가 서버에서 무효였다는 뜻 -- 호출자는 그 값을 지워야 한다. */
  childScopeRejected: boolean;
};

/**
 * 아이 스코프 진행도 조회 + 무효 childId 폴백. `fetchProgress`는 테스트 주입용이고 기본값은 실제
 * GET /onboarding/status 클라이언트다. 폴백은 정확히 1회이며(무한 재시도 없음), 폴백 호출이
 * 실패하면 그 오류를 그대로 던진다(호출자의 기존 catch가 처리).
 */
export async function fetchOnboardingProgressForSelectedChild(
  token: string,
  selectedChildId: string | null,
  fetchProgress: OnboardingProgressFetch = getOnboardingProgress
): Promise<ScopedOnboardingProgress> {
  if (!selectedChildId) {
    return { progress: await fetchProgress(token), childScopeRejected: false };
  }
  try {
    return { progress: await fetchProgress(token, selectedChildId), childScopeRejected: false };
  } catch (error) {
    if (!isChildScopeRejection(error)) {
      throw error;
    }
    return { progress: await fetchProgress(token), childScopeRejected: true };
  }
}
