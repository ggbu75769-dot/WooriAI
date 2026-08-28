/**
 * 라운드 48 T4(D1) — 빠른 기록 시트가 **저장 뒤 어디로 갈 것인가**를 정하는 순수 판정.
 *
 * ## 무엇이 문제였나
 *
 * `app/expenses/new.tsx`는 저장에 성공하면 출처와 무관하게 언제나 `/(tabs)/records`로
 * `router.replace` 했다. 그런데 이 시트로 들어오는 길은 하나가 아니다:
 *
 * - 홈/기록 탭의 빠른 기록(FAB) — 방금 적은 것을 목록에서 확인하는 것이 자연스럽다.
 * - 준비템 목록/상세의 "지출 기록하고 준비 완료" — 저장하면 서버가 그 준비템을 준비 완료로
 *   올린다(apps/api store-shared.ts markLinkedItemPrepared). 즉 **방금 오른 준비율**과 100%
 *   축하 배너가 준비템 탭에 있는데, 사용자는 기록 탭으로 내던져져 그 결과를 못 본다. 핵심
 *   루프("시기별 준비템 확인 → 구매 → 기록/상태 체크")의 마지막 고리가 화면 전환 한 번으로
 *   끊긴다.
 *
 * 그래서 **어디에서 왔는지**(`from` 라우트 파라미터)를 받아 목적지를 고른다.
 *
 * ## 왜 별도 모듈인가
 *
 * 화면 안의 삼항 연산자로 두면 검증이 소스 문자열 검사밖에 안 된다. 알림 탭 목적지 판정을
 * 떼어 낸 것과 같은 이유이자 같은 관례다(src/notifications/notification-route.ts) — 종류별
 * 목적지를 **값으로** 고정할 수 있어야 다음 라운드에서 진입점을 배선할 때 규칙이 흔들리지
 * 않는다.
 *
 * ## 방어적 파싱
 *
 * `from`은 URL/딥링크로 들어오는 남의 문자열이다. 모르는 값·배열·빈 문자열·오염된 값은
 * **전부 종전 동작(기록 탭)** 으로 떨어진다 — 링크 하나 때문에 저장 후 엉뚱한 탭으로 튀는
 * 경로를 만들지 않는다(src/expenses/record-row-actions.ts의 프리필 파싱과 같은 규율).
 */

/**
 * 이 시트를 연 진입점. **화면에 보이지 않는 값**이라(라우팅 힌트일 뿐) 문구가 아니라 식별자다.
 *
 * - `items` — 준비템 목록 탭(app/(tabs)/items.tsx)의 기록 액션.
 * - `item-detail` — 준비템 상세(app/items/[itemTemplateId].tsx)의 "지출 기록하고 준비 완료".
 * - `purchase-followup` — 구매 확인 카드(src/commerce/PurchaseFollowupPrompt.tsx)의 "샀어요".
 * - `recurring` — 정기 지출의 "기록하기"(홈 카드 src/…/index.tsx · 관리 화면 app/expenses/recurring.tsx).
 *   값 자체는 라운드 55부터 실려 왔고, 라운드 58에서 **아는 값**이 됐다(아래 목적지 규칙).
 * - `sync-fix` — 동기화 상태 화면의 "고쳐서 다시 보내기"(app/sync-status.tsx). 라운드 59 #2에서
 *   생겼다(아래 목적지 규칙 — 원본 폐기가 보이는 화면은 그 하나뿐이다).
 */
export type ExpenseEntrySource = "items" | "item-detail" | "purchase-followup" | "recurring" | "sync-fix";

/**
 * 실패 행을 고쳐 다시 보내는 진입점의 `from` 값.
 *
 * 정기 지출이 `RECURRING_ENTRY_SOURCE`(recurring-template.ts)를 내보내는 것과 같은 관례다:
 * 값을 싣는 쪽(src/expenses/failed-row-prefill.ts)과 읽는 쪽(이 파일)이 **같은 문자열 하나**를
 * 보게 해서, 한쪽만 고쳐지면 규칙이 조용히 죽는 자리를 만들지 않는다.
 */
