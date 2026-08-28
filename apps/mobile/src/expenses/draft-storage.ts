import { persistStorage } from "../stores/persist-storage";

export type QuickExpenseDraft = {
  itemName: string;
  amountText: string;
  memo: string;
  /**
   * 라운드 51 C-#5: **선택 사항**이다. 기록 시트의 초기 상태가 "미선택"이 되면서, 분류를
   * 고르지 않은 채 닫은 초안이 정상적인 값이 됐다. 복원 쪽은 이 값이 8타일 중 하나일 때만
   * 타일을 눌러 준다(없거나 못 찾으면 미선택 그대로 -- 자동 추천도 계속 돈다).
   */
  categoryId?: string;
  spentOnIso: string;
  isGift: boolean;
  /**
   * 라운드 63 C(#4) — **이 초안을 어느 아이 앞에서 쳤는가**. 가산 필드이고 **선택 사항**이다.
   *
   * 왜 필요한가: 이 초안은 전역 키 하나이고(아래 `QUICK_EXPENSE_DRAFT_KEY`) 복원은 마운트
   * 1회 무조건이었다. 그런데 실제 저장 대상은 그때그때의 전역 선택 아이다 -- 첫째의 시트에서
   * "기저귀 38500"을 치다 닫고, 그 사이 아이가 둘째로 바뀌면(홈 헤더·아이 관리 화면, 그리고
   * 라운드 62 #2가 새로 연 알림함 전환) 다시 연 시트에는 첫째의 값이 프리필처럼 복원된다.
   * 그대로 [저장]하면 **둘째의 지출**이 된다. 아이 스코프 라벨(라운드 60 #7)은 "지금 아이"를
   * 말할 뿐 "이 값이 어느 아이 것인가"를 말하지 않는다.
   *
   * 값이 **없을 수 있는** 두 경우가 모두 정상이다:
   *  - 이 필드가 생기기 전에 쓰인 초안(구 blob). 마이그레이션은 없다 -- 아래 읽기 쪽이
   *    임의 JSON을 관대하게 다루므로 구 blob은 **종전 그대로 복원**된다(모르면 지어내지
   *    않는다: 그 값이 누구 것인지 앱은 정말 모른다).
   *  - 아이를 아직 고르지 않은(또는 persist 하이드레이션 전) 상태에서 쓰인 초안. 빈 문자열을
   *    적어 두면 "모른다"와 "주인이 없다"가 구분되지 않으므로 **키 자체를 싣지 않는다**
   *    (라운드 51 C-#5의 categoryId와 같은 규율).
   */
  childId?: string;
};

/**
 * 초안은 여전히 **한 벌**이다(아이별로 여러 개 남기지 않는다).
 *
 * 라운드 63 C(#4) 설계 판단: 키에 childId를 붙여 아이마다 초안을 남기는 안은 "언제 누가
 * 지우는가"라는 정리 책임을 새로 만든다(아이가 늘 때마다 키가 늘고, 삭제·탈퇴 경로가 전부
 * 그 목록을 알아야 한다). 한 벌을 유지하고 **소유자를 적어 두는** 것이 최소치다 -- 남의 초안이
 * 복원되는 것만 막으면 이 결함은 닫힌다.
 */
const QUICK_EXPENSE_DRAFT_KEY = "wooriai-quick-expense-draft";

export async function readQuickExpenseDraft(): Promise<QuickExpenseDraft | null> {
  const raw = await persistStorage.getItem(QUICK_EXPENSE_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as QuickExpenseDraft;
  } catch {
    return null;
  }
}

export async function writeQuickExpenseDraft(draft: QuickExpenseDraft): Promise<void> {
  await persistStorage.setItem(QUICK_EXPENSE_DRAFT_KEY, JSON.stringify(draft));
}

export async function clearQuickExpenseDraft(): Promise<void> {
  await persistStorage.removeItem(QUICK_EXPENSE_DRAFT_KEY);
}

