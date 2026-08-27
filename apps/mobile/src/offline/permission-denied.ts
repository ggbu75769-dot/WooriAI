import { API_ERROR_MESSAGES } from "../api/api-error";

/**
 * 라운드 47 UX-AB — 동기화 실패 행이 **권한 거절(403 FORBIDDEN)** 때문인지 판정한다.
 *
 * 고치는 문제: sync-status 화면의 실패 행은 사유와 무관하게 늘 "재시도" 버튼을 고정으로 그렸다.
 * 그런데 403은 **정의상 재시도가 무익하다** — 서버가 이 계정의 역할로는 쓰기를 허용하지 않는다고
 * 답한 것이라, 역할이 바뀌기 전에는 몇 번을 눌러도 같은 403이 돌아온다(보기 전용 역할이 지출을
 * 기록한 경우가 정확히 이 자리다 — src/family/record-permissions.ts의 배경 설명 참고). 사용자는
 * 눌러도 아무것도 변하지 않는 버튼을 반복해서 누르게 되고, 화면은 그 이유를 말하지 않았다.
 *
 * **왜 문자열 비교인가**: 실패 행이 들고 있는 것은 `lastError` 문자열뿐이다. sync-engine이
 * `RemotePermanentError.message`를 그대로 넣고(sync-engine.ts), 그 message는 remote-api.ts가
 * `apiErrorMessage(error, ...)`로 만든다 — 즉 서버 코드가 `FORBIDDEN`이면 `API_ERROR_MESSAGES`
 * 표의 문구가 **글자 그대로** 들어온다. 행에는 status도 code도 남지 않으므로 이 문구가 유일한
 * 단서다. (status/code를 행에 함께 저장하도록 바꾸는 편이 근본적이지만 저장 스키마 변경이라
 * 별도 티켓이다.)
 *
 * **정확히 같을 때만 true**: `includes`나 부분 검색을 쓰지 않는다. 표의 문구가 바뀌거나 다른
 * 4xx가 비슷한 말을 하게 되면 판정이 조용히 넓어지는데, 잘못 true를 주면 **재시도할 수 있었던
 * 행에서 재시도 버튼이 사라진다** — 사용자가 손쓸 방법이 없어지는 방향이다. 반대로 잘못 false를
 * 주면 예전과 똑같이 재시도 버튼이 남을 뿐이다. 그래서 "모르면 기존 동작"이 안전한 쪽이고,
 * record-permissions.ts의 "역할 미상이면 잠그지 않는다"와 같은 관례다.
 */
export function isPermissionDeniedSyncError(lastError: string | null | undefined): boolean {
  if (!lastError) return false;
  return lastError === API_ERROR_MESSAGES.FORBIDDEN;
}

/**
 * 권한 거절 행에서 "재시도" 버튼 자리를 대신하는 안내. 재시도가 무익하다는 사실만 말하고
 * 무엇을 해야 하는지는 `lastError` 문구가 이미 말하고 있으므로(역할·구성원 확인) 반복하지
 * 않는다. 해요체(DNC-018).
 */
export const SYNC_STATUS_PERMISSION_DENIED_HINT = "권한이 생기면 다시 시도할 수 있어요.";