export const SYNC_FIX_ENTRY_SOURCE = "sync-fix";

/** 라우트 파라미터 이름. 붙이는 쪽과 읽는 쪽이 갈리지 않도록 문자열을 한 곳에 둔다. */
export const EXPENSE_ENTRY_SOURCE_PARAM = "from";

/**
 * 저장 후 갈 수 있는 곳. expo-router의 typedRoutes가 켜져 있어(app.json) 이 유니온이 그대로
 * Href로 검사되므로, 없는 경로를 반환하면 typecheck에서 걸린다
 * (src/notifications/notification-route.ts와 같은 장치).
 */
export type PostSaveDestination = "/(tabs)/records" | "/(tabs)/items" | "/(tabs)" | "/sync-status";

/** 종전 동작. 출처를 모르거나 규칙이 없는 값은 전부 여기로 떨어진다. */
export const POST_SAVE_DEFAULT_DESTINATION: PostSaveDestination = "/(tabs)/records";

/** 준비템 계열에서 온 기록이 돌아가는 곳(방금 오른 준비율·100% 축하 배너가 있는 화면). */
export const POST_SAVE_ITEMS_DESTINATION: PostSaveDestination = "/(tabs)/items";

/**
 * 홈 탭. **정기 지출 리마인더 카드가 서 있는 유일한 화면**이다(라운드 55 §1.5 — 리마인더의
 * 자리는 홈 한 곳뿐이고 기록 탭에는 두지 않기로 했다).
 */
export const POST_SAVE_HOME_DESTINATION: PostSaveDestination = "/(tabs)";

/**
 * 동기화 상태 화면. **원본 실패 행이 사라진 것이 보이는 유일한 화면**이다(라운드 59 #2 —
 * 근거는 아래 `resolvePostSaveDestination` 주석).
 */
export const POST_SAVE_SYNC_STATUS_DESTINATION: PostSaveDestination = "/sync-status";

const KNOWN_ENTRY_SOURCES: ReadonlyArray<ExpenseEntrySource> = [
  "items",
  "item-detail",
  "purchase-followup",
  "recurring",
  SYNC_FIX_ENTRY_SOURCE
];

/** expo-router의 파라미터는 string | string[] 둘 다 올 수 있다 — 첫 값만 읽는다. */
function firstParamValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

/**
 * `from` 파라미터 → 아는 진입점, 또는 null.
 *
 * 모르는 값을 그대로 흘리지 않고 여기서 null로 눕히는 이유: 목적지 판정이 "아는 값"만 다루면
 * 새 값이 생겼을 때 규칙을 한 곳(아래 resolvePostSaveDestination)에만 추가하면 된다.
 */
export function parseExpenseEntrySource(value: unknown): ExpenseEntrySource | null {
  const raw = firstParamValue(value).trim();
  return KNOWN_ENTRY_SOURCES.find((source) => source === raw) ?? null;
}

