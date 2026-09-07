import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ItemsCatalogService,
  type AdminItemTemplateInput,
  type AdminProductLinkInput
} from "../onboarding/items-catalog.service";

/**
 * 어드민 단건 쓰기가 실제로 받는 상품 링크 입력. 저장소의 `AdminProductLinkInput`에 라운드 107이
 * 여는 **스폰서 라벨** 한 칸을 더한 것이다(그 타입 자체는 무접촉 파일에 있다 — 아래 머리말 참고).
 */
export type AdminProductLinkWriteInput = AdminProductLinkInput & { sponsorLabel?: string | null };

/** 스폰서 두 칸이 함께 저장될 값. `isSponsored`가 참이면 `sponsorLabel`은 반드시 비어 있지 않다. */
type SponsorState = { isSponsored: boolean; sponsorLabel: string | null };

/**
 * 스폰서 라벨의 정규화. 빈 문자열·공백만 있는 값은 "없음"과 같은 뜻으로 본다
 * (`cleanOptionalText`가 저장소의 다른 선택 텍스트 칸에 하는 것과 같은 규칙이고,
 * DB CHECK는 `NOT NULL`만 보므로 `" "`가 통과해 **보이지 않는 라벨**이 서는 것을 막는다).
 */
function cleanSponsorLabel(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 라운드 107 D2 — 어드민 카탈로그 단건 쓰기가 **DB 제약보다 앞에서 지는** 가드 계층.
 *
 * ## 왜 별도 서비스인가
 *
 * 이 가드들이 있어야 할 자리는 원래 `onboarding/items-catalog.service.ts`의
 * `adminCreate…`/`adminUpdate…`다. 그 파일은 이 작업의 **무접촉 대상**이라(같은 라운드의 다른
 * 트랙이 동시에 편집 중) 손대지 않는다. 대신 이 저장소가 이미 한 번 쓴 방법을 그대로 따른다 —
 * `content-revisions.service.ts`가 같은 이유로 그 서비스의 메서드를 **감싸서** 부르고,
 * `admin.controller.ts`의 공개 문구 자리가 같은 이유로 Prisma로 값을 덧댄다("not exposed by
 * ItemsCatalogService#adminListDisclosures, which is off-limits to edit in this task").
 * 그래서 어드민 컨트롤러와 CMS 발행 경로는 저장소를 **직접** 부르지 않고 이 서비스를 지난다.
 *
 * ⚠️ 두 시점 — 언젠가 `items-catalog.service.ts`를 편집할 수 있게 되면, 여기 셋(스폰서 라벨
 * 쓰기 · 스폰서 라벨 필수 검사 · 가격 대소 검사)은 그 서비스의 `adminCreateProductLink` ·
 * `adminUpdateProductLink` · `normalizeAdminItemTemplateInput` 안으로 옮기는 것이 맞다.
 * 그때 이 파일은 사라지고 컨트롤러는 다시 저장소를 직접 부르면 된다.
 *
 * ## 세 가드가 각각 막는 500
 *
 *  · **스폰서 라벨**(D2) — `chk_product_links_sponsor`
 *    (`is_sponsored = false OR sponsor_label IS NOT NULL`, 마이그레이션 000001). 저장소는
 *    `sponsor_label`을 **쓰지 않으므로**(그 컬럼을 쓰는 런타임 경로가 저장소 전체에 0건이었다)
 *    `isSponsored: true`는 늘 CHECK 위반 → 500이었다. 곧 DNC-011의 스폰서 구분 표시를 운영자가
 *    켤 수 있는 경로가 **없었다**는 뜻이다. 여기서 두 칸을 **한 UPDATE 문으로 함께** 쓴다 —
 *    CHECK는 문장 단위로 판정하므로 그 한 문장 안에서는 위반 순간이 없다.
 *  · **가격 대소**(D7) — `chk_item_templates_price_range (price_min_krw <= price_max_krw)`.
 *  · **가격 상한**(D7) — DTO의 `@Max(MONEY_KRW_MAX)`가 진다(admin/dto/admin.dto.ts).
 */
@Injectable()
export class AdminCatalogWriteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ItemsCatalogService) private readonly store: ItemsCatalogService
  ) {}

  async createItemTemplate(input: AdminItemTemplateInput) {
    this.requirePriceRange(input.priceMinKrw ?? null, input.priceMaxKrw ?? null);
    return await this.store.adminCreateItemTemplate(input);
  }

  async updateItemTemplate(itemTemplateId: string, input: AdminItemTemplateInput) {
    // 판정 대상은 **실제로 저장될 조합**이다: PATCH는 한쪽만 보내는 것이 정상이라, 보내지 않은
    // 축은 기존 행의 값으로 채워 비교한다. 합치는 규칙은 저장소의
    // `normalizeAdminItemTemplateInput`과 글자 그대로 같다(undefined = 그대로, null = 지우기).
    // 대상 행이 없으면 여기서는 통과시키고 저장소가 종전과 같은 404를 낸다.
    const existing = await this.prisma.itemTemplate.findUnique({
      where: { id: itemTemplateId },
      select: { priceMinKrw: true, priceMaxKrw: true }
    });
    this.requirePriceRange(
      input.priceMinKrw === undefined ? existing?.priceMinKrw ?? null : input.priceMinKrw,
      input.priceMaxKrw === undefined ? existing?.priceMaxKrw ?? null : input.priceMaxKrw
    );
    return await this.store.adminUpdateItemTemplate(itemTemplateId, input);
  }

  async createProductLink(input: AdminProductLinkWriteInput) {
    const sponsor = this.resolveSponsorState(input, null);
    // 저장소에는 스폰서를 **끈 채로** 넘긴다. 새 행에는 아직 라벨이 없으므로 저장소의 INSERT가
    // `is_sponsored = true`를 실으면 그 문장 자체가 CHECK 위반이다(= 오늘의 500).
    const created = await this.store.adminCreateProductLink({ ...toStoreInput(input), isSponsored: false });
    return { ...created, ...(await this.writeSponsorState(created.id, sponsor)) };
  }

  async updateProductLink(productLinkId: string, input: AdminProductLinkWriteInput) {
    const current = await this.prisma.productLink.findUnique({
      where: { id: productLinkId },
      select: { isSponsored: true, sponsorLabel: true }
    });
    if (!current) {
      // 없는 링크는 종전과 같은 404가 먼저다 — 이 가드가 그 앞에서 400을 내면 존재하지 않는
      // 자원에 대해 "라벨을 적어 주세요"라는 틀린 안내를 하게 된다.
      return await this.store.adminUpdateProductLink(productLinkId, toStoreInput(input));
    }
    const sponsor = this.resolveSponsorState(input, current);
    // 저장소에는 스폰서 축을 **보내지 않는다**(undefined = 그대로 두기). 기존 행은 이미
    // CHECK를 만족하는 상태이므로 저장소의 UPDATE는 그 축을 건드리지 않고 지나가고, 스폰서
    // 두 칸은 아래 한 문장이 함께 쓴다.
    const updated = await this.store.adminUpdateProductLink(productLinkId, {
      ...toStoreInput(input),
      isSponsored: undefined
    });
    return { ...updated, ...(await this.writeSponsorState(productLinkId, sponsor, current)) };
  }

  /**
   * 스폰서 두 칸을 **한 UPDATE 문**으로 쓴다. 값이 이미 같으면 쓰지 않는다(무변경 PATCH가
   * `updatedAt`을 흔들지 않게 — 벌크 교체가 같은 이유로 무변경 행을 건너뛴다).
   *
   * ⚠️ 두 시점 — 생성 경로에서는 이 쓰기가 저장소의 INSERT **다음**에 온다. 그 사이에 프로세스가
   * 죽으면 링크는 "스폰서 아님"으로 남는다(= 라벨 없는 스폰서 행은 만들어질 수 없다: 거짓 표시가
   * 아니라 표시 없음이고, 운영자는 같은 화면에서 다시 켤 수 있다). 한 트랜잭션으로 묶으려면
   * 저장소가 tx 클라이언트를 받아야 하는데 그 파일이 무접촉이라 오늘은 할 수 없다 —
   * `content-revisions.service.ts`가 발행 경로에서 같은 이유로 같은 선택을 적어 두었다.
   */
  private async writeSponsorState(
    productLinkId: string,
    next: SponsorState,
    current?: SponsorState
  ): Promise<SponsorState> {
    if (current && current.isSponsored === next.isSponsored && current.sponsorLabel === next.sponsorLabel) {
      return next;
    }
    if (!current && !next.isSponsored && next.sponsorLabel === null) {
      // 생성 직후의 기본값(스폰서 아님 · 라벨 없음)은 저장소의 INSERT가 이미 쓴 값이다.
      return next;
    }
    const row = await this.prisma.productLink.update({
      where: { id: productLinkId },
      data: { isSponsored: next.isSponsored, sponsorLabel: next.sponsorLabel },
      select: { isSponsored: true, sponsorLabel: true }
    });
    return row;
  }

  /**
   * 저장될 스폰서 상태를 정한다. PATCH 관례는 다른 축과 같다 — 보내지 않은 축은 기존 값.
   *
   * 400을 **저장 전에** 내는 이유: 여기서 통과시키면 CHECK가 500으로 잡고, 운영자는 "요청을
   * 처리하지 못했어요"만 보게 된다(DNC-018이 금지하는 틀린 안내 — 다시 눌러도 같은 결과다).
   */
  private resolveSponsorState(input: AdminProductLinkWriteInput, current: SponsorState | null): SponsorState {
    const isSponsored = input.isSponsored ?? current?.isSponsored ?? false;
    const sponsorLabel =
      input.sponsorLabel === undefined ? current?.sponsorLabel ?? null : cleanSponsorLabel(input.sponsorLabel);
    if (isSponsored && !sponsorLabel) {
      throw new BadRequestException({
        code: "ADMIN_SPONSOR_LABEL_REQUIRED",
        message: "스폰서 링크에는 화면에 보일 스폰서 표시 문구가 필요해요. 스폰서 표시 문구를 적어 주세요."
      });
    }
    return { isSponsored, sponsorLabel };
  }

  private requirePriceRange(priceMinKrw: number | null, priceMaxKrw: number | null) {
    if (priceMinKrw === null || priceMaxKrw === null) return;
    if (priceMinKrw <= priceMaxKrw) return;
    throw new BadRequestException({
      code: "ADMIN_ITEM_PRICE_RANGE_INVALID",
      message: "최소 가격이 최대 가격보다 커요. 최소 가격을 최대 가격 이하로 맞춰 주세요."
    });
  }
}

/** 저장소가 아는 축만 남긴다 — `sponsorLabel`은 이 서비스가 직접 쓰는 칸이라 넘기지 않는다. */
function toStoreInput(input: AdminProductLinkWriteInput): AdminProductLinkInput {
  const { sponsorLabel, ...rest } = input;
  void sponsorLabel;
  return rest;
}
