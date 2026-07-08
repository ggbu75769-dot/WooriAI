import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  assertMoneyKrw,
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isFutureSeoulDate,
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
import { itemTemplateSeeds, productLinkSeeds } from "../../prisma/seed-data";
import type { AuthenticatedUser } from "../common/types/authenticated-request";

type ConsentDefinition = {
  type: string;
  version: string;
  required: boolean;
  title: string;
};

type ConsentRecord = ConsentDefinition & {
  accepted: boolean;
  acceptedAt: string | null;
};

type ChildRecord = {
  id: string;
  householdId: string;
  nickname: string;
  stageMode: ChildStageMode;
  dueDate?: string | null;
  birthDate?: string | null;
  manualStage?: ChildStageCode | null;
  deletedAt?: string | null;
};

type BudgetRecord = {
  childId: string;
  yearMonth: string;
  amountKrw: number;
  updatedAt: string;
};

type ExpenseRecord = {
  id: string;
  childId: string;
  householdId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string | null;
  paymentMethod: PaymentMethod;
  memo?: string | null;
  linkedItemTemplateId?: string | null;
  expenseType: ExpenseType;
  source: ExpenseSource;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type ItemTemplateRecord = {
  id: string;
  code: string;
  name: string;
  necessityLevel: NecessityLevel;
  timingLabel: string;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  displayOrder: number;
  active: boolean;
  stageCodes: ChildStageCode[];
};

type ProductLinkRecord = {
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
};

type ChildItemStatusRecord = {
  childId: string;
  itemTemplateId: string;
  status: ItemStatus;
  expenseId?: string | null;
  updatedByUserId: string;
  updatedAt: string;
};

type ImportJobRecord = {
  id: string;
  childId: string;
  householdId: string;
  createdByUserId: string;
  status: ImportStatus;
  fileName: string;
  rowCount: number;
  candidateCount: number;
  importedCount: number;
  createdAt: string;
  updatedAt: string;
};

type ImportRowRecord = {
  id: string;
  importJobId: string;
  rowIndex: number;
  parsedDate?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
  categoryId?: string;
  confidence: number;
  selected: boolean;
  validationStatus: string;
  userReviewed: boolean;
};

export type AffiliateClickEntry = {
  id: string;
  userId: string;
  householdId: string;
  childId: string;
  itemTemplateId: string;
  productLinkId: string;
  platform: ProductPlatform;
  referrerScreenId?: string;
  clickedAt: string;
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
};

export type CreateImportJobInput = {
  fileName?: string;
  fileSizeBytes?: number;
  estimatedRowCount?: number;
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

const defaultDisclosures = [
  {
    key: "affiliate_purchase",
    text: "Purchases through affiliate links may generate a commission for WooriAI."
  },
  {
    key: "sponsored_product",
    text: "Sponsored products are marked separately from general recommendations."
  },
  {
    key: "nutrition_supplement",
    text: "Nutrition and supplement content is informational and is not medical advice."
  }
];

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

function deterministicUuid(value: string) {
  const hash = createHash("sha256").update(value).digest("hex");
  const variant = ((Number.parseInt(hash[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
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

@Injectable()
export class OnboardingStoreService {
  private readonly consentsByUserId = new Map<string, ConsentRecord[]>();
  private readonly childrenById = new Map<string, ChildRecord>();
  private readonly preparedItemIdsByChildId = new Map<string, Set<string>>();
  private readonly budgetsByChildMonth = new Map<string, BudgetRecord>();
  private readonly expensesById = new Map<string, ExpenseRecord>();
  private readonly childItemStatusesByKey = new Map<string, ChildItemStatusRecord>();
  private readonly importJobsById = new Map<string, ImportJobRecord>();
  private readonly importRowsByJobId = new Map<string, ImportRowRecord[]>();
  private readonly disclosuresByKey = new Map(defaultDisclosures.map((disclosure) => [disclosure.key, disclosure]));
  private readonly itemTemplates = itemTemplateSeeds.map<ItemTemplateRecord>((item) => ({
    id: deterministicUuid(`item-template:${item.code}`),
    code: item.code,
    name: item.name,
    necessityLevel: item.necessityLevel,
    timingLabel: item.timingLabel,
    priceMinKrw: item.priceMinKrw,
    priceMaxKrw: item.priceMaxKrw,
    reasonText: item.reasonText,
    skipReasonText: item.skipReasonText,
    usedSecondhandOk: item.usedSecondhandOk,
    safetyNote: item.safetyNote,
    displayOrder: item.displayOrder,
    active: item.active,
    stageCodes: item.stageCodes as ChildStageCode[]
  }));
  private readonly productLinks = productLinkSeeds.map<ProductLinkRecord>((link) => {
    const itemTemplateId = this.itemTemplateIdByCode(link.itemTemplateCode);
    return {
      id: deterministicUuid(`product-link:${link.itemTemplateCode}:${link.platform}:${link.title}`),
      itemTemplateId,
      platform: link.platform,
      title: link.title,
      url: link.url,
      affiliateUrl: link.affiliateUrl,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText,
      displayOrder: link.displayOrder,
      active: link.active
    };
  });
  private readonly affiliateClicks: AffiliateClickEntry[] = [];

  get affiliateClickEntries() {
    return [...this.affiliateClicks];
  }

  listConsents(user: AuthenticatedUser) {
    const saved = this.consentsByUserId.get(user.id) ?? [];
    return {
      consents: consentDefinitions.map((definition) => {
        const record = saved.find(
          (consent) => consent.type === definition.type && consent.version === definition.version
        );
        return {
          ...definition,
          accepted: record?.accepted ?? false,
          acceptedAt: record?.acceptedAt ?? null
        };
      })
    };
  }

  upsertConsents(
    user: AuthenticatedUser,
    consents: Array<{ type: string; version: string; accepted: boolean }>
  ) {
    const current = this.listConsents(user).consents;
    const now = new Date().toISOString();
    const next = current.map((definition) => {
      const incoming = consents.find(
        (consent) => consent.type === definition.type && consent.version === definition.version
      );
      return incoming
        ? { ...definition, accepted: incoming.accepted, acceptedAt: incoming.accepted ? now : null }
        : definition;
    });
    this.consentsByUserId.set(user.id, next);
    return { success: true };
  }

  hasRequiredConsents(user: AuthenticatedUser) {
    return this
      .listConsents(user)
      .consents.filter((consent) => consent.required)
      .every((consent) => consent.accepted);
  }

  assertRequiredConsents(user: AuthenticatedUser) {
    if (!this.hasRequiredConsents(user)) {
      throw new ForbiddenException({
        code: "CONSENT_REQUIRED",
        message: "필수 약관과 개인정보 동의가 필요해요."
      });
    }
  }

  onboardingStatus(user: AuthenticatedUser) {
    if (!this.hasRequiredConsents(user)) {
      return { completed: false, nextStep: "consents" };
    }

    const children = this.childrenForUser(user);
    if (children.length === 0) {
      return { completed: false, nextStep: "child-profile" };
    }

    const selectedChild = children[0];
    if (!this.preparedItemIdsByChildId.has(selectedChild.id)) {
      return { completed: false, nextStep: "prepared-items" };
    }

    if (![...this.budgetsByChildMonth.values()].some((budget) => budget.childId === selectedChild.id)) {
      return { completed: false, nextStep: "budget" };
    }

    return { completed: true, nextStep: "home" };
  }

  createChild(user: AuthenticatedUser, input: CreateChildInput) {
    this.assertRequiredConsents(user);
    const role = memberRoleFor(user, input.householdId);
    if (!canEdit(role)) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "아이 프로필을 만들 권한이 없어요." });
    }

    const child = this.normalizeChild({ id: randomUUID(), ...input });
    this.childrenById.set(child.id, child);
    return this.toChildDto(child);
  }

  listChildren(user: AuthenticatedUser) {
    return { children: this.childrenForUser(user).map((child) => this.toChildDto(child)) };
  }

  getChild(user: AuthenticatedUser, childId: string) {
    return this.toChildDto(this.requireChildAccess(user, childId));
  }

  updateChild(user: AuthenticatedUser, childId: string, input: UpdateChildInput) {
    const child = this.requireChildAccess(user, childId, true);
    const definedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as UpdateChildInput;
    const updated = this.normalizeChild({ ...child, ...definedInput });
    this.childrenById.set(childId, updated);
    return this.toChildDto(updated);
  }

  setPreparedItems(user: AuthenticatedUser, childId: string, itemTemplateIds: string[]) {
    this.requireChildAccess(user, childId, true);
    const uniqueItemTemplateIds = new Set(itemTemplateIds);
    this.preparedItemIdsByChildId.set(childId, uniqueItemTemplateIds);
    for (const itemTemplateId of uniqueItemTemplateIds) {
      if (this.itemTemplates.some((item) => item.id === itemTemplateId)) {
        this.setChildItemStatus(user, childId, itemTemplateId, "prepared");
      }
    }
    return { updatedCount: uniqueItemTemplateIds.size };
  }

  getBudget(user: AuthenticatedUser, childId: string, yearMonth = this.currentYearMonth()) {
    this.requireChildAccess(user, childId);
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const budget = this.budgetsByChildMonth.get(this.budgetKey(childId, normalizedMonth));
    if (!budget) {
      throw new NotFoundException({ code: "BUDGET_NOT_FOUND", message: "월 예산을 찾을 수 없어요." });
    }
    return this.toBudgetDto(childId, normalizedMonth, budget.amountKrw);
  }

  upsertBudget(user: AuthenticatedUser, childId: string, yearMonth: string, amountKrw: number) {
    this.requireChildAccess(user, childId, true);
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const budget = {
      childId,
      yearMonth: normalizedMonth,
      amountKrw: this.requireMoneyKrw(amountKrw),
      updatedAt: new Date().toISOString()
    };
    this.budgetsByChildMonth.set(this.budgetKey(childId, normalizedMonth), budget);
    return this.toBudgetDto(childId, normalizedMonth, budget.amountKrw);
  }

  createExpense(user: AuthenticatedUser, childId: string, input: CreateExpenseInput) {
    const child = this.requireChildAccess(user, childId, true);
    const now = new Date().toISOString();
    const itemName = input.itemName.trim();
    if (!itemName) {
      throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
    }
    this.assertNotFutureDate(input.spentOn);

    const expense: ExpenseRecord = {
      id: randomUUID(),
      childId,
      householdId: child.householdId,
      categoryId: input.categoryId,
      amountKrw: this.requireMoneyKrw(input.amountKrw),
      spentOn: input.spentOn,
      itemName,
      merchant: this.cleanOptionalText(input.merchant),
      paymentMethod: input.paymentMethod ?? "unknown",
      memo: this.cleanOptionalText(input.memo),
      linkedItemTemplateId: input.linkedItemTemplateId ?? null,
      expenseType: input.expenseType ?? "expense",
      source: input.source ?? "manual",
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    this.expensesById.set(expense.id, expense);
    return this.toExpenseDto(expense);
  }

  listExpenses(user: AuthenticatedUser, childId: string, yearMonth?: string) {
    this.requireChildAccess(user, childId);
    const expenses = this.expensesForChild(childId, yearMonth);
    return {
      expenses: expenses.map((expense) => this.toExpenseDto(expense)),
      totalAmountKrw: this.totalExpenseKrw(expenses)
    };
  }

  getExpense(user: AuthenticatedUser, expenseId: string) {
    return this.toExpenseDto(this.requireExpenseAccess(user, expenseId));
  }

  updateExpense(user: AuthenticatedUser, expenseId: string, input: UpdateExpenseInput) {
    const expense = this.requireExpenseAccess(user, expenseId, true);
    const updated: ExpenseRecord = { ...expense };

    if (input.categoryId !== undefined) updated.categoryId = input.categoryId;
    if (input.amountKrw !== undefined) updated.amountKrw = this.requireMoneyKrw(input.amountKrw);
    if (input.spentOn !== undefined) {
      this.assertNotFutureDate(input.spentOn);
      updated.spentOn = input.spentOn;
    }
    if (input.itemName !== undefined) {
      const itemName = input.itemName.trim();
      if (!itemName) {
        throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
      }
      updated.itemName = itemName;
    }
    if (input.memo !== undefined) updated.memo = this.cleanOptionalText(input.memo ?? undefined);

    updated.updatedAt = new Date().toISOString();
    this.expensesById.set(expenseId, updated);
    return this.toExpenseDto(updated);
  }

  deleteExpense(user: AuthenticatedUser, expenseId: string) {
    const expense = this.requireExpenseAccess(user, expenseId, true);
    const before = this.toExpenseDto(expense);
    const deleted: ExpenseRecord = {
      ...expense,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.expensesById.set(expenseId, deleted);
    return {
      success: true,
      householdId: deleted.householdId,
      before,
      after: { ...before, deletedAt: deleted.deletedAt }
    };
  }

  createImportJob(user: AuthenticatedUser, childId: string, input: CreateImportJobInput = {}) {
    const child = this.requireChildAccess(user, childId, true);
    const fileName = this.requireAcceptedImportFile(input);
    const now = new Date().toISOString();
    const job: ImportJobRecord = {
      id: randomUUID(),
      childId,
      householdId: child.householdId,
      createdByUserId: user.id,
      status: "preview_ready",
      fileName,
      rowCount: 0,
      candidateCount: 0,
      importedCount: 0,
      createdAt: now,
      updatedAt: now
    };
    const rows = this.createStubImportRows(job.id);
    job.rowCount = rows.length;
    job.candidateCount = rows.filter((row) => row.confidence >= 0.7).length;

    this.importJobsById.set(job.id, job);
    this.importRowsByJobId.set(job.id, rows);
    return this.toImportJobDto(job);
  }

  getImportJob(user: AuthenticatedUser, importJobId: string) {
    return this.toImportJobDto(this.requireImportJobAccess(user, importJobId));
  }

  listImportRows(user: AuthenticatedUser, importJobId: string) {
    this.requireImportJobAccess(user, importJobId);
    return {
      rows: (this.importRowsByJobId.get(importJobId) ?? []).map((row) => this.toImportRowDto(row))
    };
  }

  updateImportRow(
    user: AuthenticatedUser,
    importJobId: string,
    rowId: string,
    input: UpdateImportRowInput
  ) {
    const job = this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "preview_ready") {
      throw new BadRequestException({ code: "IMPORT_NOT_EDITABLE", message: "Import preview can no longer be edited." });
    }

    const rows = this.importRowsByJobId.get(importJobId) ?? [];
    const rowIndex = rows.findIndex((row) => row.id === rowId);
    if (rowIndex === -1) {
      throw new NotFoundException({ code: "IMPORT_ROW_NOT_FOUND", message: "Import preview row was not found." });
    }

    const current = rows[rowIndex];
    const updated: ImportRowRecord = {
      ...current,
      categoryId: input.categoryId ?? current.categoryId,
      parsedItemName:
        input.parsedItemName === undefined ? current.parsedItemName : this.cleanOptionalText(input.parsedItemName) ?? undefined,
      parsedAmountKrw: input.parsedAmountKrw ?? current.parsedAmountKrw,
      selected: input.selected ?? current.selected,
      userReviewed: true
    };
    updated.validationStatus = this.validationStatusForImportRow(updated);
    if (updated.validationStatus !== "valid") {
      updated.selected = false;
    }

    rows[rowIndex] = updated;
    this.importRowsByJobId.set(importJobId, rows);
    this.importJobsById.set(importJobId, { ...job, updatedAt: new Date().toISOString() });
    return this.toImportRowDto(updated);
  }

  confirmImport(user: AuthenticatedUser, importJobId: string, input: ConfirmImportInput = {}) {
    const job = this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "preview_ready") {
      throw new BadRequestException({ code: "IMPORT_NOT_CONFIRMABLE", message: "Import job is not ready to confirm." });
    }

    const selectedRowIds = new Set(input.selectedRowIds ?? []);
    const hasExplicitSelection = selectedRowIds.size > 0;
    const rows = this.importRowsByJobId.get(importJobId) ?? [];
    const selectedRows = rows.filter((row) => (hasExplicitSelection ? selectedRowIds.has(row.id) : row.selected));
    const importableRows = selectedRows.filter((row) => this.validationStatusForImportRow(row) === "valid");

    for (const row of importableRows) {
      this.createExpense(user, job.childId, {
        categoryId: row.categoryId!,
        amountKrw: row.parsedAmountKrw!,
        spentOn: row.parsedDate!,
        itemName: row.parsedItemName!,
        paymentMethod: "unknown",
        source: "excel_import"
      });
    }

    const confirmedJob: ImportJobRecord = {
      ...job,
      status: "confirmed",
      importedCount: importableRows.length,
      updatedAt: new Date().toISOString()
    };
    this.importJobsById.set(importJobId, confirmedJob);
    return {
      importedCount: importableRows.length,
      skippedCount: selectedRows.length - importableRows.length
    };
  }

  getHome(user: AuthenticatedUser, childId: string) {
    const child = this.requireChildAccess(user, childId);
    const yearMonth = this.currentYearMonth();
    const budget = this.budgetsByChildMonth.get(this.budgetKey(childId, yearMonth));
    const recentExpenses = this.expensesForChild(childId).slice(0, 3);

    return {
      child: this.toChildDto(child),
      totalExpenseKrw: this.totalExpenseKrw(this.expensesForChild(childId)),
      monthly: this.toBudgetDto(childId, yearMonth, budget?.amountKrw ?? 0),
      recommendedItems: this.recommendedItemsForChild(childId).slice(0, 3),
      recentExpenses: recentExpenses.map((expense) => this.toExpenseDto(expense))
    };
  }

  listItems(user: AuthenticatedUser, childId: string, tab: ItemTab = "now") {
    this.requireChildAccess(user, childId);
    return { items: this.itemsForChild(childId, tab).map((item) => this.toItemSummaryDto(childId, item)) };
  }

  getItemDetail(user: AuthenticatedUser, childId: string, itemTemplateId: string) {
    this.requireChildAccess(user, childId);
    const item = this.requireItemTemplate(itemTemplateId);
    return {
      ...this.toItemSummaryDto(childId, item),
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      productLinks: this.productLinks
        .filter((link) => link.itemTemplateId === item.id && link.active)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((link) => this.toProductLinkDto(link))
    };
  }

  updateItemStatus(
    user: AuthenticatedUser,
    childId: string,
    itemTemplateId: string,
    status: ItemStatus,
    expenseId?: string
  ) {
    this.requireChildAccess(user, childId, true);
    this.requireItemTemplate(itemTemplateId);
    this.setChildItemStatus(user, childId, itemTemplateId, status, expenseId);
    return this.toItemSummaryDto(childId, this.requireItemTemplate(itemTemplateId));
  }

  clickProductLink(
    user: AuthenticatedUser,
    productLinkId: string,
    input: { childId: string; referrerScreenId?: string }
  ) {
    const child = this.requireChildAccess(user, input.childId);
    const productLink = this.productLinks.find((link) => link.id === productLinkId && link.active);
    if (!productLink) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "상품 링크를 찾을 수 없어요." });
    }
    this.requireItemTemplate(productLink.itemTemplateId);

    const click: AffiliateClickEntry = {
      id: randomUUID(),
      userId: user.id,
      householdId: child.householdId,
      childId: input.childId,
      itemTemplateId: productLink.itemTemplateId,
      productLinkId: productLink.id,
      platform: productLink.platform,
      referrerScreenId: input.referrerScreenId,
      clickedAt: new Date().toISOString()
    };
    this.affiliateClicks.push(click);

    return {
      clickId: click.id,
      redirectUrl: productLink.affiliateUrl ?? productLink.url,
      disclosureText: productLink.disclosureText ?? undefined
    };
  }

  getMonthlyReport(user: AuthenticatedUser, childId: string, yearMonth = this.currentYearMonth()) {
    this.requireChildAccess(user, childId);
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const expenses = this.expensesForChild(childId, normalizedMonth);
    const budget = this.budgetsByChildMonth.get(this.budgetKey(childId, normalizedMonth));

    return {
      childId,
      yearMonth: normalizedMonth,
      totalExpenseKrw: this.totalExpenseKrw(expenses),
      budgetAmountKrw: budget?.amountKrw ?? null,
      categoryTop: this.categoryBreakdown(expenses)
    };
  }

  getCumulativeReport(user: AuthenticatedUser, childId: string) {
    this.requireChildAccess(user, childId);
    const expenses = this.expensesForChild(childId).filter((expense) => expense.expenseType === "expense");
    const yearly = new Map<string, { year: string; amountKrw: number; count: number }>();

    for (const expense of expenses) {
      const year = expense.spentOn.slice(0, 4);
      const current = yearly.get(year) ?? { year, amountKrw: 0, count: 0 };
      current.amountKrw += expense.amountKrw;
      current.count += 1;
      yearly.set(year, current);
    }

    return {
      childId,
      totalExpenseKrw: this.totalExpenseKrw(expenses),
      yearly: [...yearly.values()].sort((left, right) => right.year.localeCompare(left.year))
    };
  }

  getCategoryReport(user: AuthenticatedUser, childId: string) {
    this.requireChildAccess(user, childId);
    return {
      childId,
      categories: this.categoryBreakdown(this.expensesForChild(childId))
    };
  }

  adminListItemTemplates() {
    return { items: this.itemTemplates.map((item) => this.toAdminItemDetailDto(item)) };
  }

  adminCreateItemTemplate(input: AdminItemTemplateInput) {
    const item = this.normalizeAdminItemTemplateInput({
      name: input.name,
      categoryId: input.categoryId,
      necessityLevel: input.necessityLevel,
      timingLabel: input.timingLabel,
      priceMinKrw: input.priceMinKrw,
      priceMaxKrw: input.priceMaxKrw,
      reasonText: input.reasonText,
      skipReasonText: input.skipReasonText,
      usedSecondhandOk: input.usedSecondhandOk,
      safetyNote: input.safetyNote,
      stageCodes: input.stageCodes,
      active: input.active
    });
    const record: ItemTemplateRecord = {
      id: randomUUID(),
      code: `admin_${Date.now()}_${this.itemTemplates.length + 1}`,
      name: item.name!,
      necessityLevel: item.necessityLevel!,
      timingLabel: item.timingLabel ?? "",
      priceMinKrw: item.priceMinKrw ?? null,
      priceMaxKrw: item.priceMaxKrw ?? null,
      reasonText: item.reasonText!,
      skipReasonText: item.skipReasonText ?? null,
      usedSecondhandOk: item.usedSecondhandOk ?? false,
      safetyNote: item.safetyNote ?? null,
      displayOrder: this.nextItemDisplayOrder(),
      active: item.active ?? true,
      stageCodes: item.stageCodes ?? (["infant_4_6"] as ChildStageCode[])
    };
    this.itemTemplates.push(record);
    return this.toAdminItemDetailDto(record);
  }

  adminUpdateItemTemplate(itemTemplateId: string, input: AdminItemTemplateInput) {
    const item = this.requireItemTemplateAnyStatus(itemTemplateId);
    const next = this.normalizeAdminItemTemplateInput({
      name: input.name ?? item.name,
      necessityLevel: input.necessityLevel ?? item.necessityLevel,
      timingLabel: input.timingLabel ?? item.timingLabel,
      priceMinKrw: input.priceMinKrw ?? item.priceMinKrw,
      priceMaxKrw: input.priceMaxKrw ?? item.priceMaxKrw,
      reasonText: input.reasonText ?? item.reasonText,
      skipReasonText: input.skipReasonText ?? item.skipReasonText,
      usedSecondhandOk: input.usedSecondhandOk ?? item.usedSecondhandOk,
      safetyNote: input.safetyNote ?? item.safetyNote,
      stageCodes: input.stageCodes ?? item.stageCodes,
      active: input.active ?? item.active
    });
    const updated: ItemTemplateRecord = {
      ...item,
      name: next.name!,
      necessityLevel: next.necessityLevel!,
      timingLabel: next.timingLabel ?? "",
      priceMinKrw: next.priceMinKrw ?? null,
      priceMaxKrw: next.priceMaxKrw ?? null,
      reasonText: next.reasonText!,
      skipReasonText: next.skipReasonText ?? null,
      usedSecondhandOk: next.usedSecondhandOk ?? false,
      safetyNote: next.safetyNote ?? null,
      active: next.active ?? true,
      stageCodes: next.stageCodes ?? item.stageCodes
    };
    const index = this.itemTemplates.findIndex((record) => record.id === itemTemplateId);
    this.itemTemplates[index] = updated;
    return this.toAdminItemDetailDto(updated);
  }

  adminListProductLinks() {
    return { links: this.productLinks.map((link) => this.toAdminProductLinkDto(link)) };
  }

  adminCreateProductLink(input: AdminProductLinkInput) {
    if (!input.itemTemplateId) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template is required." });
    }
    this.requireItemTemplateAnyStatus(input.itemTemplateId);
    if (!input.platform || !input.title?.trim() || !input.url?.trim()) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    const link: ProductLinkRecord = {
      id: randomUUID(),
      itemTemplateId: input.itemTemplateId,
      platform: input.platform,
      title: input.title.trim(),
      url: input.url.trim(),
      affiliateUrl: this.cleanOptionalText(input.affiliateUrl ?? undefined),
      isAffiliate: input.isAffiliate ?? false,
      isSponsored: input.isSponsored ?? false,
      disclosureText: this.cleanOptionalText(input.disclosureText ?? undefined),
      displayOrder: this.nextProductLinkDisplayOrder(input.itemTemplateId),
      active: input.active ?? true
    };
    this.productLinks.push(link);
    return this.toAdminProductLinkDto(link);
  }

  adminUpdateProductLink(productLinkId: string, input: AdminProductLinkInput) {
    const current = this.requireProductLinkAnyStatus(productLinkId);
    const updated: ProductLinkRecord = {
      ...current,
      itemTemplateId: input.itemTemplateId ?? current.itemTemplateId,
      platform: input.platform ?? current.platform,
      title: input.title === undefined ? current.title : input.title.trim(),
      url: input.url === undefined ? current.url : input.url.trim(),
      affiliateUrl: input.affiliateUrl === undefined ? current.affiliateUrl : this.cleanOptionalText(input.affiliateUrl ?? undefined),
      isAffiliate: input.isAffiliate ?? current.isAffiliate,
      isSponsored: input.isSponsored ?? current.isSponsored,
      disclosureText:
        input.disclosureText === undefined ? current.disclosureText : this.cleanOptionalText(input.disclosureText ?? undefined),
      active: input.active ?? current.active
    };
    this.requireItemTemplateAnyStatus(updated.itemTemplateId);
    if (!updated.title || !updated.url) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    const index = this.productLinks.findIndex((link) => link.id === productLinkId);
    this.productLinks[index] = updated;
    return this.toAdminProductLinkDto(updated);
  }

  adminListDisclosures() {
    return { disclosures: [...this.disclosuresByKey.values()] };
  }

  adminUpdateDisclosure(key: string, text: string) {
    const cleanedText = text.trim();
    if (!cleanedText) {
      throw new BadRequestException({ code: "ADMIN_DISCLOSURE_REQUIRED", message: "Disclosure text is required." });
    }
    const disclosure = { key, text: cleanedText };
    this.disclosuresByKey.set(key, disclosure);
    return disclosure;
  }

  adminAffiliateClickSummary() {
    const byPlatform = new Map<string, { platform: string; count: number }>();
    for (const click of this.affiliateClicks) {
      const current = byPlatform.get(click.platform) ?? { platform: click.platform, count: 0 };
      current.count += 1;
      byPlatform.set(click.platform, current);
    }
    return {
      totalClicks: this.affiliateClicks.length,
      byPlatform: [...byPlatform.values()]
    };
  }

  getPrivacySettings(user: AuthenticatedUser) {
    return {
      consents: this.listConsents(user).consents,
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

  previewChildProfileDeletion(user: AuthenticatedUser, childId: string) {
    this.requireChildAccess(user, childId, true);
    return {
      flowId: "child_profile_delete",
      requiresSecondStep: true,
      confirmationText: "DELETE CHILD",
      impact: ["child profile becomes inaccessible", "related expense records are removed from reports"]
    };
  }

  confirmChildProfileDeletion(user: AuthenticatedUser, childId: string, confirmationText: string) {
    this.assertConfirmation(confirmationText, "DELETE CHILD");
    const child = this.requireChildAccess(user, childId, true);
    const now = new Date().toISOString();
    this.childrenById.set(childId, { ...child, deletedAt: now });
    for (const expense of this.expensesForChild(childId)) {
      this.expensesById.set(expense.id, { ...expense, deletedAt: now, updatedAt: now });
    }
    return { success: true, flowId: "child_profile_delete" };
  }

  private childrenForUser(user: AuthenticatedUser) {
    const householdIds = new Set(user.households.map((household) => household.id));
    return [...this.childrenById.values()].filter((child) => !child.deletedAt && householdIds.has(child.householdId));
  }

  private requireChildAccess(user: AuthenticatedUser, childId: string, edit = false) {
    const child = this.childrenById.get(childId);
    if (!child || child.deletedAt) {
      throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "아이 프로필을 찾을 수 없어요." });
    }

    const role = memberRoleFor(user, child.householdId);
    if (!role || (edit && !canEdit(role))) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "아이 프로필 접근 권한이 없어요." });
    }

    return child;
  }

  private requireExpenseAccess(user: AuthenticatedUser, expenseId: string, edit = false) {
    const expense = this.expensesById.get(expenseId);
    if (!expense || expense.deletedAt) {
      throw new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." });
    }

    this.requireChildAccess(user, expense.childId, edit);
    return expense;
  }

  private requireImportJobAccess(user: AuthenticatedUser, importJobId: string, edit = false) {
    const job = this.importJobsById.get(importJobId);
    if (!job) {
      throw new NotFoundException({ code: "IMPORT_JOB_NOT_FOUND", message: "Import job was not found." });
    }

    this.requireChildAccess(user, job.childId, edit);
    return job;
  }

  private requireItemTemplate(itemTemplateId: string) {
    const item = this.itemTemplates.find((template) => template.id === itemTemplateId && template.active);
    if (!item) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "준비템을 찾을 수 없어요." });
    }
    return item;
  }

  private requireItemTemplateAnyStatus(itemTemplateId: string) {
    const item = this.itemTemplates.find((template) => template.id === itemTemplateId);
    if (!item) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "Item template was not found." });
    }
    return item;
  }

  private requireProductLinkAnyStatus(productLinkId: string) {
    const link = this.productLinks.find((record) => record.id === productLinkId);
    if (!link) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "Product link was not found." });
    }
    return link;
  }

  private normalizeChild(input: ChildRecord): ChildRecord {
    if (input.stageMode === "pregnant" && !input.dueDate) {
      throw new BadRequestException({
        code: "CHILD_STAGE_INPUT_REQUIRED",
        message: "출산 예정일을 입력해 주세요."
      });
    }
    if (input.stageMode === "born" && !input.birthDate) {
      throw new BadRequestException({
        code: "CHILD_STAGE_INPUT_REQUIRED",
        message: "아이 생년월일을 입력해 주세요."
      });
    }
    if (input.stageMode === "manual" && !input.manualStage) {
      throw new BadRequestException({
        code: "CHILD_STAGE_INPUT_REQUIRED",
        message: "아이 단계를 선택해 주세요."
      });
    }
    return input;
  }

  private toChildDto(child: ChildRecord) {
    const today = process.env.WOORIAI_STAGE_TODAY;
    const calculated =
      child.stageMode === "pregnant"
        ? calculateChildStage({ stageMode: "pregnant", dueDate: child.dueDate!, today })
        : child.stageMode === "born"
          ? calculateChildStage({ stageMode: "born", birthDate: child.birthDate!, today })
          : calculateChildStage({ stageMode: "manual", manualStage: child.manualStage!, today });

    return {
      id: child.id,
      householdId: child.householdId,
      nickname: child.nickname,
      stageMode: child.stageMode,
      dueDate: child.dueDate ?? null,
      birthDate: child.birthDate ?? null,
      manualStage: child.manualStage ?? null,
      currentStage: calculated.stageCode,
      stageLabel: calculated.stageLabel
    };
  }

  private toExpenseDto(expense: ExpenseRecord) {
    return {
      id: expense.id,
      childId: expense.childId,
      categoryId: expense.categoryId,
      amountKrw: expense.amountKrw,
      spentOn: expense.spentOn,
      itemName: expense.itemName,
      merchant: expense.merchant ?? null,
      memo: expense.memo ?? null,
      expenseType: expense.expenseType,
      source: expense.source
    };
  }

  private toBudgetDto(childId: string, yearMonth: string, amountKrw: number) {
    const usedAmountKrw = this.totalExpenseKrw(this.expensesForChild(childId, yearMonth));
    return {
      childId,
      yearMonth,
      amountKrw,
      usedAmountKrw,
      remainingAmountKrw: amountKrw - usedAmountKrw
    };
  }

  private toItemSummaryDto(childId: string, item: ItemTemplateRecord) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status: this.itemStatusFor(childId, item.id),
      timingLabel: item.timingLabel,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw)
    };
  }

  private toProductLinkDto(link: ProductLinkRecord) {
    return {
      id: link.id,
      platform: link.platform,
      title: link.title,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link)
    };
  }

  private toAdminItemDetailDto(item: ItemTemplateRecord) {
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
      productLinks: this.productLinks
        .filter((link) => link.itemTemplateId === item.id)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((link) => this.toAdminProductLinkDto(link))
    };
  }

  private toAdminProductLinkDto(link: ProductLinkRecord) {
    return {
      id: link.id,
      itemTemplateId: link.itemTemplateId,
      platform: link.platform,
      title: link.title,
      url: link.url,
      affiliateUrl: link.affiliateUrl,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link),
      active: link.active
    };
  }

  private toImportJobDto(job: ImportJobRecord) {
    return {
      id: job.id,
      status: job.status,
      rowCount: job.rowCount,
      candidateCount: job.candidateCount,
      importedCount: job.importedCount
    };
  }

  private toImportRowDto(row: ImportRowRecord) {
    return {
      id: row.id,
      rowIndex: row.rowIndex,
      parsedDate: row.parsedDate,
      parsedItemName: row.parsedItemName,
      parsedAmountKrw: row.parsedAmountKrw,
      categoryId: row.categoryId,
      confidence: row.confidence,
      selected: row.selected,
      validationStatus: row.validationStatus
    };
  }

  private expensesForChild(childId: string, yearMonth?: string) {
    const range = yearMonth ? getSeoulMonthRange(yearMonth) : null;
    return [...this.expensesById.values()]
      .filter((expense) => expense.childId === childId)
      .filter((expense) => !expense.deletedAt)
      .filter(
        (expense) =>
          !range ||
          (expense.spentOn >= range.startInclusive && expense.spentOn < range.endExclusive)
      )
      .sort(
        (left, right) =>
          right.spentOn.localeCompare(left.spentOn) || right.createdAt.localeCompare(left.createdAt)
      );
  }

  private totalExpenseKrw(expenses: ExpenseRecord[]) {
    return expenses
      .filter((expense) => expense.expenseType === "expense")
      .reduce((sum, expense) => sum + expense.amountKrw, 0);
  }

  private categoryBreakdown(expenses: ExpenseRecord[]) {
    const byCategory = new Map<string, { categoryId: string; amountKrw: number; count: number }>();
    for (const expense of expenses.filter((record) => record.expenseType === "expense")) {
      const current = byCategory.get(expense.categoryId) ?? {
        categoryId: expense.categoryId,
        amountKrw: 0,
        count: 0
      };
      current.amountKrw += expense.amountKrw;
      current.count += 1;
      byCategory.set(expense.categoryId, current);
    }
    return [...byCategory.values()].sort((left, right) => right.amountKrw - left.amountKrw);
  }

  private itemsForChild(childId: string, tab: ItemTab) {
    const child = this.childrenById.get(childId);
    if (!child) return [];
    const stageCode = this.toChildDto(child).currentStage as ChildStageCode;
    const activeItems = this.itemTemplates.filter((item) => item.active);

    if (tab === "prepared") {
      return activeItems
        .filter((item) => this.itemStatusFor(childId, item.id) === "prepared")
        .sort((left, right) => left.displayOrder - right.displayOrder);
    }

    if (tab === "not_needed") {
      return activeItems
        .filter((item) => this.itemStatusFor(childId, item.id) === "not_needed")
        .sort((left, right) => left.displayOrder - right.displayOrder);
    }

    const stageMatcher = tab === "now"
      ? (item: ItemTemplateRecord) => item.stageCodes.includes(stageCode)
      : (item: ItemTemplateRecord) => !item.stageCodes.includes(stageCode);

    return this.sortItemsForRecommendation(
      activeItems
        .filter(stageMatcher)
        .filter((item) => {
          const status = this.itemStatusFor(childId, item.id);
          return status === "not_prepared" || status === "interested";
        }),
      childId,
      stageCode
    );
  }

  private recommendedItemsForChild(childId: string) {
    return this.itemsForChild(childId, "now").map((item) => this.toItemSummaryDto(childId, item));
  }

  private sortItemsForRecommendation(items: ItemTemplateRecord[], childId: string, stageCode: ChildStageCode) {
    const sorted = sortRecommendedItems(
      items.map((item) => ({
        id: item.id,
        stageMatches: item.stageCodes.includes(stageCode),
        necessityLevel: item.necessityLevel,
        status: this.itemStatusFor(childId, item.id),
        budgetFits: true,
        userInterest: this.itemStatusFor(childId, item.id) === "interested",
        displayOrder: item.displayOrder
      }))
    );
    const itemById = new Map(items.map((item) => [item.id, item]));
    return sorted
      .map((item) => itemById.get(item.id))
      .filter((item): item is ItemTemplateRecord => Boolean(item))
      .sort((left, right) => {
        const leftScoreIndex = sorted.findIndex((item) => item.id === left.id);
        const rightScoreIndex = sorted.findIndex((item) => item.id === right.id);
        return leftScoreIndex - rightScoreIndex || left.displayOrder - right.displayOrder;
      });
  }

  private itemStatusFor(childId: string, itemTemplateId: string): ItemStatus {
    return this.childItemStatusesByKey.get(this.childItemStatusKey(childId, itemTemplateId))?.status ?? "not_prepared";
  }

  private setChildItemStatus(
    user: AuthenticatedUser,
    childId: string,
    itemTemplateId: string,
    status: ItemStatus,
    expenseId?: string | null
  ) {
    this.childItemStatusesByKey.set(this.childItemStatusKey(childId, itemTemplateId), {
      childId,
      itemTemplateId,
      status,
      expenseId: expenseId ?? null,
      updatedByUserId: user.id,
      updatedAt: new Date().toISOString()
    });
  }

  private childItemStatusKey(childId: string, itemTemplateId: string) {
    return `${childId}:${itemTemplateId}`;
  }

  private itemTemplateIdByCode(code: string) {
    return deterministicUuid(`item-template:${code}`);
  }

  private normalizeAdminItemTemplateInput(input: AdminItemTemplateInput) {
    if (!input.name?.trim() || !input.necessityLevel || !input.reasonText?.trim()) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template fields are required." });
    }
    const skipReasonText = this.cleanOptionalText(input.skipReasonText ?? undefined);
    if (input.necessityLevel !== "essential" && !skipReasonText) {
      throw new BadRequestException({
        code: "ADMIN_SKIP_REASON_REQUIRED",
        message: "Non-essential preparation items need skip guidance."
      });
    }
    return {
      ...input,
      name: input.name.trim(),
      timingLabel: this.cleanOptionalText(input.timingLabel) ?? "",
      reasonText: input.reasonText.trim(),
      skipReasonText,
      safetyNote: this.cleanOptionalText(input.safetyNote ?? undefined),
      stageCodes: input.stageCodes?.length ? input.stageCodes : (["infant_4_6"] as ChildStageCode[])
    };
  }

  private nextItemDisplayOrder() {
    return Math.max(0, ...this.itemTemplates.map((item) => item.displayOrder)) + 10;
  }

  private nextProductLinkDisplayOrder(itemTemplateId: string) {
    return Math.max(
      0,
      ...this.productLinks
        .filter((link) => link.itemTemplateId === itemTemplateId)
        .map((link) => link.displayOrder)
    ) + 10;
  }

  private defaultDisclosureFor(link: ProductLinkRecord) {
    if (link.isSponsored) return this.disclosuresByKey.get("sponsored_product")?.text;
    if (link.isAffiliate) return this.disclosuresByKey.get("affiliate_purchase")?.text;
    return undefined;
  }

  private assertConfirmation(actual: string, expected: string) {
    if (actual !== expected) {
      throw new BadRequestException({
        code: "SETTINGS_CONFIRMATION_REQUIRED",
        message: "Confirmation text does not match."
      });
    }
  }

  private budgetKey(childId: string, yearMonth: string) {
    return `${childId}:${getSeoulMonthRange(yearMonth).yearMonth}`;
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

  private createStubImportRows(importJobId: string) {
    const rows: Array<Omit<ImportRowRecord, "validationStatus">> = [
      {
        id: randomUUID(),
        importJobId,
        rowIndex: 0,
        parsedDate: "2026-07-06",
        parsedItemName: "Imported diapers",
        parsedAmountKrw: 32000,
        categoryId: defaultImportCategoryId,
        confidence: 0.94,
        selected: true,
        userReviewed: false
      },
      {
        id: randomUUID(),
        importJobId,
        rowIndex: 1,
        parsedDate: "2026-07-05",
        parsedItemName: "Imported formula",
        parsedAmountKrw: 33000,
        categoryId: defaultImportCategoryId,
        confidence: 0.86,
        selected: true,
        userReviewed: false
      },
      {
        id: randomUUID(),
        importJobId,
        rowIndex: 2,
        parsedDate: "2026-07-04",
        parsedItemName: "Possible duplicate wipes",
        parsedAmountKrw: 9000,
        categoryId: defaultImportCategoryId,
        confidence: 0.62,
        selected: false,
        userReviewed: false
      }
    ];

    return rows.map((row) => {
      const record: ImportRowRecord = { ...row, validationStatus: "pending" };
      return { ...record, validationStatus: this.validationStatusForImportRow(record) };
    });
  }

  private validationStatusForImportRow(row: ImportRowRecord) {
    if (!row.parsedDate) return "missing_date";
    try {
      this.assertNotFutureDate(row.parsedDate);
    } catch {
      return "invalid_date";
    }

    if (!row.parsedItemName?.trim()) return "missing_item_name";

    try {
      this.requireMoneyKrw(row.parsedAmountKrw);
    } catch {
      return "invalid_amount";
    }

    if (!row.categoryId) return "missing_category";
    if (!row.userReviewed && row.confidence < 0.7) return "low_confidence_duplicate_candidate";
    return "valid";
  }

  private currentYearMonth() {
    return getSeoulMonthRange(process.env.WOORIAI_STAGE_TODAY ?? getSeoulToday()).yearMonth;
  }

  private referenceNow() {
    return process.env.WOORIAI_STAGE_TODAY
      ? new Date(`${process.env.WOORIAI_STAGE_TODAY}T00:00:00+09:00`)
      : new Date();
  }

  private assertNotFutureDate(spentOn: string) {
    try {
      if (isFutureSeoulDate(spentOn, this.referenceNow())) {
        throw new BadRequestException({
          code: "EXPENSE_FUTURE_DATE",
          message: "미래 날짜의 지출은 저장할 수 없어요."
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({ code: "DATE_INVALID", message: "날짜를 다시 확인해 주세요." });
    }
  }

  private requireMoneyKrw(value: unknown) {
    try {
      return assertMoneyKrw(value);
    } catch {
      throw new BadRequestException({
        code: "EXPENSE_AMOUNT_INVALID",
        message: "금액은 0보다 큰 원화 정수만 입력할 수 있어요."
      });
    }
  }

  private cleanOptionalText(value?: string) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}
