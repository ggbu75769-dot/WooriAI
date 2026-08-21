import { Inject, Injectable, Logger } from "@nestjs/common";
import { getSeoulMonthRange } from "@wooriai/domain";
import { DevicesService } from "../devices/devices.service";
import { PrismaService } from "../prisma/prisma.service";
import { FcmSenderService } from "./fcm-sender.service";
import { PushConfigService } from "./push-config.service";

/**
 * PUSH-113: 서버측 발송 오케스트레이션 — "알림 생성 지점" 훅의 실제 구현.
 *
 * 이 저장소의 인앱 알림(예산/시기/구매확인/주간 요약)은 모바일 클라이언트가
 * 홈 데이터로부터 생성한다(apps/mobile/src/notifications/generators.ts) — 서버에는
 * 별도의 알림 테이블/생성 서비스가 없다. 그래서 서버 발송 훅은 서버가 직접
 * 관찰할 수 있는 알림 이벤트 중 예산 경계(80%/100%) 통과를 지출 생성 직후에
 * 평가해 발송한다. 경계 판정·문구는 모바일 generators.ts의 budget_80/budget_100과
 * 동일한 의미를 따른다: 초과는 strict >, 두 경계를 한 번에 지나면 100만 발송.
 * "이번 지출로 경계를 넘은 경우에만" 발송하므로 경계당 1회라는 dedupe 성질도
 * 자연히 성립한다.
 *
 * 계약: onExpenseCreated는 어떤 경우에도 예외를 던지지 않는다 — 지출 생성
 * API/인앱 알림 흐름은 이 함수의 성패와 무관하게 동작한다. 발송 실패는 결과
 * 요약과 warn 로그로만 남는다. FCM이 UNREGISTERED(404/410)로 응답한 기기는
 * DevicesService를 통해 비활성화한다.
 */

export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetPushType = "budget_80" | "budget_100";

export type ExpensePushDispatchSummary = {
  skipped: boolean;
  notificationType: BudgetPushType | null;
  attempted: number;
  sent: number;
  failed: number;
  deactivated: number;
};

const SKIPPED: ExpensePushDispatchSummary = {
  skipped: true,
  notificationType: null,
  attempted: 0,
  sent: 0,
  failed: 0,
  deactivated: 0
};

// 모바일 인앱 알림(generators.ts)과 동일한 해요체 고정 문구 (DNC-018).
const BUDGET_PUSH_COPY: Record<BudgetPushType, { title: string; body: string }> = {
  budget_100: { title: "이번 달 예산을 초과했어요", body: "이번 달 지출을 확인해 볼까요?" },
  budget_80: { title: "이번 달 예산의 80%를 사용했어요", body: "남은 예산을 확인해보세요." }
};

function toDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class PushDispatchService {
  private readonly logger = new Logger(PushDispatchService.name);

  constructor(
    @Inject(PushConfigService) private readonly config: PushConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DevicesService) private readonly devices: DevicesService,
    @Inject(FcmSenderService) private readonly sender: FcmSenderService
  ) {}

  /** 지출 생성 직후 훅 진입점 (ExpensesVersionService.createExpense에서 fire-and-forget 호출). */
  async onExpenseCreated(expenseId: string): Promise<ExpensePushDispatchSummary> {
    try {
      if (!this.config.isEnabled()) {
        // 비활성 시 DB 조회조차 하지 않는다 — 지출 생성 hot path에 비용 0.
        return SKIPPED;
      }
      return await this.evaluateAndSend(expenseId);
    } catch (error) {
      // 어떤 실패도 밖으로 던지지 않는다 — 로그만 남기고 무시.
      this.logger.warn(`push dispatch 실패(무시됨): ${error instanceof Error ? error.message : String(error)}`);
      return SKIPPED;
    }
  }

  private async evaluateAndSend(expenseId: string): Promise<ExpensePushDispatchSummary> {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    // 선물/환불은 예산 합계에 포함되지 않으므로 경계도 못 움직인다
    // (DNC-015, onboarding-store.service.ts sumExpenses와 동일 조건).
    if (!expense || expense.deletedAt || expense.expenseType !== "expense") {
      return SKIPPED;
    }

    const range = getSeoulMonthRange(expense.spentOn.toISOString().slice(0, 10));
    const budget = await this.prisma.budget.findUnique({
      where: { childId_yearMonth: { childId: expense.childId, yearMonth: toDateOnly(range.yearMonth) } }
    });
    // 예산 미설정(또는 0)은 알리지 않는다 — 모바일 budgetNotifications와 동일.
    if (!budget || budget.amountKrw <= 0) {
      return SKIPPED;
    }

    const aggregate = await this.prisma.expense.aggregate({
      where: {
        childId: expense.childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) }
      },
      _sum: { amountKrw: true }
    });
    const usedAfter = aggregate._sum.amountKrw ?? 0;
    const usedBefore = usedAfter - expense.amountKrw;
    const budgetKrw = budget.amountKrw;

    const type = resolveCrossedBoundary(usedBefore, usedAfter, budgetKrw);
    if (!type) {
      return SKIPPED;
    }

    // 수신자: 해당 가구의 활성 구성원 전원 (RBAC 역할과 무관 — 알림은 조회 성격).
    const members = await this.prisma.householdMember.findMany({
      where: { householdId: expense.householdId, status: "active" },
      select: { userId: true }
    });
    const devices = await this.devices.findActivePushDevices(members.map((member) => member.userId));

    const copy = BUDGET_PUSH_COPY[type];
    const data = { type, childId: expense.childId, yearMonth: range.yearMonth.slice(0, 7) };

    let sent = 0;
    let failed = 0;
    let deactivated = 0;
    for (const device of devices) {
      if (!device.pushToken) {
        continue; // findActivePushDevices가 이미 거르지만 타입 안전용.
      }
      const result = await this.sender.sendToDevice(device.pushToken, { ...copy, data });
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (result.unregistered) {
          await this.devices.deactivatePushDevice(device.id);
          deactivated += 1;
        }
      }
    }

    this.logger.log(
      `budget push dispatched: type=${type} attempted=${devices.length} sent=${sent} failed=${failed} deactivated=${deactivated}`
    );
    return { skipped: false, notificationType: type, attempted: devices.length, sent, failed, deactivated };
  }
}

/**
 * 이번 지출이 어떤 경계를 "넘었는지" 판정한다 (경계를 넘는 순간에만 non-null):
 * - budget_100: 이전 합계는 예산 이하였는데 지금은 초과(strict >).
 * - budget_80: 이전 합계는 80% 미만이었는데 지금은 80% 이상(예산 이하인 동안만).
 * 두 경계를 한 번에 지나면 budget_100만 — 모바일 budgetNotifications와 동일.
 */
export function resolveCrossedBoundary(usedBefore: number, usedAfter: number, budgetKrw: number): BudgetPushType | null {
  if (budgetKrw <= 0) {
    return null;
  }
  if (usedAfter > budgetKrw) {
    return usedBefore <= budgetKrw ? "budget_100" : null;
  }
  if (usedAfter / budgetKrw >= BUDGET_WARNING_RATIO && usedBefore / budgetKrw < BUDGET_WARNING_RATIO) {
    return "budget_80";
  }
  return null;
}
