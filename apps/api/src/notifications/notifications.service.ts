import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import type { ListNotificationsDto } from "./dto/notifications.dto";

const presentationByEvent = {
  catalog_item_recalled: {
    category: "safety" as const,
    title: "준비 품목 리콜 안내",
    body: "영향받는 준비 품목과 안전 안내를 확인해 주세요.",
    importance: "critical" as const,
    route: "preparation" as const,
    requiresAcknowledgement: true
  },
  catalog_item_blocked: {
    category: "safety" as const,
    title: "준비 품목 안전 차단",
    body: "사용을 보류하고 공식 출처 또는 전문가 검수 안내를 확인해 주세요.",
    importance: "critical" as const,
    route: "preparation" as const,
    requiresAcknowledgement: true
  },
  catalog_report_resolved: {
    category: "family" as const,
    title: "품목 신고 처리 결과",
    body: "알려주신 카탈로그 의견의 처리 결과를 확인해 주세요.",
    importance: "normal" as const,
    route: "preparation" as const,
    requiresAcknowledgement: false
  },
  item_plan_assigned: {
    category: "family" as const,
    title: "준비 담당 항목이 배정됐어요",
    body: "가족이 배정한 준비 품목과 현재 상태를 확인해 주세요.",
    importance: "normal" as const,
    route: "preparation" as const,
    requiresAcknowledgement: false
  },
  item_plan_comment: {
    category: "family" as const,
    title: "준비물에 새 댓글이 있어요",
    body: "가족이 남긴 준비 상황을 확인해 주세요.",
    importance: "normal" as const,
    route: "preparation" as const,
    requiresAcknowledgement: false
  },
  replacement_due: {
    category: "replacement" as const,
    title: "교체 예정일이 되었어요",
    body: "사용자가 입력한 교체 예정일을 확인해 주세요.",
    importance: "important" as const,
    route: "preparation" as const,
    requiresAcknowledgement: false
  },
  recurring_purchase_due: {
    category: "replacement" as const,
    title: "다음 구매 시점을 확인해 주세요",
    body: "사용자가 입력한 반복구매 주기에 따른 알림이에요.",
    importance: "normal" as const,
    route: "preparation" as const,
    requiresAcknowledgement: false
  }
} as const;

const fallbackPresentation = {
  category: "service" as const,
  title: "우리아이 알림",
  body: "새로운 소식이 있어요.",
  importance: "normal" as const,
  route: null,
  requiresAcknowledgement: false
};

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: ListNotificationsDto) {
    const householdIds = user.households.map((household) => household.id);
    const householdScope = {
      OR: [
        { householdId: null },
        ...(householdIds.length > 0 ? [{ householdId: { in: householdIds } }] : [])
      ]
    };
    const cursor = query.cursor
      ? await this.prisma.notificationDelivery.findFirst({
          where: { id: query.cursor, userId: user.id, AND: [householdScope] },
          select: { id: true, createdAt: true }
        })
      : null;
    const rows = await this.prisma.notificationDelivery.findMany({
      where: {
        userId: user.id,
        state: { not: "cancelled" },
        AND: [
          householdScope,
          ...(cursor ? [{
            OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } }
            ]
          }] : [])
        ]
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1
    });
    const hasNext = rows.length > query.limit;
    const page = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((row) => {
        const presentation = presentationByEvent[row.eventType as keyof typeof presentationByEvent] ?? fallbackPresentation;
        return {
          id: row.id,
          eventType: row.eventType,
          ...presentation,
          navigation: this.navigation(row),
          read: Boolean(row.openedAt) || row.state === "opened",
          occurredAt: row.createdAt.toISOString()
        };
      }),
      nextCursor: hasNext ? page.at(-1)?.id ?? null : null
    };
  }

  private navigation(row: {
    householdId: string | null;
    childId: string | null;
    targetType: string | null;
    targetId: string | null;
  }) {
    if (row.targetType === "item" && row.householdId && row.childId && row.targetId) {
      return {
        kind: "item" as const,
        householdId: row.householdId,
        childId: row.childId,
        itemId: row.targetId
      };
    }
    if (row.targetType === "family" && row.householdId) {
      return { kind: "family" as const, householdId: row.householdId };
    }
    if (row.targetType === "reports" && row.householdId && row.childId) {
      return {
        kind: "reports" as const,
        householdId: row.householdId,
        childId: row.childId
      };
    }
    return null;
  }

  async markRead(user: AuthenticatedUser, ids: string[]) {
    const now = new Date();
    const uniqueIds = [...new Set(ids)];
    const householdIds = user.households.map((household) => household.id);
    const householdScope = {
      OR: [
        { householdId: null },
        ...(householdIds.length > 0 ? [{ householdId: { in: householdIds } }] : [])
      ]
    };
    const changed = await this.prisma.$transaction(async (tx) => {
      const opened = await tx.notificationDelivery.updateMany({
        where: {
          id: { in: uniqueIds },
          userId: user.id,
          openedAt: null,
          state: { not: "cancelled" },
          AND: [householdScope]
        },
        data: { openedAt: now }
      });
      await tx.notificationDelivery.updateMany({
        where: { id: { in: uniqueIds }, userId: user.id, state: "sent", AND: [householdScope] },
        data: { state: "opened" }
      });
      return opened;
    });
    return { requestedCount: new Set(ids).size, changedCount: changed.count, readAt: now.toISOString() };
  }
}
