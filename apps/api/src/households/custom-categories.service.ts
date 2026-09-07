import { randomBytes } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isUuid } from "../common/validation/uuid";
import {
  customCategoryMaxPerHousehold,
  customCategoryNameMaxLength
} from "../finance/dto/custom-categories.dto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * 라운드 103 T1 — 커스텀 지출 분류(사용자가 직접 더하는 분류) 쓰기 저장소.
 * 설계: docs/5차/round103-custom-expense-category-design.md (§1 데이터 모델 · §2 계약 · §9 확정).
 *
 * 별도 표가 아니라 `categories`의 **가구 소유 행**인 이유(§1.1): `expenses.category_id`가
 * `NOT NULL REFERENCES categories(id)`라 그 표 밖의 id는 지출에 저장될 수 없고, 그 칸을 비울
 * 수도 없다. 그래서 소유 축(`household_id`, 000024)을 그 표에 더했다 — NULL이면 운영 시드다.
 *
 * **삭제가 없다**(§1.6). "삭제"의 자리에 서는 것은 `active = false`(보관)이고, 그 분류로
 * 기록된 지출은 어디로도 가지 않는다. 하드 삭제를 두지 않은 이유 둘: ① 지출을 "기타"로
 * 재배정하는 것은 사용자가 적어 둔 사실을 앱이 조용히 바꾸는 허위 기록이다(R28-F3이 운영자의
 * 토글에 대해 내린 판정과 같은 선) ② 0건일 때만 지우더라도 검사와 삭제 사이의 경합에서
 * 지출 INSERT가 `fk_expenses_category` 위반 → **500**이 되고, 모바일 아웃박스는 5xx를 일시
 * 실패로 보고 무한 재시도한다(expenses-store.service.ts가 이름 붙인 poison pill).
 *
 * DNC-009/010/011 무관(§6.1): 커스텀 분류는 상품·링크·수수료 축과 교차하는 자리가 없다.
 */

/** 커스텀 분류의 code 접두. `mobile_`·`import_` 접두 규칙과 겹치지 않는다(§2.2). */
const CUSTOM_CATEGORY_CODE_PREFIX = "custom_";

/**
 * 커스텀 행의 `display_order` 대역 시작값. 시드 대역(정식 10~999 · 별칭·스텁 1001~1009)보다
 * 크므로 `GET /categories`·어드민의 공통 정렬(displayOrder ASC, code ASC)에서 언제나 시드
 * 뒤에 선다(§1.7). 사용자에게 순서 조정을 주지 않는다(v1 — 설계 §7 이월표).
 */
const CUSTOM_CATEGORY_DISPLAY_ORDER_BASE = 2000;

/** 응답 한 행(= 계약의 CategoryListItem + 커스텀 표식 `householdId`). */
export type CustomCategoryView = {
  id: string;
  code: string;
  name: string;
  iconName: string | null;
  displayOrder: number;
  isSystem: boolean;
  active: boolean;
  selectable: boolean;
  householdId: string;
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
  householdId: true
} as const;

/**
 * §1.4의 비교 키 — 저장값은 DTO가 이미 trim + 연속 공백 접기까지 끝냈고, 비교는 거기에
 * `toLowerCase()`를 더한 값으로 한다. DB의 `uq_categories_household_name`이 색인 식에
 * `lower(btrim(name))`을 그대로 적어 둔 것과 같은 규칙이다(마지막 방어선이 같은 뜻을 진다).
 */
function duplicateKey(name: string): string {
  return name.trim().replace(/\s+/gu, " ").toLowerCase();
}

/**
 * §2.3의 404. 시드 행 id·타 가구 id가 **전부 여기로 떨어진다** — 403이 아니라 404인 이유는
 * "내가 만든 분류"라는 자원이 그 사람에게 없기 때문이고, 존재 신탁을 만들지 않는 부수 효과도
 * 얻는다(라운드 100 `CUSTOM_ITEM_NOT_FOUND`와 같은 판단).
 */
function customCategoryNotFound(): NotFoundException {
  return new NotFoundException({
    code: "CUSTOM_CATEGORY_NOT_FOUND",
    message: "직접 추가한 분류를 찾을 수 없어요."
  });
}

