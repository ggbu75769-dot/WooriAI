import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { predictRecurringPurchase } from "@wooriai/domain";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { AppConfigService } from "../app-config/app-config.service";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ConfirmReceiptDraftDto, CreateReceiptDraftDto, LinkExpensePlanDto, UpdatePredictionPreferenceDto } from "./dto/release5-assisted.dto";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

@Injectable()
export class Release5AssistedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfig: AppConfigService,
    @Inject(OnboardingStoreService) private readonly onboarding: OnboardingStoreService,
    @Inject(AuditLoggerService) private readonly audit: AuditLoggerService
  ) {}

  private async requireFeature(flag: "receipt_assisted_entry" | "expense_plan_link_suggestion" | "recurring_purchase_prediction") {
    if (process.env.NODE_ENV !== "production" && process.env.RELEASE5_INTERNAL_FEATURES === "1") return;
    const current = await this.appConfig.get();
    if (current.source !== "database" || !current.config.featureFlags[flag]) {
      throw new NotFoundException({ code: "FEATURE_DISABLED", message: "This feature is not active." });
    }
  }

  private membership(user: AuthenticatedUser, householdId: string, edit = false) {
    const membership = user.households.find((candidate) => candidate.id === householdId);
    if (!membership || (edit && membership.role !== "owner" && membership.role !== "co_parent")) {
      throw new ForbiddenException({ code: "FINANCIAL_PERMISSION_REQUIRED", message: "Financial owner or co-parent permission is required." });
    }
    if (membership.role === "gift_participant") {
      throw new ForbiddenException({ code: "FINANCIAL_PRIVATE", message: "Household financial data is private." });
    }
    return membership;
  }

  private async child(user: AuthenticatedUser, childId: string, edit = false) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, deletedAt: null }, select: { id: true, householdId: true } });
    if (!child) throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Child not found." });
    this.membership(user, child.householdId, edit);
    return child;
  }

  private receiptDto(draft: {
    id: string; householdId: string; childId: string; contentHash: string; fileName: string; mimeType: string;
    fileSizeBytes: number; status: string; extractionJson: Prisma.JsonValue | null; confirmedExpenseId: string | null; version: number;
  }) {
    return {
      id: draft.id,
      householdId: draft.householdId,
      childId: draft.childId,
      contentHash: draft.contentHash,
      fileName: draft.fileName,
      mimeType: draft.mimeType,
      fileSizeBytes: draft.fileSizeBytes,
      status: draft.status,
      extraction: draft.extractionJson,
      confirmedExpenseId: draft.confirmedExpenseId,
      version: draft.version
    };
  }

  async createReceiptDraft(user: AuthenticatedUser, body: CreateReceiptDraftDto) {
    await this.requireFeature("receipt_assisted_entry");
    const child = await this.child(user, body.childId, true);
    const existing = await this.prisma.receiptDraft.findUnique({ where: { householdId_contentHash: { householdId: child.householdId, contentHash: body.contentHash } } });
    if (existing) {
      if (existing.createdByUserId !== user.id) {
        throw new ConflictException({ code: "RECEIPT_DUPLICATE_IN_HOUSEHOLD", message: "This receipt was already added in the household." });
      }
      return { duplicate: true, draft: this.receiptDto(existing) };
    }

    const fixtureAllowed = process.env.NODE_ENV !== "production" && process.env.RELEASE5_RECEIPT_FIXTURE === "1";
    const fixture = fixtureAllowed ? body.fixtureExtraction : undefined;
    const confidence = fixture?.confidence ?? 0;
    const extraction = fixture ? {
      amountKrw: fixture.amountKrw ?? null,
      spentOn: fixture.spentOn ?? null,
      merchant: fixture.merchant?.trim() || null,
      itemName: fixture.itemName?.trim() || null,
      confidence: { amount: fixture.amountKrw ? confidence : 0, date: fixture.spentOn ? confidence : 0, merchant: fixture.merchant ? confidence : 0 }
    } : null;
    const created = await this.prisma.receiptDraft.create({
      data: {
        householdId: child.householdId,
        childId: child.id,
        createdByUserId: user.id,
        contentHash: body.contentHash,
        fileName: body.fileName,
        mimeType: body.mimeType,
        fileSizeBytes: body.fileSizeBytes,
        status: extraction ? "review_ready" : "extraction_failed",
        extractionProvider: extraction ? "local_fixture" : "unavailable",
        extractionJson: extraction ?? Prisma.JsonNull,
        retentionUntil: new Date(Date.now() + 30 * 86_400_000)
      }
    });
    return { duplicate: false, providerMode: extraction ? "LOCAL_FIXTURE" : "EXTERNAL_BLOCKED", draft: this.receiptDto(created) };
  }

  async getReceiptDraft(user: AuthenticatedUser, draftId: string) {
    await this.requireFeature("receipt_assisted_entry");
    const draft = await this.prisma.receiptDraft.findFirst({ where: { id: draftId, createdByUserId: user.id, deletedAt: null } });
    if (!draft) throw new NotFoundException({ code: "RECEIPT_DRAFT_NOT_FOUND", message: "Receipt draft not found." });
    this.membership(user, draft.householdId, true);
    return this.receiptDto(draft);
  }

  async confirmReceiptDraft(user: AuthenticatedUser, draftId: string, body: ConfirmReceiptDraftDto) {
    await this.requireFeature("receipt_assisted_entry");
    const result = await this.prisma.$transaction(async (tx) => {
      const prior = await tx.receiptConfirmation.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
      if (prior) {
        if (prior.receiptDraftId !== draftId || prior.requestedByUserId !== user.id) {
          throw new ConflictException({ code: "IDEMPOTENCY_KEY_REUSED", message: "The idempotency key belongs to another confirmation." });
        }
        return { expenseId: prior.expenseId, duplicate: true };
      }
      const draft = await tx.receiptDraft.findFirst({ where: { id: draftId, createdByUserId: user.id, deletedAt: null } });
      if (!draft) throw new NotFoundException({ code: "RECEIPT_DRAFT_NOT_FOUND", message: "Receipt draft not found." });
      this.membership(user, draft.householdId, true);
      if (draft.confirmedExpenseId) return { expenseId: draft.confirmedExpenseId, duplicate: true };
      if (draft.version !== body.expectedVersion) {
        throw new ConflictException({ code: "VERSION_CONFLICT", message: "The receipt draft changed. Reload and try again." });
      }
      const expense = await this.onboarding.createExpenseWithTransaction(tx, draft.householdId, draft.childId, user, {
        categoryId: body.categoryId,
        amountKrw: body.amountKrw,
        spentOn: body.spentOn,
        itemName: body.itemName,
        merchant: body.merchant,
        linkedItemDefinitionId: body.linkedItemDefinitionId,
        payerUserId: body.payerUserId,
        source: "receipt"
      });
      const changed = await tx.receiptDraft.updateMany({
        where: { id: draft.id, version: body.expectedVersion, confirmedExpenseId: null, deletedAt: null },
        data: { status: "confirmed", confirmedExpenseId: expense.id, version: { increment: 1 } }
      });
      if (changed.count !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "The receipt draft changed. Reload and try again." });
      await tx.receiptConfirmation.create({ data: { receiptDraftId: draft.id, requestedByUserId: user.id, idempotencyKey: body.idempotencyKey, expenseId: expense.id } });
      return { expenseId: expense.id, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record({ actorUserId: user.id, action: "receipt.confirm", targetType: "receipt_draft", targetId: draftId, after: result });
    return result;
  }

  private async expenseForEditor(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id: expenseId, deletedAt: null } });
    if (!expense) throw new NotFoundException({ code: "EXPENSE_NOT_FOUND", message: "Expense not found." });
    this.membership(user, expense.householdId, true);
    return expense;
  }

  async planLinkSuggestions(user: AuthenticatedUser, expenseId: string) {
    await this.requireFeature("expense_plan_link_suggestion");
    const expense = await this.expenseForEditor(user, expenseId);
    const plans = await this.prisma.userItemPlan.findMany({
      where: { householdId: expense.householdId, OR: [{ childId: expense.childId }, { childId: null }], state: { notIn: ["not_needed", "retired", "ended"] } }
    });
    const definitions = await this.prisma.itemDefinition.findMany({ where: { id: { in: plans.map((plan) => plan.itemDefinitionId) } }, select: { id: true, nameKo: true } });
    const names = new Map(definitions.map((definition) => [definition.id, definition.nameKo]));
    const expenseName = normalize(`${expense.itemName} ${expense.merchant ?? ""}`);
    const suggestions = plans.map((plan) => {
      const name = names.get(plan.itemDefinitionId) ?? "준비 항목";
      const reasonCodes: Array<"canonical_match" | "name_match" | "amount_range" | "date_proximity"> = [];
      let score = 0;
      if (expense.linkedItemDefinitionId === plan.itemDefinitionId) { score += 100; reasonCodes.push("canonical_match"); }
      const normalizedName = normalize(name);
      if (normalizedName && expenseName.includes(normalizedName)) { score += 40; reasonCodes.push("name_match"); }
      if (plan.budgetKrw && Math.abs(expense.amountKrw - plan.budgetKrw) <= Math.max(5_000, plan.budgetKrw * 0.25)) { score += 20; reasonCodes.push("amount_range"); }
      if (plan.dueDate && Math.abs(plan.dueDate.getTime() - expense.spentOn.getTime()) <= 30 * 86_400_000) { score += 10; reasonCodes.push("date_proximity"); }
      return { planId: plan.id, itemDefinitionId: plan.itemDefinitionId, itemName: name, reasonCodes, explanation: reasonCodes.length ? "항목명, 금액 또는 날짜가 이 준비 계획과 가까워요." : "연결 가능한 같은 아이의 준비 계획이에요.", score };
    }).sort((left, right) => right.score - left.score || left.planId.localeCompare(right.planId)).slice(0, 5);
    return { expenseId, suggestions: suggestions.map(({ score: _score, ...suggestion }) => suggestion) };
  }

  async linkExpensePlan(user: AuthenticatedUser, expenseId: string, body: LinkExpensePlanDto) {
    await this.requireFeature("expense_plan_link_suggestion");
    const expense = await this.expenseForEditor(user, expenseId);
    const plan = await this.prisma.userItemPlan.findUnique({ where: { id: body.planId } });
    if (!plan || plan.householdId !== expense.householdId || (plan.childId !== null && plan.childId !== expense.childId)) {
      throw new BadRequestException({ code: "EXPENSE_PLAN_SCOPE_MISMATCH", message: "The plan does not belong to this child and household." });
    }
    if (expense.linkedItemDefinitionId === plan.itemDefinitionId && plan.linkedExpenseId === expense.id) {
      return { expenseId, planId: plan.id, linked: true, version: expense.version, duplicate: true };
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const expenseGate = await tx.expense.updateMany({ where: { id: expense.id, version: body.expectedVersion, deletedAt: null }, data: { linkedItemDefinitionId: plan.itemDefinitionId, version: { increment: 1 } } });
      if (expenseGate.count !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "The expense changed. Reload and try again." });
      const planGate = await tx.userItemPlan.updateMany({ where: { id: plan.id, OR: [{ linkedExpenseId: null }, { linkedExpenseId: expense.id }] }, data: { linkedExpenseId: expense.id, version: { increment: 1 } } });
      if (planGate.count !== 1) throw new ConflictException({ code: "PLAN_ALREADY_LINKED", message: "The plan is linked to another expense." });
      await tx.expensePlanLinkEvent.create({ data: { expenseId: expense.id, planId: plan.id, actorUserId: user.id, action: "linked", reasonCode: body.reasonCode } });
      return tx.expense.findUniqueOrThrow({ where: { id: expense.id }, select: { version: true } });
    });
    return { expenseId, planId: plan.id, linked: true, version: updated.version, duplicate: false };
  }

  async unlinkExpensePlan(user: AuthenticatedUser, expenseId: string, body: LinkExpensePlanDto) {
    await this.requireFeature("expense_plan_link_suggestion");
    const expense = await this.expenseForEditor(user, expenseId);
    const plan = await this.prisma.userItemPlan.findUnique({ where: { id: body.planId } });
    if (!plan || plan.householdId !== expense.householdId || plan.itemDefinitionId !== expense.linkedItemDefinitionId) {
      throw new BadRequestException({ code: "EXPENSE_PLAN_LINK_NOT_FOUND", message: "The expense is not linked to this plan." });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const expenseGate = await tx.expense.updateMany({ where: { id: expense.id, version: body.expectedVersion, linkedItemDefinitionId: plan.itemDefinitionId, deletedAt: null }, data: { linkedItemDefinitionId: null, version: { increment: 1 } } });
      if (expenseGate.count !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "The expense changed. Reload and try again." });
      await tx.userItemPlan.updateMany({ where: { id: plan.id, linkedExpenseId: expense.id }, data: { linkedExpenseId: null, version: { increment: 1 } } });
      await tx.expensePlanLinkEvent.create({ data: { expenseId: expense.id, planId: plan.id, actorUserId: user.id, action: "unlinked", reasonCode: body.reasonCode } });
      return tx.expense.findUniqueOrThrow({ where: { id: expense.id }, select: { version: true } });
    });
    return { expenseId, planId: plan.id, linked: false, version: updated.version };
  }

  async recurringPrediction(user: AuthenticatedUser, planId: string) {
    await this.requireFeature("recurring_purchase_prediction");
    const plan = await this.prisma.userItemPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException({ code: "ITEM_PLAN_NOT_FOUND", message: "Item plan not found." });
    this.membership(user, plan.householdId, true);
    if (!plan.recurringIntervalDays) throw new BadRequestException({ code: "PREDICTION_NOT_APPLICABLE", message: "Prediction is available only for recurring consumables." });
    const expenses = await this.prisma.expense.findMany({
      where: { householdId: plan.householdId, childId: plan.childId ?? undefined, linkedItemDefinitionId: plan.itemDefinitionId, expenseType: "expense", deletedAt: null },
      select: { spentOn: true }, orderBy: { spentOn: "asc" }
    });
    const prediction = predictRecurringPurchase({ purchaseDates: expenses.map((expense) => dateOnly(expense.spentOn)), enabled: plan.predictionEnabled });
    return {
      planId,
      confirmedDueDate: plan.nextPurchaseDueAt ? dateOnly(plan.nextPurchaseDueAt) : null,
      prediction,
      predictionEnabled: plan.predictionEnabled,
      minimumPurchaseCount: 3,
      historyCount: new Set(expenses.map((expense) => dateOnly(expense.spentOn))).size,
      unavailableReason: prediction ? null : plan.predictionEnabled ? "At least three reliable purchases are required." : "Prediction is disabled."
    };
  }

  async updatePredictionPreference(user: AuthenticatedUser, planId: string, body: UpdatePredictionPreferenceDto) {
    await this.requireFeature("recurring_purchase_prediction");
    const plan = await this.prisma.userItemPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException({ code: "ITEM_PLAN_NOT_FOUND", message: "Item plan not found." });
    this.membership(user, plan.householdId, true);
    const changed = await this.prisma.userItemPlan.updateMany({ where: { id: plan.id, version: body.expectedVersion }, data: { predictionEnabled: body.enabled, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "The item plan changed. Reload and try again." });
    return this.recurringPrediction(user, planId);
  }
}
