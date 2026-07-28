import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateExpensePresetDto, UpdateExpensePresetDto } from "./dto/expense-preset.dto";

@Injectable()
export class ExpensePresetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, householdId: string) {
    this.assertMember(user, householdId);
    const presets = await this.prisma.quickExpensePreset.findMany({
      where: { householdId, archivedAt: null, OR: [{ userId: null }, { userId: user.id }] },
      orderBy: [
        { pinned: "desc" },
        { lastUsedAt: { sort: "desc", nulls: "last" } },
        { useCount: "desc" },
        { displayOrder: "asc" },
        { createdAt: "asc" }
      ]
    });
    return { presets };
  }

  async create(user: AuthenticatedUser, householdId: string, input: CreateExpensePresetDto) {
    this.assertEditor(user, householdId);
    await this.validateReferences(user.id, input.categoryId, input.paymentMethodId);
    const aggregate = await this.prisma.quickExpensePreset.aggregate({
      where: { householdId, userId: user.id, archivedAt: null },
      _max: { displayOrder: true }
    });
    return await this.prisma.quickExpensePreset.create({
      data: {
        householdId,
        userId: user.id,
        itemName: input.itemName.trim(),
        categoryId: input.categoryId,
        defaultAmountKrw: input.defaultAmountKrw,
        paymentMethodId: input.paymentMethodId,
        pinned: input.pinned ?? false,
        displayOrder: (aggregate._max.displayOrder ?? -1) + 1
      }
    });
  }

  async update(user: AuthenticatedUser, householdId: string, presetId: string, input: UpdateExpensePresetDto) {
    this.assertEditor(user, householdId);
    const preset = await this.requireOwned(user.id, householdId, presetId);
    await this.validateReferences(user.id, input.categoryId ?? preset.categoryId, input.paymentMethodId);
    return await this.prisma.quickExpensePreset.update({
      where: { id: presetId },
      data: {
        itemName: input.itemName?.trim(),
        categoryId: input.categoryId,
        defaultAmountKrw: input.defaultAmountKrw,
        paymentMethodId: input.paymentMethodId,
        pinned: input.pinned,
        displayOrder: input.displayOrder
      }
    });
  }

  async archive(user: AuthenticatedUser, householdId: string, presetId: string) {
    this.assertEditor(user, householdId);
    await this.requireOwned(user.id, householdId, presetId);
    await this.prisma.quickExpensePreset.update({ where: { id: presetId }, data: { archivedAt: new Date() } });
    return { success: true };
  }

  async recordUse(user: AuthenticatedUser, householdId: string, presetId: string) {
    this.assertEditor(user, householdId);
    await this.requireOwned(user.id, householdId, presetId);
    return await this.prisma.quickExpensePreset.update({
      where: { id: presetId },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() }
    });
  }

  private async requireOwned(userId: string, householdId: string, presetId: string) {
    const preset = await this.prisma.quickExpensePreset.findFirst({
      where: { id: presetId, householdId, userId, archivedAt: null }
    });
    if (!preset) throw new NotFoundException({ code: "PRESET_NOT_FOUND", message: "빠른 품목을 찾을 수 없어요." });
    return preset;
  }

  private async validateReferences(userId: string, categoryId: string, paymentMethodId?: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category?.active) throw new BadRequestException({ code: "CATEGORY_NOT_FOUND", message: "카테고리를 찾을 수 없어요." });
    if (paymentMethodId) {
      const payment = await this.prisma.userPaymentMethod.findFirst({ where: { id: paymentMethodId, userId, active: true } });
      if (!payment) throw new BadRequestException({ code: "PAYMENT_METHOD_NOT_FOUND", message: "결제수단을 찾을 수 없어요." });
    }
  }

  private assertMember(user: AuthenticatedUser, householdId: string) {
    if (!user.households.some((household) => household.id === householdId)) {
      throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "가족 접근 권한이 없어요." });
    }
  }

  private assertEditor(user: AuthenticatedUser, householdId: string) {
    const role = user.households.find((household) => household.id === householdId)?.role;
    if (role !== "owner" && role !== "co_parent") {
      throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "빠른 품목을 수정할 권한이 없어요." });
    }
  }
}
