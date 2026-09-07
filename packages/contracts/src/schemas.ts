import { z } from "zod";
import {
  CHILD_STAGE_CODES,
  CHILD_STAGE_MODES,
  EXPENSE_SOURCES,
  EXPENSE_TYPES,
  IMPORT_STATUSES,
  ITEM_STATUSES,
  MONEY_KRW_MAX,
  NECESSITY_LEVELS,
  PAYMENT_METHODS,
  PRODUCT_PLATFORMS
} from "@wooriai/domain";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDateOnlySchema = dateOnlySchema.nullable().optional();

export const uuidSchema = z.string().uuid();

/**
 * GAP-054 #2 — 원화 금액 한 건의 상한. **계약이자 물리적 사실**이다.
 *
 * `expenses.amount_krw` · `budgets.amount_krw`는 Postgres `int4`라 2,147,483,647을 넘는 값은
 * 저장이 아니라 5xx로 끝난다. 지금까지 이 사실은 어느 계약에도 적혀 있지 않아서, 실패의 모양이
 * 최악이었다: 모바일 오프라인 아웃박스는 로컬 저장을 먼저 성공시키고 flush에서야 5xx를 만나
 * **무한 재시도 poison**이 된다(4xx만 실패 행으로 파킹된다 — apps/mobile/src/offline/
 * remote-api.ts). 진단은 docs/5차/budget-app-gap-analysis.md P0-2.
 *
 * 라운드 54 P1-1: 숫자의 **단일 소스는 이제 도메인**(`@wooriai/domain`의 `MONEY_KRW_MAX`)이고
 * 이 줄은 그것을 그대로 재수출한다. 옮긴 이유는 도메인 술어(`isMoneyKrw`/`assertMoneyKrw`)만
 * 지나는 경로가 실제로 있었기 때문이다 — 엑셀 가져오기 검증이 int4 초과 행을 `valid`로
 * 판정해 확정 insert에서 파일 전체를 롤백시켰다(자세한 경위는 money-date.ts의 상수 주석).
 * contracts가 domain을 의존하므로(package.json) 방향은 기존 패키지 그래프 그대로다.
 *
 * 같은 숫자를 무는 자리는 **넷**이다:
 *  1. 도메인 술어 `isMoneyKrw`/`assertMoneyKrw` — 서버의 `requireMoneyKrw`(지출 생성·수정·
 *     예산 upsert)와 **엑셀 가져오기 행 검증**(apps/api/src/onboarding/import-pipeline.service.ts
 *     `validationStatusForImportRow`)이 여기를 지난다. 초과 행은 `invalid_amount`가 되어
 *     그 행만 거절되고 나머지 행은 그대로 들어온다.
 *  2. 이 스키마(`moneyKrwSchema`)와 그것을 쓰는 요청/응답 계약.
 *  3. 서버 DTO의 `@Max`(apps/api/src/finance/dto/expense.dto.ts ·
 *     onboarding/dto/upsert-budget.dto.ts — 이 상수를 그대로 import한다).
 *  4. 모바일 입력 가드(apps/mobile/src/expenses/amount-limit.ts의 `EXPENSE_AMOUNT_MAX_KRW`.
 *     모바일은 이 패키지를 의존하지 않아 값을 자기 모듈에 두되,
 *     apps/mobile/src/expenses/expense-detail-edit-rules.test.ts의 대조 테스트가 도메인 선언과
 *     두 숫자가 갈리지 않는지 확인한다).
 *
 * 마이그레이션은 필요 없다 — 컬럼 타입을 바꾸는 것이 아니라 **이미 참인 한계를 계약으로
 * 적는 것**이다.
 */
export { MONEY_KRW_MAX };

/**
 * 원화 금액 한 건(지출 1건 · 월 예산 1건). 1원 이상 int4 상한 이하의 정수다.
 *
 * ⚠️ 합계·집계에는 쓰지 않는다 — 여러 건을 더한 값은 이 상한을 넘을 수 있고, 실제로 아래
 * `homeMonthlyBudgetSchema`·리포트 합계는 각자 `z.number().int()`를 따로 쓴다.
 */
export const moneyKrwSchema = z.number().int().min(1).max(MONEY_KRW_MAX);

export const childStageModeSchema = z.enum(CHILD_STAGE_MODES);
export const childStageCodeSchema = z.enum(CHILD_STAGE_CODES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const expenseTypeSchema = z.enum(EXPENSE_TYPES);
export const expenseSourceSchema = z.enum(EXPENSE_SOURCES);
export const necessityLevelSchema = z.enum(NECESSITY_LEVELS);
export const itemStatusSchema = z.enum(ITEM_STATUSES);
export const productPlatformSchema = z.enum(PRODUCT_PLATFORMS);
export const importStatusSchema = z.enum(IMPORT_STATUSES);

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().optional()
  })
});

export const childSchema = z.object({
  id: uuidSchema,
  householdId: uuidSchema,
  nickname: z.string().min(1),
  stageMode: childStageModeSchema,
  dueDate: nullableDateOnlySchema,
  birthDate: nullableDateOnlySchema,
  manualStage: childStageCodeSchema.nullable().optional(),
  currentStage: childStageCodeSchema,
  stageLabel: z.string().min(1)
});

// CHILD-127: PATCH /children/:childId 요청 계약 — 서버 UpdateChildDto(apps/api/src/onboarding/
// dto/child.dto.ts)의 미러. 모든 필드가 optional인 부분 업데이트다.
//
// `stageMode`는 이번에 추가된 전환 필드로, 임신 중 가입한 사용자의 아이가 태어났을 때
// `pregnant → born` 한 방향으로만(그리고 birthDate와 함께) 보낼 수 있다. 방향 규칙 자체는
// 저장된 아이의 현재 stageMode를 알아야 판정할 수 있으므로 서버 도메인 규칙으로 남기고,
// 이 스키마는 형식만 고정한다. optional이므로 이 필드를 모르는 기존 클라이언트와 하위호환.
export const updateChildRequestSchema = z.object({
  nickname: z.string().min(1).optional(),
  stageMode: childStageModeSchema.optional(),
  dueDate: dateOnlySchema.optional(),
  birthDate: dateOnlySchema.optional(),
  manualStage: childStageCodeSchema.optional()
});

export const categorySchema = z.object({
  id: uuidSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  iconName: z.string().optional()
});

