import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ItemStatus, NecessityLevel } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { AuditLoggerService } from "../common/audit/audit-logger.service";
import { isUuid } from "../common/validation/uuid";
import { stagesForBand, type StageBandLabel } from "../items-commerce/stage-bands";
import { matchesTab, type ItemRankingContext } from "./item-ranking";
import { ChildAccessService } from "./child-access.service";

/**
 * 라운드 100 T1 — 커스텀 품목(사용자 직접 추가 준비물) 저장소.
 * 설계: docs/5차/round100-custom-items-design.md (§1 데이터 모델 · §2 계약 · §9 확정).
 *
 * ItemsCatalogService와 **별도 서비스**인 이유(§8): 카탈로그 서비스가 목록 합류·상세/status
 * 다형화를 위해 이 서비스를 주입하므로, 이 서비스가 거꾸로 카탈로그를 주입하면 순환이 된다.
 * 여기는 Prisma + ChildAccessService + AuditLogger만 본다.
 *
 * DNC-009 무관(§6.1): 커스텀 행은 rankItemsForTab/sortRecommendedItems의 입력에 들어가지
 * 않고(카탈로그 랭킹 결과 **뒤에** created ASC로 덧붙는다 — §2.2), 상품 링크·수수료율·
 * 스폰서 축이 아예 없다. 추천 점수 함수는 0바이트 무접촉이다.
 */

/** custom_items.name varchar(80)와 동치 — item_templates.name과 같은 폭(§1.2). */
export const CUSTOM_ITEM_NAME_MAX_LENGTH = 80;
/** 아이당 활성(미삭제) 상한(§1.4) — 목록 API가 매 조회 전량을 합치므로 무상한 금지. */
export const CUSTOM_ITEM_MAX_PER_CHILD = 200;
/**
 * 커스텀 상세의 reasonText 고정 문구 — 계약이 min(1) 필수라 비울 수 없고, 출처를 말하는
 * 고정 문구는 지어낸 데이터가 아니라 사실의 라벨이다(§2.5). 계약 패키지의 같은 이름
 * 상수(T2 소유)와 바이트가 같아야 한다 — §9.1.
 */
export const CUSTOM_ITEM_REASON_TEXT = "직접 추가한 준비물이에요.";

/** custom_items 행(관계 미선언 스키마의 Prisma 행 모양). */
export type CustomItemRow = {
  id: string;
  childId: string;
  name: string;
  stageBand: string;
  necessityLevel: NecessityLevel;
  status: ItemStatus;
  createdAt: Date;
};

export type CustomItemInput = {
  name: string;
  stageBand: StageBandLabel;
  necessityLevel: NecessityLevel;
};

/** §9.3의 404 — 그 아이의 활성 커스텀 행 없음(타 가구 id 포함: childId 스코프 조회라 구조적 404). */
function customItemNotFound(): NotFoundException {
  return new NotFoundException({ code: "CUSTOM_ITEM_NOT_FOUND", message: "직접 추가한 준비물을 찾을 수 없어요." });
}

