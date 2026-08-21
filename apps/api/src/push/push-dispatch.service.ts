import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { getSeoulMonthRange, reachedBudgetBoundaries } from "@wooriai/domain";
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
 * 관찰할 수 있는 알림 이벤트 중 예산 경계(80%/100%) 도달을 지출 커밋 직후에
 * 평가해 발송한다.
 *
 * 경계당 1회 발송 메커니즘 (리뷰 M-2 재설계 — DB 클레임):
 * 과거 구현은 "usedBefore = usedAfter - 이번 지출액" 역산으로 이번 지출이 경계를
 * '넘었는지'를 판정했는데, 동시 지출 2건이면 두 요청의 aggregate가 서로의 커밋을
 * 보는지에 따라 중복 발송과 누락이 모두 가능했다. 지금은 usedBefore를 아예 쓰지
 * 않는다: 월 합계(usedAfter)가 경계 이상이면 push_boundary_marks에
 * (childId, yearMonth, boundary) 행 INSERT로 클레임을 시도하고(unique 제약 충돌
 * = 이미 클레임됨), **클레임에 성공한 요청만** 발송한다.
 * - 중복 없음: unique 제약이 같은 (아이, 월, 경계)의 두 번째 클레임을 거부한다.
 * - 누락 없음: 경계를 실제로 넘긴 커밋 이후의 어떤 평가든 usedAfter가 경계
 *   이상이므로 클레임을 시도한다 — 역산 판정처럼 "둘 다 자기가 안 넘겼다고
 *   믿는" 경우가 없다.
 * - 100% 경계가 새로 클레임되면 100만 발송하되 80 마크도 함께 클레임(무발송)해
 *   이후 80 재발송을 차단한다 (두 경계를 한 번에 지나면 100만 — 모바일
 *   budgetNotifications와 동일한 의미).
 *
 * 알려진 한계: 지출 수정·삭제로 인한 경계 이동은 미평가(마크는 소멸하지 않음) —
 * 합계가 경계 아래로 내려갔다가 다시 올라와도 재발송하지 않는다. 발송은
 * (아이, 월, 경계)당 최대 1회이며, 발송 실패 시에도 마크는 남는다(at-most-once).
 *
 * 카피 정합(리뷰 m-3 → R19-D): 100% 경계는 usedAfter가 정확히 예산과 같으면 "모두
 * 사용했어요", 초과면 "N원 초과했어요" — 홈 배너(apps/mobile/src/home/
 * budget-warning.ts)의 exceeded 버킷 카피와 동일한 규칙. 80%/정확-100%/초과
 * 판정은 모두 정수 연산이며(부동소수점 경계 오차 없음), R19-D부터 그 판정을
 * @wooriai/domain의 reachedBudgetBoundaries 한 곳에서 가져온다 — 서버 푸시·홈
 * 배너·인앱 알림 세 표면이 같은 함수를 호출하므로 규칙이 갈라질 수 없다.
 *
 * 계약: onExpenseCreated/onBudgetRelevantChange는 어떤 경우에도 예외를 던지지
 * 않는다 — 지출 생성 API·가져오기 커밋·인앱 알림 흐름은 이 함수의 성패와
 * 무관하게 동작한다. 발송 실패는 결과 요약과 warn 로그로만 남는다. FCM이
 * UNREGISTERED(404/410)로 응답한 기기는 DevicesService를 통해 비활성화한다.
 */

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

function toDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * 월 합계(usedAfter)가 어느 경계 이상인지 판정한다 — usedBefore 역산 없음.
 *
 * R19-D: 판정 자체는 @wooriai/domain의 reachedBudgetBoundaries 한 곳에 있다
 * (packages/domain/src/budget-boundary.ts) — 홈 배너(apps/mobile/src/home/
 * budget-warning.ts)·인앱 알림(apps/mobile/src/notifications/generators.ts)도
 * 같은 함수를 쓰므로 세 표면의 80/100 판정이 어긋날 수 없다. 여기 남은 것은
 * 이 서비스가 쓰는 좁은 형태({reached80, reached100})로의 어댑터뿐이다.
 * 정수 연산(KRW는 정수, DNC-013)·"정확히 100%도 도달"·"reached100이면 reached80"은
 * 모두 도메인 모듈의 계약이다.
 */
export function resolveReachedBoundaries(
  usedAfter: number,
  budgetKrw: number
): { reached80: boolean; reached100: boolean } {
  const { reached80, reached100 } = reachedBudgetBoundaries({ budgetKrw, spentKrw: usedAfter });
  return { reached80, reached100 };
}

/**
 * 발송 카피 (해요체 고정, DNC-018). budget_100은 홈 배너
 * (apps/mobile/src/home/budget-warning.ts)의 exceeded 버킷과 같은 규칙이며, R19-D
 * 이후로는 그 '같음'이 주석이 아니라 코드로 보장된다: 초과 여부(strict >)와 초과
 * 금액을 도메인 모듈이 돌려주고 두 표면이 그것만 문장으로 옮긴다. 정확히 예산이면
 * "모두 사용했어요"(0원 초과라고 말하면 허위), 초과면 "N원 초과했어요".
 * 인앱 알림(generators.ts)은 같은 판정을 쓰되 목록에 남는 스냅샷이라 초과 금액을
 * 굳혀 적지 않는다(거기 주석 참조).
 */