// CAT-101: GET /categories 목록 항목. 임베디드 참조용 categorySchema(최소 필드)에
// 정렬/시스템 구분 필드를 더한 형태로, iconName은 DB에서 nullable이라 null도 허용한다.
export const categoryListItemSchema = categorySchema.extend({
  iconName: z.string().nullable().optional(),
  displayOrder: z.number().int().min(0),
  isSystem: z.boolean(),
  active: z.boolean(),
  // CAT-124: 사용자에게 고르라고 내밀 카테고리인지. `active`(행이 살아 있는가)·
  // `isSystem`(시스템 시드인가)과는 다른 축이며, 모바일 퀵타일 별칭 8행과 가져오기
  // 스텁 1행이 false다. **optional인 이유**: 이 필드가 없던 시절의 응답(구 서버·구
  // 캐시)도 계약을 계속 통과해야 한다. 없으면 "노출 대상"으로 간주하는 것이 기존
  // 동작과 같으므로, 소비자는 `selectable === false`일 때만 감춘다.
  selectable: z.boolean().optional(),
  /**
   * 라운드 103: 이 분류를 만든 가구(categories.household_id). **커스텀 행에만 실린다** —
   * 운영 시드 21행에는 키 자체가 없다(설계 §2.2). additive optional이라 이 필드가 없던
   * 시절의 응답·구 캐시도 그대로 통과한다.
   *
   * ⚠️ **커스텀 행의 표식은 이 필드다 — `isSystem: false`로 갈라서는 안 된다.**
   * 종전 이 주석은 표식을 `isSystem: false`로 적고 DB CHECK가
   * `(household_id IS NULL) = is_system` 등호를 진다고 했는데, **둘 다 사실이 아니다**:
   * `prisma/seed.ts`가 모바일 퀵타일 별칭 8행과 가져오기 스텁 1행을 `isSystem: false`로
   * 시드하므로(dev DB 실측 `true`=12 / `false`=9) 양방향 등호는 성립할 수 없고, 실제
   * 제약도 단방향이다 — `migrations/000024_categories_household_owner/migration.sql`의
   * `CHECK (household_id IS NULL OR is_system = false)`. 즉 `is_system = false`는 커스텀의
   * **필요조건일 뿐 충분조건이 아니다.** 그 축으로 가르면 사용자가 만들지도 않은 시드
   * 별칭 아홉 행이 커스텀으로 잡힌다(라운드 103이 실제로 한 번 밟은 함정이다).
   *
   * 이 필드가 서는 원래 이유는 그대로다 — 관리 화면이 PATCH 대상 URL
   * (`/households/:householdId/categories/:categoryId`)을 만들고, 다가구 사용자에게
   * "이 분류는 다른 가구 것"을 가른다.
   */
  householdId: uuidSchema.optional()
});

// CAT-101: GET /categories 응답 계약 (활성 카테고리만, displayOrder 오름차순).
// CAT-124: 기본 응답은 selectable=true인 항목만, `?includeAll=1`이면 전량.
// 라운드 103: 같은 응답에 호출자 가구의 커스텀 행이 **합류**한다(설계 §2.2 — 두 번째 목록을
// 만들지 않는다. 소비처 열이 이미 `["categories"]` 하나를 본다).
export const listCategoriesResponseSchema = z.object({
  categories: z.array(categoryListItemSchema)
});

// ---------------------------------------------------------------------------
// 라운드 103: 커스텀 지출 카테고리. 별도 표가 아니라 categories의 가구 소유 행이다
// (expenses.category_id가 NOT NULL FK라 그 밖의 id는 지출에 저장될 수 없다 — 설계 §1.1).
// 표식은 householdId의 유무이며(isSystem: false는 시드 별칭 9행도 갖는다 — 위 필드 주석),
// 읽기 경로의 계약 추가는 그 householdId 하나뿐이다.
// 계약 확정 원문은 docs/5차/round103-custom-expense-category-design.md §9.
// ---------------------------------------------------------------------------
export const CUSTOM_CATEGORY_NAME_MAX_LENGTH = 50; // categories.name varchar(50)와 동치
/**
 * 가구당 커스텀 분류 행 상한(보관 포함). 15는 파생값이다 —
 * 정식 12 + 15 = 27 <= CATEGORY_BUDGET_MAX_PER_MONTH(30, 라운드 102 §1.4).
 * 이 부등식이 깨지면 카테고리 예산 화면이 상한에 먼저 부딪힌다(설계 §1.7 · R4).
 */
export const CUSTOM_CATEGORY_MAX_PER_HOUSEHOLD = 15;

export const createCustomCategoryRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_CATEGORY_NAME_MAX_LENGTH) // 서버가 trim·공백접기 후 재검증
});

// 두 필드 다 optional이고 **최소 하나**가 필요하다(둘 다 없으면 서버가 VALIDATION_ERROR).
// "최소 하나"는 형식이 아니라 도메인 규칙이라 서버 DTO가 지고(설계 §9.2), 이 스키마는
// 필드 형식만 고정한다 — `active: false`가 보관, `true`가 복원이다(설계 §1.6: 하드 삭제 없음).
export const updateCustomCategoryRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_CATEGORY_NAME_MAX_LENGTH).optional(),
  active: z.boolean().optional()
});

/**
 * GAP-056 #1 — 지출 텍스트 필드 길이 상한. **이 세 줄이 단일 소스다.**
 *
 * 지금까지 같은 숫자가 세 벌로 흩어져 있었다: 이 파일의 zod `.max(100)`/`.max(500)`, 서버
 * DTO의 `@MaxLength(100)`/`@MaxLength(500)`(apps/api/src/finance/dto/expense.dto.ts), 그리고
 * **클라이언트에는 아예 없었다.** 마지막 항목이 실제 피해였다: 입력 칸이 상한을 모르니 101자
 * 품목명이 그대로 오프라인 아웃박스에 들어가 로컬 저장만 성공하고, flush에서 400을 만나
 * 영구 실패 행이 됐다(4xx는 재시도하지 않는다 — apps/mobile/src/offline/remote-api.ts).
 * 금액 상한 `MONEY_KRW_MAX`가 막은 것과 같은 종류의 루프다.
 *
 * 값은 한 글자도 바뀌지 않았다(100·100·500) — 흩어져 있던 리터럴을 이름 하나로 모을 뿐이라
 * 기존 요청의 통과/거절이 달라지지 않는다.
 *
 * 같은 숫자를 무는 자리는 **셋**이다:
 *  1. 아래 요청 스키마(`createExpenseRequestSchema` · `updateExpenseRequestSchema`).
 *  2. 서버 DTO의 `@MaxLength`(apps/api/src/finance/dto/expense.dto.ts — 이 상수를 import한다).
 *  3. 모바일 입력 가드(apps/mobile/src/expenses/text-limits.ts. 모바일은 이 패키지를 의존하지
 *     않아 값을 자기 모듈에 두되, 그 옆 text-limits.test.ts의 대조 테스트가 여기 선언과 세
 *     숫자가 갈리지 않는지 확인한다 — amount-limit.ts와 같은 관례).
 *
 * ⚠️ 이 값은 컬럼 한계가 아니다. `expenses.item_name` · `expenses.merchant`는 varchar(120)이고
 * `memo`는 text다. 즉 상한을 넘긴 값이 **물리적으로는 저장 가능**하고, 실제로 엑셀 가져오기
 * 경로(import_rows의 varchar(120))로는 101~120자가 들어온다. 손입력만 100자로 막히는 이
 * 비대칭은 알려진 상태이며(docs/5차/round56-scout.md #1 곁가지), 그래서 클라이언트 가드는
 * "새로 치는 글자"뿐 아니라 **이미 들어 있는 값**도 판정해야 한다.
 */