/**
 * 라운드 63 C(#4) — 이 초안이 **지금 아이가 아닌 다른 아이의 것**인가.
 *
 * 화면(app/expenses/new.tsx)은 마운트 복원에서 이 판정이 true면 **아무것도 복원하지 않는다**.
 * 지우지도 않는다 -- 그 값은 여전히 첫째 앞에서 치던 사용자의 입력이고, 첫째로 돌아오면
 * 그대로 살아 있어야 한다(전환 때마다 초안을 버리는 안을 고르지 않은 이유: 전환 한 벌
 * `applyChildSwitch`는 여태 캐시 무효화만 했지 사용자 입력을 버린 적이 없다).
 *
 * 판정 규칙은 `isFailedRowChildMismatch`(src/expenses/failed-row-prefill.ts)와 **같은 모양**이다
 * -- 둘 다 "아는 아이 둘이 어긋날 때만" 막는다:
 *  - 초안이 아이를 말하지 않으면 **false**(구 blob·아이 미선택 상태에서 쓰인 초안).
 *    종전 동작 그대로 복원한다. 이 한 줄이 "가산 필드만 · 마이그레이션 없음" 계약의 전부다.
 *  - 지금 아이를 모르면 **false**. 선택 아이는 persist 스토어라 **하이드레이션이 비동기**이고,
 *    마운트 1회 복원은 첫 렌더의 값을 읽는다 -- 여기서 null을 어긋남으로 치면 콜드 스타트마다
 *    자기 초안이 복원되지 않는 회귀가 된다(그 상태의 저장은 시트의 기존 가드가 이미 막는다).
 *  - 둘 다 있고 다르면 **true**.
 */
export function isQuickExpenseDraftFromOtherChild(
  draft: QuickExpenseDraft | null | undefined,
  selectedChildId: string | null | undefined
): boolean {
  const draftChildId = typeof draft?.childId === "string" ? draft.childId.trim() : "";
  if (draftChildId.length === 0) return false;
  const selected = selectedChildId?.trim() ?? "";
  if (selected.length === 0) return false;
  return draftChildId !== selected;
}

/**
 * 라운드 63 C(#4) — **한 아이 몫의 초안만** 지운다. 부르는 곳은 둘이다.
 *
 *  ① **아이 삭제 뒤처리**(라운드 62 #5의 `clearForChild` 3연타와 같은 자리에 서는 네 번째 줄).
 *     ⚠️ 배선은 이 트랙이 하지 않는다 -- 호출부(`app/settings/privacy.tsx`의 아이 삭제 성공
 *     분기)는 라운드 63 트랙 B의 소유이고, 이 모듈은 시그니처만 내놓는다.
 *  ② **기록 시트의 정리 경로 셋**(빈 입력 디바운스 · 저장 성공 · 아무것도 안 치고 닫기 --
 *     app/expenses/new.tsx `clearDraftForCurrentChild`). 그 셋은 전부 "지금 화면에 남길 것이
 *     없다"는 뜻이지 "다른 아이 앞에서 친 것도 버려라"가 아니다. 복원만 아이 스코프로 막고
 *     이쪽을 그대로 두면, 둘째로 전환한 채 시트를 한 번 여닫는 것만으로 첫째의 초안이 사라진다.
 *
 * 지우는 경우는 둘이다:
 *  - 초안이 **그 아이의 것**일 때. ①에서 이 값이 남으면 존재하지 않는 아이를 위해 친 금액이
 *    다음 진입에서 **남은 아이에게** 프리필처럼 붙는다(세 스토어는 깨끗해졌는데 이 초안만
 *    살아남는, 라운드 62 #5가 못 본 자리다).
 *  - 초안이 **주인을 말하지 않을 때**(구 blob 또는 아이를 모르는 채 쓰인 초안). 그 값이 다른
 *    아이의 것이라고 증명할 수 없으므로 이 아이가 그 값의 후보다 -- ②의 종전 동작(무조건
 *    지우기)도 그대로 보존된다. 주인 없는 초안은 자동 저장 한 번(500ms)이면 주인을 얻으므로
 *    이 창은 매우 좁다.
 *
 * 다른 아이의 초안은 **이 함수가 지우지 않는다** -- 이 함수의 존재 이유가 그 한 줄이다.
 *
 * ⚠️ 라운드 63 리뷰 #5(주석 정정) -- 여기까지가 실제 보장이다. "다른 아이의 초안은 그대로
 * 둔다"고 읽히면 저장소 전체의 성질처럼 들리지만, 초안 슬롯은 **기기당 하나**다. 즉 둘째로
 * 전환한 뒤 시트에서 **한 글자라도 치면** 500ms 자동 저장이 그 슬롯을 덮어써 첫째의 초안이
 * 사라진다 -- 이 함수가 지키는 것은 "치지 않고 여닫는 경우"(②의 정리 경로)와 "다른 아이를
 * 지웠을 때"(①)뿐이다. 아이별로 초안을 여러 벌 들고 있는 저장소가 아니다.
 */
export async function clearQuickExpenseDraftForChild(childId: string): Promise<void> {
  const removedChildId = childId?.trim() ?? "";
  if (removedChildId.length === 0) return;
  const draft = await readQuickExpenseDraft();
  if (!draft) return;
  const draftChildId = typeof draft.childId === "string" ? draft.childId.trim() : "";
  if (draftChildId.length > 0 && draftChildId !== removedChildId) return;
  await clearQuickExpenseDraft();
}