export function budgetPushCopy(type: BudgetPushType, usedAfter: number, budgetKrw: number): { title: string; body: string } {
  if (type === "budget_80") {
    return { title: "이번 달 예산의 80%를 사용했어요", body: "남은 예산을 확인해보세요." };
  }
  const { overAmountKrw } = reachedBudgetBoundaries({ budgetKrw, spentKrw: usedAfter });
  return {
    title:
      overAmountKrw > 0
        ? `이번 달 예산을 ${overAmountKrw.toLocaleString("ko-KR")}원 초과했어요`
        : "이번 달 예산을 모두 사용했어요",
    body: "이번 달 지출을 확인해 볼까요?"
  };
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
      const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
      // 선물/환불은 예산 합계에 포함되지 않으므로 경계도 못 움직인다
      // (DNC-015, onboarding/expenses-store.service.ts sumExpenses와 동일 조건).
      if (!expense || expense.deletedAt || expense.expenseType !== "expense") {
        return SKIPPED;
      }
      const range = getSeoulMonthRange(expense.spentOn.toISOString().slice(0, 10));
      return await this.evaluateChildMonth(expense.childId, expense.householdId, range.yearMonth.slice(0, 7));
    } catch (error) {
      // 어떤 실패도 밖으로 던지지 않는다 — 로그만 남기고 무시.
      this.logger.warn(`push dispatch 실패(무시됨): ${error instanceof Error ? error.message : String(error)}`);
      return SKIPPED;
    }
  }

  /**
   * 예산 관련 지출이 배치로 들어온 뒤의 훅 (리뷰 m-2: CSV 가져오기 커밋 —
   * onboarding/import-pipeline.service.ts confirmImport에서 fire-and-forget 호출).
   * 클레임 방식은 usedAfter만 필요하므로 "어느 지출이 넘겼는지"를 몰라도
   * 아이+월 단위로 1회 평가하면 충분하다. 예외를 절대 던지지 않는다.
   *
   * @param yearMonths 'YYYY-MM'(또는 'YYYY-MM-DD' — 월만 사용) 문자열 목록.
   */
  async onBudgetRelevantChange(childId: string, yearMonths: string[]): Promise<ExpensePushDispatchSummary[]> {
    try {
      if (!this.config.isEnabled()) {
        return [];
      }
      const child = await this.prisma.child.findUnique({ where: { id: childId } });
      if (!child || child.deletedAt) {
        return [];
      }
      const uniqueMonths = [...new Set(yearMonths.map((yearMonth) => yearMonth.slice(0, 7)))];
      const summaries: ExpensePushDispatchSummary[] = [];
      for (const yearMonth of uniqueMonths) {
        summaries.push(await this.evaluateChildMonth(childId, child.householdId, yearMonth));
      }
      return summaries;
    } catch (error) {
      this.logger.warn(`push dispatch 실패(무시됨): ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /** @param yearMonth 'YYYY-MM' (Asia/Seoul 기준 월). */
  private async evaluateChildMonth(
    childId: string,
    householdId: string,
    yearMonth: string
  ): Promise<ExpensePushDispatchSummary> {
    const range = getSeoulMonthRange(yearMonth);
    const budget = await this.prisma.budget.findUnique({
      where: { childId_yearMonth: { childId, yearMonth: toDateOnly(range.yearMonth) } }
    });
    // 예산 미설정(또는 0)은 알리지 않는다 — 모바일 budgetNotifications와 동일.
    if (!budget || budget.amountKrw <= 0) {
      return SKIPPED;
    }

    const aggregate = await this.prisma.expense.aggregate({
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) }
      },
      _sum: { amountKrw: true }
    });
    const usedAfter = aggregate._sum.amountKrw ?? 0;
    const budgetKrw = budget.amountKrw;

    const { reached80, reached100 } = resolveReachedBoundaries(usedAfter, budgetKrw);
    if (!reached80) {
      // reached100이면 reached80도 참이므로 이 한 줄로 "둘 다 미도달"을 거른다.
      return SKIPPED;
    }

    // 클레임: 발송보다 먼저 마크를 INSERT한다(성공한 쪽만 발송) — unique 제약이
    // 동시 평가의 중복을 거른다. 발송이 이후 실패해도 마크는 남는다(at-most-once,
    // 클래스 주석 참조).
    let type: BudgetPushType | null = null;
    if (reached100) {
      const claimed100 = await this.claimBoundaryMark(childId, yearMonth, 100);
      // 80 마크도 함께 클레임(무발송): 두 경계를 한 번에 지난 경우 이후 평가가
      // 80을 따로 재발송하지 못하게 차단한다. 이미 클레임돼 있어도 무해.
      await this.claimBoundaryMark(childId, yearMonth, 80);
      if (claimed100) {
        type = "budget_100";
      }
    } else {
      const claimed80 = await this.claimBoundaryMark(childId, yearMonth, 80);
      if (claimed80) {
        type = "budget_80";
      }
    }
    if (!type) {
      return SKIPPED;
    }

    // 수신자: 해당 가구의 활성 구성원 전원 (RBAC 역할과 무관 — 알림은 조회 성격).
    const members = await this.prisma.householdMember.findMany({
      where: { householdId, status: "active" },
      select: { userId: true }
    });
    const devices = await this.devices.findActivePushDevices(members.map((member) => member.userId));

    const copy = budgetPushCopy(type, usedAfter, budgetKrw);
    const data = { type, childId, yearMonth };

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

  /**
   * (childId, yearMonth, boundary) 마크 INSERT 시도 — 성공 시 true(이 요청이
   * 클레임 획득), unique 충돌(P2002) 시 false(다른 요청이 이미 클레임).
   * INSERT ... ON CONFLICT DO NOTHING과 동치의 Prisma 표현.
   */
  private async claimBoundaryMark(childId: string, yearMonth: string, boundary: number): Promise<boolean> {
    try {
      await this.prisma.pushBoundaryMark.create({ data: { childId, yearMonth, boundary } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  }
}
