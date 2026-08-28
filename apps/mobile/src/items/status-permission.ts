import { EXPENSE_VIEW_ONLY_ALERT_TITLE, guardExpenseAction } from "../family/record-permissions";

/**
 * 라운드 51 #8 — 보기 전용 역할의 **준비 상태 변경** 안내 단일 소스.
 *
 * ## 무엇이 문제였나
 *
 * 서버는 준비 상태 PATCH(`/children/:childId/items/:itemTemplateId/status`)를 가구의 편집
 * 역할에게만 허용한다(apps/api items-catalog.service.ts의 `requireChildAccess(..., true)`).
 * 그런데 앱에는 그 자리에 게이트가 없어서, 보기 전용(viewer)·선물 참여(gift_participant)로
 * 참여한 사람이 "준비했어요"/"괜찮아요"/"찜하기"/"선물로 받았어요"를 누르면 403이 돌아왔고
 * 화면은 "…하지 못했어요. 잠시 후 다시 시도해 주세요."라고 답했다. 잠시 후에도, 내일도 같은
 * 403이라 그 문장은 **영원히 지켜지지 않는 약속**이었다 — 지출 기록에서 UX-R이 없앤 것과
 * 정확히 같은 시퀀스다(src/family/record-permissions.ts 헤더 참고).
 *
 * ## 이 모듈이 하는 일
 *
 * 판정은 새로 만들지 않는다. 서버가 두 동작(지출 쓰기·준비 상태 쓰기)에 **같은 편집 권한**을
 * 요구하므로, 판정도 이미 있는 한 곳(record-permissions.ts의 `isExpenseEntryLocked`)을 그대로
 * 읽어 쓴다(배선은 ./useItemStatusGate.ts). 여기 있는 것은 그 잠금을 준비템 화면의 말로 옮긴
 * **문구**뿐이다 — 지출 문구를 그대로 쓰면 준비 상태를 바꾸려던 사람에게 "기록은 관리자·
 * 공동부모가 남길 수 있어요"라는 엉뚱한 답이 간다.
 *
 * 노드를 지우지 않고 눌렀을 때 안내로 답하는 관례도 그대로다(useExpenseEntryGate 주석의 근거):
 * ITEM-001/002 픽셀락 캡처는 비세션 렌더라 판정 자체가 발동하지 않지만, 버튼을 지우지 않으면
 * 그 안전이 판정 하나에만 걸리지 않는다.
 */

/** 안내 Alert 제목. 지출 쪽과 **같은 상수**를 쓴다 — 같은 사실("보기 전용이에요")을 말하므로. */
export const ITEM_STATUS_VIEW_ONLY_ALERT_TITLE = EXPENSE_VIEW_ONLY_ALERT_TITLE;

/**
 * 안내 본문. record-permissions.ts의 `EXPENSE_VIEW_ONLY_MESSAGE`와 같은 문형이다
 * ("보기 전용으로 참여하고 있어요. …는 관리자·공동부모가 …할 수 있어요."). 다시 시도를
 * 권하지 않는다 — 다시 눌러도 결과가 같기 때문이다(DNC-018: 비난하지 않고 사실만).
 */
export const ITEM_STATUS_VIEW_ONLY_MESSAGE =
  "보기 전용으로 참여하고 있어요. 준비 상태는 관리자·공동부모가 바꿀 수 있어요.";

/**
 * 잠긴 세션에서 "준비 상태를 바꾸는 동작"을 감싸는 규칙 한 줄. 지출 쪽 `guardExpenseAction`과
 * 동작이 같아서 **같은 함수를 그대로 재사용**한다(규칙이 두 벌이 되면 한쪽만 고쳐질 자리다).
 * 이름만 이 화면의 말로 다시 붙인다.
 */
export const guardItemStatusChange = guardExpenseAction;