@Injectable()
export class CustomItemsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService,
    @Inject(AuditLoggerService) private readonly auditLogger: AuditLoggerService
  ) {}

  /** POST /children/:childId/custom-items — 멱등은 컨트롤러의 IdempotencyInterceptor가 감싼다(§2.3). */
  async createCustomItem(user: AuthenticatedUser, childId: string, input: CustomItemInput) {
    await this.childAccess.requireChildAccess(user, childId, true);
    const name = this.requireCleanName(input.name);

    // §1.4: 활성(미삭제) 행만 센다 — 소프트 삭제된 행은 한도의 분모가 아니다.
    //
    // R100-R ⑦ — count→create 사이의 TOCTOU는 **알고 수용**한다: 동시 요청 둘이 같은 199를
    // 읽으면 201번째 행이 생길 수 있다. 직렬화(트랜잭션 잠금·유니크 카운터)를 얹지 않는 근거
    // (렌즈 판정 인용): 이 한도는 정합성 불변식이 아니라 **소프트 한도**다 — 목록 API가 매
    // 조회 전량을 합치는 구조에서 무상한 적재(DoS)를 막는 가드이지(위 상수 주석), 200이라는
    // 수 자체에 계약적 의미가 없다. 경합으로 1~2건이 초과돼도 다음 생성부터 count가 상한
    // 이상을 읽어 거절되므로 초과는 유계이고, 사용자 피해·데이터 오염이 없다.
    const activeCount = await this.prisma.customItem.count({ where: { childId, deletedAt: null } });
    if (activeCount >= CUSTOM_ITEM_MAX_PER_CHILD) {
      throw new BadRequestException({
        code: "CUSTOM_ITEM_LIMIT_EXCEEDED",
        message: `직접 추가할 수 있는 준비물은 아이당 ${CUSTOM_ITEM_MAX_PER_CHILD}개까지예요.`
      });
    }

    const row = await this.prisma.customItem.create({
      data: {
        childId,
        name,
        stageBand: input.stageBand,
        necessityLevel: input.necessityLevel,
        createdByUserId: user.id,
        updatedByUserId: user.id
      }
    });
    return this.toSummaryDto(row);
  }

  /** PATCH /children/:childId/custom-items/:customItemId — 속성 수정. status는 받지 않는다(§2.4). */
  async updateCustomItem(user: AuthenticatedUser, childId: string, customItemId: string, input: Partial<CustomItemInput>) {
    await this.childAccess.requireChildAccess(user, childId, true);
    const row = await this.requireActiveCustomItem(childId, customItemId);
    const name = input.name === undefined ? undefined : this.requireCleanName(input.name);

    const updated = await this.prisma.customItem.update({
      where: { id: row.id },
      data: {
        ...(name === undefined ? {} : { name }),
        ...(input.stageBand === undefined ? {} : { stageBand: input.stageBand }),
        ...(input.necessityLevel === undefined ? {} : { necessityLevel: input.necessityLevel }),
        updatedByUserId: user.id
      }
    });
    return this.toSummaryDto(updated);
  }

  /**
   * DELETE /children/:childId/custom-items/:customItemId — 소프트 삭제(지출 DNC-014와 같은 관례,
   * §1.2). 감사 로그는 id·childId만 — **이름은 싣지 않는다**: 자유 문자열은 개인정보 밀도가
   * 높은 축이고 파기 잡이 그런 문자열을 뒤늦게 마스킹해 온 전례가 있다(§1.2 —
   * child_item_statuses.statusNote 주석의 판단과 동일).
   */
  async deleteCustomItem(user: AuthenticatedUser, childId: string, customItemId: string) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
    const row = await this.requireActiveCustomItem(childId, customItemId);

    await this.prisma.customItem.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), deletedByUserId: user.id }
    });
    await this.auditLogger.record({
      actorUserId: user.id,
      householdId: child.householdId,
      action: "custom_item.delete",
      targetType: "custom_item",
      targetId: row.id,
      after: { childId }
    });
    return { id: row.id, deleted: true as const };
  }

  /**
   * 목록 합류(§2.2): 그 아이의 활성 커스텀 행을 **카탈로그와 같은 탭 술어**(matchesTab —
   * 술어를 둘로 만들지 않는다)로 걸러 created ASC로 돌려준다. 호출자
   * (ItemsCatalogService.listItems)가 카탈로그 랭킹 결과 **뒤에** 덧붙인다 — 커스텀은
   * 추천이 아니므로 점수 안에 섞지 않는다(순서 규칙 한 문장: "탭 술어는 카탈로그와 동일,
   * 순서는 카탈로그 뒤 created ASC" — T2 로컬 미러와의 동치 계약, 리스크 R5).
   */
  async listSummariesForTab(childId: string, context: ItemRankingContext) {
    const rows = await this.prisma.customItem.findMany({
      where: { childId, deletedAt: null },
      // idx_custom_items_child_active(000022)가 그대로 서빙하는 정렬. id는 같은 시각
      // 생성의 결정적 동점 파괴자(파기 잡의 (age, id) 관례와 같은 이유).
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return rows
      .filter((row) => matchesTab(this.toRankable(row), context))
      .map((row) => this.toSummaryDto(row));
  }

  /**
   * 다형 갈래의 선조회(§2.4·§2.5): childId 스코프 + 활성만 — 타 가구 id는 구조적으로 miss.
   * UUID가 아닌 경로 파라미터는 조회 전에 걸러 miss로 취급한다(R24-M2 — Prisma가 uuid
   * 술어에서 던지면 사용자 입력이 500으로 나간다).
   */
  async findActiveCustomItem(childId: string, customItemId: string): Promise<CustomItemRow | null> {
    if (!isUuid(customItemId)) return null;
    return this.prisma.customItem.findFirst({ where: { id: customItemId, childId, deletedAt: null } });
  }

  /** status 다형 갈래(§2.4)의 쓰기: 상태 + updated_by만 갱신한다. */
  async setCustomItemStatus(user: AuthenticatedUser, row: CustomItemRow, status: ItemStatus) {
    const updated = await this.prisma.customItem.update({
      where: { id: row.id },
      data: { status, updatedByUserId: user.id }
    });
    return this.toSummaryDto(updated);
  }

  /**
   * ItemSummary 모양(+`isCustom: true` 가산 마커 — §2.2). `stageCodes`는 저장된 밴드 라벨을
   * 응답 조립 시 전개한 값(§1.3 — 매핑은 stage-bands.ts 현행 정의를 따른다), `timingLabel`은
   * 밴드 라벨 그대로다. `categoryId`·`priceBandText`는 싣지 않는다 — 없는 사실(§5).
   */
  toSummaryDto(row: CustomItemRow) {
    return {
      id: row.id,
      name: row.name,
      necessityLevel: row.necessityLevel,
      status: row.status,
      timingLabel: row.stageBand,
      stageCodes: stagesForBand(row.stageBand as StageBandLabel),
      isCustom: true as const
    };
  }

  /**
   * ItemDetail 모양(§2.5·§9.2). productLinks는 []라 앱의 기존 링크 0건 갈래가 구매 CTA·
   * 판매처 비교·제휴 고지를 접는다 — DNC-010/011의 은닉이 아니라 "고지할 대상 없음"이고,
   * 중고 OK·안전 노트·의료 안내는 주장 없음(false/null)이다. 없는 것을 지어내지 않는다(§5).
   */
  toDetailDto(row: CustomItemRow) {
    return {
      ...this.toSummaryDto(row),
      reasonText: CUSTOM_ITEM_REASON_TEXT,
      skipReasonText: null,
      usedSecondhandOk: false,
      safetyNote: null,
      medicalDisclaimerRequired: false,
      linkedExpense: null,
      productLinks: []
    };
  }

  private toRankable(row: CustomItemRow) {
    return {
      id: row.id,
      stageCodes: stagesForBand(row.stageBand as StageBandLabel),
      necessityLevel: row.necessityLevel,
      status: row.status,
      // 커스텀은 랭킹에 들어가지 않으므로(§2.2) displayOrder는 술어 판정에만 필요한
      // 자리 채움이다 — matchesTab은 이 값을 읽지 않는다.
      displayOrder: 0
    };
  }

  private async requireActiveCustomItem(childId: string, customItemId: string): Promise<CustomItemRow> {
    const row = await this.findActiveCustomItem(childId, customItemId);
    if (!row) {
      throw customItemNotFound();
    }
    return row;
  }

  /**
   * DTO의 @Transform trim(§9.1) 뒤의 방어적 재검증 — 컨트롤러 밖에서 부르는 호출자(테스트·
   * 후속 서비스)가 trim을 건너뛰어도 저장 값의 불변식(트림됨 · 1..80자)이 깨지지 않게 한다.
   */
  private requireCleanName(rawName: string): string {
    const name = rawName.trim();
    if (name.length === 0 || name.length > CUSTOM_ITEM_NAME_MAX_LENGTH) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "요청 값을 다시 확인해주세요.",
        details: { fields: [{ field: "name", constraints: { length: `1..${CUSTOM_ITEM_NAME_MAX_LENGTH}자` } }] }
      });
    }
    return name;
  }
}
