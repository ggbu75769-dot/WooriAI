/**
 * 준비템 상태 변경(status PATCH)의 안내 문구 + gifted 덮어쓰기 확인 문구의 단일 소스.
 *
 * 상태 변경은 준비템 탭 행 버튼("준비했어요"/"괜찮아요")과 아이템 상세의 버튼들
 * ("찜하기/찜해제", "선물로 받았어요/선물 받음 취소", "지출 없이 준비 완료로 표시")에서 나간다.
 *
 * ## 라운드 51 C-10에서 계약이 뒤집혔다
 *
 * ITEM-124 시절 이 파일의 계약은 정반대였다: **"자동 반영을 약속하지 않는다."** 근거는 분명했다 —
 * 그때 이 경로는 오프라인 아웃박스를 타지 않아서(sync-engine.ts가 지출만 큐잉했다) 실패가 곧
 * 유실이었고, "연결되면 자동으로 반영할게요"는 지키지 못할 약속이었다. 그래서 문구는 전부
 * "아직 저장되지 않았으니 다시 눌러 주세요"였다.
 *
 * C-10이 그 근거를 없앴다. 준비 상태 변경도 이제 `item_status_outbox`에 쌓여
 * (src/offline/types.ts) 연결이 돌아오면 자동으로 전송된다 — 오프라인에서 눌러도 유실되지 않고,
 * 지출 기록과 같은 오프라인 우선 경로다. 그러니 이제는 **"다시 눌러 주세요"가 거짓말**이다:
 * 사용자가 다시 누를 필요가 없는데 다시 누르라고 하면 같은 값을 두 번 큐에 넣게 만든다.
 *
 * 그래서 문구를 지출과 같은 관례로 옮긴다(src/offline/messages.ts의 OFFLINE_SAVED_MESSAGE):
 * 대기 중이면 자동 반영을 약속하고, 서버가 **거절**했을 때만(4xx) 다음 행동을 안내한다.
 * 조작별 실패 문구 여섯 개와 연결 오류 판정(`isItemStatusConnectionError`)은 이 전환으로
 * 갈 곳이 없어져 삭제했다 — 화면은 더 이상 전송 실패를 그 자리에서 보지 않는다(전송은 나중에,
 * 다른 화면에서 일어난다). 실패는 동기화 상태 화면과 행 배지가 말한다.
 *
 * 문구 톤은 그대로 DNC-018이다: 해요체 존댓말, 사용자를 탓하지 않고 다음에 무엇을 하면 되는지만.
 *
 * 이 모듈은 react-native/react-query에 의존하지 않는 순수 모듈이라 vitest에서 그대로 테스트한다
 * (화면 자체는 렌더할 수 없어 배선은 소스 grep 계약 테스트가 맡는다 —
 * status-mutation-messages.test.ts와 gifted-status-flow.test.ts).
 */

/**
 * 어떤 조작인지. 목표 상태(ItemStatus)가 아니라 "조작" 단위인 이유: `not_prepared` 하나가
 * 찜해제와 선물 받음 취소 두 조작의 목표 상태라, 상태만으로는 무엇을 한 것인지 말로 옮길 수 없다.
 * 지금은 아래 gifted 확인 문구가 이 타입을 좁혀 쓴다.
 */
export type ItemStatusActionKind = "prepare" | "interest" | "uninterest" | "gift" | "ungift" | "skip";

/**
 * 큐에 들어갔지만 아직 서버에 닿지 않은 변경의 안내 한 줄. 지출 저장의 OFFLINE_SAVED_MESSAGE와
 * **같은 약속**을 같은 말로 한다("연결되면 자동으로 반영할게요") — 이제 실제로 그렇게 동작하므로
 * 지킬 수 있는 약속이다(src/offline/sync-engine.ts의 flushItemStatusPass).
 */
export const ITEM_STATUS_QUEUED_MESSAGE = "연결되면 자동으로 반영할게요.";

/**
 * 서버가 거절해(4xx) 자동 재시도가 멈춘 행의 다음 행동 안내. 사유 자체는 행이 들고 있는
 * `lastError`가 이미 한국어로 말하고 있으므로(remote-api.ts의 apiErrorMessage) 반복하지 않고,
 * 어디서 정리할 수 있는지만 덧붙인다.
 */
export const ITEM_STATUS_SYNC_FAILED_HINT = "동기화 상태에서 다시 시도하거나 되돌릴 수 있어요.";

/**
 * 로컬 저장 자체가 실패한 경우(기기 저장소 오류). 서버 왕복 이전이라 큐에도 들어가지 못했고,
 * 이때만은 정말로 다시 눌러야 한다 — 오프라인과 헷갈리지 않도록 연결을 언급하지 않는다.
 */
export const ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE = "준비 상태를 기기에 저장하지 못했어요. 다시 눌러 주세요.";

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

/**
 * gifted에서 넘어갈 수 있는 조작만 남긴 좁힌 타입 (라운드 24 L7).
 *
 * `uninterest`(찜해제)와 `ungift`는 여기 올 수 없다. status는 단일 컬럼이라 지금 상태가 gifted면
 * `interested`도 아니고 이미 `gifted`이므로, "찜해제"·"선물 받음 취소"라는 조작 자체가 성립하지
 * 않는다(상세 화면의 찜 버튼은 gifted일 때 항상 "찜하기"로 보인다). 예전에는 화면이
 * `isInterested ? "uninterest" : "interest"`를 넘기고 여기 "준비 전" 라벨을 들고 있었는데, 그
 * 분기는 절대 실행되지 않는 죽은 코드였다 — 읽는 사람에게 "gifted면서 interested인 상태가 있다"는
 * 잘못된 인상만 남긴다. 타입으로 막아 두면 그런 호출이 컴파일에서 걸린다.
 */
export type GiftedResetActionKind = Extract<ItemStatusActionKind, "prepare" | "interest" | "skip">;

/** 확인 문구에서 "무엇으로 바뀌는지"를 부르는 이름 — items 탭 statusLabel과 같은 표기를 쓴다. */
const GIFTED_RESET_TARGET_LABEL: Record<GiftedResetActionKind, string> = {
  prepare: "이미 준비",
  interest: "관심",
  skip: "필요 없음"
};

/**
 * gifted 상태에서 다른 상태로 넘어가기 전 확인 Alert 본문. "지금 선물 받음이고, 계속하면
 * 무엇이 된다"까지만 말한다.
 */
export function giftedResetConfirmMessage(kind: GiftedResetActionKind): string {
  return `지금은 선물 받음으로 표시돼 있어요. 계속하면 ${GIFTED_RESET_TARGET_LABEL[kind]} 상태로 바뀌어요.`;
}
