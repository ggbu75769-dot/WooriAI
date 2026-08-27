import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { getSeoulMonthRange, isFutureSeoulDate, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";
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
  referenceNow,
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
  stageMode?: ChildStageMode;
  dueDate?: string;
  birthDate?: string;
  manualStage?: ChildStageCode;
};

/**
 * 라운드 45 UX-Y: 삭제/탈퇴 미리보기의 `impact` 문구. 모바일 설정 화면(SET-003
 * PreviewSummary)이 이 배열을 한 줄씩 **그대로** 사용자에게 보여주기 때문에, 영문 원문은
 * 되돌릴 수 없는 결정을 앞둔 화면에서 읽히지 않는 문장으로 남아 있었다. 앱의 다른 문구와 같은
 * 해요체 사실 서술로 통일한다(DNC-018).
 *
 * 계정 삭제/가구 탈퇴 두 줄은 같은 라운드의 UX-AA가 settings.controller.ts의
 * leave-preview·account/delete-preview에 쓴 문장과 **글자까지 같다** — 같은 흐름을 설명하는
 * 두 응답이 서로 다른 문장을 내면 사용자에게는 다른 결과처럼 읽힌다.
 * (계정 삭제가 가구에서 "모두 나가게" 되는 것은 household-runtime.service.ts의 withdrawUser
 * 동작 그대로다. 여기 목록과 아래 아이 삭제 미리보기가 같은 문구를 쓰므로 상수는 한 곳뿐이다.)
 */
const accountDeleteImpact = ["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요"];
const householdLeaveImpact = ["이 가구에 공유된 아이 기록을 볼 수 없어요"];
const childProfileDeleteImpact = ["아이 프로필을 더는 볼 수 없어요", "관련 지출 기록이 리포트에서 제외돼요"];

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
 * R27(L-6): birthDate는 "이미 태어났다"는 사실이라 미래일 수 없다. 지금까지는
 * normalizeChildInput이 존재 여부만 보고 DTO는 `YYYY-MM-DD` 형식만 봤기 때문에,
 * 모바일 UI의 가드(apps/mobile/src/children/child-form.ts — 같은
 * isFutureSeoulDate)를 우회해 API를 직접 호출하면 미래 생년월일로 아이를 만들거나
 * pregnant → born 전환을 할 수 있었다. 그 결과 생후 개월수가 0개월에 고정되고
 * 100일/첫돌 마일스톤 창이 미래에서 시작해(milestone-report.service.ts) 리포트가
 * 사실과 다른 값을 냈다.
 *
 * 기준 시각은 기존 지출 검증(store-shared.assertNotFutureDate)과 같은
 * `referenceNow()` — 서울 기준 오늘이며, 테스트는 WOORIAI_STAGE_TODAY로 고정한다.
 * 서울 기준 "오늘"은 정상 입력이므로 허용한다(오늘 태어난 아이).
 *
 * dueDate에는 적용하지 않는다: 출산 예정일은 미래인 것이 정상이다.
 */