/**
 * 저장 성공 후의 목적지.
 *
 * - `items` / `item-detail` → 준비템 탭. 이 두 경로의 기록은 준비템 상태를 실제로 바꾸므로
 *   (linkedItemTemplateId), 사용자가 방금 만든 변화가 있는 화면으로 돌아가는 것이 맞다.
 * - `purchase-followup` → **종전 그대로 기록 탭**. 구매 확인 카드는 어느 화면 위에도 뜨는
 *   전역 오버레이라(PurchaseFollowupPrompt) 사용자가 준비템 탭을 보고 있었다는 보장이 없다.
 *   "샀어요"를 누른 사람이 방금 한 일은 **지출을 적은 것**이고, 묻지도 않은 준비템 목록으로
 *   보내면 하던 일에서 튕겨 나간다. 규칙을 여기 적어 두는 이유는 이 값이 "아직 안 정한 값"이
 *   아니라 **정해서 기본값과 같게 둔 값**이기 때문이다.
 * - `recurring` → **홈**. 아래 문단이 근거다.
 * - `sync-fix` → **동기화 상태 화면**. 그 아래 문단이 근거다.
 * - 그 외/미지정/오염 → 종전 동작(기록 탭).
 *
 * ## 왜 정기 지출만 홈인가 (라운드 58 #7)
 *
 * 이 진입점의 출발지는 **홈의 정기 지출 카드**다("이번 달 정기 지출 2건이 아직 기록에 없어요" —
 * 리마인더가 서는 자리는 홈 하나뿐이다, 라운드 55 §1.5). 사용자가 그 카드의 "기록하기"를 눌러
 * 시트에서 저장하면, 그 저장이 무엇을 했는지 **눈으로 확인할 수 있는 화면은 홈뿐**이다:
 * 홈 카드의 판정(`buildRecurringReminder`)은 서버 캐시와 함께 이 기기의 오프라인 대기 행
 * (`pendingRows` — 로컬 우선 저장이라 방금 적은 행이 그 안에 있다)을 함께 세므로, 돌아간 즉시
 * 방금 기록한 그 줄이 목록에서 사라지고 2건이 1건이 된다. 마지막 한 건이면 카드 자체가 없어진다.
 *
 * 기록 탭으로 보내면 저장된 행 하나는 보이지만 **재촉이 끝났다는 사실**은 어디에도 보이지 않고,
 * 사용자는 홈으로 돌아가 카드가 줄었는지 직접 확인해야 한다 — 준비템 경로를 준비템 탭으로
 * 되돌린 것(방금 오른 준비율을 보게 한다)과 정확히 같은 이유다. 관리 화면(app/expenses/recurring.tsx)의
 * "기록하기"도 같은 값을 싣는데, 그쪽도 목적지가 홈인 편이 낫다: 그 화면은 "적어 두는" 자리지
 * "기록을 보는" 자리가 아니라, 저장 후 되돌아가 봐야 방금 기록한 사실을 말해 주는 것이 없다.
 *
 * ## 왜 고쳐서 다시 보내기만 동기화 상태 화면인가 (라운드 59 #2)
 *
 * 이 진입점의 저장은 **두 가지 일**을 한다: 고친 내용으로 새 기록을 만들고, 저장이 확정된 뒤에
 * 원본 실패 행을 버린다(app/expenses/new.tsx의 `failedLocalId` — src/expenses/failed-row-prefill.ts).
 * 그런데 그 둘 중 **원본이 사라졌다는 사실이 보이는 화면은 동기화 상태 화면 하나뿐**이다.
 * 종전처럼 기록 탭으로 보내면 사용자는 새 기록 한 줄만 보고, 방금 고친 그 실패 행이 정말
 * 정리됐는지는 배지를 눌러 다시 들어가야 안다 — 실패 배지가 아직 다른 행 때문에 남아 있으면
 * "고쳤는데도 그대로다"로 읽히고, 그 오해는 같은 기록을 한 번 더 적게 만든다. 돌아간 즉시 그
 * 행이 없어진 목록(과 하나 줄어든 실패 배지)을 보여 주는 편이, 준비템 경로를 준비템 탭으로
 * 되돌린 것·정기 지출을 홈으로 되돌린 것과 정확히 같은 규칙이다.
 *
 * ⚠️ 이 목적지는 **되돌아가는 것**이지 새로 여는 것이 아니다. 시트는 언제나 `router.replace`로
 * 이동하므로(new.tsx), 동기화 상태 화면을 push해 둔 채 시트를 열면 스택에 같은 화면이 두 장
 * 쌓인다 — 그래서 진입점(app/sync-status.tsx)이 시트를 **replace로 연다**. 근거는 그쪽 onPress
 * 주석에 한 번만 적는다(요약하면: 빈 목록의 "닫기"가 똑같이 빈 같은 화면으로 되돌아간다).
 */
