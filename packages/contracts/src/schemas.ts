import { z } from "zod";
import {
  CHILD_STAGE_CODES,
  CHILD_STAGE_MODES,
  EXPENSE_SOURCES,
  EXPENSE_TYPES,
  IMPORT_STATUSES,
  ITEM_STATUSES,
  NECESSITY_LEVELS,
  PAYMENT_METHODS,
  PRODUCT_PLATFORMS
} from "@wooriai/domain";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDateOnlySchema = dateOnlySchema.nullable().optional();

export const uuidSchema = z.string().uuid();
export const moneyKrwSchema = z.number().int().min(1);

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
  selectable: z.boolean().optional()
});

// CAT-101: GET /categories 응답 계약 (활성 카테고리만, displayOrder 오름차순).
// CAT-124: 기본 응답은 selectable=true인 항목만, `?includeAll=1`이면 전량.
export const listCategoriesResponseSchema = z.object({
  categories: z.array(categoryListItemSchema)
});

export const createExpenseRequestSchema = z.object({
  categoryId: uuidSchema,
  amountKrw: moneyKrwSchema,
  spentOn: dateOnlySchema,
  itemName: z.string().min(1).max(100),
  merchant: z.string().max(100).optional(),
  paymentMethod: paymentMethodSchema.default("unknown"),
  memo: z.string().max(500).optional(),
  linkedItemTemplateId: uuidSchema.optional(),
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
  itemName: z.string().min(1).max(100).optional(),
  memo: z.string().max(500).optional(),
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

export const budgetSchema = z.object({
  childId: uuidSchema,
  yearMonth: dateOnlySchema,
  amountKrw: moneyKrwSchema,
  usedAmountKrw: z.number().int(),
  remainingAmountKrw: z.number().int()
});

// Home summary reports a budget of 0 (rather than omitting it) when no monthly
// budget has been set yet, so its amountKrw allows 0 unlike the strict
// moneyKrwSchema-backed budgetSchema used by the dedicated budget endpoints.
export const homeMonthlyBudgetSchema = budgetSchema.extend({
  amountKrw: z.number().int().min(0)
});

export const itemSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  necessityLevel: necessityLevelSchema,
  status: itemStatusSchema,
  timingLabel: z.string().optional(),
  priceBandText: z.string().optional(),
  stageCodes: z.array(childStageCodeSchema).optional()
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
//   not_needed와는 다르다(서버 items-catalog.service.ts TAB_STATUSES 주석 참고).
// - `all`은 상태로 거르지 않는 전체 스냅샷 탭이다. 네 탭의 합집합과 같은 집합을 1요청으로
//   준다 — 준비율(ITEM-114)처럼 전 상태가 필요한 화면의 4연속 요청을 없앤다.
export const listItemsQuerySchema = z.object({
  tab: z.enum(["now", "soon", "prepared", "not_needed", "all"]).optional(),
  stageBand: stageBandLabelSchema.optional()
});

export const productLinkSchema = z.object({
  id: uuidSchema,
  platform: productPlatformSchema,
  title: z.string().min(1),
  isAffiliate: z.boolean(),
  isSponsored: z.boolean(),
  disclosureText: z.string().optional()
});

export const itemDetailSchema = itemSummarySchema.extend({
  reasonText: z.string().min(1),
  skipReasonText: z.string().nullable().optional(),
  usedSecondhandOk: z.boolean(),
  safetyNote: z.string().nullable().optional(),
  // 라운드 48 T1: 의료/영양제 성격이라 전문가 확인이 필요한 준비템 표시(DNC-020). 스키마와
  // 시드에는 처음부터 있었지만 어떤 응답에도 실리지 않던 필드다 — 서버는 항상 boolean을
  // 보내고, 구버전 클라이언트가 깨지지 않도록 계약에서는 optional로 더한다(가산 변경).
  medicalDisclaimerRequired: z.boolean().optional(),
  productLinks: z.array(productLinkSchema)
});

export const homeSummarySchema = z.object({
  child: childSchema,
  totalExpenseKrw: z.number().int().min(0),
  monthly: homeMonthlyBudgetSchema,
  recommendedItems: z.array(itemSummarySchema),
  recentExpenses: z.array(expenseSchema)
});

export const affiliateClickResponseSchema = z.object({
  clickId: uuidSchema,
  redirectUrl: z.string().url(),
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
  categoryTop: z.array(categoryBreakdownEntrySchema)
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
  parsedItemName: z.string().max(100).optional(),
  parsedAmountKrw: moneyKrwSchema.optional(),
  categoryId: uuidSchema.optional(),
  confidence: z.number().min(0).max(1),
  selected: z.boolean(),
  validationStatus: z.string().min(1)
});

export type CategoryBreakdownEntryDto = z.infer<typeof categoryBreakdownEntrySchema>;
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
