import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { PAYMENT_METHODS, type PaymentMethod } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const creatableExpenseTypes = ["expense", "gift"] as const;
type CreatableExpenseType = (typeof creatableExpenseTypes)[number];

export class CreateExpenseDto {
  @IsUUID()
  categoryId!: string;

  @IsInt()
  @Min(1)
  amountKrw!: number;

  /**
   * 라운드 36 F-7: 여기서는 `YYYY-MM-DD` 형식만 본다. "오늘보다 미래일 수 없다"(DNC-013)는
   * 도메인 규칙이라 서비스 계층이 서울 기준으로 판정하고
   * (`store-shared.assertNotFutureDate` → `isFutureSeoulDate(spentOn, referenceNow())`),
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchant?: string;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @IsOptional()
  @IsUUID()
  linkedItemTemplateId?: string;

  @IsOptional()
  @IsIn([...creatableExpenseTypes])
  expenseType?: CreatableExpenseType;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountKrw?: number;

  /** F-7: CreateExpenseDto.spentOn과 동일 — 미래 날짜 거부는 서비스 계층(EXPENSE_FUTURE_DATE). */
  @IsOptional()
  @Matches(datePattern)
  spentOn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

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
