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
  active: z.boolean()
});

// CAT-101: GET /categories 응답 계약 (활성 카테고리만, displayOrder 오름차순).
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
  memo: z.string().nullable().optional(),
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
export type CreateExpenseRequestDto = z.infer<typeof createExpenseRequestSchema>;
export type ListCategoriesResponseDto = z.infer<typeof listCategoriesResponseSchema>;
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
export type YearlyReportDto = z.infer<typeof reportYearlySchema>;
