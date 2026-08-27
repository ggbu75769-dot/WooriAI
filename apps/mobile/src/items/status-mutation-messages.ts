/**
 * ITEM-124: 준비템 상태 변경(status PATCH) 실패 문구 + gifted 덮어쓰기 확인 문구의 단일 소스.
 *
 * 상태 변경은 준비템 탭 행 버튼("준비했어요"/"괜찮아요")과 아이템 상세의 버튼들
 * ("찜하기/찜해제", "선물로 받았어요/선물 받음 취소", "지출 없이 준비 완료로 표시")에서
 * 나가는데, 이 네 뮤테이션은 지금까지 `onSuccess`만 배선되어 있었다. 그래서 오프라인이거나
 * 서버가 5xx를 주면 화면은 아무 말도 하지 않고 그대로 있었다 — 사용자는 눌린 건지 아닌지
 * 알 수 없어 계속 누르거나(중복 요청) 바뀐 줄 알고 떠난다.
 *
 * 특히 이 경로는 지출 기록과 달리 **오프라인 아웃박스를 타지 않는다**(src/offline/sync-engine.ts는
 * 지출만 큐잉한다). 즉 실패는 곧 유실이라, "나중에 자동으로 반영할게요"라고 말하면 거짓말이
 * 된다. 문구는 반드시 "아직 저장되지 않았으니 다시 눌러 달라"는 뜻이어야 한다.
 *
 * 실패 원인은 둘로만 나눈다.
 * 1) 연결 문제(네트워크 거절 / 10초 타임아웃 ApiTimeoutError) — 잠시 뒤 되면 풀리는 문제라
 *    "연결" 자체를 언급한다.
 * 2) 그 밖의 모든 실패(4xx/5xx 응답) — 원인을 사용자가 알 수도, 고칠 수도 없으므로 어떤
 *    조작이 저장되지 않았는지만 알려주고 "다시 시도해 주세요"까지만 안내한다.
 *
 * 문구 톤은 DNC-018을 따른다: 해요체 존댓말, 사용자를 탓하지 않고(“잘못 누르셨어요” 금지)
 * 다음에 무엇을 하면 되는지만 담는다. 문형은 이미 앱에서 쓰는
 * "…하지 못했어요. 잠시 후 다시 시도해 주세요."(src/expenses/save-error-messages.ts)를 그대로 잇는다.
 *
 * 이 모듈은 react-native/react-query에 의존하지 않는 순수 모듈이라 vitest에서 그대로 테스트한다
 * (화면 자체는 렌더할 수 없어 배선은 소스 grep 계약 테스트가 맡는다 —
 * status-mutation-wiring.test.ts).
 */

/**
 * 어떤 조작이 실패했는지. 목표 상태(ItemStatus)가 아니라 "조작" 단위인 이유: `not_prepared`
 * 하나가 찜해제와 선물 받음 취소 두 조작의 목표 상태라, 상태만으로는 무엇이 실패했는지
 * 문구로 옮길 수 없다.
 */
export type ItemStatusActionKind = "prepare" | "interest" | "uninterest" | "gift" | "ungift" | "skip";

/** 연결이 끊겼거나 요청이 타임아웃된 경우 — 이 경로는 아웃박스가 없어 "자동 반영"을 약속하지 않는다. */
export const ITEM_STATUS_OFFLINE_MESSAGE = "연결이 끊겨 아직 저장하지 못했어요. 연결된 뒤 다시 눌러 주세요.";

/** "준비했어요" / "지출 없이 준비 완료로 표시" 실패. */
export const ITEM_STATUS_PREPARE_FAILED_MESSAGE = "준비 완료로 표시하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** "찜하기" 실패. */
export const ITEM_STATUS_INTEREST_FAILED_MESSAGE = "찜하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** "찜해제" 실패. */
export const ITEM_STATUS_UNINTEREST_FAILED_MESSAGE = "찜을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** "선물로 받았어요" 실패. */
export const ITEM_STATUS_GIFT_FAILED_MESSAGE = "선물 받음으로 표시하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** "선물 받음 취소" 실패. */
export const ITEM_STATUS_UNGIFT_FAILED_MESSAGE = "선물 받음을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** "괜찮아요" 실패. */
export const ITEM_STATUS_SKIP_FAILED_MESSAGE = "괜찮아요로 표시하지 못했어요. 잠시 후 다시 시도해 주세요.";

