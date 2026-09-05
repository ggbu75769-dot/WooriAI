import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import {
  EXPENSE_ITEM_NAME_MAX_LENGTH,
  EXPENSE_MEMO_MAX_LENGTH,
  EXPENSE_MERCHANT_MAX_LENGTH,
  MONEY_KRW_MAX
} from "@wooriai/contracts";
import { PAYMENT_METHODS, type PaymentMethod } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const creatableExpenseTypes = ["expense", "gift"] as const;
type CreatableExpenseType = (typeof creatableExpenseTypes)[number];

export class CreateExpenseDto {
  @IsUUID()
  categoryId!: string;

  /**
   * GAP-054 #2 — 상한은 `@wooriai/contracts`의 `MONEY_KRW_MAX`(= int4 상한)를 그대로 쓴다.
   *
   * 없을 때 무슨 일이 있었나: `expenses.amount_krw`는 int4라 이 값을 넘기면 Prisma가 아니라
   * **DB가** 터져 500으로 나갔다. 모바일 오프라인 아웃박스는 4xx만 실패 행으로 파킹하고 5xx는
   * 재시도하므로(apps/mobile/src/offline/remote-api.ts), 한 번 들어간 초과 금액은 로컬에서
   * 영원히 재전송되는 poison 행이 됐다(docs/5차/budget-app-gap-analysis.md P0-2). 400으로
   * 거절하면 그 루프 자체가 성립하지 않는다.
   *
   * 마이그레이션 없음 — 컬럼이 이미 갖고 있던 한계를 계약 층에 적는 것뿐이다.
   */
  @IsInt()
  @Min(1)
  @Max(MONEY_KRW_MAX)
  amountKrw!: number;

  /**
   * 라운드 36 F-7: 여기서는 `YYYY-MM-DD` 형식만 본다. "오늘보다 미래일 수 없다"(DNC-013)는
   * 도메인 규칙이라 서비스 계층이 서울 기준으로 판정하고
   * (`store-shared.assertExpenseDateWithinRange` → `isFutureSeoulDate(spentOn, referenceNow())`),
   * VALIDATION_ERROR가 아니라 **EXPENSE_FUTURE_DATE(400)** 로 나간다. 달력상 불가능한 날짜
   * (2026-02-31)도 같은 곳에서 EXPENSE_DATE_INVALID로 걸린다 — 정규식만으로는 통과하기 때문이다.
   *
   * 이 층에 미래 차단을 또 넣지 않는 이유: 생성(insertExpense)·수정(updateExpense)·엑셀 임포트
   * 확정(import-pipeline) 세 경로가 이미 같은 함수를 지나므로 DTO에 얹으면 규칙이 두 벌이 되고,
   * 클라이언트가 코드로 분기하는 에러 봉투가 경로마다 갈린다(생년월일 규칙도 같은 이유로
   * 서비스 계층에 둔다 — onboarding/dto/child.dto.ts의 birthDate 주석 참고).
   */
  @Matches(datePattern)
  spentOn!: string;

  /**
   * GAP-056 #1 — 길이 상한은 `@wooriai/contracts`의 상수를 그대로 쓴다(값 불변: 100).
   *
   * 숫자는 한 글자도 바뀌지 않았다. 바뀐 것은 **그 숫자를 클라이언트도 읽을 수 있게 됐다**는
   * 점이다: 지금까지 상한이 이 파일의 리터럴로만 존재해서 모바일 입력 칸은 101자를 그대로
   * 받아들였고, 오프라인 아웃박스가 로컬 저장을 먼저 성공시킨 뒤 flush에서 400을 만나
   * 영구 실패 행이 됐다(4xx는 재시도하지 않는다 — apps/mobile/src/offline/remote-api.ts).
   * 금액 상한(`MONEY_KRW_MAX`)을 계약 층으로 올린 것과 같은 이유·같은 방식이다.
   *
   * 컬럼은 varchar(120)이라 이 상한은 물리적 한계가 아니라 **계약**이다 — 마이그레이션 없음.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXPENSE_ITEM_NAME_MAX_LENGTH)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(EXPENSE_MERCHANT_MAX_LENGTH)
  merchant?: string;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(EXPENSE_MEMO_MAX_LENGTH)
  memo?: string;

  @IsOptional()
  @IsUUID()
  linkedItemTemplateId?: string;

  /**
   * 라운드 49 C-06: 어떤 제휴 링크를 눌러서 산 것인지(product_links.id). 컬럼과 FK는
   * 처음부터 있었지만(`expenses.linked_product_link_id` → `fk_expenses_linked_product_link`)
   * **어떤 쓰기 경로도 이 값을 채우지 않았다** — 구매 확인 카드의 "샀어요"가 링크 클릭에서
   * 지출 기록까지 이어지는 유일한 경로인데, 그 경로가 자기가 아는 사실(어느 링크였는지)을
   * 서버에 넘길 자리가 없었다. 전역 ValidationPipe가 `forbidNonWhitelisted`라 DTO에 없는
   * 키는 400이므로, 열지 않으면 클라이언트가 보낼 방법 자체가 없다.
   *
   * ⚠️ DNC-009: **기록·정산용 식별자다.** 추천 점수·정렬(모바일 item-ranking.ts)에 유입
   * 금지 — 수수료가 추천 순서를 바꾸면 사용자가 보는 순위가 거짓이 된다.
   *
   * 여기서는 UUID 형식을 검사한다. 저장 경로는 링크 존재를 확인해 누락을 400으로 돌려주며,
   * DB의 FK는 확인 뒤 발생하는 동시 삭제를 방어한다.
   */
  @IsOptional()
  @IsUUID()
  linkedProductLinkId?: string;