function assertNotFutureBirthDate(birthDate: string) {
  let future: boolean;
  try {
    future = isFutureSeoulDate(birthDate, referenceNow());
  } catch {
    // 형식 검증은 DTO(@Matches(datePattern))의 몫 — 여기서는 raw Error가 500으로
    // 새지 않게만 막고, 형식이 깨진 값은 그대로 통과시켜 기존 동작을 유지한다.
    return;
  }
  if (future) {
    throw new BadRequestException({
      code: "CHILD_BIRTH_DATE_FUTURE",
      message: "출생일은 오늘보다 미래일 수 없어요."
    });
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
    // L-6: 넘어온 birthDate는 stageMode와 무관하게 검사한다 — pregnant/manual로
    // 만들면서 미리 심어둔 미래 birthDate가 나중 전환/마일스톤에서 되살아나면 안 된다.
    if (input.birthDate !== undefined) {
      assertNotFutureBirthDate(input.birthDate);
    }
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

  /**
   * CHILD-127: `stageMode`는 더 이상 완전 불변이 아니다 — 임신 중 가입한 사용자의 아이가
   * 실제로 태어나면 `pregnant → born` 한 방향으로만 전환할 수 있다. 그 전에는 birthDate를
   * 채울 방법 자체가 없어서 100일/첫돌 리포트(MILESTONE_UNAVAILABLE)가 영구히 막히고,
   * 단계 계산·준비템 밴드가 출산예정일에 고정돼 있었다.
   *
   * 규칙:
   * - `born → pregnant`, `manual ↔ *` 등 그 외 모든 전환은 CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED(400).
   *   (같은 값을 그대로 보내는 것은 전환이 아니므로 항상 허용 — 기존 클라이언트 하위호환.)
   * - 전환에는 birthDate가 같은 요청에 반드시 함께 와야 한다. 없으면 기존 생성 경로와 같은
   *   CHILD_STAGE_INPUT_REQUIRED(400)/같은 문구를 쓴다.
   * - dueDate는 지우지 않는다: 컬럼을 그대로 남겨 "예정일 대비 며칠" 같은 회고와 되돌리기 문의에
   *   필요한 원본 입력을 보존한다(전환 후 단계 계산은 birthDate만 본다 — store-shared.toChildDto).
   * 별도의 감사 로그 인프라는 만들지 않는다(audit_logs는 어드민 행위 전용).
   */
  async updateChild(user: AuthenticatedUser, childId: string, input: UpdateChildInput) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
    const definedInput = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as UpdateChildInput;

    const nextStageMode = definedInput.stageMode ?? child.stageMode;
    const isTransition = nextStageMode !== child.stageMode;
    if (isTransition) {
      if (!(child.stageMode === "pregnant" && nextStageMode === "born")) {
        throw new BadRequestException({
          code: "CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED",
          message: "아이 상태는 '임신 중'에서 '태어났어요'로만 바꿀 수 있어요."
        });
      }
      if (!definedInput.birthDate) {
        throw new BadRequestException({
          code: "CHILD_STAGE_INPUT_REQUIRED",
          message: "아이 생년월일을 입력해 주세요."
        });
      }
    }

    normalizeChildInput({
      stageMode: nextStageMode,
      dueDate: definedInput.dueDate ?? (child.dueDate ? fromDateOnly(child.dueDate) : undefined),
      birthDate: definedInput.birthDate ?? (child.birthDate ? fromDateOnly(child.birthDate) : undefined),
      manualStage: definedInput.manualStage ?? child.manualStage ?? undefined
    });

    // L-6: 이번 요청이 실제로 보낸 birthDate만 검사한다(전환 포함). 저장돼 있던 값까지
    // 다시 보면, 이 규칙이 생기기 전에 들어온 미래 birthDate 때문에 닉네임 수정 같은
    // 무관한 PATCH가 영영 막힌다.
    if (definedInput.birthDate !== undefined) {
      assertNotFutureBirthDate(definedInput.birthDate);
    }

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: {
        ...(definedInput.nickname !== undefined ? { nickname: definedInput.nickname } : {}),
        ...(isTransition ? { stageMode: nextStageMode } : {}),
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
   *
   * 라운드 45 UX-Y(P1) — 계약 의미 변경: `updatedCount`는 이제 **실제로 반영된 건수**다.
   * 예전에는 요청에 담긴 고유 id 개수를 그대로 돌려줬기 때문에, 존재하지 않는 id만 보내도
   * (모바일 ONB-003이 데모 픽스처 id를 하드코딩해 실서버로 보내던 버그) 아무것도 반영되지
   * 않은 채 "n건 반영"이라는 허위 성공이 돌아왔다. 바로 다음 화면인 온보딩 이어하기가
   * childItemStatus를 세어 "0개 저장됨"이라고 말하는 것과도 정면으로 어긋났다.
   * 이제 모르는 id를 섞어 보내면 그만큼 작은 수가 돌아온다(전부 모르는 id면 0).
   * 단계 완료 표시(`preparedItemsSetAt`)는 종전대로 0건이어도 남긴다 — "아무것도 준비하지
   * 않았다"도 사용자가 이 단계를 끝냈다는 사실이다.
   */
  async setPreparedItems(user: AuthenticatedUser, childId: string, itemTemplateIds: string[]) {
    await this.childAccess.requireChildAccess(user, childId, true);
    const uniqueItemTemplateIds = [...new Set(itemTemplateIds)];
    const existing = await this.prisma.itemTemplate.findMany({
      where: { id: { in: uniqueItemTemplateIds } },
      select: { id: true }
    });
    const validIds = new Set(existing.map((item) => item.id));
    const appliedItemTemplateIds = uniqueItemTemplateIds.filter((itemTemplateId) => validIds.has(itemTemplateId));

    await this.prisma.$transaction(async (tx) => {
      await tx.child.update({ where: { id: childId }, data: { preparedItemsSetAt: new Date() } });
      for (const itemTemplateId of appliedItemTemplateIds) {
        await tx.childItemStatus.upsert({
          where: { childId_itemTemplateId: { childId, itemTemplateId } },
          update: { status: "prepared", updatedByUserId: user.id },
          create: { childId, itemTemplateId, status: "prepared", updatedByUserId: user.id }
        });
      }
    });

    return { updatedCount: appliedItemTemplateIds.length };
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
          impact: accountDeleteImpact,
          confirmationText: "DELETE ACCOUNT"
        },
        {
          id: "household_leave",
          title: "Leave household",
          impact: householdLeaveImpact,
          confirmationText: "LEAVE HOUSEHOLD"
        },
        {
          id: "child_profile_delete",
          title: "Delete child profile",
          impact: childProfileDeleteImpact,
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
      impact: childProfileDeleteImpact
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