export function resolvePostSaveDestination(params: { from?: unknown } | null | undefined): PostSaveDestination {
  const source = parseExpenseEntrySource(params?.from);
  if (source === "items" || source === "item-detail") return POST_SAVE_ITEMS_DESTINATION;
  if (source === "recurring") return POST_SAVE_HOME_DESTINATION;
  if (source === SYNC_FIX_ENTRY_SOURCE) return POST_SAVE_SYNC_STATUS_DESTINATION;
  return POST_SAVE_DEFAULT_DESTINATION;
}

// ---------------------------------------------------------------------------------------------
// "저장하고 계속 기록" (마트 연속 기록)
//
// 마트에서 기저귀·물티슈·분유를 한 번에 사고 나면 기록도 연속 3건이다. 지금까지는 저장할
// 때마다 기록 탭으로 튕겨 나가서, 두 번째 항목을 적으려면 FAB → 시트 열기 → 날짜/결제 수단
// 다시 확인을 매번 반복해야 했다. 저장은 하되 화면은 그대로 두는 보조 경로 하나가 그 왕복을
// 통째로 없앤다.
// ---------------------------------------------------------------------------------------------

/** 보조 버튼 문구. 무엇이 일어나는지를 순서대로 말한다(저장 → 계속). */
export const CONTINUE_RECORDING_LABEL = "저장하고 계속 기록";

/**
 * 계속 기록 모드에서 저장 직후 뜨는 문구.
 *
 * 일반 저장의 OFFLINE_SAVED_MESSAGE("기기에 저장했어요. 연결되면 자동으로 반영할게요.")를 그대로
 * 쓰지 않는 이유: 그 문장은 **화면을 떠나기 직전** 마지막 인사라 뒷말이 필요 없다. 여기서는 화면이
 * 그대로 남고 칸이 비워지므로, 입력이 사라진 것이 오류가 아니라 다음 항목을 위한 것임을 같은
 * 줄에서 말해 줘야 한다.
 *
 * 라운드 48 QA(P2-1) — 앞머리는 **"기기에 저장했어요"로 되돌린다**. 이 경로의 저장도 예외 없이
 * 로컬 우선(createExpenseOffline)이라, 이 문구가 뜨는 시점에 서버는 아직 이 기록을 모른다.
 * 그냥 "저장했어요"는 오프라인 저장을 서버 저장처럼 읽히게 하는 허위 표시이고, 같은 화면의 일반
 * 저장이 "기기에 저장했어요"라고 말하는 옆에서 표기가 둘로 갈린다(DNC-018 톤 일관성).
 * 뒷말만 이 모드의 것("이어서 다음 항목을 기록해 보세요")으로 바꿔 붙인다 — 서버 반영 약속은
 * 화면을 떠나지 않는 이 모드에서 동기화 상태(기록 탭 배지)가 계속 책임진다.
 */
export const CONTINUE_RECORDING_SAVED_MESSAGE = "기기에 저장했어요. 이어서 다음 항목을 기록해 보세요.";

/**
 * 이 진입 상태에서 "저장하고 계속 기록"을 내놓아도 되는가.
 *
 * 준비템에서 넘어온 기록(linkedItemTemplateId)에서는 **내놓지 않는다**: 그 파라미터는 화면이
 * 살아 있는 동안 바뀌지 않으므로, 폼만 비우고 이어서 적은 두 번째 지출도 같은 준비템에 연결돼
 * 버린다(서버가 그 준비템을 다시 준비 완료로 올린다 — 사용자가 연결한 적 없는 기록이다).
 * 준비템 경로는 애초에 "그 한 건을 적는" 흐름이라 연속 기록이 필요하지도 않다.
 */
export function canContinueRecording(input: { linkedItemTemplateId?: string | null }): boolean {
  const linked = input.linkedItemTemplateId?.trim() ?? "";
  return linked.length === 0;
}
