import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { PrismaService } from "../prisma/prisma.service";

/**
 * CAT-101: 지출 입력/리포트 화면이 공유하는 시드 카테고리 목록 조회.
 * 활성(active=true) 카테고리만 displayOrder 오름차순으로 반환한다. 응답 계약은
 * @wooriai/contracts의 listCategoriesResponseSchema와 1:1로 맞춘다.
 */
@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        iconName: true,
        displayOrder: true,
        isSystem: true,
        active: true
      }
    });
    return { categories };
  }
}