export const EXPENSE_ITEM_NAME_MAX_LENGTH = 100;
export const EXPENSE_MERCHANT_MAX_LENGTH = 100;
export const EXPENSE_MEMO_MAX_LENGTH = 500;

export const createExpenseRequestSchema = z.object({
  categoryId: uuidSchema,
  amountKrw: moneyKrwSchema,
  spentOn: dateOnlySchema,
  itemName: z.string().min(1).max(EXPENSE_ITEM_NAME_MAX_LENGTH),
  merchant: z.string().max(EXPENSE_MERCHANT_MAX_LENGTH).optional(),
  paymentMethod: paymentMethodSchema.default("unknown"),
  memo: z.string().max(EXPENSE_MEMO_MAX_LENGTH).optional(),
  linkedItemTemplateId: uuidSchema.optional(),
  // 라운드 49 C-06: 어떤 제휴 링크를 눌러서 산 것인지(product_links.id) — 구매 확인 카드의
  // "샀어요"가 아는 사실을 서버로 넘기는 자리다. 컬럼·FK는 처음부터 있었지만 쓰기 경로가
  // 없어 늘 null이었다. additive optional이라 보내지 않던 클라이언트는 그대로다.
  // ⚠️ DNC-009: 기록·정산용이며 추천 점수·정렬에 유입 금지.
  linkedProductLinkId: uuidSchema.optional(),
  expenseType: z.enum(["expense", "gift"]).default("expense")
});

export const expenseSchema = z.object({
  id: uuidSchema,
  childId: uuidSchema,
  // CON-115: DB not-null(expenses.category_id)이고 API가 항상 반환하므로 required.
  categoryId: uuidSchema,
  amountKrw: moneyKrwSchema,
  spentOn: dateOnlySchema,
  itemName: z.string().min(1),
  merchant: z.string().nullable().optional(),
  // 라운드 48 T3: 저장만 되고 어디서도 다시 못 보던 두 필드의 응답 노출
  // (apps/api/src/onboarding/store-shared.ts toExpenseDto). **additive optional**이라
  // 두 필드가 없던 시절의 페이로드(409 충돌 스냅숏 toExpenseSnapshot, 오프라인 대기 행,
  // 구 서버 응답)도 그대로 통과한다 — `.default()`를 걸지 않는 이유는 파싱만으로 없는 값을
  // "unknown"으로 지어내지 않기 위해서다.
  paymentMethod: paymentMethodSchema.optional(),
  memo: z.string().nullable().optional(),
  linkedItemTemplateId: uuidSchema.nullable().optional(),
  // 라운드 49 C-06: 생성 때 저장한 제휴 링크 id의 되읽기(store-shared.ts toExpenseDto).
  // 라운드 48 T3과 같은 이유로 additive optional이다 — 이 필드가 없던 응답·오프라인 대기
  // 행·409 스냅숏도 그대로 통과해야 한다. ⚠️ DNC-009: 추천 점수·정렬에 유입 금지.
  linkedProductLinkId: uuidSchema.nullable().optional(),
  expenseType: expenseTypeSchema.default("expense"),
  source: expenseSourceSchema.default("manual"),
  createdByUserId: uuidSchema.optional(),
  // CON-115/MOB-103: 낙관적 동시성 버전 — 생성 시 1, 수정/소프트삭제마다 +1.
  // 모든 지출 응답(생성/조회/목록/home.recentExpenses)에 항상 포함된다.
  version: z.number().int().min(1)
});

// CON-115: PATCH /expenses/:id 요청 계약 — 서버 UpdateExpenseDto의 미러
// (apps/api/src/finance/dto/expense.dto.ts). expenseType은 생성과 동일하게
// expense|gift만 허용된다(refund는 서버가 400으로 거부). expectedVersion이
// 있고 서버 version과 다르면 409 VERSION_CONFLICT(versionConflictResponseSchema).
export const updateExpenseRequestSchema = z.object({
  categoryId: uuidSchema.optional(),
  amountKrw: moneyKrwSchema.optional(),
  spentOn: dateOnlySchema.optional(),
  itemName: z.string().min(1).max(EXPENSE_ITEM_NAME_MAX_LENGTH).optional(),
  memo: z.string().max(EXPENSE_MEMO_MAX_LENGTH).optional(),
  // 라운드 49 C-03: 판매처에도 결제 수단과 **같은 구멍**이 있었다 — 충돌 병합 화면이
  // 판매처를 비교 항목으로 내놓는데(모바일 `diffExpenseFields`) 수정 계약에 자리가 없어
  // 고른 값을 보낼 수 없었다. 같은 라운드에 지출 상세 판매처 편집도 이 자리를 쓴다.
  // 빈 문자열은 "지웠다"는 뜻으로 서버가 null로 정리한다(memo와 동일).
  merchant: z.string().max(EXPENSE_MERCHANT_MAX_LENGTH).optional(),
  // 라운드 48 QA(P2-6): 생성에는 처음부터 있었지만 수정에는 없던 필드. 오프라인 충돌 병합
  // ("두 값 나란히 보기")이 결제 수단도 고르게 하면서 그 선택을 보낼 자리가 없었다 — 서버
  // ValidationPipe가 forbidNonWhitelisted라 실으면 400이라, 화면이 고르라고 해 놓고 조용히
  // 무시했다. additive optional이라 보내지 않던 클라이언트는 그대로다.
  paymentMethod: paymentMethodSchema.optional(),
  expenseType: z.enum(["expense", "gift"]).optional(),
  expectedVersion: z.number().int().min(1).optional()
});

