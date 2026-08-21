import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { getSeoulMonthRange, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { ChildAccessService } from "./child-access.service";
import { ExpensesStoreService } from "./expenses-store.service";
import {
  buildBudgetDto,
  canEdit,
  currentYearMonth,
  fromDateOnly,
  memberRoleFor,
  requireMoneyKrw,
  toChildDto,
  toDateOnly,
  type ChildDto
} from "./store-shared";

type ConsentDefinition = {
  type: string;
  version: string;
  required: boolean;
  title: string;
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

const consentDefinitions: ConsentDefinition[] = [
  { type: "terms", version: "2026-07-06", required: true, title: "서비스 이용약관" },
  { type: "privacy", version: "2026-07-06", required: true, title: "개인정보 처리 동의" },
  { type: "marketing", version: "2026-07-06", required: false, title: "소식 알림 동의" }
];

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
 * REF-118: onboarding lifecycle core split out of the former
 * onboarding-store.service.ts god service — consents, onboarding progress
 * status, child profile CRUD + prepared-items step, monthly budgets, and the
 * privacy settings/child-deletion flows (all writes to the same
 * consent/child/budget resources). Public HTTP contract, error codes and
 * response shapes are unchanged.
 */
@Injectable()
export class OnboardingCoreService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService,
    @Inject(ExpensesStoreService) private readonly expensesStore: ExpensesStoreService
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
   *
   * R19-C(F1) 다자녀: `childId`를 주면 그 아이 기준으로 요약/완료 판정을 만든다. 예전에는 항상
   * `children[0]`(첫째)만 봤기 때문에 둘째만 예산/준비템을 끝낸 계정이 영원히 미완료로 보였고,
   * 모바일의 selectedChildId 복구가 둘째 사용자를 말없이 첫째로 되돌렸다. 파라미터를 생략하면
   * 기존 그대로 첫째를 쓰므로 기존 클라이언트와 하위호환된다.
   */
  async onboardingStatus(user: AuthenticatedUser, childId?: string) {
    const consentsAccepted = await this.hasRequiredConsents(user);
    if (!consentsAccepted) {
      return this.onboardingStatusResult("consents", true, {
        consentsAccepted: false,
        child: null,
        preparedItemsCount: null,
        budget: null
      });
    }

    // 지정된 아이는 requireChildAccess로 확인한다 — 없는/삭제된 아이는 CHILD_NOT_FOUND(404),
    // 남의 가구 아이는 FORBIDDEN(403)으로, 다른 아이 스코프 엔드포인트와 동일한 의미를 유지.
    const selectedChild = childId
      ? await this.childAccess.requireChildAccess(user, childId)
      : (await this.childAccess.childrenForUser(user))[0];
    if (!selectedChild) {
      return this.onboardingStatusResult("child-profile", true, {
        consentsAccepted: true,
        child: null,
        preparedItemsCount: null,
        budget: null
      });
    }

    const childSummary = toChildDto(selectedChild);
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
      child: ChildDto | null;
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
    return toChildDto(created);
  }

  async listChildren(user: AuthenticatedUser) {
    const children = await this.childAccess.childrenForUser(user);
    return { children: children.map((child) => toChildDto(child)) };
  }

  async getChild(user: AuthenticatedUser, childId: string) {
    return toChildDto(await this.childAccess.requireChildAccess(user, childId));
  }

  async updateChild(user: AuthenticatedUser, childId: string, input: UpdateChildInput) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
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
    return toChildDto(updated);
  }

  /**
   * Transactional: marks the child's onboarding "prepared items" step complete
   * (`preparedItemsSetAt`) and upserts a `child_item_statuses` row for every
   * submitted id that resolves to a real, existing item template — both in the
   * same transaction, so a crash partway through can never record the step as done
   * without its status rows (or vice versa).
   */
  async setPreparedItems(user: AuthenticatedUser, childId: string, itemTemplateIds: string[]) {
    await this.childAccess.requireChildAccess(user, childId, true);
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

  async getBudget(user: AuthenticatedUser, childId: string, yearMonth = currentYearMonth()) {
    await this.childAccess.requireChildAccess(user, childId);
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
    await this.childAccess.requireChildAccess(user, childId, true);
    // REP-105: yearMonth arrives DTO-normalized to `YYYY-MM-01` (inputs accept
    // `YYYY-MM` or `YYYY-MM-01`; see common/validation/year-month.ts), and
    // getSeoulMonthRange itself truncates any date to its month, so this
    // normalization point — shared by getBudget/getMonthlyReport — is
    // tolerant of both forms. Responses keep the first-of-month form.
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const amount = requireMoneyKrw(amountKrw);
    const budget = await this.prisma.budget.upsert({
      where: { childId_yearMonth: { childId, yearMonth: toDateOnly(normalizedMonth) } },
      update: { amountKrw: amount },
      create: { childId, yearMonth: toDateOnly(normalizedMonth), amountKrw: amount, createdByUserId: user.id }
    });
    return this.toBudgetDto(childId, normalizedMonth, budget.amountKrw);
  }

  private async toBudgetDto(childId: string, yearMonth: string, amountKrw: number) {
    const range = getSeoulMonthRange(yearMonth);
    const usedAmountKrw = await this.expensesStore.sumExpenses(childId, range);
    return buildBudgetDto(childId, yearMonth, amountKrw, usedAmountKrw);
  }

  // ---------------------------------------------------------------------------
  // privacy settings / deletion flows
  // ---------------------------------------------------------------------------

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
    await this.childAccess.requireChildAccess(user, childId, true);
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
    const child = await this.childAccess.requireChildAccess(user, childId, true);
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

  private assertConfirmation(actual: string, expected: string) {
    if (actual !== expected) {
      throw new BadRequestException({ code: "SETTINGS_CONFIRMATION_REQUIRED", message: "Confirmation text does not match." });
    }
  }
}
