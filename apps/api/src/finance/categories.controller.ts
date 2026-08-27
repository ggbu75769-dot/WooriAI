import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ListCategoriesQueryDto, includeAllRequested } from "./dto/query.dto";

/**
 * CAT-101: 지출 입력/리포트 화면이 공유하는 시드 카테고리 목록 조회.
 * 활성(active=true) 카테고리를 displayOrder 오름차순으로 반환한다. 응답 계약은
 * @wooriai/contracts의 listCategoriesResponseSchema와 1:1로 맞춘다.
 *
 * CAT-124: 기본 응답은 여기서 한 겹 더 좁힌다 — `selectable = true`인 카테고리만.
 *
 * 왜: 시드는 세 묶음이 쌓인 21행이다(정식 12 + 모바일 퀵타일 별칭 8 + 가져오기 스텁 1,
 * prisma/seed-data.ts). 별칭 행은 모바일이 하드코딩한 UUID를 유효한 categoryId로
 * 만들려고 존재하는 것이지 사용자가 고를 선택지가 아닌데, 정식 행과 뜻만 겹치고 이름은
 * 달라서("기저귀/위생" vs "기저귀") 클라이언트 동명 중복 제거로는 지울 수 없었다
 * (docs/operations/known-limitations.md B절이 "서버 쪽 정공법"으로 남겨 둔 항목).
 *
 * 하위 호환 — 바뀌는 것은 이 응답에 실리는 행 집합뿐이다:
 *   * 별칭·스텁 행은 삭제되지 않는다(DNC-007). active도 그대로다.
 *   * 지출 생성/수정의 categoryId 검증은 selectable을 보지 않는다
 *     (onboarding/expenses-store.service.ts `requireExistingCategory` — 존재 확인만).
 *     8타일 빠른 입력과 오프라인 재전송이 별칭 id로 계속 지출을 만들 수 있어야 한다.
 *   * 이미 별칭 id로 저장된 지출의 **이름 해석**은 전량이 필요하므로 `?includeAll=1`이
 *     21행 전부를 돌려준다. 모바일은 이름 해석과 칩 목록을 같은 `["categories"]` 캐시
 *     하나로 쓰므로 includeAll=1로 받아 표시 단계에서 `selectableCategories`로 좁힌다
 *     (apps/mobile/src/categories.ts).
 *   * 응답 DTO의 `selectable` 필드는 계약상 optional이라 구 클라이언트는 무시하면 된다.
 */
@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(createDtoValidationPipe(ListCategoriesQueryDto)) query: ListCategoriesQueryDto) {
    const includeAll = includeAllRequested(query.includeAll);
    const categories = await this.prisma.category.findMany({
      where: includeAll ? { active: true } : { active: true, selectable: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        iconName: true,
        displayOrder: true,
        isSystem: true,
        active: true,
        selectable: true
      }
    });
    return { categories };
  }
}
