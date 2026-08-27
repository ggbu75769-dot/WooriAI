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
 */
export type ExpenseEntrySource = "items" | "item-detail" | "purchase-followup";

/** 라우트 파라미터 이름. 붙이는 쪽과 읽는 쪽이 갈리지 않도록 문자열을 한 곳에 둔다. */
export const EXPENSE_ENTRY_SOURCE_PARAM = "from";

/**
 * 저장 후 갈 수 있는 곳. expo-router의 typedRoutes가 켜져 있어(app.json) 이 유니온이 그대로
 * Href로 검사되므로, 없는 경로를 반환하면 typecheck에서 걸린다
 * (src/notifications/notification-route.ts와 같은 장치).
 */
export type PostSaveDestination = "/(tabs)/records" | "/(tabs)/items";

/** 종전 동작. 출처를 모르거나 규칙이 없는 값은 전부 여기로 떨어진다. */
export const POST_SAVE_DEFAULT_DESTINATION: PostSaveDestination = "/(tabs)/records";

/** 준비템 계열에서 온 기록이 돌아가는 곳(방금 오른 준비율·100% 축하 배너가 있는 화면). */
export const POST_SAVE_ITEMS_DESTINATION: PostSaveDestination = "/(tabs)/items";

const KNOWN_ENTRY_SOURCES: ReadonlyArray<ExpenseEntrySource> = ["items", "item-detail", "purchase-followup"];

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
 * - 그 외/미지정/오염 → 종전 동작(기록 탭).
 */
export function resolvePostSaveDestination(params: { from?: unknown } | null | undefined): PostSaveDestination {
  const source = parseExpenseEntrySource(params?.from);
  if (source === "items" || source === "item-detail") return POST_SAVE_ITEMS_DESTINATION;
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