// CON-115: DELETE /expenses/:id — expectedVersion은 쿼리 파라미터로 전달된다
// (apps/api/src/finance/dto/query.dto.ts). 생략 시 레거시(무조건 삭제) 동작.
export const deleteExpenseRequestSchema = z.object({
  expectedVersion: z.number().int().min(1).optional()
});

// CON-115/MOB-103 §2.2: 409 VERSION_CONFLICT의 `current` — 서버의 최신 상태.
// 살아있는 지출 전체 스냅샷 | 소프트삭제 톰스톤 | (row가 아예 없으면) null.
export const expenseConflictSnapshotSchema = z
  .union([
    expenseSchema,
    z.object({ id: uuidSchema, deleted: z.literal(true), version: z.number().int().min(1) })
  ])
  .nullable();

// CON-115: PATCH/DELETE /expenses/:id의 409 충돌 응답 바디 — GlobalExceptionFilter가
// {error:{...}} 봉투 밖 최상위에 `current`를 나란히 싣는다(§2.2 계약).
export const versionConflictResponseSchema = z.object({
  error: errorResponseSchema.shape.error.extend({ code: z.literal("VERSION_CONFLICT") }),
  current: expenseConflictSnapshotSchema
});

// API-124: GET /children/:childId/expenses 의 페이지 크기 계약.
// 서버 DTO(apps/api/src/finance/dto/query.dto.ts)가 이 값을 그대로 가져다 쓴다.
export const EXPENSE_LIST_DEFAULT_LIMIT = 200;
export const EXPENSE_LIST_MAX_LIMIT = 500;

// API-124: GET /children/:childId/expenses 쿼리 계약 — 서버 ListExpensesQueryDto의 미러.
// 셋 다 선택적이라, limit/cursor를 모르는 기존 클라이언트는 종전과 같은 요청을 보내고
// 서버가 기본 limit(200)의 첫 페이지를 돌려준다(하위호환).
//
// R24-L5: `yearMonth`의 월은 01~12로 묶는다. 종전 `\d{2}`는 서버보다 느슨해
// `2026-13`/`2026-00`을 계약상 유효로 판정했지만, 서버는 같은 값을 400
// VALIDATION_ERROR로 거절한다(`apps/api/src/common/validation/year-month.ts`
// `YEAR_MONTH_INPUT_PATTERN` — 무제한 `\d{2}`가 getSeoulMonthRange에서 Invalid
// Date로 터져 500이 되는 것을 막으려고 좁힌 패턴이다). 계약이 서버보다 넓으면
// 계약을 통과한 요청이 서버에서 거절당해, 이 스키마를 믿는 클라이언트가 잡을 수
// 있었던 오류를 왕복 뒤에야 알게 된다. 두 정규식은 **문자 그대로 같아야 한다**.
export const listExpensesQuerySchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/).optional(),
  limit: z.number().int().min(1).max(EXPENSE_LIST_MAX_LIMIT).optional(),
  cursor: z.string().min(1).optional()
});

// API-124: GET /children/:childId/expenses 응답 계약.
//
// `expenses`는 이제 한 페이지(최대 limit건)이고, `hasMore`/`nextCursor`가 그 다음
// 페이지를 가리킨다. 두 필드는 **추가 필드**라 optional로 둔다 — 기존 클라이언트는
// 무시해도 되고, 서버는 항상 채워 보낸다.
//
// ⚠️ `totalAmountKrw`는 페이지 합이 아니라 **조회 범위 전체의 합**이다(DNC-015:
// expenseType === "expense"만, 선물 제외 — 서버 ExpensesStoreService.sumExpenses).
// 페이지네이션 도입 후에도 이 의미는 바뀌지 않으므로 클라이언트는 페이지를 모아
// 더할 필요가 없다.
export const listExpensesResponseSchema = z.object({
  expenses: z.array(expenseSchema),
  totalAmountKrw: z.number().int().min(0),
  hasMore: z.boolean().optional(),
  nextCursor: z.string().nullable().optional()
});

// ---------------------------------------------------------------------------
// 라운드 102: 카테고리별 예산. budgets(총액 한 칸, DNC-007)와 별개 테이블 category_budgets이며
// 기존 PUT/GET /budget과 GET /reports/monthly에 additive로만 실린다. 홈·푸시·경고 판정 무접촉.
// 계약 확정 원문은 docs/5차/round102-category-budget-design.md §9.
// ---------------------------------------------------------------------------
export const CATEGORY_BUDGET_MAX_PER_MONTH = 30; // 아이·월당 행 상한 (§1.4)

export const categoryBudgetEntrySchema = z.object({
  categoryId: uuidSchema,
  amountKrw: moneyKrwSchema // 1..MONEY_KRW_MAX — 0원 예산 없음(부재가 곧 미설정)
});

export const budgetSchema = z.object({
  childId: uuidSchema,
  yearMonth: dateOnlySchema,
  amountKrw: moneyKrwSchema,
  usedAmountKrw: z.number().int(),
  remainingAmountKrw: z.number().int(),
  // 라운드 102: additive optional — 이 필드가 없던 시절의 응답(구 서버·구 캐시)도 그대로
  // 통과한다. 서버 200은 항상 배열(없으면 [])을 categoryId 오름차순으로 싣는다(§2.3).
  categoryBudgets: z.array(categoryBudgetEntrySchema).optional()
});

// Home summary reports a budget of 0 (rather than omitting it) when no monthly
// budget has been set yet, so its amountKrw allows 0 unlike the strict
// moneyKrwSchema-backed budgetSchema used by the dedicated budget endpoints.
// 라운드 102: extend라 categoryBudgets(optional)를 타입으로는 승계하지만, 서버는 홈 응답에
// 이 필드를 싣지 않는다(§2.4 — 소비처 없는 페이로드를 늘리지 않는다).
export const homeMonthlyBudgetSchema = budgetSchema.extend({
  amountKrw: z.number().int().min(0)
});