  @IsOptional()
  @IsIn([...creatableExpenseTypes])
  expenseType?: CreatableExpenseType;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** GAP-054 #2: 생성과 **같은 상한**이다(근거는 CreateExpenseDto.amountKrw 주석). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MONEY_KRW_MAX)
  amountKrw?: number;

  /** F-7: CreateExpenseDto.spentOn과 동일 — 미래 날짜 거부는 서비스 계층(EXPENSE_FUTURE_DATE). */
  @IsOptional()
  @Matches(datePattern)
  spentOn?: string;

  /** GAP-056 #1: 생성과 **같은 상한**이다(근거는 CreateExpenseDto.itemName 주석). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXPENSE_ITEM_NAME_MAX_LENGTH)
  itemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EXPENSE_MEMO_MAX_LENGTH)
  memo?: string;

  /**
   * 라운드 49 C-03: 결제 수단(아래)과 **정확히 같은 구멍**이 판매처에도 있었다. 오프라인
   * 충돌 해소의 "두 값 나란히 보기"는 판매처를 비교 항목으로 내놓는데
   * (apps/mobile/src/offline/sync-engine.ts `diffExpenseFields`의 표시 집합에 "merchant"가
   * 있다), 이 DTO에 필드가 없어 사용자가 거기서 고른 값을 클라이언트가 보낼 수 없었다
   * (`forbidNonWhitelisted` → 실으면 400). 화면은 고르라고 하고 무엇을 고르든 서버 값이
   * 그대로 남는 **조용한 무시**였다. 같은 라운드에서 지출 상세에 판매처 편집이 생기면서
   * 그 구멍이 실제 입력 경로로도 이어졌다.
   *
   * 빈 문자열은 "지웠다"는 뜻이다 — 서비스 계층의 `cleanOptionalText`가 memo와 똑같이
   * null로 바꾼다. 보내지 않으면 손대지 않는다(additive optional).
   */
  @IsOptional()
  @IsString()
  @MaxLength(EXPENSE_MERCHANT_MAX_LENGTH)
  merchant?: string;

  /**
   * 라운드 48 QA(P2-6): 생성(CreateExpenseDto)에는 처음부터 있었지만 수정에는 없던 필드.
   *
   * 없어서 무슨 일이 있었나: 오프라인 충돌 해소의 "두 값 나란히 보기"는 결제 수단도 비교 항목으로
   * 내놓는다(apps/mobile/src/offline/sync-engine.ts `diffExpenseFields`). 사용자가 거기서 값을
   * 골라 병합하면 그 payload가 PATCH로 나가는데, 이 DTO에 필드가 없으니 클라이언트는 아예 보낼
   * 수 없었다(전역 ValidationPipe가 `forbidNonWhitelisted`라 실으면 400) — 화면은 고르라고 하고,
   * 무엇을 고르든 결제 수단만은 서버 값 그대로 남는 **조용한 무시**였다.
   *
   * 계약 확장은 additive·optional이다: 보내지 않던 클라이언트의 동작은 한 글자도 바뀌지 않는다.
   */
  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsIn([...creatableExpenseTypes])
  expenseType?: CreatableExpenseType;

  /**
   * Optimistic-concurrency guard (MOB-103, design doc §2.2). Omitted by legacy
   * clients -- when absent, update behaves exactly as before (no conflict
   * check). When present and it no longer matches the server's current
   * `version`, the request 409s with VERSION_CONFLICT instead of applying.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
