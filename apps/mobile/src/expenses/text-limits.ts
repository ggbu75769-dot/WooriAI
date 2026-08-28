/**
 * GAP-056 #1 — 지출 텍스트 필드 길이 상한의 (모바일 쪽) 단일 소스.
 *
 * 금액 상한(amount-limit.ts)과 **같은 종류의 구멍**의 텍스트판이다. 서버 DTO는 품목명 100자·
 * 판매처 100자·메모 500자를 `@MaxLength`로 물고 있는데(apps/api/src/finance/dto/expense.dto.ts),
 * 입력 화면에는 그 숫자를 아는 자리가 한 곳도 없었다. 그래서 101자를 적으면 이렇게 끝났다:
 * 오프라인 아웃박스가 **로컬 저장을 먼저 성공**시키고, flush에서야 400을 만나 실패 행으로
 * 파킹된다(4xx는 재시도하지 않는다 — apps/mobile/src/offline/remote-api.ts). 사용자에게 남는
 * 선택지는 "다시 시도"(몇 번을 눌러도 같은 400)와 "버리기"(기록 손실) 둘뿐인 **영구 실패 행**이다.
 * 입력 칸이 먼저 막으면 그 행이 큐에 들어갈 일 자체가 없다.
 *
 * ## 단일 소스는 어디인가
 * **`@wooriai/contracts`의 `EXPENSE_ITEM_NAME_MAX_LENGTH` · `EXPENSE_MERCHANT_MAX_LENGTH` ·
 * `EXPENSE_MEMO_MAX_LENGTH`가 단일 소스다.** 서버 DTO(`@MaxLength`)와 요청 스키마(zod)가
 * 그 상수를 직접 import한다. 모바일은 그 패키지를 의존하지 않으므로(apps/mobile/package.json에
 * contracts가 없다 — domain만 있다) 값을 여기 다시 적되, `text-limits.test.ts`의 대조 테스트가
 * contracts 선언과 이 세 숫자가 갈리지 않는지 확인한다. amount-limit.ts가 도메인 상수와
 * 맺고 있는 관계와 똑같은 관계다.
 *
 * ## 컬럼은 120인데 상한이 100인 이유
 * `expenses.item_name` · `expenses.merchant`는 varchar(120)이고 memo는 text다. 즉 100/500은
 * 물리적 한계가 아니라 **계약이 정한 값**이고, 실제로 엑셀 가져오기 경로(import_rows)는
 * 120자까지 받아들인다. 그래서 101~120자짜리 품목명을 가진 지출이 DB에 이미 있을 수 있다 —
 * 그 기록을 지출 상세에서 열어 저장하면 PATCH가 400으로 떨어진다. 입력 칸의 `maxLength`는
 * "새로 치는 글자"만 막으므로, **이미 들어 있는 값**은 아래 판정 함수가 잡아 안내 한 줄로
 * 말해 준다(조용히 잘라 버리지 않는다 — 무엇이 왜 막혔는지 모르는 채로 두지 않는다).
 *
 * ## 문구
 * 사용자에게는 varchar도 DTO도 말하지 않는다 — 몇 자까지 쓸 수 있는지만 말한다(해요체,
 * DNC-018: 죄책감 유발 금지). 정기 지출 템플릿의 같은 안내(recurring-template.ts의
 * `RECURRING_ITEM_NAME_TOO_LONG_MESSAGE`)와 한 문장으로 맞춘다.
 *
 * 이 모듈은 특정 화면에 묶이지 않는다 — 지출 상세(app/expenses/[expenseId].tsx)가 먼저 쓰고,
 * 빠른 기록 시트(app/expenses/new.tsx)도 같은 함수를 그대로 import하면 된다.
 */

/** 품목명 상한. 서버 `CreateExpenseDto.itemName`/`UpdateExpenseDto.itemName`의 `@MaxLength`와 같은 값. */
export const ITEM_NAME_MAX_LENGTH = 100;

/** 판매처 상한. 서버 `merchant`의 `@MaxLength`와 같은 값. */
export const MERCHANT_MAX_LENGTH = 100;

/** 메모 상한. 서버 `memo`의 `@MaxLength`와 같은 값(컬럼은 text — 이 숫자는 계약이다). */
export const MEMO_MAX_LENGTH = 500;

/**
 * 상한 초과 여부. **서버로 실제로 보낼 문자열을 그대로 넘긴다** — 품목명·판매처는 화면이
 * `trim()`한 값을 보내고 메모는 원문 그대로 보내므로, 판정도 같은 값으로 해야 클라이언트가
 * "괜찮다"고 한 입력이 서버에서 400이 되는 어긋남이 생기지 않는다(class-validator의
 * `@MaxLength`도 받은 문자열의 `.length`를 그대로 본다).
 *
 * 빈 문자열·필수 여부는 여기서 판단하지 않는다(기존 가드가 담당한다 — 금액의 0 이하 판정을
 * amount-limit.ts가 맡지 않는 것과 같다).
 */
export function isTextOverLimit(value: string, maxLength: number): boolean {
  return value.length > maxLength;
}

/** 품목명이 상한을 넘었는가. */
export function isItemNameOverLimit(value: string, maxLength: number = ITEM_NAME_MAX_LENGTH): boolean {
  return isTextOverLimit(value, maxLength);
}

/** 판매처가 상한을 넘었는가. */
export function isMerchantOverLimit(value: string, maxLength: number = MERCHANT_MAX_LENGTH): boolean {
  return isTextOverLimit(value, maxLength);
}

/** 메모가 상한을 넘었는가. */
export function isMemoOverLimit(value: string, maxLength: number = MEMO_MAX_LENGTH): boolean {
  return isTextOverLimit(value, maxLength);
}

/** 입력 칸 아래 안내 한 줄. 막은 이유(= 몇 자까지 쓸 수 있는지)를 사실대로 말한다. */
export function itemNameOverLimitMessage(maxLength: number = ITEM_NAME_MAX_LENGTH): string {
  return `품목명은 ${maxLength}자까지 입력할 수 있어요.`;
}

/** 판매처 안내 한 줄. */
export function merchantOverLimitMessage(maxLength: number = MERCHANT_MAX_LENGTH): string {
  return `판매처는 ${maxLength}자까지 입력할 수 있어요.`;
}

/** 메모 안내 한 줄. */
export function memoOverLimitMessage(maxLength: number = MEMO_MAX_LENGTH): string {
  return `메모는 ${maxLength}자까지 입력할 수 있어요.`;
}

/**
 * 저장 직전 가드용 한 방 판정 — 셋 중 하나라도 상한을 넘으면 true.
 *
 * 버튼 비활성만으로 끝내지 않는 이유는 금액 상한과 같다: 상태가 앞서가는 경로(연타·자동
 * 채움·프리필 직후 저장)를 비활성 하나로 다 막지 못한다. 넘기는 값은 **보낼 값 그대로**다.
 */
export function hasExpenseTextOverLimit(fields: { itemName?: string; merchant?: string; memo?: string }): boolean {
  return (
    isItemNameOverLimit(fields.itemName ?? "") ||
    isMerchantOverLimit(fields.merchant ?? "") ||
    isMemoOverLimit(fields.memo ?? "")
  );
}