export const itemSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  necessityLevel: necessityLevelSchema,
  status: itemStatusSchema,
  // 라운드 49 C-02: 준비템이 속한 지출 분류(categories.id). 시드 준비템 **전부**가 값을
  // 갖고 있었지만(목록은 apps/api/prisma/seed-data.ts의 `itemTemplateSeeds`, 적재는
  // prisma/seed.ts의 `seedItemTemplates`) 앱 DTO가 버려서, "준비템 → 지출 기록"
  // 프리필이 품목명만 넘기고 분류는 늘 기본 타일로 떨어졌다.
  // ⚠️ 두 시점(라운드 106 T10): 종전 이 줄은 그 수를 **63개**로 적었는데 오늘 실측은
  // **62개**다(`itemTemplateSeeds` 원소 62 · 그중 `categoryCode`를 가진 것 62 — 같은 파일을
  // 세는 apps/api/test/seed-data.test.ts 머리말도 "62개 품목"으로 적는다). 이 문장이 서는
  // 근거는 "전부가 값을 갖는다"이지 특정 개수가 아니므로 **수를 빼고 사실만 남긴다** —
  // 시드가 한 줄 늘 때마다 갈리는 숫자를 계약 주석에 박아 두지 않는다.
  // (같은 63이 apps 아래 주석 넷에 더 남아 있다: items-catalog.service.ts ·
  // test/items-commerce.e2e.test.ts · mobile items/expense-link-prompt.ts와 그 테스트.
  // 그 넷은 이 트랙 소유가 아니라 손대지 않았다.)
  // **additive optional**이다 —
  // 컬럼 자체가 nullable(item_templates.category_id)이고 구버전 서버 응답도 그대로 통과해야
  // 한다. 금액은 여기 실리지 않는다: priceBandText는 범위라 특정 값을 프리필하면 허위 표시다.
  categoryId: uuidSchema.optional(),
  timingLabel: z.string().optional(),
  priceBandText: z.string().optional(),
  stageCodes: z.array(childStageCodeSchema).optional(),
  // 라운드 100: 커스텀 품목(사용자 직접 추가 준비물, custom_items 행)이 이 모양으로 목록에
  // 합류할 때의 표식. **additive optional** — 없으면 카탈로그 품목이고, 이 필드가 없던 시절의
  // 응답(구 서버·구 캐시)도 그대로 통과한다. itemDetailSchema는 extend라 자동 승계된다.
  isCustom: z.boolean().optional()
});

// ITEM-121: 준비템 화면의 "시기 칩" 라벨 — GET /children/:childId/items의 선택적
// `stageBand` 쿼리 파라미터 값이자 클라이언트 칩 라벨의 단일 소스다. 밴드 -> 스테이지
// 코드 매핑은 서버(apps/api/src/items-commerce/stage-bands.ts)와 모바일
// (apps/mobile/src/items/stage-bands.ts)이 각각 들고 있고, 두 정의가 어긋나지 않도록
// apps/api/test/mobile-stage-band-contract.test.ts가 대조한다.
export const stageBandLabelSchema = z.enum(["0-6개월", "6-12개월", "12-24개월", "24개월+"]);
export const STAGE_BAND_LABELS = stageBandLabelSchema.options;

// ITEM-121: GET /children/:childId/items 쿼리 계약 — 서버 ListItemsQueryDto의 미러
// (apps/api/src/items-commerce/dto/items.dto.ts). 두 파라미터 모두 선택적이며,
// stageBand를 생략하면 기존 동작(아이의 현재 단계 기준)이 그대로 유지된다(하위호환).
//
// ITEM-123 (B4/B5): 두 가지가 확장됐다(둘 다 값 추가/응답 확대라 기존 클라이언트는 무영향).
// - `prepared` 탭은 이제 prepared뿐 아니라 gifted 상태 항목도 함께 돌려준다. gifted는
//   "선물로 받아 이미 손에 있다"라 준비 완료와 같은 계열이고, "필요 없다고 판단했다"인
//   not_needed와는 다르다(서버 `TAB_STATUSES` 주석 참고 — 그 상수는
//   **apps/api/src/onboarding/item-ranking.ts**에 있다. ⚠️ 두 시점(라운드 106 T10): 종전 이
//   줄은 자리를 items-catalog.service.ts로 적었는데 그 파일에 그 이름은 없다 — 탭 술어
//   `matchesTab`과 함께 item-ranking.ts가 들고 있고, 카탈로그 서비스는 그것을 부를 뿐이다).
// - `all`은 상태로 거르지 않는 전체 스냅샷 탭이다. 네 탭의 합집합과 같은 집합을 1요청으로
//   준다 — 준비율(ITEM-114)처럼 전 상태가 필요한 화면의 4연속 요청을 없앤다.
export const listItemsQuerySchema = z.object({
  tab: z.enum(["now", "soon", "prepared", "not_needed", "all"]).optional(),
  stageBand: stageBandLabelSchema.optional()
});

/**
 * 라운드 64 D(#4) — 스냅샷 가격을 **그릴 수 있는 나이의 상한**(일). 확인한 지 이 일수를
 * 넘긴 가격은 앱이 아예 그리지 않는다(apps/mobile/src/items/link-price.ts 규칙 5).
 *
 * 왜 계약에 있는가: 이 선은 **앱에만 있는 판정이었고, 그래서 아무에게도 보고되지 않았다** —
 * 어느 날부터 판매처 가격이 통째로 사라져도 어드민 화면에는 아무 신호가 없었다(헬스는 배지가
 * 서는데 가격만 없는 비대칭). 어드민이 "이 가격은 앱에서 이미 안 보인다"고 말하려면 같은
 * 숫자를 알아야 하는데, 그 숫자를 어드민 소스에 다시 박으면 다음에 갈린다(라운드 63 #9의
 * 교훈). 그래서 문턱을 계약으로 올리고, 서버가 어드민 DTO에서 `priceExpired`를 **계산해서**
 * 내려보낸다 — 숫자 자체는 어드민 번들에 실리지 않는다.
 *
 * 손으로 유지되는 사본이 하나 더 있다: `apps/mobile/src/items/link-price.ts`의
 * `LINK_PRICE_MAX_AGE_DAYS`(모바일은 @wooriai/contracts를 의존하지 않는다 —
 * known-limitations §D. 재수출 배선은 후속이다).
 *
 * 라운드 64 M-2: 두 값이 어긋나는 순간을 잡는 가드는 **모바일 쪽 수기 미러 계약 테스트**에
 * 있다 — `apps/mobile/src/api/contracts-mirror.test.ts`의
 * "LINK_PRICE_MAX_AGE_DAYS가 packages/contracts의 값과 같다". (종전 주석은 존재하지도 않는
 * `apps/api/test/mobile-link-price-contract.test.ts`를 근거로 들어, 이중 소스가 아무 가드
 * 없이 놓인 상태를 보호받는 것처럼 적어 두고 있었다.)
 */
export const LINK_PRICE_MAX_AGE_DAYS = 180;

