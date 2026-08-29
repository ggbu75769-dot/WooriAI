import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  calculateChildStage,
  getSeoulMonthRange,
  getSeoulToday,
  isBeforeEntryDateFloor,
  isFutureSeoulDate,
  ENTRY_DATE_MAX_PAST_YEARS,
  type ChildStageCode,
  type ChildStageMode
} from "@wooriai/domain";
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
 * leave-preview·account/delete-preview에 쓴 문장과 **같은 한 벌에서 출발한다** — 같은 흐름을
 * 설명하는 두 응답이 다른 이야기를 하면 사용자에게는 다른 결과처럼 읽힌다.
 * (계정 삭제가 가구에서 "모두 나가게" 되는 것은 household-runtime.service.ts의 withdrawUser
 * 동작 그대로다. 여기 목록과 아래 아이 삭제 미리보기가 같은 문구를 쓰므로 상수는 한 곳뿐이다.)
 *
 * ⚠️ 라운드 70 리뷰(M-3) — **두 응답은 이제 글자까지 같지는 않다.** 라운드 70 D(GAP-070 D)가
 * settings.controller.ts의 두 미리보기를 **요청자의 역할에서 파생**시켰기 때문이다(관리자면
 * `LAST_OWNER_LEAVE_IMPACT_LINE` 한 줄이 더 선다). 그래서 지금의 관계는 이렇다:
 *  - 여기(GET /settings/privacy의 `flows`)는 **요청자와 무관한 기본형**이다 — 흐름이 무엇인지
 *    나열하는 목록이라 "이 사람이 지금 진행하면 무슨 일이 나는가"를 말하는 자리가 아니다;
 *  - 미리보기(leave-preview · account/delete-preview)는 **요청자 역할 파생**이고, 그 자리가
 *    되돌릴 수 없는 결정 직전이라 요청자에게만 참인 줄까지 말한다.
 * 그리고 **화면이 그리는 것은 미리보기의 impact뿐이다**(apps/mobile/app/settings/privacy.tsx의
 * `PreviewSummary` — 그 화면은 `flows`에서 개수만 읽는다). 두 응답의 이 차이는
 * apps/api/test/admin-settings.e2e.test.ts가 같은 계정의 두 응답을 대조해 값으로 고정한다.
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
 * 기준 시각은 기존 지출 검증(store-shared.assertExpenseDateWithinRange)과 같은
 * `referenceNow()` — 서울 기준 오늘이며, 테스트는 WOORIAI_STAGE_TODAY로 고정한다.
 * 서울 기준 "오늘"은 정상 입력이므로 허용한다(오늘 태어난 아이).
 *
 * dueDate에는 적용하지 않는다: 출산 예정일은 미래인 것이 정상이다. 다만 **끝은 있다** —
 * 아래 `assertDueDateWithinFullTerm`(라운드 67 B)이 그 위쪽 경계를 본다.
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
 * 라운드 68 A: birthDate의 **아래쪽 경계**(20년). 바로 위 `assertNotFutureBirthDate`가 세운 위쪽
 * 경계의 반대 방향이고, 형식·기준 시각·실패 시 침묵 규칙까지 **같은 모양**이다.
 *
 * 지금까지 이 값에는 아래쪽 경계가 아예 없었다(normalizeChildInput은 존재 여부만, DTO는 형식만
 * 본다). 그래서 `2026` → `2016` 같은 한 자리 오타든 폼을 우회한 API 호출이든 그대로 저장됐고,
 * 그 아이의 홈은 "생후 117개월"을, 단계는 `elementary`를 그린다(더 먼 값이면 도메인의 마지막
 * 밴드가 열려 있어 전부 `middle_school`로 받는다 — packages/domain/src/stage.ts). 값이 대놓고
 * 이상한데도 무엇이 틀렸는지 말해 주는 자리가 없었다. 모바일 폼도 같은 규칙을 갖지만
 * (apps/mobile/src/children/child-form.ts의 `computeDateError`), 그 가드를 우회한 호출을 막는
 * 것이 이 함수의 존재 이유다 — R27(L-6)이 birthDate 미래에 세운 선례 그대로다.
 *
 * ## 숫자를 짓지 않는다
 * 하한은 도메인의 `ENTRY_DATE_MAX_PAST_MONTHS`(240) 한 곳에만 있고, 지출 날짜 가드
 * (store-shared.ts의 `assertExpenseDateWithinPastFloor`)와 앱의 달력 픽커가 **같은 그 값**을
 * 읽는다. 문장도 폼이 내는 것과 글자까지 같다(child-form.ts의 `CHILD_BIRTH_DATE_TOO_OLD_ERROR`).
 * 하한 당일은 통과시킨다 — 달력 픽커가 고를 수 있게 열어 두는 그 날이다.
 *
 * ## 도메인 밴드는 건드리지 않는다
 * `ageMonthsToStageCode`의 열린 마지막 밴드를 닫는 것은 DNC-007이 지키는 도메인 의미 변경이다.
 * 여기서 하는 일은 **서버가 값을 받지 않는 것**뿐이고, 이미 저장된 값은 마이그레이션하지 않는다.
 */
