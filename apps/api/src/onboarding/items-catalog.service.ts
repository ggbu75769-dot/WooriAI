import { randomBytes, randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  sortRecommendedItems,
  type ChildStageCode,
  type ItemStatus,
  type NecessityLevel,
  type ProductPlatform
} from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { isHttpOrHttpsUrl } from "../common/validation/url-scheme";
import { hashClickIp, isAllowedAffiliateUrl, PRODUCT_LINK_NOT_FOUND_ERROR } from "../items-commerce/affiliate-link-guard.util";
import { itemStagesMatchBand, type StageBandLabel } from "../items-commerce/stage-bands";
import { ChildAccessService } from "./child-access.service";
import { ExpensesStoreService } from "./expenses-store.service";
import { cleanOptionalText, toChildDto, type DbClient } from "./store-shared";

type ItemTemplateRow = {
  id: string;
  code: string;
  name: string;
  necessityLevel: NecessityLevel;
  timingLabel: string | null;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  displayOrder: number;
  active: boolean;
};

type ItemTemplateWithStages = ItemTemplateRow & { stageCodes: ChildStageCode[] };

type ProductLinkRow = {
  id: string;
  itemTemplateId: string;
  platform: ProductPlatform;
  title: string;
  url: string;
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureText: string | null;
  displayOrder: number;
  active: boolean;
  // COM-105 link health (migration 000009): "ok" | "broken" | "unstable",
  // null = never checked. Optional so hand-built rows in older code/tests
  // keep compiling; Prisma rows always carry both.
  healthStatus?: string | null;
  healthCheckedAt?: Date | null;
};

export type AdminItemTemplateInput = {
  name?: string;
  categoryId?: string;
  necessityLevel?: NecessityLevel;
  timingLabel?: string;
  priceMinKrw?: number | null;
  priceMaxKrw?: number | null;
  reasonText?: string;
  skipReasonText?: string | null;
  usedSecondhandOk?: boolean;
  safetyNote?: string | null;
  stageCodes?: ChildStageCode[];
  active?: boolean;
};

export type AdminProductLinkInput = {
  itemTemplateId?: string;
  platform?: ProductPlatform;
  title?: string;
  url?: string;
  affiliateUrl?: string | null;
  isAffiliate?: boolean;
  isSponsored?: boolean;
  disclosureText?: string | null;
  active?: boolean;
};

/**
 * ITEM-123 (B5): `all`은 상태로 거르지 않는 **전체 스냅샷** 탭이다. 기존 4개 탭은 그대로 두고
 * 추가만 했으므로(하위호환) 예전 클라이언트는 영향을 받지 않는다. 준비율(ITEM-114)처럼
 * "모든 활성 준비물의 현재 상태"가 필요한 화면이 탭 4개를 각각 부르는 대신 1요청으로
 * 같은 집합을 받는다.
 */
export type ItemTab = "now" | "soon" | "prepared" | "not_needed" | "all";

/**
 * ITEM-123 (B4): 상태 탭이 담는 상태 집합.
 *
 * gifted가 어느 탭에 속하는가 — `prepared`다. 근거:
 * - 도메인(packages/domain/src/recommendation.ts EXCLUDED_NOW_NEEDED_STATUSES)은
 *   prepared/gifted/not_needed를 "지금 필요" 추천에서 함께 제외한다. 세 상태 모두
 *   더 이상 준비 행동이 필요 없다는 뜻이다.
 * - 그 안에서 gifted는 "선물로 받아 **이미 손에 있다**"이므로 물건을 갖춘 prepared와
 *   같은 계열이고, "필요 없다고 판단해 **준비하지 않기로 했다**"인 not_needed와는
 *   의미가 정반대다. 준비완료 탭에 넣어야 사용자가 가진 물건을 한 곳에서 본다.
 * - 예전에는 어느 탭에도 없어서 gifted 항목이 앱에서 완전히 사라졌다(ITEM-114 준비율의
 *   분모에서도 빠졌다). 탭 응답이 넓어질 뿐 기존 항목이 사라지지 않으므로 하위호환이다.
 */
