import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
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
 *
 * 라운드 103 — 여기에 **소유자 축**이 하나 더 걸린다(round103-custom-expense-category-design.md
 * §2.2). 종전 이 조회는 필터가 노출 두 축(`active`/`selectable`)뿐이었다 — `categories`에
 * 소유자 칸이 없었기 때문이다. 이제 `household_id`가 있고(000024), NULL이면 운영 시드·값이면
 * 그 가구가 만든 분류다. 그래서 응답은 **시드 전량 + 호출자가 속한 가구의 커스텀 행**이고,
 * 남의 가구 분류는 어느 갈래에서도 실리지 않는다(소유자 필터 대장 §1.9 #1 — 그 대장을
 * test/category-owner-scope.test.ts가 전수로 잠근다).
 *
 * 노출 두 축의 뜻은 커스텀에도 **그대로** 재사용된다(새 규칙 0건, §6.2): 커스텀 행은 언제나
 * `selectable = true`(사용자가 고르라고 만든 행이다)이고 `active`가 **보관** 축이다 — 기본
 * 목록에는 활성 커스텀만, `?includeAll=1`에는 보관된 것까지. 즉 보관해도 과거 지출의 이름은
 * 영원히 해석된다(아래 F3 문단이 시드에 대해 세운 그 규칙과 같은 근거).
 *
 * 커스텀 행의 표식은 응답에 실리는 **`householdId`**다(시드 행에는 그 키가 아예 없다).
 * ⚠️ `isSystem: false`를 표식으로 읽으면 안 된다 — 모바일 퀵타일 별칭 8행과 가져오기 스텁
 * 1행이 이미 `is_system = false`로 시드되기 때문이다(prisma/seed.ts). 설계 §2.2는 그 칸을
 * 표식으로 적었지만 실측이 그와 달랐고, 그래서 가산 필드 쪽이 유일한 표식이다.
 *
 * 다가구 사용자의 읽기는 **속한 가구 전부의 합집합**이다(§1.3): 그 전부가 이 사람의 가구이고,
 * 읽기에는 하나를 고를 필요가 없다(analytics.service.ts가 결정적 선택이 필요해 `sort()[0]`을
 * 쓰는 자리와 다른 축이다).
 *
 * 라운드 28 리뷰 F3 — `?includeAll=1`은 이제 **`active`와도 무관하게 전량**을 돌려준다.
 * 이 스위치의 용도는 "고를 목록"이 아니라 **이름 해석**이기 때문이다: 어드민에서 어떤
 * 카테고리의 `active`를 끄면 그 행이 전량 목록에서까지 사라져, 그 카테고리로 이미 기록된
 * 과거 지출의 라벨이 기록 탭·리포트 범례·CSV에서 일제히 "기타"로 바뀌었다 — 사용자가
 * 실제로 적어 둔 이름이 아니므로 허위 표시다(운영자가 노출만 끄려던 조작이 과거 데이터의
 * 표시를 조용히 바꿨다). 이름은 유지하고 "새로 고를 수는 없게" 하는 것이 의도이므로,
 * 전량 조회는 `active`를 보지 않고 기본 목록(`active && selectable`)만 좁힌다. 비활성
 * 카테고리를 픽커에서 빼는 판단은 클라이언트의 `selectableCategories`가 맡는다.
 */
@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(ListCategoriesQueryDto)) query: ListCategoriesQueryDto
  ) {
    const includeAll = includeAllRequested(query.includeAll);
    const householdIds = (request.user?.households ?? []).map((household) => household.id);
    const rows = await this.prisma.category.findMany({
      where: {
        // includeAll=1 → 노출 두 축 필터 없음(이름 해석용 전량, F3). 기본 → active + selectable.
        ...(includeAll ? {} : { active: true, selectable: true }),
        // 라운드 103 §2.2 — 소유자 축. 시드(NULL) + 호출자 가구의 커스텀만. 가구가 하나도 없는
        // 계정(온보딩 직전)이면 `in: []`이 아무것도 매치하지 않아 시드만 남는다.
        OR: [{ householdId: null }, { householdId: { in: householdIds } }]
      },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        iconName: true,
        displayOrder: true,
        isSystem: true,
        active: true,
        selectable: true,
        householdId: true
      }
    });
    // §2.2의 가산 필드 규칙: `householdId`는 **커스텀 행에만** 싣는다(시드 행에는 키 자체가
    // 없다). additive optional이라 구 클라이언트·구 캐시는 무접촉이고, 관리 화면은 이 키로
    // PATCH 대상 URL을 만든다.
    const categories = rows.map(({ householdId, ...rest }) =>
      householdId === null ? rest : { ...rest, householdId }
    );
    return { categories };
  }
}