/**
 * 라운드 51 #9 — 판매처별 가격(가산 optional). 이번 라운드는 계약만이고 표시 UI는 없다.
 *
 * `priceSnapshotKrw`는 "언젠가 확인한 값"이라 언제 확인했는지를 함께 말하지 않으면
 * 사용자가 현재가로 읽는다 — 그것이 곧 허위 표시다(DNC-009와 같은 정직 원칙). 그래서
 * **두 필드는 항상 함께 있거나 함께 없다**. 서버가 그 규칙을 강제하고
 * (apps/api/src/onboarding/items-catalog.service.ts toProductLinkDto), 계약도 아래
 * refine으로 같은 규칙을 거절선으로 삼는다 — 한쪽만 실은 응답은 계약 위반이다.
 *
 * 화면은 다음 라운드에 배선하되, 가격을 그릴 때는 반드시 `priceCheckedAt` 기준 시각을
 * 함께 보여야 한다(값만 크게 쓰고 시각을 숨기면 이 규칙을 우회하는 것과 같다).
 *
 * 가격은 표시 전용이다 — 추천 점수·정렬에는 절대 넣지 않는다(DNC-009).
 */
export const productLinkSchema = z
  .object({
    id: uuidSchema,
    platform: productPlatformSchema,
    title: z.string().min(1),
    isAffiliate: z.boolean(),
    isSponsored: z.boolean(),
    disclosureText: z.string().optional(),
    priceSnapshotKrw: z.number().int().min(0).optional(),
    /** ISO 8601 UTC 문자열. 이 값이 없으면 가격도 없어야 한다(위 주석). */
    priceCheckedAt: z.string().datetime().optional()
  })
  .refine(
    (link) => (link.priceSnapshotKrw === undefined) === (link.priceCheckedAt === undefined),
    { message: "가격과 가격 확인 시각은 함께 있어야 해요.", path: ["priceCheckedAt"] }
  );

export const itemDetailSchema = itemSummarySchema.extend({
  reasonText: z.string().min(1),
  skipReasonText: z.string().nullable().optional(),
  usedSecondhandOk: z.boolean(),
  safetyNote: z.string().nullable().optional(),
  // 라운드 48 T1: 의료/영양제 성격이라 전문가 확인이 필요한 준비템 표시(DNC-020). 스키마와
  // 시드에는 처음부터 있었지만 어떤 응답에도 실리지 않던 필드다 — 서버는 항상 boolean을
  // 보내고, 구버전 클라이언트가 깨지지 않도록 계약에서는 optional로 더한다(가산 변경).
  medicalDisclaimerRequired: z.boolean().optional(),
  // 라운드 49 C-04: 이 준비템에 실제로 연결된 지출(child_item_statuses.expense_id).
  // 연결은 예전부터 기록됐지만(store-shared.ts markLinkedItemPrepared) 어느 응답에도
  // 실리지 않아 "지출 → 준비템" 한 방향만 보였다. 상세 단건에서만 조회한다(목록 부하 0).
  //
  // 서버는 **삭제되지 않은 지출**(expenses.deleted_at IS NULL)만 싣는다 — 삭제한 지출의
  // 금액을 계속 보여주면 허위 표시다. 연결이 없거나 그 지출이 삭제됐으면 null이다.
  // additive optional: 이 필드가 없던 구버전 응답도 그대로 통과한다.
  linkedExpense: z
    .object({
      id: uuidSchema,
      amountKrw: z.number().int(),
      spentOn: dateOnlySchema
    })
    .nullable()
    .optional(),
  productLinks: z.array(productLinkSchema)
});

// ---------------------------------------------------------------------------
// 라운드 100: 커스텀 품목(사용자 직접 추가 준비물). item_templates(운영 시드)와 별개 테이블이며
// 목록에는 ItemSummary 모양으로 합류한다(isCustom 마커). DNC-009: 추천 점수·정렬 무접촉.
// 계약 확정 원문은 docs/5차/round100-custom-items-design.md §9.1 — 이 절이 그 수기 단일 소스다.
// ---------------------------------------------------------------------------
export const CUSTOM_ITEM_NAME_MAX_LENGTH = 80; // custom_items.name varchar(80)와 동치
export const CUSTOM_ITEM_MAX_PER_CHILD = 200; // 아이당 활성(미삭제) 상한
/** 커스텀 상세의 reasonText 고정 문구 — 출처 라벨이지 지어낸 설명이 아니다. */
export const CUSTOM_ITEM_REASON_TEXT = "직접 추가한 준비물이에요.";

export const createCustomItemRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_ITEM_NAME_MAX_LENGTH), // 서버가 트림 후 재검증
  stageBand: stageBandLabelSchema, // 4밴드 라벨 원문
  necessityLevel: necessityLevelSchema // 클라이언트가 항상 명시(기본 essential은 UI 몫)
});

// 설계 문서 §9.1은 `createCustomItemRequestSchema.partial()`로 적었다 — 아래 선언은 그것과
// **의미가 같다**(세 필드 전부 optional, 값 제약 동일. schemas.test.ts가 partial() 동치를 값으로
// 문다). 파생 호출 대신 z.object로 푼 이유: 모바일 수기 미러 스윕
// (apps/mobile/src/api/contracts-mirror.test.ts)의 모집단 파서가 `.object({`/`.extend({` 머리만
// 객체 스키마로 읽어서, `.partial()` 한 줄짜리 파생은 분류 불능으로 빨개진다 — 스키마 의미를
// 바꾸지 않고 파서가 읽는 형태로 적는다.
// status는 여기 없다 — 상태는 기존 PATCH /children/:childId/items/:id/status 하나가 쓴다.
export const updateCustomItemRequestSchema = z.object({
  name: z.string().min(1).max(CUSTOM_ITEM_NAME_MAX_LENGTH).optional(),
  stageBand: stageBandLabelSchema.optional(),
  necessityLevel: necessityLevelSchema.optional()
});

export const customItemSummarySchema = itemSummarySchema.extend({ isCustom: z.literal(true) });

export const deleteCustomItemResponseSchema = z.object({ id: uuidSchema, deleted: z.literal(true) });

export const homeSummarySchema = z.object({
  child: childSchema,
  totalExpenseKrw: z.number().int().min(0),
  monthly: homeMonthlyBudgetSchema,
  recommendedItems: z.array(itemSummarySchema),
  recentExpenses: z.array(expenseSchema)
});

