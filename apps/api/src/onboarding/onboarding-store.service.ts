import { randomBytes, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  assertMoneyKrw,
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isFutureSeoulDate,
  isValidCalendarDate,
  sortRecommendedItems,
  type ChildStageCode,
  type ChildStageMode,
  type ExpenseSource,
  type ExpenseType,
  type ImportStatus,
  type ItemStatus,
  type MemberRole,
  type NecessityLevel,
  type PaymentMethod,
  type ProductPlatform
} from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isHttpOrHttpsUrl } from "../common/validation/url-scheme";
import { parseImportFile, type ParsedImportRow } from "../imports/import-parser";
import { hashClickIp, isAllowedAffiliateUrl, PRODUCT_LINK_NOT_FOUND_ERROR } from "../items-commerce/affiliate-link-guard.util";
import { PushDispatchService } from "../push/push-dispatch.service";

type DbClient = Prisma.TransactionClient;

type ConsentDefinition = {
  type: string;
  version: string;
  required: boolean;
  title: string;
};

type ChildRow = {
  id: string;
  householdId: string;
  nickname: string;
  stageMode: ChildStageMode;
  dueDate: Date | null;
  birthDate: Date | null;
  manualStage: ChildStageCode | null;
  preparedItemsSetAt: Date | null;
  deletedAt: Date | null;
};

