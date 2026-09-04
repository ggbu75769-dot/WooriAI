/**
 * 기능 라운드 1 트랙 D — 품목 상세의 **품목 메모(기기 보관)** 판정·문구 순수 모듈.
 *
 * 보유/불필요/보류 같은 *상태*만으로는 "왜"가 남지 않는다("산후조리원에서 준다고 함",
 * "언니네서 물려받기로"). 이 모듈은 그 자유 메모의 규칙 전부를 든다 — 화면
 * (app/items/[itemTemplateId].tsx)은 그리기만 하고, 저장은 기기 로컬 스토어
 * (src/items/item-memo.store.ts — zustand persist·AsyncStorage)가 맡는다. **서버 0바이트.**
 *
 * 설계 근거(docs/5차/feature-round1-design.md §3 트랙 D):
 *  - 키는 `itemTemplateId` 단위다 — 아이 전환과 무관한 *물건*에 대한 메모다.
 *  - 상한 200자. `src/expenses/text-limits.ts`의 관례(값이 곧 계약)를 따르되 그 파일은
 *    지출 입력 소유라 import하지 않고 자체 상수로 둔다.
 *  - 서버 스키마(child_item_statuses)에 memo 칼럼을 더하는 길은 계약·마이그레이션·로컬 미러
 *    3면 수술이라 이월(§6)됐다. 대신 **"이 기기에만 저장돼요" 고지가 필수**다 — 가족과
 *    동기화되지 않는다는 사실을 숨기지 않는다(정직성 규율, DNC-018 해요체).
 *  - ⚠️ 준비템 가격 표시는 사용자 결정 대기 잠금 — 이 모듈의 어떤 문구도 가격을 말하지 않는다.
 *
 * ⚠️ **두 시점 — 저장은 명시 [메모 저장] 버튼이다(자동 저장 없음).** 설계 문서 초안은
 * blur/뒤로가기 자동 저장을 적었지만, 집행 지시가 "저장은 명시 버튼(자동 저장 금지)"으로
 * 정정했다 — 지웠다가 마음을 바꾼 입력이 화면을 떠났다는 이유로 말없이 확정되는 쪽이
 * 더 나쁘다는 판정이다(예산 화면 트랙 E의 "자동 저장 절대 금지"와 같은 축). 어느 쪽이든
 * 네트워크 뮤테이션이 아니므로 `mutation-press-guard`(useMutation 모집단)의 밖이다.
 */

/** 메모 상한(문자 수). 서버 계약이 없으므로 이 숫자가 곧 이 기능의 계약이다. */
export const ITEM_MEMO_MAX_LENGTH = 200;

/** 메모 카드 제목. "메모" 한 낱말은 지출 입력의 메모 칸과 헷갈려서 소유를 밝힌다. */
export const ITEM_MEMO_CARD_TITLE = "내 메모";

/**
 * **필수 고지** — 이 메모는 서버로 가지 않는다. 가족 계정과 공유된다고 오해할 수 있는
 * 자리라, 저장 위치의 사실을 화면이 직접 말한다(숨기면 정직성 규율 위반).
 */
export const ITEM_MEMO_DEVICE_ONLY_NOTICE = "이 메모는 이 기기에만 저장돼요. 가족과는 공유되지 않아요.";

/** 입력 칸의 낭독 라벨. 지출 입력의 "메모 입력 (선택)" 관례를 따른다(선택 사항 표기 포함). */
export const ITEM_MEMO_INPUT_LABEL = "품목 메모 입력 (선택)";

/** 플레이스홀더 — 설계 문서가 든 실제 사용례를 그대로 보여준다(가격 언급 금지). */
export const ITEM_MEMO_INPUT_PLACEHOLDER = "예: 산후조리원에서 준다고 함";

/** 명시 저장 버튼의 보이는 라벨. */
export const ITEM_MEMO_SAVE_LABEL = "메모 저장";

/** 저장 성공(내용 있음) 안내 — DNC-018 해요체. */
export const ITEM_MEMO_SAVED_NOTICE = "메모를 저장했어요.";

/** 빈 메모 저장 = 삭제. 삭제를 저장이라고 부르지 않는다(무엇이 일어났는지 그대로 말한다). */
export const ITEM_MEMO_CLEARED_NOTICE = "메모를 지웠어요.";

/**
 * 기기 저장 실패 문구. 이 경로는 네트워크가 아니라 **이 기기의 저장소** 실패라
 * "연결"을 말하지 않고, 재시도 주체(다시 누르기)만 말한다 —
 * `ITEM_STATUS_LOCAL_SAVE_FAILED_MESSAGE`(src/items/status-mutation-messages.ts)와 같은 규율.
 * 화면은 이 문구를 준비 상태 저장 실패와 같은 배너 한 자리(Toast tone="error")로 알린다 —
 * 저장 실패 무음 금지.
 *
 * ⚠️ 리뷰 M-3(두 시점): 종전 표현은 "메모가 이 기기에 저장되지 않았어요."였다 — 라운드 76 A의
 * 모듈 실패 문구 대장(src/offline/messages.test.ts)이 "저장하지 못했어요" 꼴을 바늘로 걷는다는
 * 이유로 바늘을 피한 것인데, 그 결과 **같은 화면·같은 원인**(기기 저장 실패)의 두 문구가
 * 문법("저장되지 않았어요" vs "저장하지 못했어요")으로 갈렸다. 그 대장은 수 고정 스윕이 아니라
 * **등재형**이다(이유가 적힌 면제 목록 — src/offline/offline-aware-screens.ts에
 * status-mutation-messages.ts가 이미 같은 사유로 서 있다). 그래서 문구를 상태 문구와 같은
 * 꼴로 맞추고, 이 모듈을 그 면제 목록에 등재했다(등재 사유: 기기 로컬 저장이라 연결이
 * 실패의 원인도 해법도 아니다).
 */
