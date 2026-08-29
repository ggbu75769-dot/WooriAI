/**
 * 라운드 58 #5 — 동기화 실패 행의 **"고쳐서 다시 보내기"** 프리필 계약(순수 로직).
 *
 * ## 무엇이 없었나
 *
 * 라운드 57 #8 이후, 재시도가 무익한 4xx로 실패한 지출 행에는 "재시도" 대신 안내 한 줄이
 * 선다 — "다시 보내도 같은 결과예요. 내용을 고쳐 새로 기록하거나 버려 주세요."
 * (src/offline/permission-denied.ts). 정직한 문장이지만, 화면에는 그 "내용을 고쳐 새로 기록"에
 * 해당하는 **길이 없었다**. 사용자가 실제로 해야 했던 일은 이랬다:
 *
 *   1. 실패 카드에 보이는 품목명·금액을 눈으로 읽어 외운다(판매처·메모·날짜·결제 수단은 카드에
 *      보이지도 않는다 — 그 값들은 그냥 사라진 것과 같다).
 *   2. 기록 시트를 새로 열어 전부 다시 친다.
 *   3. 원본 실패 행으로 돌아와 따로 버린다(잊으면 실패 배지가 영영 남는다).
 *
 * 이 모듈은 1·2를 없앤다: 행의 payload를 그대로 실은 기록 시트가 열린다. 3은 화면이 맡되,
 * **새 저장이 확정된 뒤에만** 원본을 버린다(아래 `FAILED_ROW_LOCAL_ID_PARAM` 주석).
 *
 * ## 왜 별도 모듈인가 ("같은 내용으로 또 기록"과 무엇이 다른가)
 *
 * 프리필을 만드는 함수가 이미 하나 있다(record-row-actions.ts `buildRepeatExpenseParams`).
 * 거기에 옵션을 붙이지 않고 파일을 나눈 이유는 **날짜** 하나 때문이다. 그쪽은 "새로 산 물건을
 * 또 적는" 동선이라 날짜를 일부러 넘기지 않고(오늘에서 시작한다), 이쪽은 "이미 적은 그 기록을
 * 서버가 받아 줄 수 있게 다시 쓰는" 동선이라 날짜를 넘겨야 한다 — 두 규칙이 한 함수 안에서
 * 플래그로 갈리면 어느 호출부가 무엇을 뜻했는지 나중에 읽을 수 없다(근거는 record-row-actions.ts
 * 의 "날짜 미전달" 주석에 예외로 함께 적어 두었다).
 *
 * 파싱은 두 동선이 **같은 파라미터 이름**을 쓰는 부분(품목명·금액·분류·결제 수단)까지
 * record-row-actions.ts의 `parseExpensePrefillParams`가 그대로 맡는다. 이 파일은 그 계약에
 * 없던 것(판매처·메모·날짜·원본 localId)만 더한다.
 *
 * react-native / expo-router / 저장소에 의존하지 않는다(vitest 단위 테스트 대상).
 */

import { isBeforeEntryDateFloor, isValidCalendarDate } from "@wooriai/domain";
import type { ExpensePayload } from "../offline/types";
import { SYNC_FIX_ENTRY_SOURCE } from "./post-save-destination";
import {
  EXPENSE_PREFILL_PAYMENT_METHODS,
  firstPrefillParamValue,
  isRepeatableExpenseType,
  type ExpensePrefillPaymentMethod
} from "./record-row-actions";

/**
 * 기록 시트가 "이건 실패 행을 다시 쓰는 중"임을 아는 유일한 표시 = 원본 행의 localId.
 *
 * 이 값이 있으면 시트는 저장이 **확정된 뒤에** 그 행을 버린다(discardOfflineMutation). 저장
 * 전에 버리면 저장이 실패했을 때 원본도 새 기록도 없는 상태가 된다 — 실패 행 하나가 두 번
 * 사라지는 셈이라, 사용자가 되돌릴 방법이 없다(이 큐의 행은 서버에 없다).
 */
export const FAILED_ROW_LOCAL_ID_PARAM = "failedLocalId";