function assertBirthDateWithinPastFloor(birthDate: string) {
  let tooOld: boolean;
  try {
    tooOld = isBeforeEntryDateFloor(birthDate, referenceNow());
  } catch {
    // 형식 검증은 DTO(@Matches(datePattern))의 몫 — assertNotFutureBirthDate와 같은 판단이다.
    return;
  }
  if (tooOld) {
    throw new BadRequestException({
      code: "CHILD_BIRTH_DATE_TOO_OLD",
      message: `${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 날은 고를 수 없어요.`
    });
  }
}

/**
 * 라운드 67 B: dueDate의 **위쪽 경계**. 예정일이 미래인 것은 정상이지만, 무한히 먼 미래가
 * 정상인 것은 아니다 — 임신에는 만삭이라는 끝이 있다.
 *
 * 지금까지 이 값에는 위쪽 경계가 아예 없었다(normalizeChildInput은 존재 여부만 보고, DTO는
 * `YYYY-MM-DD` 형식만 본다). 그래서 손타이핑 오타(`2026` → `2062`)든 폼을 우회한 API 호출이든
 * 그대로 저장됐고, 그 아이는 도메인의 주차 계산이 0으로 clamp되면서(packages/domain/src/stage.ts)
 * **임신 0주차**로 굳는다 — 홈의 D 카운트와 준비템 밴드가 임신 초기에 고정되는데 무엇이
 * 틀렸는지 말해 주는 자리가 없다. 모바일 폼도 같은 규칙을 갖지만(apps/mobile/src/children/
 * child-form.ts의 `computeDateError`), 그 가드를 우회한 호출을 막는 것이 이 함수의 존재
 * 이유다 — R27(L-6)이 birthDate에 세운 선례 그대로다.
 *
 * ## 숫자를 짓지 않는다
 * 만삭 주차를 여기 적지 않고 도메인에 물어 읽는다: "예정일이 곧 오늘"이면 도메인이 만삭 주차를
 * 답하고, 그 답이 곧 "예정일이 오늘로부터 가장 멀 수 있는 거리"다. 모바일 폼과 달력 픽커도
 * 같은 질문을 자기 자리에서 따로 던진다(계층을 가로질러 상수를 끌어오지 않는다). 만삭 당일은
 * 통과시킨다 — 달력 픽커가 고를 수 있게 열어 두는 그 날이라, 여기서 거절하면 픽커에서 고른
 * 날짜가 저장 직전에 막힌다.
 *
 * 기준 시각은 `assertNotFutureBirthDate`와 **같은** `referenceNow()`(서울 기준 오늘, 테스트는
 * WOORIAI_STAGE_TODAY로 고정)이고, 비교도 같은 도메인 함수(`isFutureSeoulDate`)다 — 기준을
 * 오늘에서 만삭 날짜로 옮길 뿐이다. 만삭을 못 읽으면(도메인 응답 모양이 바뀌면) 막지 않는다:
 * 상한을 지어내 정상 예정일을 거절하는 편이 더 나쁘다.
 */