/**
 * GAP-067 #4: `shareUrl`은 **앱 밖으로 내보내는** 주소이고 `redirectUrl`은 **여는** 주소다.
 * 둘을 한 칸으로 합치지 않는 이유: `/r/:code`로 열면 이 클릭 행과 리다이렉트가 만드는 익명
 * 클릭이 겹쳐 한 번의 클릭이 두 번 세어진다. optional인 이유: 리다이렉트 코드가 없는 행
 * (이론상 — 컬럼은 NOT NULL UNIQUE다)과 이 필드를 모르는 옛 서버에서 앱이 종전 URL로
 * 떨어질 수 있어야 한다.
 */
export const affiliateClickResponseSchema = z.object({
  clickId: uuidSchema,
  redirectUrl: z.string().url(),
  shareUrl: z.string().url().optional(),
  disclosureText: z.string().optional()
});

// CON-121: 카테고리별 합계 한 줄 — 월간 리포트의 categoryTop과
// GET /children/:childId/reports/category의 categories가 같은 서버 집계
// (ReportingStoreService.categoryBreakdown)에서 나오므로 하나의 계약을 공유한다.
// amountKrw/count는 groupBy 합계라 0 이상(빈 그룹은 애초에 나오지 않지만
// moneyKrwSchema의 "1원 이상" 계약과는 다른 축이라 min(0)으로 둔다).
export const categoryBreakdownEntrySchema = z.object({
  categoryId: uuidSchema,
  amountKrw: z.number().int().min(0),
  count: z.number().int().min(0)
});

// CON-121: GET /children/:childId/reports/category 응답 계약.
export const reportCategorySchema = z.object({
  childId: uuidSchema,
  categories: z.array(categoryBreakdownEntrySchema)
});

export const reportMonthlySchema = z.object({
  childId: uuidSchema,
  yearMonth: dateOnlySchema,
  totalExpenseKrw: z.number().int().min(0),
  budgetAmountKrw: z.number().int().min(1).nullable().optional(),
  // CON-121(CON-115 권고 잔여분): z.record(z.unknown())였던 자리를 실응답 형태로
  // 조인다 — 월간 리포트의 categoryTop은 카테고리 합계 내림차순 목록이다.
  categoryTop: z.array(categoryBreakdownEntrySchema),
  // 라운드 102: 그 달의 카테고리 예산 행(없으면 []). additive optional — 이 필드가 없던
  // 시절의 응답도 통과한다. 리포트 "예산 대비" 블록의 예산 소스다(§2.4).
  categoryBudgets: z.array(categoryBudgetEntrySchema).optional()
});

// REP-128: GET /children/:childId/reports/trend 의 구간 크기 계약.
// 서버 DTO(apps/api/src/finance/dto/query.dto.ts TrendReportQueryDto)가 이 값을 그대로
// 가져다 쓴다 — EXPENSE_LIST_* 와 같은 관례.
export const TREND_REPORT_DEFAULT_MONTHS = 6;
export const TREND_REPORT_MAX_MONTHS = 12;

/**
 * REP-128: GET /children/:childId/reports/trend 응답 계약.
 *
 * 모바일 리포트 월간 탭의 추이 차트가 `GET /reports/monthly`를 6번 부르던 워터폴을 한 번의
 * 범위 질의로 접은 엔드포인트다. 차트가 실제로 소비하는 값은 달마다 `totalExpenseKrw`
 * 하나뿐이라 예산·카테고리 분해는 담지 않는다 — 그게 필요한 화면은 종전대로
 * `GET /reports/monthly`(불변, 하위호환)를 부른다.
 *
 * `months`는 **오름차순 연속** 배열이고 마지막 원소가 요청한 `endYearMonth`다. 기록이
 * 없는 달도 0으로 채워 빠지지 않으므로 길이는 요청한 months와 항상 같다. 각 달의
 * `yearMonth`는 다른 리포트 응답과 같은 내부 `YYYY-MM-01` 형태이고, 같은 달의 월간 리포트
 * `totalExpenseKrw`와 정확히 일치한다(선물 제외 DNC-015 — 서버 sumExpenses와 같은 술어).
 */
export const reportTrendSchema = z.object({
  childId: uuidSchema,
  months: z
    .array(
      z.object({
        yearMonth: dateOnlySchema,
        totalExpenseKrw: z.number().int().min(0)
      })
    )
    .min(1)
    .max(TREND_REPORT_MAX_MONTHS)
});

export const reportYearlySchema = z.object({
  childId: uuidSchema,
  year: z.string().regex(/^\d{4}$/),
  totalExpenseKrw: z.number().int().min(0),
  monthlyTotals: z.array(
    z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      totalExpenseKrw: z.number().int().min(0)
    })
  ).length(12)
});

export const importJobSchema = z.object({
  id: uuidSchema,
  // 라운드 41 K-2: 잡이 묶인 아이. 검수 화면의 "대상 아이" 표시가 클라이언트의 선택 아이 값을
  // 추측하지 않고 서버가 실제로 쓰는 값(confirmImport → insertExpense(job.childId))을 그대로
  // 읽도록, 응답 계약에 고정한다.
  childId: uuidSchema,
  status: importStatusSchema,
  rowCount: z.number().int().optional(),
  candidateCount: z.number().int().optional(),
  importedCount: z.number().int().optional()
});

export const importRowSchema = z.object({
  id: uuidSchema,
  rowIndex: z.number().int().min(0),
  parsedDate: dateOnlySchema.optional(),
  /**
   * 라운드 106 T10 — 상한은 **컬럼 폭(120)**이지 지출 계약의 100이 아니다.
   *
   * 종전 이 줄은 `.max(100)`이었다. 그 숫자는 `EXPENSE_ITEM_NAME_MAX_LENGTH`(지출이 될 수
   * 있는 품목명의 상한)에서 온 것인데, **이 스키마는 지출이 아니라 미리보기 행의 응답**이고
   * 서버는 101~120자 행을 값 그대로 실어 보낸다: `import_rows.parsed_item_name`이
   * `varchar(120)`이라 담을 수 있고, GAP-058 #8이 "컬럼이 담을 수 있는 값을 굳이 비우면
   * 사용자가 어느 행인지조차 알 수 없다"는 이유로 **값을 보존하기로** 정했기 때문이다
   * (apps/api/src/onboarding/import-pipeline.service.ts `buildImportRowsFromParsed` — 그 행은
   * 값을 유지한 채 `item_name_too_long` 상태로 떨어지고 선택에서 빠진다. 121자 이상만 값이
   * null이 된다). 즉 종전 계약은 **서버가 실제로 내보내는 정상 응답을 거절**했고, 그 응답을
   * 이 스키마로 파싱하는 자리(apps/api/test/import-excel.e2e.test.ts)는 그 구간의 행을
   * 아직 만들어 본 적이 없어 아무도 밟지 않았다. 계약을 사실에 맞춰 넓힌다(서버 무변경).
   *
   * ⚠️ 검수 PATCH의 입력 상한은 여전히 100이다(서버 `UpdateImportRowDto`의 `@MaxLength(100)`)
   * — 사용자가 **고쳐 넣는** 값은 지출이 될 수 있어야 하고, 여기 넓힌 것은 **되읽는** 값의
   * 상한뿐이다. 두 숫자가 다른 것이 이 파이프라인의 사실이다.
   */
  parsedItemName: z.string().max(120).optional(),
  parsedAmountKrw: moneyKrwSchema.optional(),
  categoryId: uuidSchema.optional(),
  confidence: z.number().min(0).max(1),
  selected: z.boolean(),
  validationStatus: z.string().min(1)
});