export const ITEM_MEMO_LOCAL_SAVE_FAILED_MESSAGE = "메모를 이 기기에 저장하지 못했어요. 다시 눌러 주세요.";

/**
 * 저장 버튼의 낭독 문장 — 어느 품목의 메모인지 이름을 앞에 붙인다(같은 화면의
 * "『이름』 선물로 받았어요" 관례). 문장 꼬리가 고정 명사("메모 저장")라 조사 분기가 없다
 * (korean-particle-guard의 ⓐ 형식). 이름을 모르면 보이는 라벨 그대로다.
 */
export function itemMemoSaveAccessibilityLabel(itemName: string): string {
  const name = itemName.trim();
  return name.length > 0 ? `${name} 메모 저장` : ITEM_MEMO_SAVE_LABEL;
}

/**
 * 저장 대상 정규화: 앞뒤 공백을 지우고 상한에서 자른다. 빈 결과는 "메모 없음"이라는 뜻이다.
 *
 * 리뷰 L-1(두 시점): 종전 `String.prototype.slice(0, 200)`은 UTF-16 단위 절단이라 200번째
 * 자리가 서로게이트 쌍(이모지 등)의 한가운데면 홀로 남은 high surrogate가 저장됐다 — 렌더에서
 * 깨진 글자다. 이제 `Array.from`(코드포인트 반복자)으로 자르므로 경계의 문자는 통째로 남거나
 * 통째로 잘린다. 상한 200의 단위도 UTF-16 코드유닛 수에서 **코드포인트 수**로 옮겨 갔다
 * (한글·라틴 등 BMP 문자만의 메모는 종전과 바이트 단위로 같다).
 */
export function normalizeItemMemo(text: string): string {
  return Array.from(text.trim()).slice(0, ITEM_MEMO_MAX_LENGTH).join("");
}

export type ItemMemos = Readonly<Record<string, string>>;

/**
 * 메모 한 건의 저장 판정. 입력을 변형하지 않고 새 표를 돌려준다.
 *
 *  - 키가 비면 아무것도 하지 않는다(어느 품목의 메모인지 모르는 저장은 없다).
 *  - 정규화 결과가 비면 **그 키를 지운다** — 빈 문자열을 값으로 쌓지 않는다(빈 메모 삭제 규칙).
 *  - 바뀌는 것이 없으면 **같은 객체**를 돌려준다(purchase-followup.store의 no-op 관례 —
 *    구독자가 헛돌지 않는다).
 *  - 다른 품목의 메모는 건드리지 않는다(품목별 격리).
 */
export function applyItemMemoSave(memos: ItemMemos, itemTemplateId: string, rawMemo: string): ItemMemos {
  const key = itemTemplateId.trim();
  if (key.length === 0) return memos;
  const memo = normalizeItemMemo(rawMemo);
  if (memo.length === 0) {
    if (!(key in memos)) return memos;
    const next: Record<string, string> = { ...memos };
    delete next[key];
    return next;
  }
  if (memos[key] === memo) return memos;
  return { ...memos, [key]: memo };
}

/** 저장 뒤 안내 문구 판정: 내용이 남았으면 저장, 비웠으면 삭제를 말한다. */
export function itemMemoSavedNotice(rawMemo: string): string {
  return normalizeItemMemo(rawMemo).length > 0 ? ITEM_MEMO_SAVED_NOTICE : ITEM_MEMO_CLEARED_NOTICE;
}

/**
 * persist 블롭 방어(다른 스토어들의 sanitize 관례 — purchase-followup.store의 sanitizedEntries):
 * 알 수 없는/옛 버전 블롭에서 문자열 키·문자열 값 쌍만 살리고, 값은 정규화(트림·상한)한다.
 * 정규화 결과가 빈 항목은 버린다(빈 메모는 애초에 저장되지 않는 값이다). 표 모양이 아니면
 * 통째로 빈 표로 떨어진다 — 손상 blob이 화면을 깨는 것보다 메모가 비는 쪽이 낫다.
 */
export function sanitizedItemMemos(value: unknown): Record<string, string> {
  const table = value && typeof value === "object" ? (value as { memos?: unknown }).memos : undefined;
  if (!table || typeof table !== "object" || Array.isArray(table)) return {};
  const memos: Record<string, string> = {};
  for (const [key, memo] of Object.entries(table as Record<string, unknown>)) {
    if (typeof key !== "string" || key.trim().length === 0) continue;
    if (typeof memo !== "string") continue;
    const normalized = normalizeItemMemo(memo);
    if (normalized.length === 0) continue;
    memos[key.trim()] = normalized;
  }
  return memos;
}