/** URL 파라미터로 실려 가는 값(전부 문자열). 값이 없는 필드는 **키 자체를 싣지 않는다**. */
export type FailedRowPrefillParams = {
  /** 원본 실패 행. 저장 확정 후 이 행을 버린다. */
  failedLocalId: string;
  /**
   * 라운드 58 통합리뷰 P1-1 — **이 행이 어느 아이의 기록인가**.
   *
   * 이 앱의 기록 시트는 언제나 *지금 선택된 아이* 밑으로 저장한다(new.tsx의 `childId`는
   * selected-child.store에서 온다). 그런데 실패 행은 아이 A로 만들어졌을 수 있고, 사용자가
   * 그 사이 아이 B로 전환해 두었을 수도 있다. 그 상태로 "고쳐서 다시 보내기"가 열리면 새
   * 기록은 B 밑으로 저장되고 **A의 원본은 저장 확정과 함께 폐기된다** — 아이 A의 지출 한 건이
   * 사용자가 고른 적 없는 아이로 옮겨 앉고, 되돌릴 원본도 없다(서버에 없는 행이다).
   *
   * 그래서 방어가 두 겹이다. 첫 겹은 화면이다: 동기화 상태 화면은 이 행이 선택된 아이의
   * 것일 때만 버튼을 그린다(app/sync-status.tsx). 둘째 겹이 이 값이다 — 링크가 어떤 경로로
   * 열리든(딥링크·복원된 내비게이션 상태) 시트가 스스로 어긋남을 알아채고 저장을 막는다
   * (`isFailedRowChildMismatch`).
   */
  childId: string;
  /**
   * 라운드 59 #2 — **저장 후 어디로 돌아갈 것인가**(라우팅 힌트, 화면에 보이지 않는 값).
   *
   * `sync-fix`는 곧 "저장이 확정되면 동기화 상태 화면으로 돌아간다"는 뜻이다. 이 값이 없으면
   * 시트는 종전처럼 기록 탭으로 가는데, 그 화면에는 **원본 실패 행이 사라졌다는 사실**이
   * 어디에도 없다(판정과 근거는 post-save-destination.ts `resolvePostSaveDestination`).
   * 문자열을 여기 다시 적지 않고 그 모듈의 상수를 그대로 싣는다 — 양 끝이 갈리면 규칙이
   * 조용히 죽는다(정기 지출의 `RECURRING_ENTRY_SOURCE`와 같은 관례).
   */
  from: typeof SYNC_FIX_ENTRY_SOURCE;
  itemName: string;
  amountKrw: string;
  /**
   * 원본 기록의 지출 날짜(YYYY-MM-DD). 시트의 날짜 가드를 통과하지 못하면 시트가 오늘로
   * 물러서고 그 사실을 한 줄로 밝힌다(`resolveFailedRowPrefillDate`).
   */
  spentOn?: string;
  categoryId?: string;
  paymentMethod?: ExpensePrefillPaymentMethod;
  merchant?: string;
  memo?: string;
  /**
   * 준비템에서 시작된 기록이면 그 연결도 함께 간다 — 다시 보낸 기록이 서버에 닿으면 그
   * 준비템이 '준비 완료'로 올라가는 것이 원본이 하려던 일이었다(R19-B 핵심 루프). 여기서
   * 떨어뜨리면 사용자가 고친 것은 오타 하나인데 준비템 연결만 조용히 사라진다.
   */
  itemTemplateId?: string;
  /**
   * 눌러서 산 제휴 링크 id도 그대로 옮긴다(기록·정산용).
   * ⚠️ DNC-009: 추천 점수·정렬로 유입 금지 — 이 값은 payload에만 실린다.
   */
  linkedProductLinkId?: string;
};

/** 프리필을 만들 때 보는 것 = 실패 행 그 자체(localId + payload). */
export type FailedRowPrefillInput = {
  localId: string;
  payload: ExpensePayload;
};

