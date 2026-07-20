import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type CustomPreparationBundle } from "@prisma/client";
import { buildPreparationCalendarEvents, kstWeekStart, selectTodayActions, type TodayActionCandidate } from "@wooriai/domain";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import { AppConfigService } from "../app-config/app-config.service";
import type { ApplyCustomBundleDto, BundleVersionDto, CalendarQueryDto, CreateCustomBundleDto, TodayPreferenceDto, UpdateCustomBundleDto } from "./dto/release5-daily.dto";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

@Injectable()
export class Release5DailyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfig: AppConfigService
  ) {}

  async featureEnabled(flag: "today_family_center" | "preparation_calendar" | "custom_bundles" | "weekly_briefing") {
    if (process.env.NODE_ENV !== "production" && process.env.RELEASE5_INTERNAL_FEATURES === "1") return true;
    const current = await this.appConfig.get();
    return current.source === "database" && current.config.featureFlags[flag];
  }

  private async requireFeature(flag: "today_family_center" | "preparation_calendar" | "custom_bundles" | "weekly_briefing") {
    if (!await this.featureEnabled(flag)) throw new NotFoundException({ code: "FEATURE_DISABLED", message: "This feature is not active." });
  }

  private membership(user: AuthenticatedUser, householdId: string) {
    const membership = user.households.find((household) => household.id === householdId);
    if (!membership) throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "Household access is required." });
    return membership;
  }

  private editor(user: AuthenticatedUser, householdId: string) {
    const membership = this.membership(user, householdId);
    if (membership.role !== "owner" && membership.role !== "co_parent") {
      throw new ForbiddenException({ code: "HOUSEHOLD_EDITOR_REQUIRED", message: "Owner or co-parent permission is required." });
    }
    return membership;
  }

  private async child(user: AuthenticatedUser, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, deletedAt: null }, select: { id: true, householdId: true } });
    if (!child) throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Child not found." });
    this.membership(user, child.householdId);
    return child;
  }

  private async referenceDate(input?: string) {
    if (input) return input;
    const rows = await this.prisma.$queryRaw<Array<{ today: Date }>>`SELECT (clock_timestamp() AT TIME ZONE 'Asia/Seoul')::date AS today`;
    return dateOnly(rows[0]!.today);
  }

  async todayCenter(user: AuthenticatedUser, childId: string, requestedReferenceDate?: string) {
    await this.requireFeature("today_family_center");
    const child = await this.child(user, childId);
    const membership = this.membership(user, child.householdId);
    const referenceDate = await this.referenceDate(requestedReferenceDate);
    const weekEnd = addDays(referenceDate, 7);
    const plans = await this.prisma.userItemPlan.findMany({
      where: { householdId: child.householdId, childId, state: { notIn: ["not_considered", "not_needed", "retired", "ended"] } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }]
    });
    const [alerts, preferences, definitions] = await Promise.all([
      this.prisma.catalogSafetyAlert.findMany({ where: { userItemPlanId: { in: plans.map((plan) => plan.id) }, acknowledgedAt: null }, orderBy: { createdAt: "asc" } }),
      this.prisma.todayActionPreference.findMany({ where: { userId: user.id, householdId: child.householdId, OR: [{ childId }, { childId: null }] } }),
      this.prisma.itemDefinition.findMany({ where: { id: { in: [...new Set(plans.map((plan) => plan.itemDefinitionId))] } }, select: { id: true, nameKo: true } })
    ]);
    const names = new Map(definitions.map((definition) => [definition.id, definition.nameKo]));
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const candidates: TodayActionCandidate[] = [];
    for (const alert of alerts) {
      const plan = planById.get(alert.userItemPlanId);
      if (!plan) continue;
      candidates.push({ actionKey: `safety:${alert.id}`, kind: "safety_acknowledgement", sourceId: plan.itemDefinitionId, childId, dueDate: null, assignedUserId: plan.assignedUserId, safetyBlocking: true });
    }
    for (const plan of plans) {
      if (membership.role === "gift_participant" && plan.state !== "gift_expected") continue;
      const due = plan.dueDate ? dateOnly(plan.dueDate) : null;
      if (due && due < referenceDate) candidates.push({ actionKey: `plan:${plan.id}:overdue`, kind: "overdue_assigned", sourceId: plan.itemDefinitionId, childId, dueDate: due, assignedUserId: plan.assignedUserId });
      else if (due && due <= weekEnd) candidates.push({ actionKey: `plan:${plan.id}:due`, kind: "due_this_week", sourceId: plan.itemDefinitionId, childId, dueDate: due, assignedUserId: plan.assignedUserId });
      const replacement = plan.replacementDueAt ? dateOnly(plan.replacementDueAt) : null;
      if (replacement && replacement <= weekEnd) candidates.push({ actionKey: `plan:${plan.id}:replacement`, kind: "replacement_due", sourceId: plan.itemDefinitionId, childId, dueDate: replacement, assignedUserId: plan.assignedUserId });
      const recurring = plan.nextPurchaseDueAt ? dateOnly(plan.nextPurchaseDueAt) : null;
      if (recurring && recurring <= weekEnd) candidates.push({ actionKey: `plan:${plan.id}:recurring`, kind: "recurring_due", sourceId: plan.itemDefinitionId, childId, dueDate: recurring, assignedUserId: plan.assignedUserId });
      if (plan.budgetKrw && !plan.assignedUserId) candidates.push({ actionKey: `plan:${plan.id}:unassigned-cost`, kind: "planned_cost_unassigned", sourceId: plan.itemDefinitionId, childId, dueDate: due, assignedUserId: null, financial: true });
    }
    const selected = selectTodayActions({
      referenceDate,
      currentUserId: user.id,
      canViewFinancial: membership.role !== "gift_participant",
      candidates,
      preferences: preferences.map((preference) => ({ actionKey: preference.actionKey, mode: preference.mode as "snooze" | "hide_lifecycle", snoozedUntil: preference.snoozedUntil ? dateOnly(preference.snoozedUntil) : null }))
    });
    return {
      generatedAt: new Date().toISOString(),
      referenceDate,
      source: "database" as const,
      actions: selected.map((action) => ({
        ...action,
        reasonCode: action.kind,
        reasonParams: { itemName: names.get(action.sourceId) ?? "준비 항목", dueDate: action.dueDate },
        navigation: action.kind === "safety_acknowledgement"
          ? { kind: "notifications" as const }
          : { kind: "item" as const, itemId: action.sourceId, childId }
      }))
    };
  }

  async updateTodayPreference(user: AuthenticatedUser, input: TodayPreferenceDto) {
    await this.requireFeature("today_family_center");
    this.membership(user, input.householdId);
    if (input.actionKey.startsWith("safety:")) throw new BadRequestException({ code: "SAFETY_ACTION_NOT_SNOOZABLE", message: "Safety acknowledgement cannot be hidden or snoozed." });
    const scopeKey = input.childId ?? "household";
    const existing = await this.prisma.todayActionPreference.findUnique({
      where: { userId_householdId_scopeKey_actionKey: { userId: user.id, householdId: input.householdId, scopeKey, actionKey: input.actionKey } }
    });
    if (existing && input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
      throw new ConflictException({ code: "TODAY_PREFERENCE_CONFLICT", message: "Today preference changed on another device." });
    }
    if (input.mode === "snooze" && !input.snoozedUntil) throw new BadRequestException({ code: "SNOOZE_DATE_REQUIRED", message: "A snooze date is required." });
    return this.prisma.todayActionPreference.upsert({
      where: { userId_householdId_scopeKey_actionKey: { userId: user.id, householdId: input.householdId, scopeKey, actionKey: input.actionKey } },
      create: { userId: user.id, householdId: input.householdId, childId: input.childId, scopeKey, actionKey: input.actionKey, mode: input.mode, snoozedUntil: input.snoozedUntil ? parseDate(input.snoozedUntil) : null, lifecycleCode: input.lifecycleCode },
      update: { mode: input.mode, snoozedUntil: input.snoozedUntil ? parseDate(input.snoozedUntil) : null, lifecycleCode: input.lifecycleCode, version: { increment: 1 } }
    });
  }

  async calendar(user: AuthenticatedUser, householdId: string, query: CalendarQueryDto) {
    await this.requireFeature("preparation_calendar");
    const membership = this.membership(user, householdId);
    if (membership.role === "gift_participant") throw new ForbiddenException({ code: "CALENDAR_PRIVATE", message: "Preparation calendar is unavailable to gift participants." });
    if (query.childId) {
      const child = await this.child(user, query.childId);
      if (child.householdId !== householdId) throw new ForbiddenException({ code: "CHILD_SCOPE_MISMATCH", message: "Child does not belong to this household." });
    }
    const plans = await this.prisma.userItemPlan.findMany({
      where: { householdId, ...(query.childId ? { childId: query.childId } : {}), ...(query.assigneeUserId ? { assignedUserId: query.assigneeUserId } : {}) },
      orderBy: { id: "asc" }
    });
    const definitions = await this.prisma.itemDefinition.findMany({ where: { id: { in: [...new Set(plans.map((plan) => plan.itemDefinitionId))] } }, select: { id: true, nameKo: true } });
    const names = new Map(definitions.map((definition) => [definition.id, definition.nameKo]));
    const referenceDate = await this.referenceDate();
    const events = buildPreparationCalendarEvents(plans.map((plan) => ({
      planId: plan.id,
      itemDefinitionId: plan.itemDefinitionId,
      childId: plan.childId,
      assignedUserId: plan.assignedUserId,
      dueDate: plan.dueDate ? dateOnly(plan.dueDate) : null,
      replacementDueAt: plan.replacementDueAt ? dateOnly(plan.replacementDueAt) : null,
      nextPurchaseDueAt: plan.nextPurchaseDueAt ? dateOnly(plan.nextPurchaseDueAt) : null,
      state: plan.state
    }))).filter((event) => event.date.startsWith(query.month) && (!query.eventTypes || query.eventTypes.includes(event.type)));
    return { month: query.month, timezone: "Asia/Seoul" as const, events: events.map((event) => ({ ...event, itemName: names.get(event.itemDefinitionId) ?? "준비 항목", status: event.date < referenceDate ? "overdue" as const : event.date === referenceDate ? "today" as const : "upcoming" as const })) };
  }

  async listBundles(user: AuthenticatedUser, householdId: string) {
    await this.requireFeature("custom_bundles");
    const membership = this.membership(user, householdId);
    if (membership.role === "gift_participant") throw new ForbiddenException({ code: "CUSTOM_BUNDLE_PRIVATE", message: "Custom bundles are unavailable to gift participants." });
    const bundles = await this.prisma.customPreparationBundle.findMany({ where: { householdId, archivedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
    return { bundles: await this.bundleContracts(bundles) };
  }

  private async bundleContracts(bundles: CustomPreparationBundle[]) {
    if (bundles.length === 0) return [];
    const items = await this.prisma.customPreparationBundleItem.findMany({
      where: { bundleId: { in: bundles.map((bundle) => bundle.id) } },
      orderBy: [{ bundleId: "asc" }, { displayOrder: "asc" }, { id: "asc" }]
    });
    const definitions = await this.prisma.itemDefinition.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.itemDefinitionId))] } },
      select: { id: true, nameKo: true }
    });
    const names = new Map(definitions.map((definition) => [definition.id, definition.nameKo]));
    const itemsByBundle = new Map<string, typeof items>();
    for (const item of items) {
      const group = itemsByBundle.get(item.bundleId) ?? [];
      group.push(item);
      itemsByBundle.set(item.bundleId, group);
    }
    return bundles.map((bundle) => ({
      ...bundle,
      archivedAt: bundle.archivedAt?.toISOString() ?? null,
      items: (itemsByBundle.get(bundle.id) ?? []).map((item) => ({
        itemDefinitionId: item.itemDefinitionId,
        itemName: names.get(item.itemDefinitionId) ?? "준비 항목",
        defaultQuantity: item.defaultQuantity,
        displayOrder: item.displayOrder
      }))
    }));
  }

  private async bundleContract(bundleId: string) {
    const [bundle, items] = await Promise.all([
      this.prisma.customPreparationBundle.findUniqueOrThrow({ where: { id: bundleId } }),
      this.prisma.customPreparationBundleItem.findMany({ where: { bundleId }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] })
    ]);
    const definitions = await this.prisma.itemDefinition.findMany({ where: { id: { in: items.map((item) => item.itemDefinitionId) } }, select: { id: true, nameKo: true } });
    const names = new Map(definitions.map((definition) => [definition.id, definition.nameKo]));
    return { ...bundle, archivedAt: bundle.archivedAt?.toISOString() ?? null, items: items.map((item) => ({ itemDefinitionId: item.itemDefinitionId, itemName: names.get(item.itemDefinitionId) ?? "준비 항목", defaultQuantity: item.defaultQuantity, displayOrder: item.displayOrder })) };
  }

  private async validateBundleItems(items: CreateCustomBundleDto["items"]) {
    const ids = items.map((item) => item.itemDefinitionId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException({ code: "CUSTOM_BUNDLE_DUPLICATE_ITEM", message: "A custom bundle cannot contain the same canonical item twice." });
    const found = await this.prisma.itemDefinition.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException({ code: "CUSTOM_BUNDLE_ITEM_NOT_FOUND", message: "Every bundle item must be a canonical catalog item." });
  }

  async createBundle(user: AuthenticatedUser, householdId: string, input: CreateCustomBundleDto) {
    await this.requireFeature("custom_bundles");
    this.editor(user, householdId);
    await this.validateBundleItems(input.items);
    const bundle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customPreparationBundle.create({ data: { householdId, createdByUserId: user.id, title: input.title.trim(), scopeType: input.scopeType } });
      if (input.items.length) await tx.customPreparationBundleItem.createMany({ data: input.items.map((item, index) => ({ bundleId: created.id, itemDefinitionId: item.itemDefinitionId, defaultQuantity: item.defaultQuantity, displayOrder: index })) });
      return created;
    });
    return this.bundleContract(bundle.id);
  }

  async updateBundle(user: AuthenticatedUser, householdId: string, bundleId: string, input: UpdateCustomBundleDto) {
    await this.requireFeature("custom_bundles");
    this.editor(user, householdId);
    await this.validateBundleItems(input.items);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.customPreparationBundle.updateMany({ where: { id: bundleId, householdId, version: input.expectedVersion, archivedAt: null }, data: { title: input.title.trim(), scopeType: input.scopeType, version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException({ code: "CUSTOM_BUNDLE_CONFLICT", message: "Custom bundle changed or was archived." });
      await tx.customPreparationBundleItem.deleteMany({ where: { bundleId } });
      if (input.items.length) await tx.customPreparationBundleItem.createMany({ data: input.items.map((item, index) => ({ bundleId, itemDefinitionId: item.itemDefinitionId, defaultQuantity: item.defaultQuantity, displayOrder: index })) });
    });
    return this.bundleContract(bundleId);
  }

  async archiveBundle(user: AuthenticatedUser, householdId: string, bundleId: string, input: BundleVersionDto) {
    await this.requireFeature("custom_bundles");
    this.editor(user, householdId);
    const changed = await this.prisma.customPreparationBundle.updateMany({ where: { id: bundleId, householdId, version: input.expectedVersion, archivedAt: null }, data: { archivedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictException({ code: "CUSTOM_BUNDLE_CONFLICT", message: "Custom bundle changed or was archived." });
    return { success: true };
  }

  private async bundlePreview(user: AuthenticatedUser, householdId: string, bundleId: string, input: ApplyCustomBundleDto) {
    await this.requireFeature("custom_bundles");
    this.editor(user, householdId);
    const child = await this.child(user, input.childId);
    if (child.householdId !== householdId) throw new ForbiddenException({ code: "CHILD_SCOPE_MISMATCH", message: "Child does not belong to this household." });
    const bundle = await this.prisma.customPreparationBundle.findFirst({ where: { id: bundleId, householdId, archivedAt: null } });
    if (!bundle) throw new NotFoundException({ code: "CUSTOM_BUNDLE_NOT_FOUND", message: "Custom bundle not found." });
    if (bundle.version !== input.expectedVersion) throw new ConflictException({ code: "CUSTOM_BUNDLE_CONFLICT", message: "Custom bundle changed before apply." });
    const items = await this.prisma.customPreparationBundleItem.findMany({ where: { bundleId }, orderBy: { displayOrder: "asc" } });
    const existing = await this.prisma.userItemPlan.findMany({ where: { householdId, childId: child.id, itemDefinitionId: { in: items.map((item) => item.itemDefinitionId) } }, select: { itemDefinitionId: true } });
    const existingIds = new Set(existing.map((plan) => plan.itemDefinitionId));
    return { bundle, child, items, result: { create: items.filter((item) => !existingIds.has(item.itemDefinitionId)).map((item) => item.itemDefinitionId), existing: items.filter((item) => existingIds.has(item.itemDefinitionId)).map((item) => item.itemDefinitionId), duplicate: [] as string[] } };
  }

  async previewBundle(user: AuthenticatedUser, householdId: string, bundleId: string, input: ApplyCustomBundleDto) {
    const preview = await this.bundlePreview(user, householdId, bundleId, input);
    return preview.result;
  }

  async applyBundle(user: AuthenticatedUser, householdId: string, bundleId: string, input: ApplyCustomBundleDto) {
    const replay = await this.prisma.customBundleApplication.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.requestedByUserId !== user.id || replay.householdId !== householdId || replay.bundleId !== bundleId || replay.childId !== input.childId) {
        throw new ConflictException({ code: "IDEMPOTENCY_KEY_REUSED", message: "Idempotency key belongs to a different request." });
      }
      return replay.resultJson;
    }
    const preview = await this.bundlePreview(user, householdId, bundleId, input);
    return this.prisma.$transaction(async (tx) => {
      const existingReplay = await tx.customBundleApplication.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existingReplay) return existingReplay.resultJson;
      const current = await tx.customPreparationBundle.findFirst({ where: { id: bundleId, householdId, version: input.expectedVersion, archivedAt: null } });
      if (!current) throw new ConflictException({ code: "CUSTOM_BUNDLE_CONFLICT", message: "Custom bundle changed before apply." });
      if (preview.result.create.length) await tx.userItemPlan.createMany({ data: preview.items.filter((item) => preview.result.create.includes(item.itemDefinitionId)).map((item) => ({ householdId, childId: input.childId, itemDefinitionId: item.itemDefinitionId, state: "planned", desiredQuantity: item.defaultQuantity })) , skipDuplicates: true });
      const result = { ...preview.result, createdCount: preview.result.create.length, existingCount: preview.result.existing.length };
      await tx.customBundleApplication.create({ data: { bundleId, householdId, childId: input.childId, requestedByUserId: user.id, idempotencyKey: input.idempotencyKey, resultJson: result } });
      await tx.auditLog.create({ data: { actorUserId: user.id, householdId, action: "custom_bundle.apply", targetType: "custom_preparation_bundle", targetId: bundleId, afterJson: result } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async weeklyBriefing(user: AuthenticatedUser, householdId: string, requestedReferenceDate?: string) {
    await this.requireFeature("weekly_briefing");
    const membership = this.membership(user, householdId);
    const referenceDate = await this.referenceDate(requestedReferenceDate);
    const weekStart = kstWeekStart(referenceDate);
    const nextWeek = addDays(weekStart, 7);
    const weekAfter = addDays(weekStart, 14);
    const plans = await this.prisma.userItemPlan.findMany({ where: { householdId, state: { notIn: ["not_considered", "not_needed", "retired", "ended"] } } });
    const [expenses, alerts] = await Promise.all([
      membership.role === "gift_participant" ? [] : this.prisma.expense.findMany({ where: { householdId, deletedAt: null, spentOn: { gte: parseDate(weekStart), lt: parseDate(nextWeek) } } }),
      this.prisma.catalogSafetyAlert.findMany({ where: { userItemPlanId: { in: plans.map((plan) => plan.id) }, acknowledgedAt: null }, select: { itemDefinitionId: true, reason: true } })
    ]);
    const visiblePlans = membership.role === "gift_participant" ? plans.filter((plan) => plan.state === "gift_expected") : plans;
    const payload = {
      safety: alerts.map((alert) => ({ itemId: alert.itemDefinitionId, reason: alert.reason })),
      completed: visiblePlans.filter((plan) => ["owned", "gifted", "borrowed", "rented"].includes(plan.state)).length,
      dueNextWeek: visiblePlans.filter((plan) => plan.dueDate && dateOnly(plan.dueDate) >= nextWeek && dateOnly(plan.dueDate) < weekAfter).length,
      unassigned: visiblePlans.filter((plan) => !plan.assignedUserId).length,
      financial: membership.role === "gift_participant" ? null : {
        plannedKrw: visiblePlans.filter((plan) => plan.dueDate && dateOnly(plan.dueDate) >= weekStart && dateOnly(plan.dueDate) < nextWeek).reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
        actualKrw: expenses.reduce((sum, expense) => sum + (expense.expenseType === "refund" || expense.expenseType === "support" ? -expense.amountKrw : expense.expenseType === "gift" ? 0 : expense.amountKrw), 0)
      }
    };
    const sourceHash = hash(payload);
    const briefing = await this.prisma.weeklyBriefing.upsert({
      where: { userId_householdId_weekStart: { userId: user.id, householdId, weekStart: parseDate(weekStart) } },
      create: { userId: user.id, householdId, weekStart: parseDate(weekStart), payloadJson: payload, sourceHash },
      update: { payloadJson: payload, sourceHash, generatedAt: new Date() }
    });
    return { id: briefing.id, householdId, weekStart, generatedAt: briefing.generatedAt.toISOString(), sourceHash, sections: payload };
  }

  async markBriefingRead(user: AuthenticatedUser, householdId: string, briefingId: string) {
    await this.requireFeature("weekly_briefing");
    this.membership(user, householdId);
    const changed = await this.prisma.weeklyBriefing.updateMany({ where: { id: briefingId, userId: user.id, householdId }, data: { readAt: new Date() } });
    if (changed.count !== 1) throw new NotFoundException({ code: "WEEKLY_BRIEFING_NOT_FOUND", message: "Weekly briefing not found." });
    return { success: true };
  }
}
