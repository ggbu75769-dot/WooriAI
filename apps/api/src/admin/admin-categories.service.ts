import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { foldDisplayName } from "../common/validation/display-name";
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
 *
 * 라운드 103 — 이 서비스의 세 조회가 **system-only**로 좁아진다(설계 §1.9 #2~4 ·
 * round103-custom-expense-category-design.md). 종전에는 "필터 없이 전량"이 곧 시드 전량과
 * 같은 말이었다 — `categories`에 소유자 칸이 없어 그 표에 사용자 행이 있을 수 없었기
 * 때문이다. 이제 그 표에 가구가 만든 분류가 함께 산다(`household_id`, 000024). 그래서
 * 조회마다 `householdId: null`을 명시한다:
 *   * **운영자는 사용자 분류를 보지 않는다** — 어드민 표에 개인 데이터 표면을 신설하지
 *     않는다는 라운드 100·102와 같은 판단이고, 커스텀 통계·CS 조회는 개인정보 검토가
 *     선행하는 별도 결정이다(설계 §7 이월표).
 *   * 그래서 커스텀 id로 `findById`를 부르면 종전과 같은 404 `CATEGORY_NOT_FOUND`이고,
 *     `update`는 그 404를 먼저 지나므로 커스텀 행을 고칠 수 없다(어드민 컨트롤러가
 *     findById → update 순으로 부른다).
 *   * 어드민 준비템 분류 셀렉트(`itemCategoryOptions`)는 이 목록만 보므로 함께 깨끗해진다.
 * 이 세 자리는 소유자 필터 대장(test/category-owner-scope.test.ts)에 `system-only`로 등재돼
 * 있고, 등재 없는 새 `prisma.category.` 호출은 그 대장에서 빨개진다.
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
      // 라운드 103 §1.9 #2 — 운영 시드만(`household_id IS NULL`). 사용자가 만든 분류는
      // 어드민 표에 오르지 않는다.
      where: { householdId: null },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: CATEGORY_SELECT
    });
    return { categories };
  }

  /**
   * 감사 로그 before/after 스냅샷을 만들기 위해 수정 전 행을 먼저 읽는다.
   *
   * 라운드 103 §1.9 #3 — 여기도 시드만 본다. `findUnique`는 유니크 키 밖의 술어를 받지
   * 않으므로 `findFirst`로 바꾸고 `householdId: null`을 더했다(id가 여전히 PK라 결과는
   * 여전히 0 또는 1건이다). 커스텀 id는 여기서 miss가 되어 종전과 같은 404로 떨어진다.
   */
  async findById(categoryId: string): Promise<AdminCategoryView> {
    const category = UUID_PATTERN.test(categoryId)
      ? await this.prisma.category.findFirst({
          where: { id: categoryId, householdId: null },
          select: CATEGORY_SELECT
        })
      : null;
    if (!category) {
      throw new NotFoundException({ code: "CATEGORY_NOT_FOUND", message: "카테고리를 찾을 수 없어요." });
    }
    return category;
  }

  async update(categoryId: string, input: AdminUpdateCategoryDto): Promise<AdminCategoryView> {
    if (input.name !== undefined) {
      await this.requireUniqueSeedName(categoryId, input.name);
    }
    return await this.prisma.category.update({
      // 라운드 103 §1.9 #4 — 이 쓰기는 `findById`(system-only)를 먼저 지나므로 자연히 시드
      // 행만 받는다. 그 사실을 대장 테스트가 값으로 고정한다(등재 입장: system-only).
      // `where`에 소유자 술어를 더하지 않는 이유: `update`는 유니크 키만 받고, 여기서
      // `updateMany`로 바꾸면 "없으면 0건 갱신"이 되어 404가 200으로 조용히 바뀐다.
      where: { id: categoryId },
      // 값이 오지 않은 축은 `undefined`라 Prisma가 그대로 건드리지 않는다 —
      // 부분 수정(PATCH) 계약이 그대로 유지된다.
      //
      // `name`은 DTO가 이미 정규화한 뒤 검증했다(F2) — 여기 한 번 더 접는 것은 그 계약을
      // 두 번째로 확인하는 무해한 항등 연산이고, DTO를 거치지 않는 호출부가 생겨도 공백이
      // 그대로 저장되지 않게 남겨 둔다. 공백만 있는 이름은 DTO에서 400으로 걸린다.
      //
      // 라운드 109 두 시점 — 종전(그때는 참): 여기는 `.trim()`이었고, 그때는 DTO도 `.trim()`
      // 뿐이라 두 자리가 같은 뜻이었다. → 이제 DTO가 `trim + 연속 공백 접기`(커스텀 쪽과 같은
      // 함수)까지 하므로, `.trim()`을 그대로 두면 이 "확인"이 DTO보다 약해져 항등이 아니게 된다.
      // 그래서 **같은 함수**를 부른다(`foldDisplayName` — 규칙의 구현은 저장소에 한 벌이다).
      // 보이지 않는 제어문자 거절은 여기서 하지 않는다: 그 판정은 400을 낼 수 있는 자리
      // (DTO)의 몫이고, 여기서 던지면 같은 위반이 유입 경로에 따라 400과 500으로 갈린다.
      data: {
        name: input.name === undefined ? undefined : foldDisplayName(input.name),
        displayOrder: input.displayOrder,
        active: input.active,
        selectable: input.selectable
      },
      select: CATEGORY_SELECT
    });
  }

  /**
   * 라운드 107 D6 — **어드민 이름 변경의 중복 검사.** 라운드 103이 커스텀 쪽에 세운
   * `CustomCategoriesService.requireUniqueName`과 **같은 규칙**이고, 새 규칙은 하나도 없다.
   *
   * 왜 필요한가: 이름이 겹치는 순간 앱에서 **칩 하나가 조용히 사라지고**, 살아남은 칩이
   * 사라진 칩의 지출까지 자기 합계로 끌어온다 — 사용자가 그 칩을 눌러 보는 금액이 사실이
   * 아니게 된다(허위 표시). 기제 둘은 라운드 103이 이미 값으로 적었다:
   * `apps/mobile/src/categories.ts`의 `selectableCategories`가 동명 그룹을 한 슬롯으로 접고
   * (동순위면 뒤에 온 행이 버려진다), `records-list-view.ts`의 `idsByName`이 같은 이름의 모든
   * id를 한 `matchIds`로 묶는다.
   *
   * DB는 이 방향을 잡지 못한다: `uq_categories_household_name`은 부분 색인
   * `WHERE household_id IS NOT NULL`이라(000024) **시드 행이 색인 밖**이고, 마이그레이션
   * 스스로 "그 축은 서비스 검사가 유일한 방어선"이라고 적어 두었다. 그래서 커스텀 쪽만
   * 지키던 불변식이 어드민 쪽에서 한 방향으로 뚫려 있었다.
   *
   * 비교 규칙(커스텀과 글자 그대로 같다): `trim` → 연속 공백 접기 → `toLowerCase`.
   * DB 색인 식의 `lower(btrim(name))`이 같은 뜻을 진다.
   *
   * 비교 모집단은 **시드 전량**(`householdId: null` — 정식 12 + 모바일 퀵타일 별칭 8 +
   * 가져오기 스텁 1)이다. 커스텀 행을 넣지 않는 이유는 라운드 103 §1.9가 이 서비스를
   * system-only로 좁힌 그 판단이다 — 운영자는 사용자가 만든 분류를 보지 않는다. 그 결과
   * 어드민 이름이 어느 가구의 커스텀 이름과 겹치는 경우는 **여기서 막히지 않고** 그 가구의
   * 커스텀 쪽 검사(같은 모집단에 시드를 포함한다)가 다음 쓰기에서 막는다. 이월로 남긴다.
   */
  private async requireUniqueSeedName(categoryId: string, name: string) {
    const key = duplicateKey(name);
    const rows = await this.prisma.category.findMany({
      // 라운드 103 §1.9와 같은 렌즈 — 시드만 본다. (대장 등재: system-only)
      where: { householdId: null },
      select: { id: true, name: true }
    });
    if (rows.some((row) => row.id !== categoryId && duplicateKey(row.name) === key)) {
      throw new BadRequestException({
        code: "ADMIN_CATEGORY_NAME_DUPLICATE",
        message: "이미 있는 카테고리 이름이에요. 다른 이름으로 바꿔 주세요."
      });
    }
  }
}

/**
 * 이름 비교 키. `households/custom-categories.service.ts`의 같은 이름 함수와 규칙이 같다.
 *
 * 라운드 109 두 시점 — 종전(그때는 참): 접기 정규식(`trim + /\s+/gu`)을 **여기 한 벌 더**
 * 적어 두고 "공유 모듈로 합칠 수 있게 되는 라운드에 접는다"고 남겨 두었다. → 이제 그 접기의
 * 구현은 `common/validation/display-name.ts` 한 자리이고, 이 함수는 거기에 `toLowerCase()`만
 * 더한다. 접기 규칙을 넓혀도 비교 키와 저장값이 갈릴 수 없다(DTO도 같은 함수를 부른다).
 * DB 색인 식 `lower(btrim(name))`이 같은 뜻을 진다.
 */
function duplicateKey(name: string): string {
  return foldDisplayName(name).toLowerCase();
}