/**
 * 실패 행 → 기록 시트 프리필 파라미터. 이 행을 그대로 다시 쓸 수 없으면 **null**이고, 그때
 * 화면은 버튼 자체를 내놓지 않는다(눌러도 아무 일이 없는 버튼을 만들지 않는 규칙 —
 * record-row-actions.ts 라운드 38 H-7과 같은 판단).
 *
 * null이 되는 네 경우:
 *
 *  1. **선물·환불 행.** 이 시트가 만들 수 있는 구분은 지출/선물뿐이고(환불은 엑셀 가져오기·
 *     서버 경로로만 생긴다), 프리필 계약에는 구분을 싣는 파라미터가 없다. 그대로 열면 선물이
 *     조용히 일반 지출로 저장돼 이번 달 합계가 사용자가 쓰지 않은 돈만큼 부푼다(DNC-015 —
 *     `isRepeatableExpenseType`이 "또 기록"에서 같은 이유로 막는 바로 그 자리다). 이 행들에도
 *     "버리기"는 그대로 남으므로 사용자가 갇히지 않는다.
 *  2. **품목명이 빈 행**(손상·레거시 데이터). 시트의 저장 가드가 그대로 막는다.
 *  3. **0 이하·비정수 금액**(DNC-013).
 *  4. **아이를 말하지 않는 행**(childId가 빈 손상 데이터). 어느 아이의 기록인지 모르는 채로
 *     시트를 열면 새 기록이 어느 아이 밑으로 가야 하는지도 확인할 수 없다 — 위 `childId`
 *     주석의 이중 방어가 둘 다 무력해지는 유일한 경우라, 아예 열지 않는다.
 *
 * 값이 없는 선택 필드는 키를 싣지 않는다 — 빈 문자열을 실어 보내면 "사용자가 지운 값"과
 * "원래 없던 값"이 구분되지 않는다.
 */