const FAILED_MESSAGE_BY_KIND: Record<ItemStatusActionKind, string> = {
  prepare: ITEM_STATUS_PREPARE_FAILED_MESSAGE,
  interest: ITEM_STATUS_INTEREST_FAILED_MESSAGE,
  uninterest: ITEM_STATUS_UNINTEREST_FAILED_MESSAGE,
  gift: ITEM_STATUS_GIFT_FAILED_MESSAGE,
  ungift: ITEM_STATUS_UNGIFT_FAILED_MESSAGE,
  skip: ITEM_STATUS_SKIP_FAILED_MESSAGE
};

/**
 * 던져진 값에서 비교 가능한 메시지 문자열을 뽑는다. react-query의 onError는 무엇이든 넘겨줄 수
 * 있어(Error, 문자열, undefined) 방어적으로 읽는다.
 */
function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function errorNameOf(error: unknown): string {
  const name = (error as { name?: unknown } | null | undefined)?.name;
  return typeof name === "string" ? name : "";
}

/**
 * 연결 때문에 실패했는가. api 클라이언트는 이 경우 (a) 자체 타임아웃 래퍼가 던지는
 * ApiTimeoutError(name), (b) fetch 자체의 거절(RN "Network request failed" / web "Failed to fetch")
 * 중 하나를 던진다(src/api/client.ts). 서버가 준 응답 본문은 절대 여기 걸리지 않는다 —
 * 응답이 있었다는 건 연결은 됐다는 뜻이다.
 */
export function isItemStatusConnectionError(error: unknown): boolean {
  const name = errorNameOf(error);
  if (name === "ApiTimeoutError" || name === "AbortError") return true;
  const message = errorMessageOf(error).toLowerCase();
  return message.includes("network request failed") || message.includes("failed to fetch");
}

/**
 * 실패 원인 → 사용자에게 보여줄 문구. 알 수 없는 실패는 원문(서버 JSON 본문/스택)을 절대
 * 그대로 노출하지 않고 조작별 안내 문구로 대체한다.
 */
export function itemStatusMutationErrorMessage(kind: ItemStatusActionKind, error: unknown): string {
  if (isItemStatusConnectionError(error)) return ITEM_STATUS_OFFLINE_MESSAGE;
  return FAILED_MESSAGE_BY_KIND[kind];
}

/**
 * 리뷰 F2: gifted/interested/prepared/not_needed는 서로 배타적인 **단일 status 컬럼**이다.
 * 그래서 "선물로 받았어요"로 정리해 둔 항목에서 찜하기·준비했어요·괜찮아요를 누르면 gifted가
 * 아무 말 없이 사라진다(준비완료 탭에서 "선물 받음" 배지가 그냥 없어진다). 되돌리려면 상세로
 * 들어가 다시 선물 받음을 눌러야 하는데, 사용자는 무엇이 사라졌는지조차 모른다.
 *
 * 그래서 gifted를 잃게 만드는 조작만 확인을 한 번 거친다. 확인 문구는 겁주지 않고(DNC-018)
 * 무엇이 바뀌는지만 알려준다 — 이미 상세 화면의 "선물 받음을 취소할까요?" Alert와 같은
 * 관례(질문/안내 + "취소" cancel 버튼 + 실행 버튼)를 쓴다.
 */
export const GIFTED_RESET_CONFIRM_TITLE = "선물받은 상태가 해제돼요";

/** 확인 Alert의 취소 버튼(style: "cancel") 문구 — 앱 전체 Alert 관례와 동일. */
export const GIFTED_RESET_CONFIRM_CANCEL_LABEL = "취소";

/** 확인 Alert의 실행 버튼 문구. */
export const GIFTED_RESET_CONFIRM_ACTION_LABEL = "계속하기";

/** 확인 문구에서 "무엇으로 바뀌는지"를 부르는 이름 — items 탭 statusLabel과 같은 표기를 쓴다. */
const GIFTED_RESET_TARGET_LABEL: Record<Exclude<ItemStatusActionKind, "gift" | "ungift">, string> = {
  prepare: "이미 준비",
  interest: "관심",
  uninterest: "준비 전",
  skip: "필요 없음"
};

/**
 * gifted 상태에서 다른 상태로 넘어가기 전 확인 Alert 본문. "지금 선물 받음이고, 계속하면
 * 무엇이 된다"까지만 말한다.
 */
export function giftedResetConfirmMessage(kind: Exclude<ItemStatusActionKind, "gift" | "ungift">): string {
  return `지금은 선물 받음으로 표시돼 있어요. 계속하면 ${GIFTED_RESET_TARGET_LABEL[kind]} 상태로 바뀌어요.`;
}