function assertDueDateWithinFullTerm(dueDate: string) {
  const probeIso = getSeoulToday(referenceNow());
  const fullTerm = calculateChildStage({ stageMode: "pregnant", dueDate: probeIso, today: probeIso });
  const weeks = "pregnancyWeek" in fullTerm ? Math.max(0, fullTerm.pregnancyWeek) : 0;
  if (weeks <= 0) return;

  const fullTermReference = new Date(referenceNow().getTime() + weeks * 7 * 86_400_000);
  let beyond: boolean;
  try {
    beyond = isFutureSeoulDate(dueDate, fullTermReference);
  } catch {
    // 형식 검증은 DTO(@Matches(datePattern))의 몫 — assertNotFutureBirthDate와 같은 판단이다.
    return;
  }
  if (beyond) {
    throw new BadRequestException({
      code: "CHILD_DUE_DATE_BEYOND_TERM",
      message: `만삭(${weeks}주)보다 먼 날은 고를 수 없어요.`
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
    // 라운드 68 A: 같은 값의 반대쪽 경계(20년 하한)도 같은 자리에서 본다.
    if (input.birthDate !== undefined) {
      assertNotFutureBirthDate(input.birthDate);
      assertBirthDateWithinPastFloor(input.birthDate);
    }
    // 라운드 67 B: dueDate도 stageMode와 무관하게 검사한다(위와 같은 이유 — born/manual로
    // 만들면서 심어둔 값이 나중 화면에서 되살아나면 안 된다).
    if (input.dueDate !== undefined) {
      assertDueDateWithinFullTerm(input.dueDate);
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
    // 라운드 68 A: 같은 값의 반대쪽 경계(20년 하한)도 같은 규칙으로 본다 — **이번 요청이 실제로
    // 보낸 값만** 보므로, 규칙이 생기기 전에 들어온 값 때문에 무관한 PATCH가 막히지 않는다.
    if (definedInput.birthDate !== undefined) {
      assertNotFutureBirthDate(definedInput.birthDate);
      assertBirthDateWithinPastFloor(definedInput.birthDate);
    }
    // 라운드 67 B: dueDate도 **이번 요청이 실제로 보낸 값만** 본다. 저장돼 있던 값까지 다시
    // 보면, 이 규칙이 생기기 전에 들어온 예정일 때문에 별명 수정 같은 무관한 PATCH가 영영
    // 막힌다(위 birthDate와 같은 판단). 잘못 저장된 값은 이 폼에서 고쳐 덮어쓰는 길이 열려 있다.
    if (definedInput.dueDate !== undefined) {
      assertDueDateWithinFullTerm(definedInput.dueDate);
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
   *
   * 라운드 46 Q-1 — 유효 판정 기준은 **화면에 보일 수 있었던 준비템**이다(`active: true`).
   * 종전에는 존재 여부만 봤기 때문에, 사용자가 목록을 띄워 둔 사이 어드민이 비활성화한
   * 항목도 그대로 세어졌다. 그 결과 `updatedCount < 요청 수`가 실제로는 **도달 불가**였고,
   * 그 상태를 알리려고 만든 클라이언트의 부분 반영 안내(모바일 ONB-003
   * `preparedItemsPartialNotice`)가 영영 발동하지 않는 죽은 코드였다. 화면에서 사라진
   * 항목을 "준비 완료"로 기록하면 준비템 탭에도 나타나지 않으므로, 세지 않는 편이 사실에
   * 맞다(비활성 항목의 childItemStatus 행도 만들지 않는다).
   *
   * stage는 일부러 거르지 않는다: 시기 밴드는 탭 전환(ITEM-121 stageBand)으로 사용자가
   * 직접 바꿔 볼 수 있는 값이라, 현재 단계와 다르다는 이유로 거절하면 실제로 화면에서 고른
   * 항목이 조용히 누락된다. `active`만이 "어디서도 더는 보이지 않는다"는 뜻이다.
   */
  async setPreparedItems(user: AuthenticatedUser, childId: string, itemTemplateIds: string[]) {
    await this.childAccess.requireChildAccess(user, childId, true);
    const uniqueItemTemplateIds = [...new Set(itemTemplateIds)];
    const existing = await this.prisma.itemTemplate.findMany({
      where: { id: { in: uniqueItemTemplateIds }, active: true },
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

  /**
   * GAP-063 #5: 반환값이 예산 DTO **하나**에서 DTO + 감사 봉투로 바뀌었다.
   * 호출부는 `budgets.controller.ts` 하나뿐이고(저장소 전체 검색), 그 컨트롤러가
   * `budget`만 응답으로 돌려주므로 **API 응답은 한 글자도 달라지지 않는다**.
   *
   * 왜 여기서 스냅샷을 만드는가: `budgets` 행은 `(child_id, year_month)` 유니크 한 칸이라
   * 덮어쓰면 이전 금액이 **사실 자체로 사라진다**(이월도 이력도 없다). 그리고 이 경로는
   * 가구의 쓰기 권한자 누구나 탈 수 있어(`requireChildAccess(user, childId, true)`)
   * 공동 가구에서 한쪽이 세운 예산을 다른 쪽이 조용히 갈아 끼울 수 있다.
   * before는 upsert **직전** 조회 1회다 — 지출 수정 경로(expenses.service.ts의
   * updateExpense)와 같은 정밀도이고, 같은 트랜잭션이 아니라는 성질도 그와 같다.
   *
   * `createdByUserId`를 손대지 않는 이유: 이 컬럼은 create에서만 채워지므로 행이 아는 것은
   * "처음 만든 사람"뿐이고, "마지막으로 바꾼 사람"을 행에 담으려면 `updated_by_user_id`
   * 컬럼 신설 = 마이그레이션이다(schema.prisma의 Budget 주석 참조). 이번 라운드의
   * 마이그레이션 0 원칙에 따라 그 사실은 **감사 로그가 대신 답한다** — 행위자는
   * audit_logs.actor_user_id, 시각은 그 행의 created_at이다.
   */
  async upsertBudget(user: AuthenticatedUser, childId: string, yearMonth: string, amountKrw: number) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
    // REP-105: yearMonth arrives DTO-normalized to `YYYY-MM-01` (inputs accept
    // `YYYY-MM` or `YYYY-MM-01`; see common/validation/year-month.ts), and
    // getSeoulMonthRange itself truncates any date to its month, so this
    // normalization point — shared by getBudget/getMonthlyReport — is
    // tolerant of both forms. Responses keep the first-of-month form.
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const amount = requireMoneyKrw(amountKrw);
    const where = { childId_yearMonth: { childId, yearMonth: toDateOnly(normalizedMonth) } };
    const existing = await this.prisma.budget.findUnique({ where });
    const budget = await this.prisma.budget.upsert({
      where,
      update: { amountKrw: amount },
      create: { childId, yearMonth: toDateOnly(normalizedMonth), amountKrw: amount, createdByUserId: user.id }
    });
    return {
      budget: await this.toBudgetDto(childId, normalizedMonth, budget.amountKrw),
      householdId: child.householdId,
      budgetId: budget.id,
      // 봉투에는 금액·연월·childId만 싣는다 — PII(닉네임·이메일)도, 지출 원문도 없다.
      // before가 null이면 "이 달 예산이 처음 세워졌다"는 뜻이다(덮어쓰기가 아니다).
      before: existing ? { childId, yearMonth: normalizedMonth, amountKrw: existing.amountKrw } : null,
      after: { childId, yearMonth: normalizedMonth, amountKrw: budget.amountKrw }
    };
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