// ---------------------------------------------------------------------------
// 라운드 106 T10 관찰(DNC-018 관찰형) — **아래 `z.infer` 별칭 대부분은 오늘 아무도 부르지 않는다.**
//
// 실측(2026-09-07 · 방식: apps · packages · scripts 아래 전 .ts/.tsx에서 **주석을 지운 뒤**
// 선언 줄을 뺀 토큰 검색): 두 패키지의 export 선언 **171** 중 **27**이 제품 소스·테스트·자기
// 파일 어디에도 나오지 않는다. 27은 전부 타입 별칭이다 — 26은 이 블록, 하나는 analytics.ts의
// `AnalyticsEventEnvelope` — 값(런타임) export는 이 집합에 하나도 없다.
// ⚠️ 이 수는 **하한**이다: 같은 이름이 다른 뜻으로 서 있으면(예: 서버가 자기 `ChildDto`를
// 따로 선언한다) 토큰 검색이 "쓰인다"로 읽는다. 그리고 이 문단이 위 이름을 적고 있으므로
// **주석까지 세는 검색으로는 27이 아니라 26으로 보인다** — 방식이 곧 수의 일부다.
// 값(런타임) export 중 제품 소스 호출부가 0건인 것은 하나 있다(도메인의 `validateItemTrustRules`
// — 테스트만 부른다. 그 함수 위의 관찰 주석이 오늘의 배선 상태를 적어 둔다).
//
// ⚠️ 왜 이 수가 지금까지 세어지지 않았나: 사문 대장(`packages/test-utils/src/dead-export-ledger.ts`)의
// **모집단이 모바일 `src` 아래와 어드민 `src/lib` 아래뿐이라 packages는 애초에 밖**이다
// (그 파일의 "결정 ②"). 즉 이 자리는 대장이 초록이어도 세어진 적이 없는 사각이다.
//
// ⚠️ 지우지 않는다. ⓐ 이 패키지의 존재 이유가 "계약을 **말하는** 수기 단일 소스"이고, 타입
// 별칭은 스키마가 뜻하는 모양을 이름으로 고정하는 그 계약의 일부다(소비자가 `z.infer`를 각자
// 다시 쓰면 이름이 갈린다). ⓑ 소비 3앱 중 모바일은 이 패키지를 의존하지 않고 수기 미러를
// 쓰므로(known-limitations §D) "부르는 곳 0건"이 곧 "쓸모 0"이 아니다. ⓒ 값 export가 아니라
// 타입이라 번들에 실리지 않는다(런타임 비용 0).
// 지우는 판단이 필요해지는 날의 조건: 사문 대장의 모집단이 packages까지 넓어지고, 그 대장이
// **타입 축**을 어떻게 다룰지 정할 때 — 그때 이 문단이 그날의 실측 기준선이다.
// ---------------------------------------------------------------------------
export type CategoryBreakdownEntryDto = z.infer<typeof categoryBreakdownEntrySchema>;
export type CategoryBudgetEntryDto = z.infer<typeof categoryBudgetEntrySchema>;
export type CreateCustomItemRequestDto = z.infer<typeof createCustomItemRequestSchema>;
export type UpdateCustomItemRequestDto = z.infer<typeof updateCustomItemRequestSchema>;
export type CreateCustomCategoryRequestDto = z.infer<typeof createCustomCategoryRequestSchema>;
export type UpdateCustomCategoryRequestDto = z.infer<typeof updateCustomCategoryRequestSchema>;
export type CustomItemSummaryDto = z.infer<typeof customItemSummarySchema>;
export type DeleteCustomItemResponseDto = z.infer<typeof deleteCustomItemResponseSchema>;
export type CategoryListItemDto = z.infer<typeof categoryListItemSchema>;
export type CategoryReportDto = z.infer<typeof reportCategorySchema>;
export type ChildDto = z.infer<typeof childSchema>;
export type UpdateChildRequestDto = z.infer<typeof updateChildRequestSchema>;
export type CreateExpenseRequestDto = z.infer<typeof createExpenseRequestSchema>;
export type ListCategoriesResponseDto = z.infer<typeof listCategoriesResponseSchema>;
export type ListExpensesQueryDto = z.infer<typeof listExpensesQuerySchema>;
export type ListExpensesResponseDto = z.infer<typeof listExpensesResponseSchema>;
export type DeleteExpenseRequestDto = z.infer<typeof deleteExpenseRequestSchema>;
export type ExpenseConflictSnapshotDto = z.infer<typeof expenseConflictSnapshotSchema>;
export type ExpenseDto = z.infer<typeof expenseSchema>;
export type UpdateExpenseRequestDto = z.infer<typeof updateExpenseRequestSchema>;
export type VersionConflictResponseDto = z.infer<typeof versionConflictResponseSchema>;
export type HomeSummaryDto = z.infer<typeof homeSummarySchema>;
export type ImportRowDto = z.infer<typeof importRowSchema>;
export type ImportJobDto = z.infer<typeof importJobSchema>;
export type ItemDetailDto = z.infer<typeof itemDetailSchema>;
export type ItemSummaryDto = z.infer<typeof itemSummarySchema>;
export type ListItemsQueryDto = z.infer<typeof listItemsQuerySchema>;
export type StageBandLabel = z.infer<typeof stageBandLabelSchema>;
export type ProductLinkDto = z.infer<typeof productLinkSchema>;
export type TrendReportDto = z.infer<typeof reportTrendSchema>;
export type YearlyReportDto = z.infer<typeof reportYearlySchema>;