export function buildFailedRowPrefillParams(row: FailedRowPrefillInput): FailedRowPrefillParams | null {
  const payload = row.payload;
  if (!isRepeatableExpenseType(payload?.expenseType)) return null;
  const localId = row.localId?.trim() ?? "";
  if (localId.length === 0) return null;
  const childId = payload?.childId?.trim() ?? "";
  if (childId.length === 0) return null;
  const itemName = payload?.itemName?.trim() ?? "";
  if (itemName.length === 0) return null;
  if (!Number.isInteger(payload.amountKrw) || payload.amountKrw <= 0) return null;

  const spentOn = typeof payload.spentOn === "string" ? payload.spentOn.trim() : "";
  const categoryId = payload.categoryId?.trim() ?? "";
  const merchant = payload.merchant?.trim() ?? "";
  // 메모는 trim만 하고 **줄이지 않는다**: 길이 상한을 넘겨 400으로 실패한 행이야말로 이 버튼의
  // 사례라, 여기서 잘라 버리면 사용자가 고칠 원문이 사라진다(시트의 저장 가드가 길이를 말한다).
  const memo = payload.memo?.trim() ?? "";
  const paymentMethod = EXPENSE_PREFILL_PAYMENT_METHODS.find((method) => method === payload.paymentMethod);
  const itemTemplateId = payload.linkedItemTemplateId?.trim() ?? "";
  const linkedProductLinkId = payload.linkedProductLinkId?.trim() ?? "";

  return {
    failedLocalId: localId,
    childId,
    // 라운드 59 #2: 저장 후 착지도 이 계약의 일부다(위 `from` 주석).
    from: SYNC_FIX_ENTRY_SOURCE,
    itemName,
    amountKrw: String(payload.amountKrw),
    ...(spentOn.length > 0 ? { spentOn } : {}),
    ...(categoryId.length > 0 ? { categoryId } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(merchant.length > 0 ? { merchant } : {}),
    ...(memo.length > 0 ? { memo } : {}),
    ...(itemTemplateId.length > 0 ? { itemTemplateId } : {}),
    ...(linkedProductLinkId.length > 0 ? { linkedProductLinkId } : {})
  };
}

/** 시트가 "고쳐서 다시 보내기로 열렸는가"를 판정한다. 아니면 null(= 평소의 새 기록). */
export function parseFailedRowLocalId(value: unknown): string | null {
  const localId = firstPrefillParamValue(value).trim();
  return localId.length > 0 ? localId : null;
}

/** 판매처·메모처럼 **글자 그대로** 옮기는 프리필 값. 없으면 빈 문자열(= 예전처럼 빈 칸). */
export function parseFailedRowPrefillText(value: unknown): string {
  return firstPrefillParamValue(value);
}

/**
 * 라운드 59 #5 — 다른 아이의 실패 행에서 **버튼 자리에 서는 한 줄**.
 *
 * 라운드 58 통합리뷰 P1-1이 그 행에서 "고쳐서 다시 보내기"를 뗀 것은 옳았지만(아래
 * `isFailedRowChildMismatch` 주석의 데이터 손실), 뗀 자리에 아무 말도 남기지 않았다. 사용자가
 * 보는 것은 같은 실패 행 둘 중 하나에만 버튼이 있는 화면이고, 왜 이 행에는 없는지 화면 어디에도
 * 없다 — 이 앱의 관례(라운드 40 J-9: **지우지 않고 사실을 말한다**)에서 벗어난 유일한 자리였다.
 *
 * 무엇을 하면 되는지까지 한 줄에 말한다(아이를 바꾸면 그 행에도 버튼이 선다). 책망 없는 해요체
 * (DNC-018)이고, "버리기"는 그 행에 그대로 남으므로 사용자가 갇히지도 않는다.
 *
 * ⚠️ 자리: 동기화 상태 화면의 문구 단일 소스는 `src/offline/messages.ts`다. 이 상수만 여기 있는
 * 이유는 라운드 59 트랙 A가 그 파일을 소유해 같은 라운드에서 충돌하기 때문이고, **문구를 옮기는
 * 것 자체가 다음 라운드의 몫**이다(트랙 B가 새 문구를 자기 소유 모듈에 두기로 한 합의).
 */
export const FAILED_ROW_OTHER_CHILD_NOTICE = "다른 아이의 기록이에요. 그 아이를 선택하면 고쳐서 다시 보낼 수 있어요.";

/**
 * 라운드 58 통합리뷰 P1-1 — 이중 방어의 **둘째 겹**: 프리필이 말하는 아이와 지금 선택된 아이가
 * 어긋나는가.
 *
 * 화면(app/sync-status.tsx)이 이미 버튼을 선택된 아이의 행에만 그리므로 정상 동선에서는 언제나
 * false다. 그런데도 시트가 스스로 한 번 더 묻는 이유는, 그 버튼을 누른 **뒤에** 어긋남이 생길 수
 * 있기 때문이다: 시트가 열려 있는 동안 다른 탭·다른 기기 동기화로 선택된 아이가 바뀌면(이 앱의
 * 아이 선택은 전역 스토어다) 저장 시점의 아이는 버튼을 누를 때의 아이가 아니다. 딥링크·복원된
 * 내비게이션 상태로 이 화면이 직접 열리는 경로도 같은 자리다.
 *
 * 어긋나면 화면은 **저장을 막고 사실을 말한다**(FAILED_ROW_PREFILL_CHILD_MISMATCH_NOTICE).
 * 조용히 지금 아이 밑으로 저장하면 아이 A의 지출이 B의 합계에 들어가고, 저장 확정과 함께 A의
 * 원본 실패 행이 폐기돼 되돌릴 길이 사라진다(서버에 없는 행이다).
 *
 * 판정 규칙:
 *  - 파라미터가 없으면 **false**. 이 계약을 싣지 않는 다른 진입점("또 기록"·준비템·정기 지출)의
 *    동작은 한 글자도 바뀌지 않는다.
 *  - 아이를 아직 고르지 않았으면 **false**. 그 상태의 저장은 시트의 기존 가드가 이미 막고 있고,
 *    여기서 한 번 더 말하면 "아이를 고르세요"와 "다른 아이의 기록이에요"가 함께 서서 사용자가
 *    무엇을 해야 하는지 오히려 흐려진다.
 *  - 둘 다 있고 다르면 **true**.
 */
export function isFailedRowChildMismatch(
  prefillChildId: unknown,
  selectedChildId: string | null | undefined
): boolean {
  const rowChildId = firstPrefillParamValue(prefillChildId).trim();
  if (rowChildId.length === 0) return false;
  const selected = selectedChildId?.trim() ?? "";
  if (selected.length === 0) return false;
  return rowChildId !== selected;
}

export type FailedRowPrefillDate = {
  /** 시트가 시작할 날짜(ISO). null이면 화면 기본값(오늘) 그대로다. */
  spentOn: string | null;
  /**
   * 원본 날짜를 쓸 수 없어 오늘로 물러섰는가. 화면은 이때만 안내 한 줄을 띄운다
   * (FAILED_ROW_PREFILL_DATE_RESET_NOTICE — src/offline/messages.ts).
   */
  fellBackToToday: boolean;
};

/** 프리필 자체가 없을 때의 값. 안내도 없고 날짜도 화면 기본값이다. */
export const NO_FAILED_ROW_PREFILL_DATE: FailedRowPrefillDate = { spentOn: null, fellBackToToday: false };

/**
 * 날짜 프리필 판정.
 *
 * ## 왜 오늘로 몰래 바꾸지 않나
 *
 * 실패 행의 날짜가 **미래**인 경우가 실제로 있다: 기기 시계가 앞서 있거나 자정 경계에서 만든
 * 기록은 서울 기준 미래 날짜로 저장돼 서버에서 400(EXPENSE_FUTURE_DATE)을 받는다 — 즉 날짜
 * 때문에 실패한 행이 이 버튼의 대표 사례다. 그 값을 그대로 채우면 시트의 날짜 가드
 * (`validateExpenseDateInput` → `isFutureSeoulDate`)에 걸려 저장 버튼이 막힌 채로 열린다.
 *
 * 그렇다고 앱이 조용히 오늘로 고쳐 두면, 사용자가 고른 적 없는 날짜가 기록에 남고 그 달 합계가
 * 사실과 어긋난다(DNC: 허위 데이터 금지). 그래서 **오늘로 물러서되 그 사실을 말한다** — 고르는
 * 것은 사용자 몫이고, 날짜 칩과 달력은 바로 그 자리에 있다.
 *
 * ## 이 함수는 실패 행만의 것이 아니다
 *
 * 기록 시트가 `spentOn` 파라미터를 읽는 자리는 하나뿐이고(app/expenses/new.tsx), 그 자리로
 * 들어오는 경로는 둘이다: 실패 행의 "고쳐서 다시 보내기"와 **기록 탭 달력 칸 탭**
 * (app/(tabs)/records.tsx의 `handleRecordForCalendarDate` → `/expenses/new?spentOn=`). 그래서
 * 여기가 두 동선의 **공통 입구**이고, 이 함수가 통과시킨 날짜는 시트의 초기값이 된다.
 *
 * 판정 규칙(시트의 가드와 같은 질문을 순수하게 다시 묻는다):
 *  - 값 없음 → 프리필 없음, 안내 없음(평소의 새 기록과 같다).
 *  - 형식이 아니거나 달력에 없는 날짜 → 오늘 + 안내. 손상된 값을 화면에 그리지 않는다.
 *  - `todayIso`보다 뒤(미래) → 오늘 + 안내.
 *  - **과거 하한보다 이른 날짜 → 오늘 + 안내**(라운드 68 리뷰 C-1). 시트의 저장 가드는 이미 그
 *    날짜를 거절하는데(entry-form-guards.ts의 하한 갈래), 그 값이 초기값으로 앉으면 저장 버튼이
 *    막힌 채로 열린다 — 미래 날짜와 같은 자리다. 하한 숫자는 여기 적지 않고 도메인 술어에
 *    묻는다(`isBeforeEntryDateFloor`): 읽는 쪽과 쓰는 쪽이 같은 하나를 봐야 한다.
 *  - 그 밖 → 그대로 쓴다.
 *
 * 어느 갈래로 물러서든 안내 문장은 하나다("오늘로 두었어요") — 사용자가 할 일이 같기 때문이다.
 *
 * `todayIso`를 인자로 받는 이유: 이 앱의 "오늘"은 서울 기준이고(getSeoulToday), 화면은 이미 그
 * 값을 한 번 만들어 두었다. 여기서 시계를 다시 읽으면 같은 렌더 안에서 두 개의 오늘이 생긴다.
 * 문자열 비교로 충분한 것도 그 함수와 같은 이유다(ISO 날짜는 사전순 = 시간순). 하한 쪽은 폼
 * 가드와 **같은 호출 형태**로 둔다(인자 없는 도메인 기본값) — 하한은 달 단위라 하루의 어긋남이
 * 판정을 바꾸지 않고, 두 자리가 같은 모양이어야 다음 라운드가 한쪽만 고치지 않는다.
 */
export function resolveFailedRowPrefillDate(value: unknown, todayIso: string): FailedRowPrefillDate {
  const spentOn = firstPrefillParamValue(value).trim();
  if (spentOn.length === 0) return NO_FAILED_ROW_PREFILL_DATE;
  if (!isValidCalendarDate(spentOn)) return { spentOn: null, fellBackToToday: true };
  if (spentOn > todayIso) return { spentOn: null, fellBackToToday: true };
  if (isBeforeEntryDateFloor(spentOn)) return { spentOn: null, fellBackToToday: true };
  return { spentOn, fellBackToToday: false };
}
