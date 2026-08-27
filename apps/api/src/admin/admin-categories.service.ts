import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AdminUpdateCategoryDto } from "./dto/admin-categories.dto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 어드민 카테고리 표에 실리는 한 행. 앱용 `GET /categories`(finance/categories.controller.ts)와
 * 달리 필터 없이 **전량**을 돌려주고, 운영 판단에 필요한 `selectable`/`active`/`isSystem`을
 * 모두 노출한다.
 */
export type AdminCategoryView = {
  id: string;
  code: string;
  name: string;
  iconName: string | null;
  displayOrder: number;
  isSystem: boolean;
  active: boolean;
  selectable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const CATEGORY_SELECT = {
  id: true,
  code: true,
  name: true,
  iconName: true,
  displayOrder: true,
  isSystem: true,
  active: true,
  selectable: true,
  createdAt: true,
  updatedAt: true
} as const;

/**
 * ADM-127: 카테고리 운영 조회/수정.
 *
 * 왜 필요한가: CAT-124가 `categories.selectable`을 도입하면서 "앱 선택 목록에서 뺀다"는
 * 운영 결정이 생겼는데, 그 토글을 돌릴 수단이 psql뿐이었다(어드민에 카테고리 화면이 없었다).
 *
 * 경계(DNC-007): 이 서비스에는 create도 delete도 없다. 시드 21행(정식 12 + 모바일 퀵타일
 * 별칭 8 + 가져오기 스텁 1, prisma/seed-data.ts)은 id가 클라이언트·시드에 하드코딩돼 있고
 * 이미 저장된 지출의 `category_id`가 그 행을 가리키므로, 행을 지우거나 id/code를 바꾸는 순간
 * 과거 지출의 카테고리 해석이 깨진다. 그래서 편집 축은 name/displayOrder/active/selectable
 * 넷으로만 열어 둔다.
 */
@Injectable()
export class AdminCategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 전량 목록. 정렬은 앱 쪽 `GET /categories`와 동일한 키(displayOrder, code)를 써서,
   * 운영자가 어드민에서 보는 순서가 앱에서 사용자가 보게 될 순서와 어긋나지 않게 한다.
   */
  async list(): Promise<{ categories: AdminCategoryView[] }> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: CATEGORY_SELECT
    });
    return { categories };
  }

  /** 감사 로그 before/after 스냅샷을 만들기 위해 수정 전 행을 먼저 읽는다. */
  async findById(categoryId: string): Promise<AdminCategoryView> {
    const category = UUID_PATTERN.test(categoryId)
      ? await this.prisma.category.findUnique({ where: { id: categoryId }, select: CATEGORY_SELECT })
      : null;
    if (!category) {
      throw new NotFoundException({ code: "CATEGORY_NOT_FOUND", message: "카테고리를 찾을 수 없어요." });
    }
    return category;
  }

  async update(categoryId: string, input: AdminUpdateCategoryDto): Promise<AdminCategoryView> {
    return await this.prisma.category.update({
      where: { id: categoryId },
      // 값이 오지 않은 축은 `undefined`라 Prisma가 그대로 건드리지 않는다 —
      // 부분 수정(PATCH) 계약이 그대로 유지된다.
      data: {
        name: input.name?.trim(),
        displayOrder: input.displayOrder,
        active: input.active,
        selectable: input.selectable
      },
      select: CATEGORY_SELECT
    });
  }
}