type ExpenseRow = {
  id: string;
  childId: string;
  householdId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: Date;
  itemName: string;
  merchant: string | null;
  paymentMethod: PaymentMethod;
  memo: string | null;
  linkedItemTemplateId: string | null;
  expenseType: ExpenseType;
  source: ExpenseSource;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ItemTemplateRow = {
  id: string;
  code: string;
  name: string;
  necessityLevel: NecessityLevel;
  timingLabel: string | null;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  displayOrder: number;
  active: boolean;
};

type ItemTemplateWithStages = ItemTemplateRow & { stageCodes: ChildStageCode[] };

type ProductLinkRow = {
  id: string;
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  displayOrder: number;
  active: boolean;
  // COM-105 link health (migration 000009): "ok" | "broken" | "unstable",
  // null = never checked. Optional so hand-built rows in older code/tests
  // keep compiling; Prisma rows always carry both.
  healthStatus?: string | null;
  healthCheckedAt?: Date | null;
};

type ImportRowRow = {
  id: string;
  importJobId: string;
  rowIndex: number;
  parsedDate: Date | null;
  parsedItemName: string | null;
  parsedAmountKrw: number | null;
  categoryId: string | null;
  confidence: Prisma.Decimal | number;
  selected: boolean;
  userReviewed: boolean;
  validationStatus: string;
  duplicateCandidateExpenseId?: string | null;
};

type CreateChildInput = {
  householdId: string;
  nickname: string;
  stageMode: ChildStageMode;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
};

type UpdateChildInput = {
  nickname?: string;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
};

export type CreateExpenseInput = {
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  memo?: string;
  linkedItemTemplateId?: string;
  expenseType?: ExpenseType;
  source?: ExpenseSource;
};

export type UpdateExpenseInput = {
  categoryId?: string;
  amountKrw?: number;
  spentOn?: string;
  itemName?: string;
  memo?: string | null;
  expenseType?: ExpenseType;
};

export type CreateImportJobInput = {
  fileName?: string;
  fileSizeBytes?: number;
  estimatedRowCount?: number;
  fileBuffer?: Buffer;
};

export type UpdateImportRowInput = {
  selected?: boolean;
  categoryId?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
};

export type ConfirmImportInput = {
  selectedRowIds?: string[];
};

export type AdminItemTemplateInput = {
  name?: string;
  categoryId?: string;
  necessityLevel?: NecessityLevel;
  timingLabel?: string;
  priceMinKrw?: number | null;
  priceMaxKrw?: number | null;
  reasonText?: string;
  skipReasonText?: string | null;
  usedSecondhandOk?: boolean;
  safetyNote?: string | null;
  stageCodes?: ChildStageCode[];
  active?: boolean;
};

export type AdminProductLinkInput = {
  itemTemplateId?: string;
  platform?: ProductPlatform;
  title?: string;
  url?: string;
  affiliateUrl?: string | null;
  isAffiliate?: boolean;
  isSponsored?: boolean;
  disclosureText?: string | null;
  active?: boolean;
};

export type ItemTab = "now" | "soon" | "prepared" | "not_needed";

const defaultImportCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const importMaxFileSizeBytes = 10 * 1024 * 1024;
const importMaxRows = 2000;

const consentDefinitions: ConsentDefinition[] = [
  { type: "terms", version: "2026-07-06", required: true, title: "서비스 이용약관" },
  { type: "privacy", version: "2026-07-06", required: true, title: "개인정보 처리 동의" },
  { type: "marketing", version: "2026-07-06", required: false, title: "소식 알림 동의" }
];

function memberRoleFor(user: AuthenticatedUser, householdId: string): MemberRole | null {
  return user.households.find((household) => household.id === householdId)?.role ?? null;
}

function canEdit(role: MemberRole | null) {
  return role === "owner" || role === "co_parent";
}

function priceBandText(priceMinKrw: number | null, priceMaxKrw: number | null) {
  if (priceMinKrw == null && priceMaxKrw == null) {
    return undefined;
  }
  if (priceMinKrw != null && priceMaxKrw != null) {
    return `${priceMinKrw.toLocaleString("ko-KR")}~${priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  if (priceMinKrw != null) {
    return `${priceMinKrw.toLocaleString("ko-KR")}원부터`;
  }
  return `${priceMaxKrw!.toLocaleString("ko-KR")}원 이하`;
}

function toDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`);
}

function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeChildInput(input: {
  stageMode: ChildStageMode;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
}) {
  if (input.stageMode === "pregnant" && !input.dueDate) {
    throw new BadRequestException({ code: "CHILD_STAGE_INPUT_REQUIRED", message: "출산 예정일을 입력해 주세요." });
  }
  if (input.stageMode === "born" && !input.birthDate) {
    throw new BadRequestException({ code: "CHILD_STAGE_INPUT_REQUIRED", message: "아이 생년월일을 입력해 주세요." });
  }
  if (input.stageMode === "manual" && !input.manualStage) {
    throw new BadRequestException({ code: "CHILD_STAGE_INPUT_REQUIRED", message: "아이 단계를 선택해 주세요." });
  }
}

/**
 * Postgres-backed onboarding/finance/commerce store, replacing the earlier
 * in-memory Maps. Class name and every public method signature/response shape are
 * unchanged from the in-memory version; every method is now async.
 */
@Injectable()
export class OnboardingStoreService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    // PUSH-113 후속(리뷰 m-2): 전역 PushModule(@Global())이 제공하는 발송 훅.
    // @Optional() — 이 서비스만 따로 조립하는 단위 테스트/부분 모듈에서는 없어도
    // 되고, 그 경우 훅은 그냥 건너뛴다 (finance/expenses.service.ts와 같은 선례).
    @Optional() @Inject(PushDispatchService) private readonly pushDispatch?: PushDispatchService
  ) {}

  async listConsents(user: AuthenticatedUser) {
    const saved = await this.prisma.consent.findMany({ where: { userId: user.id } });
    return {
      consents: consentDefinitions.map((definition) => {
        const record = saved.find(
          (consent) => consent.consentType === definition.type && consent.version === definition.version
        );
        return {
          ...definition,
          accepted: record?.accepted ?? false,
          acceptedAt: record?.acceptedAt?.toISOString() ?? null
        };
      })
    };
  }

  async upsertConsents(user: AuthenticatedUser, consents: Array<{ type: string; version: string; accepted: boolean }>) {
    const current = (await this.listConsents(user)).consents;
    const now = new Date();
    for (const definition of current) {
      const incoming = consents.find(
        (consent) => consent.type === definition.type && consent.version === definition.version
      );
      if (!incoming) continue;
      await this.prisma.consent.upsert({
        where: {
          userId_consentType_version: {
            userId: user.id,
            consentType: definition.type,
            version: definition.version
          }
        },
        update: {
          accepted: incoming.accepted,
          acceptedAt: incoming.accepted ? now : null,
          revokedAt: incoming.accepted ? null : now
        },
        create: {
          userId: user.id,
          consentType: definition.type,
          version: definition.version,
          accepted: incoming.accepted,
          acceptedAt: incoming.accepted ? now : null
        }
      });
    }
    return { success: true };
  }

  async hasRequiredConsents(user: AuthenticatedUser) {
    const { consents } = await this.listConsents(user);
    return consents.filter((consent) => consent.required).every((consent) => consent.accepted);
  }

  async assertRequiredConsents(user: AuthenticatedUser) {
    if (!(await this.hasRequiredConsents(user))) {
      throw new ForbiddenException({ code: "CONSENT_REQUIRED", message: "필수 약관과 개인정보 동의가 필요해요." });
    }
  }

  /**
   * MOB-101 (round5a-sprint1-plan.md §4): the "server progress state" the design calls for is
   * derived directly from the real onboarding resources (consents, the household's child,
   * childItemStatus rows, budget) instead of a separate progress-tracking table -- those
   * resources ARE the saved state for each step, so deriving from them can never drift out of
   * sync with what actually got created, and there is nothing to reconcile after a
   * create/upsert. `canRestart` follows the conservative rule from the onboarding resume
   * screen (ONB-006): once a child has been created for the household, "처음부터" is no longer
   * offered (only "이어서 하기") to avoid orphaning or duplicating that child; before a child
   * exists there's nothing to lose by restarting.
   */
  async onboardingStatus(user: AuthenticatedUser) {
    const consentsAccepted = await this.hasRequiredConsents(user);
    if (!consentsAccepted) {
      return this.onboardingStatusResult("consents", true, {
        consentsAccepted: false,
        child: null,
        preparedItemsCount: null,
        budget: null
      });
    }

    const children = await this.childrenForUser(user);
    if (children.length === 0) {
      return this.onboardingStatusResult("child-profile", true, {
        consentsAccepted: true,
        child: null,
        preparedItemsCount: null,
        budget: null
      });
    }

    const selectedChild = children[0];
    const childSummary = this.toChildDto(selectedChild);
    if (!selectedChild.preparedItemsSetAt) {
      return this.onboardingStatusResult("prepared-items", false, {
        consentsAccepted: true,
        child: childSummary,
        preparedItemsCount: null,
        budget: null
      });
    }

    const preparedItemsCount = await this.prisma.childItemStatus.count({ where: { childId: selectedChild.id } });
    const budget = await this.prisma.budget.findFirst({ where: { childId: selectedChild.id } });
    if (!budget) {
      return this.onboardingStatusResult("budget", false, {
        consentsAccepted: true,
        child: childSummary,
        preparedItemsCount,
        budget: null
      });
    }

    return {
      completed: true,
      nextStep: "home",
      canRestart: false,
      summary: {
        consentsAccepted: true,
        child: childSummary,
        preparedItemsCount,
        budget: { yearMonth: fromDateOnly(budget.yearMonth), amountKrw: budget.amountKrw }
      }
    };
  }

  private onboardingStatusResult(
    nextStep: "consents" | "child-profile" | "prepared-items" | "budget",
    canRestart: boolean,
    summary: {
      consentsAccepted: boolean;
      child: ReturnType<OnboardingStoreService["toChildDto"]> | null;
      preparedItemsCount: number | null;
      budget: { yearMonth: string; amountKrw: number } | null;
    }
  ) {
    return { completed: false, nextStep, canRestart, summary };
  }

  async createChild(user: AuthenticatedUser, input: CreateChildInput) {
    await this.assertRequiredConsents(user);
    const role = memberRoleFor(user, input.householdId);
    if (!canEdit(role)) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "아이 프로필을 만들 권한이 없어요." });
    }

    normalizeChildInput(input);
    const created = await this.prisma.child.create({
      data: {
        householdId: input.householdId,
        nickname: input.nickname,
        stageMode: input.stageMode,
        dueDate: input.dueDate ? toDateOnly(input.dueDate) : null,
        birthDate: input.birthDate ? toDateOnly(input.birthDate) : null,
        manualStage: input.manualStage ?? null
      }
    });
    return this.toChildDto(created);
  }

  async listChildren(user: AuthenticatedUser) {
    const children = await this.childrenForUser(user);
    return { children: children.map((child) => this.toChildDto(child)) };
  }

  async getChild(user: AuthenticatedUser, childId: string) {
    return this.toChildDto(await this.requireChildAccess(user, childId));
  }

  async updateChild(user: AuthenticatedUser, childId: string, input: UpdateChildInput) {
    const child = await this.requireChildAccess(user, childId, true);
    const definedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as UpdateChildInput;

    normalizeChildInput({
      stageMode: child.stageMode,
      dueDate: definedInput.dueDate ?? (child.dueDate ? fromDateOnly(child.dueDate) : undefined),
      birthDate: definedInput.birthDate ?? (child.birthDate ? fromDateOnly(child.birthDate) : undefined),
      manualStage: definedInput.manualStage ?? child.manualStage ?? undefined
    });

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: {
        ...(definedInput.nickname !== undefined ? { nickname: definedInput.nickname } : {}),
        ...(definedInput.dueDate !== undefined ? { dueDate: toDateOnly(definedInput.dueDate) } : {}),
        ...(definedInput.birthDate !== undefined ? { birthDate: toDateOnly(definedInput.birthDate) } : {}),
        ...(definedInput.manualStage !== undefined ? { manualStage: definedInput.manualStage } : {})
      }
    });
    return this.toChildDto(updated);
  }

  /**
   * Transactional: marks the child's onboarding "prepared items" step complete
   * (`preparedItemsSetAt`) and upserts a `child_item_statuses` row for every
   * submitted id that resolves to a real, existing item template — both in the
   * same transaction, so a crash partway through can never record the step as done
   * without its status rows (or vice versa).
   */
  async setPreparedItems(user: AuthenticatedUser, childId: string, itemTemplateIds: string[]) {
    await this.requireChildAccess(user, childId, true);
    const uniqueItemTemplateIds = [...new Set(itemTemplateIds)];
    const existing = await this.prisma.itemTemplate.findMany({
      where: { id: { in: uniqueItemTemplateIds } },
      select: { id: true }
    });
    const validIds = new Set(existing.map((item) => item.id));

    await this.prisma.$transaction(async (tx) => {
      await tx.child.update({ where: { id: childId }, data: { preparedItemsSetAt: new Date() } });
      for (const itemTemplateId of uniqueItemTemplateIds) {
        if (!validIds.has(itemTemplateId)) continue;
        await tx.childItemStatus.upsert({
          where: { childId_itemTemplateId: { childId, itemTemplateId } },
          update: { status: "prepared", updatedByUserId: user.id },
          create: { childId, itemTemplateId, status: "prepared", updatedByUserId: user.id }
        });
      }
    });

    return { updatedCount: uniqueItemTemplateIds.length };
  }

  async getBudget(user: AuthenticatedUser, childId: string, yearMonth = this.currentYearMonth()) {
    await this.requireChildAccess(user, childId);
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const budget = await this.prisma.budget.findUnique({
      where: { childId_yearMonth: { childId, yearMonth: toDateOnly(normalizedMonth) } }
    });
    if (!budget) {
      throw new NotFoundException({ code: "BUDGET_NOT_FOUND", message: "월 예산을 찾을 수 없어요." });
    }
    return this.toBudgetDto(childId, normalizedMonth, budget.amountKrw);
  }

  async upsertBudget(user: AuthenticatedUser, childId: string, yearMonth: string, amountKrw: number) {
    await this.requireChildAccess(user, childId, true);
    // REP-105: yearMonth arrives DTO-normalized to `YYYY-MM-01` (inputs accept
    // `YYYY-MM` or `YYYY-MM-01`; see common/validation/year-month.ts), and
    // getSeoulMonthRange itself truncates any date to its month, so this
    // normalization point — shared by getBudget/getMonthlyReport — is
    // tolerant of both forms. Responses keep the first-of-month form.
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const amount = this.requireMoneyKrw(amountKrw);
    const budget = await this.prisma.budget.upsert({
      where: { childId_yearMonth: { childId, yearMonth: toDateOnly(normalizedMonth) } },
      update: { amountKrw: amount },
      create: { childId, yearMonth: toDateOnly(normalizedMonth), amountKrw: amount, createdByUserId: user.id }
    });
    return this.toBudgetDto(childId, normalizedMonth, budget.amountKrw);
  }

  async createExpense(user: AuthenticatedUser, childId: string, input: CreateExpenseInput) {
    const child = await this.requireChildAccess(user, childId, true);
    const created = await this.insertExpense(this.prisma, child.householdId, childId, user, input);
    return this.toExpenseDto(created);
  }

  async listExpenses(user: AuthenticatedUser, childId: string, yearMonth?: string) {
    await this.requireChildAccess(user, childId);
    const expenses = await this.expensesForChild(childId, yearMonth);
    return {
      expenses: expenses.map((expense) => this.toExpenseDto(expense)),
      totalAmountKrw: this.totalExpenseKrw(expenses)
    };
  }

  async getExpense(user: AuthenticatedUser, expenseId: string) {
    return this.toExpenseDto(await this.requireExpenseAccess(user, expenseId));
  }

  async updateExpense(user: AuthenticatedUser, expenseId: string, input: UpdateExpenseInput) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    const data: Prisma.ExpenseUpdateInput = {};

    if (input.categoryId !== undefined) {
      await this.requireExistingCategory(input.categoryId);
      data.categoryId = input.categoryId;
    }
    if (input.amountKrw !== undefined) data.amountKrw = this.requireMoneyKrw(input.amountKrw);
    if (input.spentOn !== undefined) {
      this.assertNotFutureDate(input.spentOn);
      data.spentOn = toDateOnly(input.spentOn);
    }
    if (input.itemName !== undefined) {
      const itemName = input.itemName.trim();
      if (!itemName) {
        throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
      }
      data.itemName = itemName;
    }
    if (input.memo !== undefined) data.memo = this.cleanOptionalText(input.memo ?? undefined);
    if (input.expenseType !== undefined) data.expenseType = input.expenseType;

    const updated = await this.prisma.expense.update({ where: { id: expense.id }, data });
    return this.toExpenseDto(updated);
  }

  async deleteExpense(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    const before = this.toExpenseDto(expense);
    const now = new Date();
    const deleted = await this.prisma.expense.update({
      where: { id: expense.id },
      data: { deletedAt: now, deletedByUserId: user.id }
    });
    return {
      success: true,
      householdId: deleted.householdId,
      before,
      after: { ...before, deletedAt: deleted.deletedAt?.toISOString() ?? null }
    };
  }

  async createImportJob(user: AuthenticatedUser, childId: string, input: CreateImportJobInput = {}) {
    const child = await this.requireChildAccess(user, childId, true);
    const fileName = this.requireAcceptedImportFile(input);

    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new BadRequestException({ code: "IMPORT_FILE_REQUIRED", message: "Import file is required." });
    }

    const referenceYear = Number(this.currentYearMonth().slice(0, 4));
    let parsed: Awaited<ReturnType<typeof parseImportFile>>;
    try {
      parsed = await parseImportFile(input.fileBuffer, fileName, { referenceYear, maxRows: importMaxRows });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "가져오기 파일을 읽을 수 없어요." });
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "가져올 데이터를 찾을 수 없어요." });
    }

    const rows = await this.buildImportRowsFromParsed(childId, parsed.rows);

    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importJob.create({
        data: {
          childId,
          householdId: child.householdId,
          userId: user.id,
          status: "preview_ready",
          fileName,
          fileType: parsed.fileType,
          fileSizeBytes: BigInt(Math.max(1, input.fileSizeBytes ?? input.fileBuffer?.length ?? 0)),
          rowCount: 0,
          candidateCount: 0,
          importedCount: 0
        }
      });

      for (const row of rows) {
        await tx.importRow.create({
          data: {
            id: row.id,
            importJobId: created.id,
            rowIndex: row.rowIndex,
            rawJson: {},
            parsedDate: row.parsedDate,
            parsedItemName: row.parsedItemName,
            parsedAmountKrw: row.parsedAmountKrw,
            categoryId: row.categoryId,
            confidence: row.confidence,
            duplicateCandidateExpenseId: row.duplicateCandidateExpenseId ?? null,
            selected: row.selected,
            userReviewed: row.userReviewed,
            validationStatus: row.validationStatus
          }
        });
      }

      const candidateCount = rows.filter((row) => Number(row.confidence) >= 0.7).length;
      return tx.importJob.update({
        where: { id: created.id },
        data: { rowCount: rows.length, candidateCount }
      });
    });

    return this.toImportJobDto(job);
  }

  async getImportJob(user: AuthenticatedUser, importJobId: string) {
    return this.toImportJobDto(await this.requireImportJobAccess(user, importJobId));
  }

  async listImportRows(user: AuthenticatedUser, importJobId: string) {
    await this.requireImportJobAccess(user, importJobId);
    const rows = await this.prisma.importRow.findMany({ where: { importJobId }, orderBy: { rowIndex: "asc" } });
    return { rows: rows.map((row) => this.toImportRowDto(row)) };
  }

  async updateImportRow(user: AuthenticatedUser, importJobId: string, rowId: string, input: UpdateImportRowInput) {
    const job = await this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "preview_ready") {
      throw new BadRequestException({ code: "IMPORT_NOT_EDITABLE", message: "Import preview can no longer be edited." });
    }

    const current = await this.prisma.importRow.findFirst({ where: { id: rowId, importJobId } });
    if (!current) {
      throw new NotFoundException({ code: "IMPORT_ROW_NOT_FOUND", message: "Import preview row was not found." });
    }

    const merged: ImportRowRow = {
      ...current,
      categoryId: input.categoryId ?? current.categoryId,
      parsedItemName:
        input.parsedItemName === undefined ? current.parsedItemName : this.cleanOptionalText(input.parsedItemName) ?? null,
      parsedAmountKrw: input.parsedAmountKrw ?? current.parsedAmountKrw,
      selected: input.selected ?? current.selected,
      userReviewed: true
    };
    const validationStatus = this.validationStatusForImportRow(merged);
    const selected = validationStatus === "valid" ? merged.selected : false;

    const updated = await this.prisma.importRow.update({
      where: { id: rowId },
      data: {
        categoryId: merged.categoryId,
        parsedItemName: merged.parsedItemName,
        parsedAmountKrw: merged.parsedAmountKrw,
        selected,
        userReviewed: true,
        validationStatus
      }
    });
    return this.toImportRowDto(updated);
  }

  /**
   * Transactional: creates every importable selected row as an expense and marks
   * the import job confirmed in one Prisma transaction, so a failure partway
   * through (e.g. an invalid categoryId on one row) rolls back every expense this
   * confirm would otherwise have created, rather than leaving a partial import.
   *
   * The first statement inside the transaction is a compare-and-swap
   * (`preview_ready` -> `confirmed`) `updateMany`. This closes a race where two
   * concurrent confirm requests for the same import job both pass the
   * pre-transaction `job.status !== "preview_ready"` check (both read the row
   * before either has written to it) and would otherwise both insert the same
   * expenses. With the CAS, only the request that wins the `updateMany` proceeds to
   * insert; the loser gets the exact same `IMPORT_NOT_CONFIRMABLE` error a
   * sequential double-confirm already produced before this fix.
   */
  async confirmImport(user: AuthenticatedUser, importJobId: string, input: ConfirmImportInput = {}) {
    const job = await this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "preview_ready") {
      throw new BadRequestException({ code: "IMPORT_NOT_CONFIRMABLE", message: "Import job is not ready to confirm." });
    }

    const selectedRowIds = new Set(input.selectedRowIds ?? []);
    const hasExplicitSelection = selectedRowIds.size > 0;
    const rows = await this.prisma.importRow.findMany({ where: { importJobId } });
    const selectedRows = rows.filter((row) => (hasExplicitSelection ? selectedRowIds.has(row.id) : row.selected));
    const importableRows = selectedRows.filter((row) => this.validationStatusForImportRow(row) === "valid");

    const importedCount = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.importJob.updateMany({
        where: { id: importJobId, status: "preview_ready" },
        data: { status: "confirmed" }
      });
      if (claimed.count === 0) {
        throw new BadRequestException({ code: "IMPORT_NOT_CONFIRMABLE", message: "Import job is not ready to confirm." });
      }

      for (const row of importableRows) {
        await this.insertExpense(tx, job.householdId, job.childId, user, {
          categoryId: row.categoryId!,
          amountKrw: row.parsedAmountKrw!,
          spentOn: fromDateOnly(row.parsedDate!),
          itemName: row.parsedItemName!,
          paymentMethod: "unknown",
          source: "excel_import"
        });
      }

      await tx.importJob.update({
        where: { id: importJobId },
        data: { importedCount: importableRows.length }
      });

      return importableRows.length;
    });

    // PUSH-113 후속(리뷰 m-2): 가져오기 커밋은 insertExpense를 직접 호출해
    // ExpensesVersionService의 지출 생성 훅을 타지 않으므로, 배치 커밋 완료 후
    // 아이별로 1회 예산 경계 평가를 fire-and-forget으로 건다. 클레임 방식은
    // usedAfter(월 합계)만 필요해 "어느 행이 경계를 넘겼는지"는 몰라도 된다.
    // 실패해도 가져오기 흐름에는 영향이 없다 (onBudgetRelevantChange는 예외를
    // 절대 던지지 않는 계약).
    if (importedCount > 0) {
      const yearMonths = [...new Set(importableRows.map((row) => fromDateOnly(row.parsedDate!).slice(0, 7)))];
      void this.pushDispatch?.onBudgetRelevantChange(job.childId, yearMonths);
    }

    return {
      importedCount,
      skippedCount: selectedRows.length - importedCount
    };
  }

  async getHome(user: AuthenticatedUser, childId: string) {
    // View-access check must stay first: no data reads happen for a child the
    // caller is not allowed to see (PERF-103 kept this ordering intact).
    const child = await this.requireChildAccess(user, childId);
    const yearMonth = this.currentYearMonth();
    // PERF-103: the child's expense rows are fetched ONCE (recentExpenses and
    // totalExpenseKrw both derive from `expenses`), and the four independent
    // reads run in parallel instead of serially.
    const [budget, monthlyUsedKrw, expenses, recommendedItems] = await Promise.all([
      this.prisma.budget.findUnique({
        where: { childId_yearMonth: { childId, yearMonth: toDateOnly(yearMonth) } }
      }),
      this.sumExpenses(childId, getSeoulMonthRange(yearMonth)),
      this.expensesForChild(childId),
      this.recommendedItemsForChild(childId)
    ]);

    return {
      child: this.toChildDto(child),
      totalExpenseKrw: this.totalExpenseKrw(expenses),
      monthly: this.buildBudgetDto(childId, yearMonth, budget?.amountKrw ?? 0, monthlyUsedKrw),
      recommendedItems: recommendedItems.slice(0, 3),
      recentExpenses: expenses.slice(0, 3).map((expense) => this.toExpenseDto(expense))
    };
  }

  async listItems(user: AuthenticatedUser, childId: string, tab: ItemTab = "now") {
    await this.requireChildAccess(user, childId);
    const items = await this.itemsForChild(childId, tab);
    return { items: items.map(({ item, status }) => this.toItemSummaryDto(item, status)) };
  }

  async getItemDetail(user: AuthenticatedUser, childId: string, itemTemplateId: string) {
    await this.requireChildAccess(user, childId);
    const item = await this.requireItemTemplate(itemTemplateId);
    const status = await this.itemStatusFor(childId, itemTemplateId);
    const links = await this.prisma.productLink.findMany({
      where: { itemTemplateId: item.id, active: true },
      orderBy: { displayOrder: "asc" }
    });
    const disclosures = await this.disclosuresByKey();

    return {
      ...this.toItemSummaryDto(item, status),
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      productLinks: links.map((link) => this.toProductLinkDto(link, disclosures))
    };
  }

  async updateItemStatus(user: AuthenticatedUser, childId: string, itemTemplateId: string, status: ItemStatus, expenseId?: string) {
    await this.requireChildAccess(user, childId, true);
    const item = await this.requireItemTemplate(itemTemplateId);
    if (expenseId) {
      await this.requireExpenseBelongsToChild(user, expenseId, childId);
    }
    await this.setChildItemStatus(user, childId, itemTemplateId, status, expenseId);
    return this.toItemSummaryDto(item, status);
  }

  async clickProductLink(
    user: AuthenticatedUser,
    productLinkId: string,
    input: { childId: string; referrerScreenId?: string },
    requestMeta?: { ip?: string; userAgent?: string }
  ) {
    const child = await this.requireChildAccess(user, input.childId);
    const productLink = await this.prisma.productLink.findFirst({ where: { id: productLinkId, active: true } });
    if (!productLink) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "상품 링크를 찾을 수 없어요." });
    }
    await this.requireItemTemplate(productLink.itemTemplateId);

    const redirectUrl = productLink.affiliateUrl ?? productLink.url;
    this.requireHttpUrl(redirectUrl);
    // COM-106: same allowlist check as the public GET /r/:code redirect (§4). A disallowed
    // domain returns the same 404 as "link not found" — see PRODUCT_LINK_NOT_FOUND_ERROR's
    // doc comment for why the codes are unified — and the click is not logged.
    if (!isAllowedAffiliateUrl(redirectUrl)) {
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }

    // subId is a self-generated uuid (never derived from user/child identifiers) reused as
    // the row's own id, per round5a-sprint2-plan.md §4's "subId=clickId — PII 금지".
    const clickId = randomUUID();
    const click = await this.prisma.affiliateClick.create({
      data: {
        id: clickId,
        userId: user.id,
        householdId: child.householdId,
        childId: input.childId,
        itemTemplateId: productLink.itemTemplateId,
        productLinkId: productLink.id,
        platform: productLink.platform,
        referrerScreenId: input.referrerScreenId,
        subId: clickId,
        ipHash: hashClickIp(requestMeta?.ip),
        userAgent: requestMeta?.userAgent ?? null
      }
    });

    return {
      clickId: click.id,
      redirectUrl,
      disclosureText: productLink.disclosureText ?? undefined
    };
  }

  async getMonthlyReport(user: AuthenticatedUser, childId: string, yearMonth = this.currentYearMonth()) {
    await this.requireChildAccess(user, childId);
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const range = getSeoulMonthRange(normalizedMonth);
    const [totalExpenseKrw, budget, categoryTop] = await Promise.all([
      this.sumExpenses(childId, range),
      this.prisma.budget.findUnique({ where: { childId_yearMonth: { childId, yearMonth: toDateOnly(normalizedMonth) } } }),
      this.categoryBreakdown(childId, range)
    ]);

    return {
      childId,
      yearMonth: normalizedMonth,
      totalExpenseKrw,
      budgetAmountKrw: budget?.amountKrw ?? null,
      categoryTop
    };
  }

  async getYearlyReport(user: AuthenticatedUser, childId: string, year = this.currentYear()) {
    await this.requireChildAccess(user, childId);
    const normalizedYear = this.requireValidYear(year);
    const rows = await this.prisma.expense.findMany({
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: {
          gte: new Date(`${normalizedYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${Number(normalizedYear) + 1}-01-01T00:00:00.000Z`)
        }
      },
      select: { spentOn: true, amountKrw: true }
    });

    const totalsByMonth = new Map<string, number>();
    for (const row of rows) {
      const key = fromDateOnly(row.spentOn).slice(0, 7);
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + row.amountKrw);
    }

    const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
      const yearMonth = `${normalizedYear}-${String(index + 1).padStart(2, "0")}`;
      return { yearMonth, totalExpenseKrw: totalsByMonth.get(yearMonth) ?? 0 };
    });

    return {
      childId,
      year: normalizedYear,
      totalExpenseKrw: monthlyTotals.reduce((sum, month) => sum + month.totalExpenseKrw, 0),
      monthlyTotals
    };
  }

  async getCumulativeReport(user: AuthenticatedUser, childId: string) {
    await this.requireChildAccess(user, childId);
    const rows = await this.prisma.expense.findMany({
      where: { childId, deletedAt: null, expenseType: "expense" },
      select: { spentOn: true, amountKrw: true }
    });

    const yearly = new Map<string, { year: string; amountKrw: number; count: number }>();
    for (const row of rows) {
      const year = fromDateOnly(row.spentOn).slice(0, 4);
      const current = yearly.get(year) ?? { year, amountKrw: 0, count: 0 };
      current.amountKrw += row.amountKrw;
      current.count += 1;
      yearly.set(year, current);
    }

    return {
      childId,
      totalExpenseKrw: rows.reduce((sum, row) => sum + row.amountKrw, 0),
      yearly: [...yearly.values()].sort((left, right) => right.year.localeCompare(left.year))
    };
  }

  async getCategoryReport(
    user: AuthenticatedUser,
    childId: string,
    period: { yearMonth?: string; year?: string; quarter?: number } = {}
  ) {
    await this.requireChildAccess(user, childId);
    return {
      childId,
      categories: await this.categoryBreakdown(childId, this.categoryReportRange(period))
    };
  }

  /**
   * REP-104: resolves the category report's optional period filter to a Seoul-calendar
   * date range. Exactly one period shape is accepted per request -- yearMonth (single
   * month), year (whole year), or year+quarter (calendar quarter); no period at all
   * keeps the historical all-time breakdown. Cross-field combinations the per-field
   * DTO validation cannot express are rejected here.
   */
  private categoryReportRange(period: {
    yearMonth?: string;
    year?: string;
    quarter?: number;
  }): { startInclusive: string; endExclusive: string } | undefined {
    const { yearMonth, year, quarter } = period;
    if (yearMonth && (year !== undefined || quarter !== undefined)) {
      throw new BadRequestException({
        code: "REPORT_PERIOD_INVALID",
        message: "조회 기간은 yearMonth 또는 year(+quarter) 중 하나로만 지정해 주세요."
      });
    }
    if (quarter !== undefined && year === undefined) {
      throw new BadRequestException({
        code: "REPORT_PERIOD_INVALID",
        message: "quarter는 year와 함께 지정해 주세요."
      });
    }
    if (yearMonth) return getSeoulMonthRange(yearMonth);
    if (year === undefined) return undefined;

    const normalizedYear = this.requireValidYear(year);
    const startMonth = quarter === undefined ? 1 : (quarter - 1) * 3 + 1;
    const endMonthExclusive = quarter === undefined ? 13 : startMonth + 3;
    const startInclusive = `${normalizedYear}-${String(startMonth).padStart(2, "0")}-01`;
    const endExclusive =
      endMonthExclusive > 12
        ? `${Number(normalizedYear) + 1}-01-01`
        : `${normalizedYear}-${String(endMonthExclusive).padStart(2, "0")}-01`;
    return { startInclusive, endExclusive };
  }

  async adminListItemTemplates() {
    const items = await this.listItemTemplatesWithStages(false);
    const links = await this.prisma.productLink.findMany();
    const disclosures = await this.disclosuresByKey();
    const linksByItem = this.groupBy(links, (link) => link.itemTemplateId);
    return { items: items.map((item) => this.toAdminItemDetailDto(item, linksByItem.get(item.id) ?? [], disclosures)) };
  }

  async adminCreateItemTemplate(input: AdminItemTemplateInput) {
    const normalized = this.normalizeAdminItemTemplateInput(input, {});
    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.itemTemplate.create({
        data: {
          code: `admin_${Date.now()}_${randomBytes(3).toString("hex")}`,
          name: normalized.name!,
          categoryId: input.categoryId ?? null,
          necessityLevel: normalized.necessityLevel!,
          timingLabel: normalized.timingLabel ?? "",
          priceMinKrw: normalized.priceMinKrw ?? null,
          priceMaxKrw: normalized.priceMaxKrw ?? null,
          reasonText: normalized.reasonText!,
          skipReasonText: normalized.skipReasonText ?? null,
          usedSecondhandOk: normalized.usedSecondhandOk ?? false,
          safetyNote: normalized.safetyNote ?? null,
          displayOrder: await this.nextItemDisplayOrder(tx),
          active: normalized.active ?? true
        }
      });
      await this.replaceItemTemplateStages(tx, item.id, normalized.stageCodes ?? (["infant_4_6"] as ChildStageCode[]));
      return item;
    });

    const withStages = await this.requireItemTemplateAnyStatus(created.id);
    return this.toAdminItemDetailDto(withStages, [], await this.disclosuresByKey());
  }

  async adminUpdateItemTemplate(itemTemplateId: string, input: AdminItemTemplateInput) {
    const item = await this.requireItemTemplateAnyStatus(itemTemplateId);
    const normalized = this.normalizeAdminItemTemplateInput(input, item);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.itemTemplate.update({
        where: { id: itemTemplateId },
        data: {
          name: normalized.name!,
          categoryId: input.categoryId ?? undefined,
          necessityLevel: normalized.necessityLevel!,
          timingLabel: normalized.timingLabel ?? "",
          priceMinKrw: normalized.priceMinKrw ?? null,
          priceMaxKrw: normalized.priceMaxKrw ?? null,
          reasonText: normalized.reasonText!,
          skipReasonText: normalized.skipReasonText ?? null,
          usedSecondhandOk: normalized.usedSecondhandOk ?? false,
          safetyNote: normalized.safetyNote ?? null,
          active: normalized.active ?? true
        }
      });
      if (normalized.stageCodes) {
        await this.replaceItemTemplateStages(tx, itemTemplateId, normalized.stageCodes);
      }
      return row;
    });

    const withStages = await this.requireItemTemplateAnyStatus(updated.id);
    const links = await this.prisma.productLink.findMany({ where: { itemTemplateId } });
    return this.toAdminItemDetailDto(withStages, links, await this.disclosuresByKey());
  }

  async adminListProductLinks() {
    const links = await this.prisma.productLink.findMany();
    const disclosures = await this.disclosuresByKey();
    return { links: links.map((link) => this.toAdminProductLinkDto(link, disclosures)) };
  }

  async adminCreateProductLink(input: AdminProductLinkInput) {
    if (!input.itemTemplateId) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template is required." });
    }
    await this.requireItemTemplateAnyStatus(input.itemTemplateId);
    if (!input.platform || !input.title?.trim() || !input.url?.trim()) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    this.requireHttpUrl(input.url);
    if (input.affiliateUrl) {
      this.requireHttpUrl(input.affiliateUrl);
    }

    const link = await this.prisma.productLink.create({
      data: {
        itemTemplateId: input.itemTemplateId,
        platform: input.platform,
        title: input.title.trim(),
        url: input.url.trim(),
        affiliateUrl: this.cleanOptionalText(input.affiliateUrl ?? undefined),
        isAffiliate: input.isAffiliate ?? false,
        isSponsored: input.isSponsored ?? false,
        disclosureText: this.cleanOptionalText(input.disclosureText ?? undefined),
        displayOrder: await this.nextProductLinkDisplayOrder(input.itemTemplateId),
        active: input.active ?? true
      }
    });
    return this.toAdminProductLinkDto(link, await this.disclosuresByKey());
  }

  async adminUpdateProductLink(productLinkId: string, input: AdminProductLinkInput) {
    const current = await this.requireProductLinkAnyStatus(productLinkId);
    const itemTemplateId = input.itemTemplateId ?? current.itemTemplateId;
    await this.requireItemTemplateAnyStatus(itemTemplateId);

    const title = input.title === undefined ? current.title : input.title.trim();
    const url = input.url === undefined ? current.url : input.url.trim();
    if (!title || !url) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    this.requireHttpUrl(url);
    const affiliateUrl =
      input.affiliateUrl === undefined ? current.affiliateUrl : this.cleanOptionalText(input.affiliateUrl ?? undefined);
    if (affiliateUrl) {
      this.requireHttpUrl(affiliateUrl);
    }

    const updated = await this.prisma.productLink.update({
      where: { id: productLinkId },
      data: {
        itemTemplateId,
        platform: input.platform ?? current.platform,
        title,
        url,
        affiliateUrl,
        isAffiliate: input.isAffiliate ?? current.isAffiliate,
        isSponsored: input.isSponsored ?? current.isSponsored,
        disclosureText:
          input.disclosureText === undefined ? current.disclosureText : this.cleanOptionalText(input.disclosureText ?? undefined),
        active: input.active ?? current.active
      }
    });
    return this.toAdminProductLinkDto(updated, await this.disclosuresByKey());
  }

  async adminListDisclosures() {
    const rows = await this.prisma.disclosure.findMany({ orderBy: { key: "asc" } });
    return { disclosures: rows.map((row) => ({ key: row.key, text: row.text })) };
  }

  async adminUpdateDisclosure(key: string, text: string) {
    const cleanedText = text.trim();
    if (!cleanedText) {
      throw new BadRequestException({ code: "ADMIN_DISCLOSURE_REQUIRED", message: "Disclosure text is required." });
    }
    const row = await this.prisma.disclosure.upsert({
      where: { key },
      update: { text: cleanedText },
      create: { key, text: cleanedText }
    });
    return { key: row.key, text: row.text };
  }

  async adminAffiliateClickSummary() {
    const grouped = await this.prisma.affiliateClick.groupBy({
      by: ["platform"],
      _count: { _all: true }
    });
    const totalClicks = grouped.reduce((sum, group) => sum + group._count._all, 0);
    return {
      totalClicks,
      byPlatform: grouped.map((group) => ({ platform: group.platform, count: group._count._all }))
    };
  }

  async getPrivacySettings(user: AuthenticatedUser) {
    return {
      consents: (await this.listConsents(user)).consents,
      flows: [
        {
          id: "account_delete",
          title: "Delete account",
          impact: ["account access stops", "active household memberships are left"],
          confirmationText: "DELETE ACCOUNT"
        },
        {
          id: "household_leave",
          title: "Leave household",
          impact: ["shared child data is no longer accessible from this account"],
          confirmationText: "LEAVE HOUSEHOLD"
        },
        {
          id: "child_profile_delete",
          title: "Delete child profile",
          impact: ["child profile becomes inaccessible", "related expense records are removed from reports"],
          confirmationText: "DELETE CHILD"
        }
      ]
    };
  }

  async previewChildProfileDeletion(user: AuthenticatedUser, childId: string) {
    await this.requireChildAccess(user, childId, true);
    return {
      flowId: "child_profile_delete",
      requiresSecondStep: true,
      confirmationText: "DELETE CHILD",
      impact: ["child profile becomes inaccessible", "related expense records are removed from reports"]
    };
  }

  /**
   * Transactional: soft-deletes the child and bulk soft-deletes every one of its
   * non-deleted expenses in one transaction, so a crash partway through can never
   * leave a deleted child with still-active expense rows (which would otherwise
   * keep counting toward reports/budgets for a child the user can no longer see).
   */
  async confirmChildProfileDeletion(user: AuthenticatedUser, childId: string, confirmationText: string) {
    this.assertConfirmation(confirmationText, "DELETE CHILD");
    const child = await this.requireChildAccess(user, childId, true);
    const now = new Date();

    const deletedExpenseCount = await this.prisma.$transaction(async (tx) => {
      await tx.child.update({ where: { id: childId }, data: { deletedAt: now } });
      const result = await tx.expense.updateMany({
        where: { childId, deletedAt: null },
        data: { deletedAt: now, deletedByUserId: user.id }
      });
      return result.count;
    });

    return {
      success: true,
      flowId: "child_profile_delete",
      householdId: child.householdId,
      deletedExpenseCount,
      deletedAt: now.toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------------

  private async insertExpense(
    client: DbClient,
    householdId: string,
    childId: string,
    user: AuthenticatedUser,
    input: CreateExpenseInput
  ): Promise<ExpenseRow> {
    const itemName = input.itemName.trim();
    if (!itemName) {
      throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
    }
    this.assertNotFutureDate(input.spentOn);
    await this.requireExistingCategory(input.categoryId, client);
    if (input.linkedItemTemplateId) {
      await this.requireExistingItemTemplateAnyStatus(input.linkedItemTemplateId, client);
    }

    return client.expense.create({
      data: {
        householdId,
        childId,
        createdByUserId: user.id,
        categoryId: input.categoryId,
        amountKrw: this.requireMoneyKrw(input.amountKrw),
        spentOn: toDateOnly(input.spentOn),
        itemName,
        merchant: this.cleanOptionalText(input.merchant),
        paymentMethod: input.paymentMethod ?? "unknown",
        memo: this.cleanOptionalText(input.memo),
        linkedItemTemplateId: input.linkedItemTemplateId ?? null,
        expenseType: input.expenseType ?? "expense",
        source: input.source ?? "manual"
      }
    });
  }

  private async childrenForUser(user: AuthenticatedUser): Promise<ChildRow[]> {
    const householdIds = user.households.map((household) => household.id);
    if (householdIds.length === 0) return [];
    return this.prisma.child.findMany({
      where: { householdId: { in: householdIds }, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
  }

  private async requireChildAccess(user: AuthenticatedUser, childId: string, edit = false): Promise<ChildRow> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.deletedAt) {
      throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "아이 프로필을 찾을 수 없어요." });
    }

    const role = memberRoleFor(user, child.householdId);
    if (!role || (edit && !canEdit(role))) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "아이 프로필 접근 권한이 없어요." });
    }

    return child;
  }

  private async requireExpenseAccess(user: AuthenticatedUser, expenseId: string, edit = false): Promise<ExpenseRow> {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.deletedAt) {
      throw new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." });
    }

    await this.requireChildAccess(user, expense.childId, edit);
    return expense;
  }

  private async requireExpenseBelongsToChild(user: AuthenticatedUser, expenseId: string, childId: string) {
    const expense = await this.requireExpenseAccess(user, expenseId, true);
    if (expense.childId !== childId) {
      throw new ForbiddenException({ code: "EXPENSE_CHILD_MISMATCH", message: "지출 기록이 해당 아이 소속이 아니에요." });
    }
    return expense;
  }

  private async requireImportJobAccess(user: AuthenticatedUser, importJobId: string, edit = false) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) {
      throw new NotFoundException({ code: "IMPORT_JOB_NOT_FOUND", message: "Import job was not found." });
    }
    await this.requireChildAccess(user, job.childId, edit);
    return job;
  }

  private async requireItemTemplate(itemTemplateId: string): Promise<ItemTemplateWithStages> {
    const item = await this.itemTemplateWithStages(itemTemplateId);
    if (!item || !item.active) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "준비템을 찾을 수 없어요." });
    }
    return item;
  }

  private async requireItemTemplateAnyStatus(itemTemplateId: string): Promise<ItemTemplateWithStages> {
    const item = await this.itemTemplateWithStages(itemTemplateId);
    if (!item) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "Item template was not found." });
    }
    return item;
  }

  private async requireExistingItemTemplateAnyStatus(itemTemplateId: string, client: DbClient = this.prisma) {
    const exists = await client.itemTemplate.findUnique({ where: { id: itemTemplateId }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException({ code: "EXPENSE_LINKED_ITEM_TEMPLATE_INVALID", message: "연결된 준비템을 찾을 수 없어요." });
    }
  }

  private async requireExistingCategory(categoryId: string, client: DbClient = this.prisma) {
    const exists = await client.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요."
      });
    }
  }

  private async requireProductLinkAnyStatus(productLinkId: string): Promise<ProductLinkRow> {
    const link = await this.prisma.productLink.findUnique({ where: { id: productLinkId } });
    if (!link) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "Product link was not found." });
    }
    return link;
  }

  private async itemTemplateWithStages(itemTemplateId: string): Promise<ItemTemplateWithStages | null> {
    const item = await this.prisma.itemTemplate.findUnique({ where: { id: itemTemplateId } });
    if (!item) return null;
    const stages = await this.prisma.itemTemplateStage.findMany({
      where: { itemTemplateId },
      orderBy: { priorityWeight: "desc" }
    });
    return { ...item, stageCodes: stages.map((stage) => stage.stageCode) };
  }

  private async listItemTemplatesWithStages(activeOnly: boolean): Promise<ItemTemplateWithStages[]> {
    const items = await this.prisma.itemTemplate.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { displayOrder: "asc" }
    });
    if (items.length === 0) return [];
    const stages = await this.prisma.itemTemplateStage.findMany({
      where: { itemTemplateId: { in: items.map((item) => item.id) } },
      orderBy: { priorityWeight: "desc" }
    });
    const stagesByItem = this.groupBy(stages, (stage) => stage.itemTemplateId);
    return items.map((item) => ({
      ...item,
      stageCodes: (stagesByItem.get(item.id) ?? []).map((stage) => stage.stageCode)
    }));
  }

  private toChildDto(child: ChildRow) {
    const today = process.env.WOORIAI_STAGE_TODAY;
    const calculated =
      child.stageMode === "pregnant"
        ? calculateChildStage({ stageMode: "pregnant", dueDate: fromDateOnly(child.dueDate!), today })
        : child.stageMode === "born"
          ? calculateChildStage({ stageMode: "born", birthDate: fromDateOnly(child.birthDate!), today })
          : calculateChildStage({ stageMode: "manual", manualStage: child.manualStage!, today });

    return {
      id: child.id,
      householdId: child.householdId,
      nickname: child.nickname,
      stageMode: child.stageMode,
      dueDate: child.dueDate ? fromDateOnly(child.dueDate) : null,
      birthDate: child.birthDate ? fromDateOnly(child.birthDate) : null,
      manualStage: child.manualStage ?? null,
      currentStage: calculated.stageCode,
      stageLabel: calculated.stageLabel
    };
  }

  private toExpenseDto(expense: ExpenseRow) {
    return {
      id: expense.id,
      childId: expense.childId,
      categoryId: expense.categoryId,
      amountKrw: expense.amountKrw,
      spentOn: fromDateOnly(expense.spentOn),
      itemName: expense.itemName,
      merchant: expense.merchant ?? null,
      memo: expense.memo ?? null,
      expenseType: expense.expenseType,
      source: expense.source,
      createdByUserId: expense.createdByUserId
    };
  }

  private async toBudgetDto(childId: string, yearMonth: string, amountKrw: number) {
    const range = getSeoulMonthRange(yearMonth);
    const usedAmountKrw = await this.sumExpenses(childId, range);
    return this.buildBudgetDto(childId, yearMonth, amountKrw, usedAmountKrw);
  }

  /** Pure DTO assembly shared by toBudgetDto and getHome (PERF-103), so getHome can
   *  fetch usedAmountKrw inside its Promise.all without changing the response shape. */
  private buildBudgetDto(childId: string, yearMonth: string, amountKrw: number, usedAmountKrw: number) {
    return {
      childId,
      yearMonth,
      amountKrw,
      usedAmountKrw,
      remainingAmountKrw: amountKrw - usedAmountKrw
    };
  }

  private toItemSummaryDto(item: ItemTemplateWithStages, status: ItemStatus) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status,
      // CON-115: DB에서 null인 timingLabel은 undefined로 정리해 계약(z.string().optional())과
      // 모바일 타입(timingLabel?: string)에 맞춘다 — null이 그대로 나가면 계약 위반.
      timingLabel: item.timingLabel ?? undefined,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
      stageCodes: item.stageCodes
    };
  }

  private toProductLinkDto(link: ProductLinkRow, disclosures: Map<string, string>) {
    return {
      id: link.id,
      platform: link.platform,
      title: link.title,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link, disclosures)
    };
  }

  private toAdminItemDetailDto(item: ItemTemplateWithStages, links: ProductLinkRow[], disclosures: Map<string, string>) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status: "not_prepared" as const,
      timingLabel: item.timingLabel,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      active: item.active,
      stageCodes: item.stageCodes,
      productLinks: [...links]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((link) => this.toAdminProductLinkDto(link, disclosures))
    };
  }

  private toAdminProductLinkDto(link: ProductLinkRow, disclosures: Map<string, string>) {
    return {
      id: link.id,
      itemTemplateId: link.itemTemplateId,
      platform: link.platform,
      title: link.title,
      url: link.url,
      affiliateUrl: link.affiliateUrl,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link, disclosures),
      active: link.active,
      // COM-105: worker-written health verdict, surfaced on the admin links
      // page only (the app-facing toProductLinkDto stays unchanged).
      healthStatus: link.healthStatus ?? null,
      healthCheckedAt: link.healthCheckedAt ?? null
    };
  }

  private toImportJobDto(job: {
    id: string;
    status: ImportStatus;
    rowCount: number | null;
    candidateCount: number | null;
    importedCount: number | null;
  }) {
    return {
      id: job.id,
      status: job.status,
      rowCount: job.rowCount ?? 0,
      candidateCount: job.candidateCount ?? 0,
      importedCount: job.importedCount ?? 0
    };
  }

  private toImportRowDto(row: ImportRowRow) {
    return {
      id: row.id,
      rowIndex: row.rowIndex,
      parsedDate: row.parsedDate ? fromDateOnly(row.parsedDate) : undefined,
      parsedItemName: row.parsedItemName ?? undefined,
      parsedAmountKrw: row.parsedAmountKrw ?? undefined,
      categoryId: row.categoryId ?? undefined,
      confidence: Number(row.confidence),
      selected: row.selected,
      validationStatus: row.validationStatus
    };
  }

  private async expensesForChild(childId: string, yearMonth?: string): Promise<ExpenseRow[]> {
    const range = yearMonth ? getSeoulMonthRange(yearMonth) : null;
    return this.prisma.expense.findMany({
      where: {
        childId,
        deletedAt: null,
        ...(range ? { spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) } } : {})
      },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }]
    });
  }

  private totalExpenseKrw(expenses: ExpenseRow[]) {
    return expenses.filter((expense) => expense.expenseType === "expense").reduce((sum, expense) => sum + expense.amountKrw, 0);
  }

  private async sumExpenses(childId: string, range: { startInclusive: string; endExclusive: string }) {
    const result = await this.prisma.expense.aggregate({
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) }
      },
      _sum: { amountKrw: true }
    });
    return result._sum.amountKrw ?? 0;
  }

  private async categoryBreakdown(childId: string, range?: { startInclusive: string; endExclusive: string }) {
    const grouped = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        ...(range ? { spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) } } : {})
      },
      _sum: { amountKrw: true },
      _count: { _all: true }
    });

    return grouped
      .map((group) => ({
        categoryId: group.categoryId,
        amountKrw: group._sum.amountKrw ?? 0,
        count: group._count._all
      }))
      .sort((left, right) => right.amountKrw - left.amountKrw);
  }

  private async itemsForChild(childId: string, tab: ItemTab): Promise<Array<{ item: ItemTemplateWithStages; status: ItemStatus }>> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) return [];

    const stageCode = this.toChildDto(child).currentStage as ChildStageCode;
    const activeItems = await this.listItemTemplatesWithStages(true);
    const statuses = await this.prisma.childItemStatus.findMany({ where: { childId } });
    const statusByItem = new Map(statuses.map((row) => [row.itemTemplateId, row.status]));
    const statusFor = (itemId: string): ItemStatus => statusByItem.get(itemId) ?? "not_prepared";

    if (tab === "prepared") {
      return activeItems
        .filter((item) => statusFor(item.id) === "prepared")
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ item, status: statusFor(item.id) }));
    }

    if (tab === "not_needed") {
      return activeItems
        .filter((item) => statusFor(item.id) === "not_needed")
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ item, status: statusFor(item.id) }));
    }

    const stageMatcher =
      tab === "now"
        ? (item: ItemTemplateWithStages) => item.stageCodes.includes(stageCode)
        : (item: ItemTemplateWithStages) => !item.stageCodes.includes(stageCode);

    const candidates = activeItems.filter(stageMatcher).filter((item) => {
      const status = statusFor(item.id);
      return status === "not_prepared" || status === "interested";
    });

    const sorted = sortRecommendedItems(
      candidates.map((item) => ({
        id: item.id,
        stageMatches: item.stageCodes.includes(stageCode),
        necessityLevel: item.necessityLevel,
        status: statusFor(item.id),
        budgetFits: true,
        userInterest: statusFor(item.id) === "interested",
        displayOrder: item.displayOrder
      }))
    );
    const itemById = new Map(candidates.map((item) => [item.id, item]));
    return sorted
      .map((entry) => itemById.get(entry.id))
      .filter((item): item is ItemTemplateWithStages => Boolean(item))
      .sort((left, right) => {
        const leftIndex = sorted.findIndex((entry) => entry.id === left.id);
        const rightIndex = sorted.findIndex((entry) => entry.id === right.id);
        return leftIndex - rightIndex || left.displayOrder - right.displayOrder;
      })
      .map((item) => ({ item, status: statusFor(item.id) }));
  }

  private async recommendedItemsForChild(childId: string) {
    const items = await this.itemsForChild(childId, "now");
    return items.map(({ item, status }) => this.toItemSummaryDto(item, status));
  }

  private async itemStatusFor(childId: string, itemTemplateId: string): Promise<ItemStatus> {
    const row = await this.prisma.childItemStatus.findUnique({
      where: { childId_itemTemplateId: { childId, itemTemplateId } }
    });
    return row?.status ?? "not_prepared";
  }

  private async setChildItemStatus(
    user: AuthenticatedUser,
    childId: string,
    itemTemplateId: string,
    status: ItemStatus,
    expenseId?: string | null
  ) {
    await this.prisma.childItemStatus.upsert({
      where: { childId_itemTemplateId: { childId, itemTemplateId } },
      update: { status, expenseId: expenseId ?? null, updatedByUserId: user.id },
      create: { childId, itemTemplateId, status, expenseId: expenseId ?? null, updatedByUserId: user.id }
    });
  }

  private async disclosuresByKey(): Promise<Map<string, string>> {
    const rows = await this.prisma.disclosure.findMany();
    return new Map(rows.map((row) => [row.key, row.text]));
  }

  private normalizeAdminItemTemplateInput(input: AdminItemTemplateInput, existing: Partial<ItemTemplateWithStages>) {
    const name = input.name ?? existing.name;
    const necessityLevel = input.necessityLevel ?? existing.necessityLevel;
    const reasonText = input.reasonText ?? existing.reasonText;
    if (!name?.trim() || !necessityLevel || !reasonText?.trim()) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template fields are required." });
    }
    const skipReasonText = this.cleanOptionalText(input.skipReasonText ?? existing.skipReasonText ?? undefined);
    if (necessityLevel !== "essential" && !skipReasonText) {
      throw new BadRequestException({
        code: "ADMIN_SKIP_REASON_REQUIRED",
        message: "Non-essential preparation items need skip guidance."
      });
    }
    return {
      name: name.trim(),
      necessityLevel,
      timingLabel: this.cleanOptionalText(input.timingLabel ?? existing.timingLabel ?? undefined) ?? "",
      priceMinKrw: input.priceMinKrw ?? existing.priceMinKrw ?? null,
      priceMaxKrw: input.priceMaxKrw ?? existing.priceMaxKrw ?? null,
      reasonText: reasonText.trim(),
      skipReasonText,
      usedSecondhandOk: input.usedSecondhandOk ?? existing.usedSecondhandOk ?? false,
      safetyNote: this.cleanOptionalText(input.safetyNote ?? existing.safetyNote ?? undefined),
      active: input.active ?? existing.active ?? true,
      stageCodes: input.stageCodes?.length ? input.stageCodes : existing.stageCodes
    };
  }

  private async replaceItemTemplateStages(tx: DbClient, itemTemplateId: string, stageCodes: ChildStageCode[]) {
    await tx.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
    for (const [index, stageCode] of stageCodes.entries()) {
      await tx.itemTemplateStage.create({
        data: { itemTemplateId, stageCode, priorityWeight: stageCodes.length - index }
      });
    }
  }

  private async nextItemDisplayOrder(client: DbClient) {
    const max = await client.itemTemplate.aggregate({ _max: { displayOrder: true } });
    return (max._max.displayOrder ?? 0) + 10;
  }

  private async nextProductLinkDisplayOrder(itemTemplateId: string) {
    const max = await this.prisma.productLink.aggregate({
      where: { itemTemplateId },
      _max: { displayOrder: true }
    });
    return (max._max.displayOrder ?? 0) + 10;
  }

  private defaultDisclosureFor(link: { isSponsored: boolean; isAffiliate: boolean }, disclosures: Map<string, string>) {
    if (link.isSponsored) return disclosures.get("sponsored_product");
    if (link.isAffiliate) return disclosures.get("affiliate_purchase");
    return undefined;
  }

  private assertConfirmation(actual: string, expected: string) {
    if (actual !== expected) {
      throw new BadRequestException({ code: "SETTINGS_CONFIRMATION_REQUIRED", message: "Confirmation text does not match." });
    }
  }

  private requireAcceptedImportFile(input: CreateImportJobInput) {
    const fileName = input.fileName?.trim();
    if (!fileName) {
      throw new BadRequestException({ code: "IMPORT_FILE_REQUIRED", message: "Import file is required." });
    }

    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx") {
      throw new BadRequestException({ code: "IMPORT_FILE_TYPE_INVALID", message: "Only csv or xlsx files are allowed." });
    }

    if (input.fileSizeBytes !== undefined && input.fileSizeBytes > importMaxFileSizeBytes) {
      throw new BadRequestException({ code: "IMPORT_FILE_TOO_LARGE", message: "Import files must be 10MB or smaller." });
    }

    if (input.estimatedRowCount !== undefined && input.estimatedRowCount > importMaxRows) {
      throw new BadRequestException({ code: "IMPORT_TOO_MANY_ROWS", message: "Import files can include up to 2,000 rows." });
    }

    return fileName;
  }

  /**
   * Resolves each parser-produced row (pure text/number data, no DB access) into
   * a persistable ImportRowRow: maps `categoryCode` -> a real seeded
   * `categories.id` (falling back to `defaultImportCategoryId` when there's no
   * keyword match or the code doesn't resolve), flags duplicate candidates
   * against the child's existing non-deleted expenses (same date + amount), and
   * computes each row's validationStatus/selected default from that.
   */
  private async buildImportRowsFromParsed(childId: string, parsedRows: ParsedImportRow[]): Promise<ImportRowRow[]> {
    const categoryCodes = [...new Set(parsedRows.map((row) => row.categoryCode).filter((code): code is string => Boolean(code)))];
    const categories = categoryCodes.length
      ? await this.prisma.category.findMany({ where: { code: { in: categoryCodes } }, select: { id: true, code: true } })
      : [];
    const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

    const candidateDates = [...new Set(parsedRows.filter((row) => row.dateIso && row.amountKrw != null).map((row) => row.dateIso!))];
    const candidateAmounts = [
      ...new Set(parsedRows.filter((row) => row.dateIso && row.amountKrw != null).map((row) => row.amountKrw!))
    ];
    const existingExpenses =
      candidateDates.length && candidateAmounts.length
        ? await this.prisma.expense.findMany({
            where: {
              childId,
              deletedAt: null,
              spentOn: { in: candidateDates.map((iso) => toDateOnly(iso)) },
              amountKrw: { in: candidateAmounts }
            },
            select: { id: true, spentOn: true, amountKrw: true }
          })
        : [];
    const existingExpenseIdByKey = new Map(
      existingExpenses.map((expense) => [`${fromDateOnly(expense.spentOn)}|${expense.amountKrw}`, expense.id])
    );

    return parsedRows.map((row) => {
      const categoryId = (row.categoryCode ? categoryIdByCode.get(row.categoryCode) : undefined) ?? defaultImportCategoryId;
      const duplicateCandidateExpenseId =
        row.dateIso && row.amountKrw != null ? existingExpenseIdByKey.get(`${row.dateIso}|${row.amountKrw}`) ?? null : null;

      const base = {
        id: randomUUID(),
        importJobId: "",
        rowIndex: row.rowIndex,
        parsedDate: row.dateIso ? toDateOnly(row.dateIso) : null,
        parsedItemName: row.itemName,
        parsedAmountKrw: row.amountKrw,
        categoryId,
        confidence: row.confidence,
        userReviewed: false,
        duplicateCandidateExpenseId
      };

      const validationStatus = this.validationStatusForImportRow(base);
      return { ...base, validationStatus, selected: validationStatus === "valid" };
    });
  }

  private validationStatusForImportRow(row: {
    parsedDate: Date | null;
    parsedItemName: string | null;
    parsedAmountKrw: number | null;
    categoryId: string | null;
    confidence: Prisma.Decimal | number;
    userReviewed: boolean;
    duplicateCandidateExpenseId?: string | null;
  }) {
    if (!row.parsedDate) return "missing_date";
    try {
      this.assertNotFutureDate(fromDateOnly(row.parsedDate));
    } catch {
      return "invalid_date";
    }

    if (!row.parsedItemName?.trim()) return "missing_item_name";

    try {
      this.requireMoneyKrw(row.parsedAmountKrw ?? undefined);
    } catch {
      return "invalid_amount";
    }

    if (!row.categoryId) return "missing_category";
    if (!row.userReviewed && row.duplicateCandidateExpenseId) return "duplicate_candidate";
    if (!row.userReviewed && Number(row.confidence) < 0.7) return "low_confidence_duplicate_candidate";
    return "valid";
  }

  private currentYearMonth() {
    return getSeoulMonthRange(process.env.WOORIAI_STAGE_TODAY ?? getSeoulToday()).yearMonth;
  }

  private currentYear() {
    return this.currentYearMonth().slice(0, 4);
  }

  private requireValidYear(year: string) {
    if (!/^\d{4}$/.test(year)) {
      throw new BadRequestException({ code: "YEAR_INVALID", message: "연도를 다시 확인해 주세요." });
    }
    return year;
  }

  private referenceNow() {
    return process.env.WOORIAI_STAGE_TODAY
      ? new Date(`${process.env.WOORIAI_STAGE_TODAY}T00:00:00+09:00`)
      : new Date();
  }

  private assertNotFutureDate(spentOn: string) {
    if (!isValidCalendarDate(spentOn)) {
      throw new BadRequestException({ code: "EXPENSE_DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
    }

    try {
      if (isFutureSeoulDate(spentOn, this.referenceNow())) {
        throw new BadRequestException({ code: "EXPENSE_FUTURE_DATE", message: "미래 날짜의 지출은 저장할 수 없어요." });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({ code: "EXPENSE_DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
    }
  }

  private requireMoneyKrw(value: unknown) {
    try {
      return assertMoneyKrw(value);
    } catch {
      throw new BadRequestException({ code: "EXPENSE_AMOUNT_INVALID", message: "금액은 0보다 큰 원화 정수만 입력할 수 있어요." });
    }
  }

  private requireHttpUrl(value: string) {
    if (!isHttpOrHttpsUrl(value)) {
      throw new BadRequestException({
        code: "PRODUCT_LINK_URL_SCHEME_INVALID",
        message: "상품 링크 주소는 http 또는 https로 시작해야 해요."
      });
    }
  }

  private cleanOptionalText(value?: string) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }
}