@Injectable()
export class CustomCategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  /**
   * `POST /households/:householdId/categories` — 멱등은 컨트롤러의 IdempotencyInterceptor가
   * 감싼다(§2.4). 권한(owner/co_parent)은 그 앞의 HouseholdRoleGuard가 이미 판정했다.
   *
   * 검증 순서(§2.3): DTO 형식 → 권한(가드) → **이름 중복** → **한도**. 로컬 미러(T2)가 같은
   * 순서를 갖는다 — 순서가 갈리면 같은 입력에 두 구현이 다른 코드를 낸다(§3.1).
   */
  async createCustomCategory(householdId: string, name: string): Promise<CustomCategoryView> {
    await this.requireUniqueName(householdId, name, null);

    // 한도의 분모는 **보관 행을 포함한** 그 가구의 커스텀 전량이다(§1.7). count→create 사이의
    // TOCTOU는 라운드 100 R100-R ⑦과 같은 이유로 알고 수용한다: 이 상한은 정합성 불변식이
    // 아니라 전량 목록이 무한히 자라지 않게 하는 소프트 한도이고, 경합으로 한둘이 넘어도
    // 다음 생성부터 count가 상한 이상을 읽어 거절되므로 초과는 유계다.
    const existingCount = await this.prisma.category.count({ where: { householdId } });
    if (existingCount >= customCategoryMaxPerHousehold()) {
      throw new BadRequestException({
        code: "CUSTOM_CATEGORY_LIMIT_EXCEEDED",
        message:
          `직접 추가한 분류는 가구당 ${customCategoryMaxPerHousehold()}개까지예요. ` +
          "쓰지 않는 분류는 보관하고, 이름은 언제든 바꿀 수 있어요."
      });
    }

    const row = await this.prisma.category.create({
      // 요청이 정할 수 없는 축은 전부 여기서 정해진다(§2.3). `isSystem: false`는 DB CHECK
      // (chk_categories_owner_is_system)가 요구하는 값이기도 하다 — 가구 소유 행은 시스템
      // 시드일 수 없다(000024).
      data: {
        householdId,
        code: `${CUSTOM_CATEGORY_CODE_PREFIX}${randomBytes(16).toString("hex")}`,
        name,
        iconName: null,
        displayOrder: CUSTOM_CATEGORY_DISPLAY_ORDER_BASE + existingCount,
        isSystem: false,
        active: true,
        // 커스텀 행은 언제나 selectable이다 — 사용자가 "고르라고" 만든 행이다(§6.2).
        // 보관 축은 `active`이고, 두 축의 뜻은 라운드 26·28이 정한 그대로다(새 규칙 0건).
        selectable: true
      },
      select: CATEGORY_SELECT
    });
    // `custom_category.create`는 남기지 않는다(§2.5) — 행 자체가 기록이고 soft delete가 없어
    // 사라지지 않는다(라운드 100 §1.2와 같은 판단).
    return toView(row, householdId);
  }

  /**
   * `PATCH /households/:householdId/categories/:categoryId` — 이름 변경 · 보관 · 복원.
   * 자연 멱등이라 Idempotency-Key가 없다(지출 수정·라운드 100 PATCH와 같은 판단).
   */
  async updateCustomCategory(
    user: AuthenticatedUser,
    householdId: string,
    categoryId: string,
    patch: { name?: string; active?: boolean }
  ): Promise<CustomCategoryView> {
    const before = await this.requireOwnCustomCategory(householdId, categoryId);
    if (patch.name !== undefined) {
      await this.requireUniqueName(householdId, patch.name, before.id);
    }

    const after = await this.prisma.category.update({
      where: { id: before.id },
      // 값이 오지 않은 축은 `undefined`라 Prisma가 그대로 건드리지 않는다 — 부분 수정(PATCH)
      // 계약 그대로. `active: false`로 보관해도 **행·id·code는 그대로**이고 지출은 한 바이트도
      // 바뀌지 않는다(§1.6 전체가 기대는 사실).
      data: { name: patch.name, active: patch.active },
      select: CATEGORY_SELECT
    });

    /**
     * §2.5 — 이름 변경과 보관은 `budget.upsert`가 로그를 남기는 그 이유("덮어쓰면 이전 값이
     * 사라지는 한 칸")에 해당하므로 남긴다. 봉투에 **이름 문자열은 싣지 않는다**: 사용자 자유
     * 문자열은 개인정보 밀도가 높은 축이라는 라운드 100 §1.2의 결정을 그대로 따른다.
     * 알려진 귀결을 그대로 받아들인다 — **이름의 이전 값은 남지 않는다**(가구 내부의 자기
     * 라벨이라 대조가 필요한 분쟁 축이 아니다).
     *
     * `changed`는 **이 요청이 실은 축**이다(값이 실제로 달라졌는지가 아니라). 같은 이름으로
     * 다시 저장한 요청도 "이름을 건드린 요청"으로 남는 편이, 봉투를 읽는 쪽이 요청 모양을
     * 되짚을 수 있어 정직하다.
     */
    await this.auditLogger.record({
      actorUserId: user.id,
      householdId,
      action: "custom_category.update",
      targetType: "categories",
      targetId: before.id,
      after: {
        categoryId: before.id,
        householdId,
        changed: (["name", "active"] as const).filter((axis) => patch[axis] !== undefined),
        activeBefore: before.active,
        activeAfter: after.active
      }
    });
    return toView(after, householdId);
  }

  /**
   * 대상이 **그 가구의 커스텀 행**인가(§2.3의 검증 순서 3번). `householdId` 술어 하나가
   * 시드 행(그 칸이 NULL이다)과 타 가구 행을 함께 걸러 낸다 — 두 갈래를 따로 쓰지 않는다.
   * UUID가 아닌 경로 파라미터는 조회 전에 거른다(R24-M2 — Prisma가 uuid 술어에서 던지면
   * 사용자 입력이 500으로 나간다).
   */
  private async requireOwnCustomCategory(householdId: string, categoryId: string) {
    if (!isUuid(categoryId)) {
      throw customCategoryNotFound();
    }
    const row = await this.prisma.category.findFirst({
      where: { id: categoryId, householdId },
      select: CATEGORY_SELECT
    });
    if (!row) {
      throw customCategoryNotFound();
    }
    return row;
  }

  /**
   * §1.4 — 이름 중복 금지. **이 규칙이 없으면 조용히 칩이 사라진다**: 모바일의
   * `selectableCategories` 규칙 (c)가 동명 그룹을 하나로 접는데 커스텀 행은 `mobile_` 접두가
   * 아니라 정식과 동순위라, 이름이 같으면 입력 순서로 하나가 사라진다(그 행에 지출이 있어도).
   * 그리고 `buildRecordsCategoryChips`의 `idsByName`은 전량 목록을 훑으므로 커스텀 "기저귀"가
   * 퀵타일 별칭 "기저귀"의 id를 자기 `matchIds`로 흡수해 **무관한 지출을 자기 합계로 끌어온다**.
   *
   * 비교 모집단은 둘이다: **① 시드 21행 전량의 이름**(별칭·스텁 포함 — 위 두 번째 이유 때문에
   * 정식 12만으로는 부족하다) **② 그 가구의 커스텀 행 전량**(보관된 것 포함 — 보관 해제가
   * 중복을 만들면 안 된다). DB의 부분 유니크 색인은 ②만 지키므로(①은 `household_id IS NULL`
   * 이라 색인 밖) **①의 유일한 방어선이 이 검사**이고, 그 사실을 e2e가 값으로 문다.
   */
  private async requireUniqueName(householdId: string, name: string, excludeCategoryId: string | null) {
    if (name.length > customCategoryNameMaxLength()) {
      // DTO가 이미 정규화 뒤 길이를 검사했다(§9.2). 이 한 줄은 DTO를 거치지 않는 호출부가
      // 생겨도 varchar(50)이 DB에서 터지지 않게 남겨 두는 두 번째 확인이고, 조회보다 앞선다.
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "요청 값을 다시 확인해주세요." });
    }
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ householdId: null }, { householdId }] },
      select: { id: true, name: true }
    });
    const key = duplicateKey(name);
    const clash = rows.some((row) => row.id !== excludeCategoryId && duplicateKey(row.name) === key);
    if (clash) {
      throw new BadRequestException({
        code: "CUSTOM_CATEGORY_NAME_DUPLICATE",
        message: "이미 있는 분류 이름이에요. 다른 이름으로 적어 주세요."
      });
    }
  }
}

/**
 * 이 서비스가 돌려주는 행은 언제나 커스텀(= 소유 가구가 있는) 행이라 `householdId`가 실린다.
 * 값은 조회·생성이 이미 술어로 쓴 그 가구 id다 — 행에서 다시 읽어 `null` 갈래를 만들지 않는다.
 * 시드 행에는 그 키가 **아예 없는** 쪽(§2.2의 가산 필드 규칙)은 `GET /categories`의 조립이 진다.
 */
function toView(
  row: {
    id: string;
    code: string;
    name: string;
    iconName: string | null;
    displayOrder: number;
    isSystem: boolean;
    active: boolean;
    selectable: boolean;
    householdId: string | null;
  },
  householdId: string
): CustomCategoryView {
  const { householdId: _owner, ...rest } = row;
  return { ...rest, householdId };
}