const TAB_STATUSES: Record<"prepared" | "not_needed", ItemStatus[]> = {
  prepared: ["prepared", "gifted"],
  not_needed: ["not_needed"]
};

function priceBandText(priceMinKrw: number | null, priceMaxKrw: number | null) {
  if (priceMinKrw == null && priceMaxKrw == null) {
    return undefined;
  }
  if (priceMinKrw != null && priceMaxKrw != null) {
    return `${priceMinKrw.toLocaleString("ko-KR")}~${priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  if (priceMinKrw != null) {
    return `${priceMinKrw.toLocaleString("ko-KR")}원부터`;
  }
  return `${priceMaxKrw!.toLocaleString("ko-KR")}원 이하`;
}

/**
 * REF-118: preparation-item catalog + commerce surface split out of the former
 * onboarding-store.service.ts god service — stage-filtered item tabs, item
 * detail with product links, per-child item status, affiliate click logging
 * (COM-106 allowlist behavior unchanged), and the admin catalog CRUD
 * (item templates, product links, disclosures, click summary). Public HTTP
 * contract, error codes and response shapes are unchanged.
 */
@Injectable()
export class ItemsCatalogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService,
    @Inject(ExpensesStoreService) private readonly expensesStore: ExpensesStoreService
  ) {}

  /**
   * ITEM-121: `stageBand`는 선택적이다.
   * - 생략(기존 호출자 전부): 아이의 **현재 단계** 기준 — 종전 동작 그대로다.
   * - 지정: 그 **시기 밴드** 기준 — 현재 단계와 다른 시기의 준비물도 미리 볼 수 있고
   *   (예비 부모의 "다음 시기 미리 보기"), prepared/not_needed 탭도 같은 밴드로 좁힌다.
   *   단 tab="all"(전 상태 스냅샷)은 밴드를 무시한다 — 아래 itemsForChild의 FIX/F4 참고.
   */
  async listItems(user: AuthenticatedUser, childId: string, tab: ItemTab = "now", stageBand?: StageBandLabel) {
    await this.childAccess.requireChildAccess(user, childId);
    const items = await this.itemsForChild(childId, tab, stageBand);
    return { items: items.map(({ item, status }) => this.toItemSummaryDto(item, status)) };
  }

  async getItemDetail(user: AuthenticatedUser, childId: string, itemTemplateId: string) {
    await this.childAccess.requireChildAccess(user, childId);
    const item = await this.requireItemTemplate(itemTemplateId);
    const status = await this.itemStatusFor(childId, itemTemplateId);
    const links = await this.prisma.productLink.findMany({
      where: { itemTemplateId: item.id, active: true },
      orderBy: { displayOrder: "asc" }
    });
    const disclosures = await this.disclosuresByKey();

    return {
      ...this.toItemSummaryDto(item, status),
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      productLinks: links.map((link) => this.toProductLinkDto(link, disclosures))
    };
  }

  async updateItemStatus(user: AuthenticatedUser, childId: string, itemTemplateId: string, status: ItemStatus, expenseId?: string) {
    await this.childAccess.requireChildAccess(user, childId, true);
    const item = await this.requireItemTemplate(itemTemplateId);
    if (expenseId) {
      await this.expensesStore.requireExpenseBelongsToChild(user, expenseId, childId);
    }
    await this.setChildItemStatus(user, childId, itemTemplateId, status, expenseId);
    return this.toItemSummaryDto(item, status);
  }

  async clickProductLink(
    user: AuthenticatedUser,
    productLinkId: string,
    input: { childId: string; referrerScreenId?: string },
    requestMeta?: { ip?: string; userAgent?: string }
  ) {
    const child = await this.childAccess.requireChildAccess(user, input.childId);
    const productLink = await this.prisma.productLink.findFirst({ where: { id: productLinkId, active: true } });
    if (!productLink) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "상품 링크를 찾을 수 없어요." });
    }
    await this.requireItemTemplate(productLink.itemTemplateId);

    const redirectUrl = productLink.affiliateUrl ?? productLink.url;
    this.requireHttpUrl(redirectUrl);
    // COM-106: same allowlist check as the public GET /r/:code redirect (§4). A disallowed
    // domain returns the same 404 as "link not found" — see PRODUCT_LINK_NOT_FOUND_ERROR's
    // doc comment for why the codes are unified — and the click is not logged.
    if (!isAllowedAffiliateUrl(redirectUrl)) {
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }

    // subId is a self-generated uuid (never derived from user/child identifiers) reused as
    // the row's own id, per round5a-sprint2-plan.md §4's "subId=clickId — PII 금지".
    const clickId = randomUUID();
    const click = await this.prisma.affiliateClick.create({
      data: {
        id: clickId,
        userId: user.id,
        householdId: child.householdId,
        childId: input.childId,
        itemTemplateId: productLink.itemTemplateId,
        productLinkId: productLink.id,
        platform: productLink.platform,
        referrerScreenId: input.referrerScreenId,
        subId: clickId,
        ipHash: hashClickIp(requestMeta?.ip),
        userAgent: requestMeta?.userAgent ?? null
      }
    });

    return {
      clickId: click.id,
      redirectUrl,
      disclosureText: productLink.disclosureText ?? undefined
    };
  }

  /**
   * Stage-sorted "now" tab summaries, consumed by ReportingStoreService.getHome.
   *
   * ⚠️ 호출 전 접근검증 필수 (FIX-118B/F5): REF-118 분리 때 다른 서비스가 쓰려고
   * public이 된 childId 기반 조회다 — `user` 인자가 없고 권한 확인도 하지
   * 않는다. 호출자가 먼저 ChildAccessService.requireChildAccess를 통과시켜야
   * 한다(getHome이 그 규약을 지킨다). listItems처럼 user를 받는 메서드는 스스로
   * 확인하므로 이 경고 대상이 아니다.
   */
  async recommendedItemsForChild(childId: string) {
    const items = await this.itemsForChild(childId, "now");
    return items.map(({ item, status }) => this.toItemSummaryDto(item, status));
  }

  // ---------------------------------------------------------------------------
  // admin catalog
  // ---------------------------------------------------------------------------

  async adminListItemTemplates() {
    const items = await this.listItemTemplatesWithStages(false);
    const links = await this.prisma.productLink.findMany();
    const disclosures = await this.disclosuresByKey();
    const linksByItem = this.groupBy(links, (link) => link.itemTemplateId);
    return { items: items.map((item) => this.toAdminItemDetailDto(item, linksByItem.get(item.id) ?? [], disclosures)) };
  }

  async adminCreateItemTemplate(input: AdminItemTemplateInput) {
    const normalized = this.normalizeAdminItemTemplateInput(input, {});
    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.itemTemplate.create({
        data: {
          code: `admin_${Date.now()}_${randomBytes(3).toString("hex")}`,
          name: normalized.name!,
          categoryId: input.categoryId ?? null,
          necessityLevel: normalized.necessityLevel!,
          timingLabel: normalized.timingLabel ?? "",
          priceMinKrw: normalized.priceMinKrw ?? null,
          priceMaxKrw: normalized.priceMaxKrw ?? null,
          reasonText: normalized.reasonText!,
          skipReasonText: normalized.skipReasonText ?? null,
          usedSecondhandOk: normalized.usedSecondhandOk ?? false,
          safetyNote: normalized.safetyNote ?? null,
          displayOrder: await this.nextItemDisplayOrder(tx),
          active: normalized.active ?? true
        }
      });
      await this.replaceItemTemplateStages(tx, item.id, normalized.stageCodes ?? (["infant_4_6"] as ChildStageCode[]));
      return item;
    });

    const withStages = await this.requireItemTemplateAnyStatus(created.id);
    return this.toAdminItemDetailDto(withStages, [], await this.disclosuresByKey());
  }

  async adminUpdateItemTemplate(itemTemplateId: string, input: AdminItemTemplateInput) {
    const item = await this.requireItemTemplateAnyStatus(itemTemplateId);
    const normalized = this.normalizeAdminItemTemplateInput(input, item);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.itemTemplate.update({
        where: { id: itemTemplateId },
        data: {
          name: normalized.name!,
          categoryId: input.categoryId ?? undefined,
          necessityLevel: normalized.necessityLevel!,
          timingLabel: normalized.timingLabel ?? "",
          priceMinKrw: normalized.priceMinKrw ?? null,
          priceMaxKrw: normalized.priceMaxKrw ?? null,
          reasonText: normalized.reasonText!,
          skipReasonText: normalized.skipReasonText ?? null,
          usedSecondhandOk: normalized.usedSecondhandOk ?? false,
          safetyNote: normalized.safetyNote ?? null,
          active: normalized.active ?? true
        }
      });
      if (normalized.stageCodes) {
        await this.replaceItemTemplateStages(tx, itemTemplateId, normalized.stageCodes);
      }
      return row;
    });

    const withStages = await this.requireItemTemplateAnyStatus(updated.id);
    const links = await this.prisma.productLink.findMany({ where: { itemTemplateId } });
    return this.toAdminItemDetailDto(withStages, links, await this.disclosuresByKey());
  }

  async adminListProductLinks() {
    const links = await this.prisma.productLink.findMany();
    const disclosures = await this.disclosuresByKey();
    return { links: links.map((link) => this.toAdminProductLinkDto(link, disclosures)) };
  }

  async adminCreateProductLink(input: AdminProductLinkInput) {
    if (!input.itemTemplateId) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template is required." });
    }
    await this.requireItemTemplateAnyStatus(input.itemTemplateId);
    if (!input.platform || !input.title?.trim() || !input.url?.trim()) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    this.requireHttpUrl(input.url);
    if (input.affiliateUrl) {
      this.requireHttpUrl(input.affiliateUrl);
    }

    const link = await this.prisma.productLink.create({
      data: {
        itemTemplateId: input.itemTemplateId,
        platform: input.platform,
        title: input.title.trim(),
        url: input.url.trim(),
        affiliateUrl: cleanOptionalText(input.affiliateUrl ?? undefined),
        isAffiliate: input.isAffiliate ?? false,
        isSponsored: input.isSponsored ?? false,
        disclosureText: cleanOptionalText(input.disclosureText ?? undefined),
        displayOrder: await this.nextProductLinkDisplayOrder(input.itemTemplateId),
        active: input.active ?? true
      }
    });
    return this.toAdminProductLinkDto(link, await this.disclosuresByKey());
  }

  async adminUpdateProductLink(productLinkId: string, input: AdminProductLinkInput) {
    const current = await this.requireProductLinkAnyStatus(productLinkId);
    const itemTemplateId = input.itemTemplateId ?? current.itemTemplateId;
    await this.requireItemTemplateAnyStatus(itemTemplateId);

    const title = input.title === undefined ? current.title : input.title.trim();
    const url = input.url === undefined ? current.url : input.url.trim();
    if (!title || !url) {
      throw new BadRequestException({ code: "ADMIN_PRODUCT_LINK_REQUIRED", message: "Product link fields are required." });
    }
    this.requireHttpUrl(url);
    const affiliateUrl =
      input.affiliateUrl === undefined ? current.affiliateUrl : cleanOptionalText(input.affiliateUrl ?? undefined);
    if (affiliateUrl) {
      this.requireHttpUrl(affiliateUrl);
    }

    const updated = await this.prisma.productLink.update({
      where: { id: productLinkId },
      data: {
        itemTemplateId,
        platform: input.platform ?? current.platform,
        title,
        url,
        affiliateUrl,
        isAffiliate: input.isAffiliate ?? current.isAffiliate,
        isSponsored: input.isSponsored ?? current.isSponsored,
        disclosureText:
          input.disclosureText === undefined ? current.disclosureText : cleanOptionalText(input.disclosureText ?? undefined),
        active: input.active ?? current.active
      }
    });
    return this.toAdminProductLinkDto(updated, await this.disclosuresByKey());
  }

  async adminListDisclosures() {
    const rows = await this.prisma.disclosure.findMany({ orderBy: { key: "asc" } });
    return { disclosures: rows.map((row) => ({ key: row.key, text: row.text })) };
  }

  async adminUpdateDisclosure(key: string, text: string) {
    const cleanedText = text.trim();
    if (!cleanedText) {
      throw new BadRequestException({ code: "ADMIN_DISCLOSURE_REQUIRED", message: "Disclosure text is required." });
    }
    const row = await this.prisma.disclosure.upsert({
      where: { key },
      update: { text: cleanedText },
      create: { key, text: cleanedText }
    });
    return { key: row.key, text: row.text };
  }

  async adminAffiliateClickSummary() {
    const grouped = await this.prisma.affiliateClick.groupBy({
      by: ["platform"],
      _count: { _all: true }
    });
    const totalClicks = grouped.reduce((sum, group) => sum + group._count._all, 0);
    return {
      totalClicks,
      byPlatform: grouped.map((group) => ({ platform: group.platform, count: group._count._all }))
    };
  }

  // ---------------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------------

  private async requireItemTemplate(itemTemplateId: string): Promise<ItemTemplateWithStages> {
    const item = await this.itemTemplateWithStages(itemTemplateId);
    if (!item || !item.active) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "준비템을 찾을 수 없어요." });
    }
    return item;
  }

  private async requireItemTemplateAnyStatus(itemTemplateId: string): Promise<ItemTemplateWithStages> {
    const item = await this.itemTemplateWithStages(itemTemplateId);
    if (!item) {
      throw new NotFoundException({ code: "ITEM_NOT_FOUND", message: "Item template was not found." });
    }
    return item;
  }

  private async requireProductLinkAnyStatus(productLinkId: string): Promise<ProductLinkRow> {
    const link = await this.prisma.productLink.findUnique({ where: { id: productLinkId } });
    if (!link) {
      throw new NotFoundException({ code: "PRODUCT_LINK_NOT_FOUND", message: "Product link was not found." });
    }
    return link;
  }

  private async itemTemplateWithStages(itemTemplateId: string): Promise<ItemTemplateWithStages | null> {
    const item = await this.prisma.itemTemplate.findUnique({ where: { id: itemTemplateId } });
    if (!item) return null;
    const stages = await this.prisma.itemTemplateStage.findMany({
      where: { itemTemplateId },
      orderBy: { priorityWeight: "desc" }
    });
    return { ...item, stageCodes: stages.map((stage) => stage.stageCode) };
  }

  private async listItemTemplatesWithStages(activeOnly: boolean): Promise<ItemTemplateWithStages[]> {
    const items = await this.prisma.itemTemplate.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { displayOrder: "asc" }
    });
    if (items.length === 0) return [];
    const stages = await this.prisma.itemTemplateStage.findMany({
      where: { itemTemplateId: { in: items.map((item) => item.id) } },
      orderBy: { priorityWeight: "desc" }
    });
    const stagesByItem = this.groupBy(stages, (stage) => stage.itemTemplateId);
    return items.map((item) => ({
      ...item,
      stageCodes: (stagesByItem.get(item.id) ?? []).map((stage) => stage.stageCode)
    }));
  }

  private toItemSummaryDto(item: ItemTemplateWithStages, status: ItemStatus) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status,
      // CON-115: DB에서 null인 timingLabel은 undefined로 정리해 계약(z.string().optional())과
      // 모바일 타입(timingLabel?: string)에 맞춘다 — null이 그대로 나가면 계약 위반.
      timingLabel: item.timingLabel ?? undefined,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
      stageCodes: item.stageCodes
    };
  }

  private toProductLinkDto(link: ProductLinkRow, disclosures: Map<string, string>) {
    return {
      id: link.id,
      platform: link.platform,
      title: link.title,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link, disclosures)
    };
  }

  private toAdminItemDetailDto(item: ItemTemplateWithStages, links: ProductLinkRow[], disclosures: Map<string, string>) {
    return {
      id: item.id,
      name: item.name,
      necessityLevel: item.necessityLevel,
      status: "not_prepared" as const,
      timingLabel: item.timingLabel,
      priceBandText: priceBandText(item.priceMinKrw, item.priceMaxKrw),
      reasonText: item.reasonText,
      skipReasonText: item.skipReasonText,
      usedSecondhandOk: item.usedSecondhandOk,
      safetyNote: item.safetyNote,
      active: item.active,
      stageCodes: item.stageCodes,
      productLinks: [...links]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((link) => this.toAdminProductLinkDto(link, disclosures))
    };
  }

  private toAdminProductLinkDto(link: ProductLinkRow, disclosures: Map<string, string>) {
    return {
      id: link.id,
      itemTemplateId: link.itemTemplateId,
      platform: link.platform,
      title: link.title,
      url: link.url,
      affiliateUrl: link.affiliateUrl,
      isAffiliate: link.isAffiliate,
      isSponsored: link.isSponsored,
      disclosureText: link.disclosureText ?? this.defaultDisclosureFor(link, disclosures),
      active: link.active,
      // COM-105: worker-written health verdict, surfaced on the admin links
      // page only (the app-facing toProductLinkDto stays unchanged).
      healthStatus: link.healthStatus ?? null,
      healthCheckedAt: link.healthCheckedAt ?? null
    };
  }

  private async itemsForChild(
    childId: string,
    tab: ItemTab,
    stageBand?: StageBandLabel
  ): Promise<Array<{ item: ItemTemplateWithStages; status: ItemStatus }>> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) return [];

    const stageCode = toChildDto(child).currentStage as ChildStageCode;
    const activeItems = await this.listItemTemplatesWithStages(true);
    const statuses = await this.prisma.childItemStatus.findMany({ where: { childId } });
    const statusByItem = new Map(statuses.map((row) => [row.itemTemplateId, row.status]));
    const statusFor = (itemId: string): ItemStatus => statusByItem.get(itemId) ?? "not_prepared";

    // ITEM-121: 시기 필터의 기준. stageBand가 오면 "그 밴드에 걸치는가", 없으면 종전대로
    // "아이의 현재 단계를 포함하는가". now/soon은 이 술어의 참/거짓으로 갈리고,
    // prepared/not_needed는 밴드가 지정된 경우에만 추가로 좁힌다(미지정 시 종전 동작).
    const inSelectedPeriod = stageBand
      ? (item: ItemTemplateWithStages) => itemStagesMatchBand(item.stageCodes, stageBand)
      : (item: ItemTemplateWithStages) => item.stageCodes.includes(stageCode);

    // ITEM-123 (B5): 전체 스냅샷. 상태로 거르지 않으므로 now/soon/prepared/not_needed
    // 네 탭의 합집합을 빠짐없이 담고(gifted 포함), 화면이 준비율을 계산하려고
    // 탭을 4번 부르던 왕복을 1번으로 줄인다.
    //
    // FIX/F4: 예전에는 stageBand가 오면 다른 상태 탭들처럼 밴드로 좁혔는데, 그러면
    // 합집합보다 **작아진다** — now는 밴드에 걸치는 항목, soon은 그 여집합이라 둘의
    // 합집합은 밴드와 무관하게 "미준비·관심" 전부다. 밴드로 좁힌 all에는 soon 탭에
    // 버젓이 보이는 항목이 빠져 있었고, 준비율의 분모도 그만큼 줄었다. 그래서 all은
    // 밴드를 적용하지 않는다(밴드 유무와 상관없이 활성 항목 전체).
    // 정확히 말하면 all ⊇ 네 탭의 합집합이다: 밴드가 지정되면 prepared/not_needed 탭은
    // 밴드로 좁혀지므로, 밴드 밖의 이미 정리된 항목(prepared/gifted/not_needed)은 어느
    // 탭에도 안 보이지만 스냅샷에는 남는다. 준비율은 분모·분자를 같은 스냅샷에서 세므로
    // 이 여유분이 비율을 왜곡하지 않는다(오히려 밴드로 좁히면 정리된 항목만 빠져 왜곡된다).
    if (tab === "all") {
      return [...activeItems]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ item, status: statusFor(item.id) }));
    }

    if (tab === "prepared" || tab === "not_needed") {
      const tabStatuses = TAB_STATUSES[tab];
      return activeItems
        .filter((item) => tabStatuses.includes(statusFor(item.id)))
        .filter((item) => (stageBand ? inSelectedPeriod(item) : true))
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => ({ item, status: statusFor(item.id) }));
    }

    const stageMatcher =
      tab === "now"
        ? (item: ItemTemplateWithStages) => inSelectedPeriod(item)
        : (item: ItemTemplateWithStages) => !inSelectedPeriod(item);

    const candidates = activeItems.filter(stageMatcher).filter((item) => {
      const status = statusFor(item.id);
      return status === "not_prepared" || status === "interested";
    });

    const sorted = sortRecommendedItems(
      candidates.map((item) => ({
        id: item.id,
        // 점수의 stageMatches는 밴드와 무관하게 늘 "아이의 현재 단계"를 뜻한다 — 다음 시기를
        // 미리 볼 때도 지금 당장 필요한 항목이 위로 오게 하는 편이 사용자에게 정직하다.
        stageMatches: item.stageCodes.includes(stageCode),
        necessityLevel: item.necessityLevel,
        status: statusFor(item.id),
        budgetFits: true,
        userInterest: statusFor(item.id) === "interested",
        displayOrder: item.displayOrder
      }))
    );
    // FIX/ITEM-121(F3): 예전에는 비교자 안에서 sorted.findIndex를 두 번 돌려 O(n²)였다.
    // 순위를 Map으로 한 번만 만들어 O(n log n)으로 정렬한다(결과 순서는 동일).
    const itemById = new Map(candidates.map((item) => [item.id, item]));
    const rankById = new Map(sorted.map((entry, index) => [entry.id, index]));
    return sorted
      .map((entry) => itemById.get(entry.id))
      .filter((item): item is ItemTemplateWithStages => Boolean(item))
      .sort((left, right) => {
        const leftIndex = rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex || left.displayOrder - right.displayOrder;
      })
      .map((item) => ({ item, status: statusFor(item.id) }));
  }

  private async itemStatusFor(childId: string, itemTemplateId: string): Promise<ItemStatus> {
    const row = await this.prisma.childItemStatus.findUnique({
      where: { childId_itemTemplateId: { childId, itemTemplateId } }
    });
    return row?.status ?? "not_prepared";
  }

  /**
   * 사용자가 상태를 **명시적으로 고른** 경로(PATCH .../status)의 쓰기 지점이므로
   * 무조건 덮어쓴다 — gifted/not_needed로 바꾸는 것도, 거기서 다시 되돌리는 것도
   * 사용자의 의도다. 지출 기록이 자동으로 준비 완료를 표시하는 경로는 이와 달리
   * 이미 정리된 상태를 보존해야 해서 별도 규칙을 쓴다:
   * store-shared.ts의 markLinkedItemPrepared (R19-B) 참고.
   */
  private async setChildItemStatus(
    user: AuthenticatedUser,
    childId: string,
    itemTemplateId: string,
    status: ItemStatus,
    expenseId?: string | null
  ) {
    await this.prisma.childItemStatus.upsert({
      where: { childId_itemTemplateId: { childId, itemTemplateId } },
      update: { status, expenseId: expenseId ?? null, updatedByUserId: user.id },
      create: { childId, itemTemplateId, status, expenseId: expenseId ?? null, updatedByUserId: user.id }
    });
  }

  private async disclosuresByKey(): Promise<Map<string, string>> {
    const rows = await this.prisma.disclosure.findMany();
    return new Map(rows.map((row) => [row.key, row.text]));
  }

  private normalizeAdminItemTemplateInput(input: AdminItemTemplateInput, existing: Partial<ItemTemplateWithStages>) {
    const name = input.name ?? existing.name;
    const necessityLevel = input.necessityLevel ?? existing.necessityLevel;
    const reasonText = input.reasonText ?? existing.reasonText;
    if (!name?.trim() || !necessityLevel || !reasonText?.trim()) {
      throw new BadRequestException({ code: "ADMIN_ITEM_TEMPLATE_REQUIRED", message: "Item template fields are required." });
    }
    const skipReasonText = cleanOptionalText(input.skipReasonText ?? existing.skipReasonText ?? undefined);
    if (necessityLevel !== "essential" && !skipReasonText) {
      throw new BadRequestException({
        code: "ADMIN_SKIP_REASON_REQUIRED",
        message: "Non-essential preparation items need skip guidance."
      });
    }
    return {
      name: name.trim(),
      necessityLevel,
      timingLabel: cleanOptionalText(input.timingLabel ?? existing.timingLabel ?? undefined) ?? "",
      priceMinKrw: input.priceMinKrw ?? existing.priceMinKrw ?? null,
      priceMaxKrw: input.priceMaxKrw ?? existing.priceMaxKrw ?? null,
      reasonText: reasonText.trim(),
      skipReasonText,
      usedSecondhandOk: input.usedSecondhandOk ?? existing.usedSecondhandOk ?? false,
      safetyNote: cleanOptionalText(input.safetyNote ?? existing.safetyNote ?? undefined),
      active: input.active ?? existing.active ?? true,
      stageCodes: input.stageCodes?.length ? input.stageCodes : existing.stageCodes
    };
  }

  private async replaceItemTemplateStages(tx: DbClient, itemTemplateId: string, stageCodes: ChildStageCode[]) {
    await tx.itemTemplateStage.deleteMany({ where: { itemTemplateId } });
    for (const [index, stageCode] of stageCodes.entries()) {
      await tx.itemTemplateStage.create({
        data: { itemTemplateId, stageCode, priorityWeight: stageCodes.length - index }
      });
    }
  }

  private async nextItemDisplayOrder(client: DbClient) {
    const max = await client.itemTemplate.aggregate({ _max: { displayOrder: true } });
    return (max._max.displayOrder ?? 0) + 10;
  }

  private async nextProductLinkDisplayOrder(itemTemplateId: string) {
    const max = await this.prisma.productLink.aggregate({
      where: { itemTemplateId },
      _max: { displayOrder: true }
    });
    return (max._max.displayOrder ?? 0) + 10;
  }

  private defaultDisclosureFor(link: { isSponsored: boolean; isAffiliate: boolean }, disclosures: Map<string, string>) {
    if (link.isSponsored) return disclosures.get("sponsored_product");
    if (link.isAffiliate) return disclosures.get("affiliate_purchase");
    return undefined;
  }

  private requireHttpUrl(value: string) {
    if (!isHttpOrHttpsUrl(value)) {
      throw new BadRequestException({
        code: "PRODUCT_LINK_URL_SCHEME_INVALID",
        message: "상품 링크 주소는 http 또는 https로 시작해야 해요."
      });
    }
  }

  private groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }
}
