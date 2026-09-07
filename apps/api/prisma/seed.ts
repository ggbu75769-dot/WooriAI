import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashAdminPassword } from "../src/admin/admin-password";
import {
  categorySeeds,
  disclosureSeeds,
  importStubCategorySeeds,
  itemTemplateSeeds,
  mobileCategoryAliasSeeds,
  productLinkSeeds,
  productLinkSeedKey
} from "./seed-data";

const prisma = new PrismaClient();

/**
 * 라운드 107 트랙 E — **시드가 덮어써도 되는 축과 안 되는 축의 경계**(정찰 S5 D3).
 *
 * ⚠️ 이 시드는 배포마다 돈다(`scripts/deploy/oracle-bootstrap.sh`의 8단계 ·
 * `.github/workflows/ci.yml`). 종전에는 콘텐츠 다섯 표를 upsert의 `update` 갈래로
 * 전량 덮어썼고, 그래서 **어드민에서 고친 값이 다음 배포에 시드 값으로 되돌아갔다.**
 *
 * 실측(임시 DB `wooriai_seedprobe` — 마이그레이션 000001~000025 적용 → 시드 1회 →
 * 운영자 편집 4건 → 재시드 1회. 라운드 107 트랙 E):
 *
 * | 편집한 것 | 재시드 뒤 |
 * |---|---|
 * | 링크 제목 `카시트 …` → `… (운영자 수정)` | **product_links 67 → 68행.** car_seat/coupang 링크가 **둘 다 active** — 준비템 상세에 같은 상품의 구매 CTA가 둘 |
 * | 카테고리 `기저귀/위생(운영자)` · `selectable=false` | 시드 값으로 복귀 |
 * | 준비템 `카시트(운영자)` · displayOrder 77 | 시드 값으로 복귀 |
 * | 고지 문구(DNC-010) | 시드 값으로 복귀 |
 *
 * **오늘의 경계는 한 문장이다: 시드는 없는 행을 만들 뿐, 있는 행의 콘텐츠를 고치지 않는다.**
 *
 * 근거는 "누가 그 값의 단일 소스인가"다. 아래 다섯 표의 편집 축은 전부 어드민 API가
 * 쓰기 경로를 갖고 있고(`admin-categories.service.ts` · `items-catalog.service.ts`의
 * 어드민 갈래 · `admin.service.ts`의 고지 갱신 · `product-link-bulk.service.ts`),
 * 그 쓰기는 감사 로그와 CMS 발행 이력을 남긴다. 시드에는 그런 기록이 없다 —
 * 즉 배포가 조용히 이기면 **감사 로그에는 운영자의 변경만 남고 실제 값은 시드 값**이
 * 되어, 기록과 화면이 서로 다른 말을 한다.
 *
 * | 표 | 시드가 만드는가 | 시드가 고치는가 | 근거 |
 * |---|---|---|---|
 * | `categories`(정식 12 · 별칭 9) | 예 | **아니오** | `name`·`displayOrder`·`active`·`selectable` 넷이 어드민 편집 축과 정확히 겹친다. `code`·`isSystem`·`householdId`는 아무도 못 고치므로 되돌릴 것도 없다 |
 * | `item_templates` | 예 | **아니오** | 13축 전부가 어드민 PATCH의 축이다 |
 * | `item_template_stages` | **새로 만든 준비템의 것만** | 아니오 | 어드민은 단계를 **집합으로** 바꾼다(delete-all → 재삽입). 행 단위로 "없으면 만든다"를 하면 운영자가 뺀 단계가 되살아나므로, 단계의 소유자는 준비템 행을 누가 만들었는지로 갈린다 |
 * | `disclosures` | 예 | **아니오** | 문구를 되돌리는 것은 DNC-010의 반대 방향 오류다 — 법무가 새로 승인한 문구를 배포가 옛 문구로 되돌린다 |
 * | `product_links` | 예 | **아니오** | 아래 자연키 문단 참조. 플랜 A 전환(쿠팡 승인 후 CSV 일괄 교체)이 바꾸는 `url`·`affiliateUrl`·`isAffiliate`가 바로 이 표의 축이다 — 덮어쓰면 승인받은 제휴 링크가 배포마다 비제휴 검색 링크로 되돌아간다 |
 * | `admin_users` | 예 | 아니오(ADM-007, 종전 그대로) | 아래 `createAdminUserIfMissing` |
 *
 * **예외는 명시적 opt-in 하나뿐이다.** `SEED_OVERWRITE_CONTENT=1`이면 종전처럼 다섯 표를
 * 전량 덮어쓴다. 시드 데이터를 고친 뒤 로컬 dev/test DB를 시드 값으로 맞출 때만 쓴다
 * (운영 배포 경로는 이 값을 설정하지 않는다 — 부트스트랩 스크립트 8단계 주석).
 * 데이터를 통째로 버려도 되는 자리라면 `pnpm db reset`이 여전히 더 정직한 도구다.
 */
const OVERWRITE_CONTENT = process.env.SEED_OVERWRITE_CONTENT === "1";

type SeedTally = { created: number; kept: number; overwritten: number; adopted: number };

function newTally(): SeedTally {
  return { created: 0, kept: 0, overwritten: 0, adopted: 0 };
}

const tallies = {
  categories: newTally(),
  itemTemplates: newTally(),
  itemTemplateStages: newTally(),
  disclosures: newTally(),
  productLinks: newTally()
};

// 관찰형 경고 모음(DNC-018): 시드는 아무것도 지우지 않는다. 이미 중복이 생긴 환경을
// **말해 줄** 뿐이고, 무엇을 지울지는 사람이 정한다.
const warnings: string[] = [];

// COM-106: product_links.redirect_code는 NOT NULL UNIQUE opaque 코드. 기존 행이면
// seedProductLinks가 이미 저장된 코드를 그대로 두므로 건드리지 않고, 신규 생성 시에만
// 발급한다.
function generateRedirectCode(): string {
  return randomBytes(6).toString("hex");
}

async function seedCategories() {
  for (const category of categorySeeds) {
    const existing = await prisma.category.findUnique({
      where: { code: category.code },
      select: { id: true }
    });
    // 라운드 107 E: 있는 행은 그대로 둔다. 어드민이 고칠 수 있는 네 축(name·displayOrder·
    // active·selectable)이 아래 `update` 갈래와 정확히 겹치기 때문이다.
    if (existing && !OVERWRITE_CONTENT) {
      tallies.categories.kept += 1;
      continue;
    }

    await prisma.category.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        iconName: category.iconName,
        displayOrder: category.displayOrder,
        isSystem: true,
        active: true,
        // CAT-124: 정식 12개만 사용자에게 내미는 선택지다. 재시드가 마이그레이션 000018의
        // 결과를 되돌리지 않도록 두 경로(정식/별칭) 모두 플래그를 명시한다.
        // ⚠️ 라운드 107 E 두 번째 시점: 이 `update` 갈래는 이제 SEED_OVERWRITE_CONTENT=1
        // 에서만 실행된다. 기본 경로에서 000018의 결과를 지키는 것은 "고치지 않는다"이고,
        // 새 DB에서 지키는 것은 바로 아래 `create`다.
        selectable: true
      },
      create: {
        code: category.code,
        name: category.name,
        iconName: category.iconName,
        displayOrder: category.displayOrder,
        isSystem: true,
        active: true,
        selectable: true
      }
    });
    if (existing) tallies.categories.overwritten += 1;
    else tallies.categories.created += 1;
  }

  // See MobileCategoryAliasSeed's doc comment (prisma/seed-data.ts): these keep the
  // mobile app's hardcoded quick-expense `categoryId` literals valid against the
  // server-side "categoryId must exist in categories" check, without disturbing the
  // locked 12-category list above (seed-data.test.ts asserts that list exactly).
  //
  // CAT-124: these rows stay `active: true` (already-recorded spending references them, and the
  // 8-tile quick input keeps writing them) but are seeded `selectable: false`, so
  // `GET /categories` only offers them under `?includeAll=1`. The seed carries the flag
  // explicitly rather than relying on migration 000018's UPDATE, so a re-seed on an
  // already-migrated database stays consistent.
  for (const alias of [...mobileCategoryAliasSeeds, ...importStubCategorySeeds]) {
    const existing = await prisma.category.findUnique({ where: { id: alias.id }, select: { id: true } });
    if (existing && !OVERWRITE_CONTENT) {
      tallies.categories.kept += 1;
      continue;
    }

    await prisma.category.upsert({
      where: { id: alias.id },
      update: {
        code: alias.code,
        name: alias.name,
        iconName: alias.iconName,
        displayOrder: alias.displayOrder,
        isSystem: false,
        active: true,
        selectable: alias.selectable
      },
      create: {
        id: alias.id,
        code: alias.code,
        name: alias.name,
        iconName: alias.iconName,
        displayOrder: alias.displayOrder,
        isSystem: false,
        active: true,
        selectable: alias.selectable
      }
    });
    if (existing) tallies.categories.overwritten += 1;
    else tallies.categories.created += 1;
  }
}

async function seedDisclosures() {
  for (const disclosure of disclosureSeeds) {
    const existing = await prisma.disclosure.findUnique({
      where: { key: disclosure.key },
      select: { key: true }
    });
    // 라운드 107 E: 고지 문구는 어드민(`admin.disclosure.update`)과 CMS 발행이 고치는 값이다.
    // 배포가 옛 문구로 되돌리면 그것이 DNC-010의 반대 방향 오류(승인되지 않은 문구를 화면에
    // 세우는 일)가 된다.
    if (existing && !OVERWRITE_CONTENT) {
      tallies.disclosures.kept += 1;
      continue;
    }

    await prisma.disclosure.upsert({
      where: { key: disclosure.key },
      update: { text: disclosure.text, active: true },
      create: { key: disclosure.key, text: disclosure.text, active: true }
    });
    if (existing) tallies.disclosures.overwritten += 1;
    else tallies.disclosures.created += 1;
  }
}

async function seedItemTemplates() {
  const categories = await prisma.category.findMany({
    where: { code: { in: categorySeeds.map((category) => category.code) } },
    select: { id: true, code: true }
  });
  const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

  for (const item of itemTemplateSeeds) {
    const categoryId = categoryIdByCode.get(item.categoryCode);
    if (!categoryId) {
      throw new Error(`Missing category seed for item template: ${item.categoryCode}`);
    }

    const existing = await prisma.itemTemplate.findUnique({
      where: { code: item.code },
      select: { id: true }
    });
    // 라운드 107 E: 있는 준비템은 그대로 둔다. 13축 전부가 어드민 PATCH의 축이다.
    // 단계(`item_template_stages`)도 함께 건너뛴다 — 어드민은 단계를 **집합으로**
    // 교체하므로(replaceItemTemplateStages: delete-all → 재삽입), 행 단위로 "없으면
    // 만든다"를 하면 운영자가 의도적으로 뺀 단계가 배포마다 되살아난다.
    if (existing && !OVERWRITE_CONTENT) {
      tallies.itemTemplates.kept += 1;
      continue;
    }

    await prisma.itemTemplate.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        categoryId,
        necessityLevel: item.necessityLevel,
        timingLabel: item.timingLabel,
        priceMinKrw: item.priceMinKrw,
        priceMaxKrw: item.priceMaxKrw,
        reasonText: item.reasonText,
        skipReasonText: item.skipReasonText,
        usedSecondhandOk: item.usedSecondhandOk,
        safetyNote: item.safetyNote,
        medicalDisclaimerRequired: item.medicalDisclaimerRequired,
        displayOrder: item.displayOrder,
        active: item.active
      },
      create: {
        code: item.code,
        name: item.name,
        categoryId,
        necessityLevel: item.necessityLevel,
        timingLabel: item.timingLabel,
        priceMinKrw: item.priceMinKrw,
        priceMaxKrw: item.priceMaxKrw,
        reasonText: item.reasonText,
        skipReasonText: item.skipReasonText,
        usedSecondhandOk: item.usedSecondhandOk,
        safetyNote: item.safetyNote,
        medicalDisclaimerRequired: item.medicalDisclaimerRequired,
        displayOrder: item.displayOrder,
        active: item.active
      }
    });
    if (existing) tallies.itemTemplates.overwritten += 1;
    else tallies.itemTemplates.created += 1;

    const savedItem = await prisma.itemTemplate.findUniqueOrThrow({
      where: { code: item.code },
      select: { id: true }
    });

    for (const [index, stageCode] of item.stageCodes.entries()) {
      const existingStage = await prisma.itemTemplateStage.findUnique({
        where: { itemTemplateId_stageCode: { itemTemplateId: savedItem.id, stageCode } },
        select: { itemTemplateId: true }
      });
      await prisma.itemTemplateStage.upsert({
        where: {
          itemTemplateId_stageCode: {
            itemTemplateId: savedItem.id,
            stageCode
          }
        },
        update: {
          priorityWeight: item.stageCodes.length - index
        },
        create: {
          itemTemplateId: savedItem.id,
          stageCode,
          priorityWeight: item.stageCodes.length - index
        }
      });
      if (existingStage) tallies.itemTemplateStages.overwritten += 1;
      else tallies.itemTemplateStages.created += 1;
    }
  }
}

/**
 * 라운드 51 #9 — 시드 링크의 `price_checked_at`(000020) 결정 규칙.
 *
 * - 시드가 가격을 명시하지 않았으면(null) 시각도 null이다. 서버가 강제하는
 *   "가격과 확인 시각은 함께 있거나 함께 없다" 규칙을 데이터 쪽에서도 지킨다.
 * - 저장된 가격이 시드와 같고 확인 시각이 이미 있으면 그 시각을 유지한다 — 시드를
 *   다시 돌린 것은 가격을 다시 확인한 것이 아니다(재실행마다 시각이 오늘로 밀리면
 *   "방금 확인한 가격"이라는 허위 신선도가 생긴다).
 * - 그 밖(신규 링크·가격 변경·시각 없음)은 지금으로 채운다.
 *
 * ⚠️ 라운드 107 E 두 번째 시점: 기본 경로에서는 기존 행을 고치지 않으므로 이 함수가
 * 실제로 갈라지는 자리는 두 곳뿐이다 — 신규 생성(existing = null)과
 * SEED_OVERWRITE_CONTENT=1. 규칙 자체는 그대로 남는다(플랜 A 이후 가격이 다시
 * 심기면 그때 이 규칙이 다시 일한다).
 */
function resolveSeedPriceCheckedAt(
  seedPriceKrw: number | null,
  existing: { priceSnapshotKrw: number | null; priceCheckedAt: Date | null } | null
): Date | null {
  if (seedPriceKrw === null) return null;
  if (existing && existing.priceCheckedAt && existing.priceSnapshotKrw === seedPriceKrw) {
    return existing.priceCheckedAt;
  }
  return new Date();
}

const PRODUCT_LINK_MATCH_SELECT = {
  id: true,
  title: true,
  url: true,
  seedKey: true,
  priceSnapshotKrw: true,
  priceCheckedAt: true
} as const;

type ProductLinkMatch = {
  row: {
    id: string;
    title: string;
    url: string;
    seedKey: string | null;
    priceSnapshotKrw: number | null;
    priceCheckedAt: Date | null;
  };
  /** 안정 키가 없던 기존 행을 이 시드 링크의 것으로 인정했는가(= seed_key를 처음 찍는가). */
  adopted: boolean;
  /** 같은 (준비템, 플랫폼)에 남은, 이 시드가 자기 것으로 고르지 않은 행들. */
  strays: Array<{ id: string; title: string }>;
};

/**
 * 라운드 107 트랙 E — **자연키 교체**(정찰 S5 D3 ②).
 *
 * 종전 매칭은 `findFirst({ itemTemplateId, platform, title })`였다. 그런데 이 셋은
 * **전부 어드민이 고칠 수 있는 값**이다(`AdminUpdateProductLinkDto`: `itemTemplateId?` ·
 * `platform?` · `title?` · `url?` — 즉 이 표에는 오늘 안정된 컬럼이 하나도 없다).
 * 그래서 운영자가 제목을 한 글자만 고쳐도 다음 시드는 자기 행을 알아보지 못하고
 * **두 번째 링크를 만든다**(실측: 67 → 68행, 둘 다 active).
 *
 * 그래서 안정 식별자 컬럼을 새로 둔다: `product_links.seed_key`(마이그레이션 000026).
 * 어떤 어드민 DTO에도 없는 칸이라 운영자가 움직일 수 없고, 값은 시드가 정한다.
 *
 * **키의 모양은 `<itemTemplateCode>:<platform>`이다.** 지어낸 규칙이 아니라 이미
 * 저장소가 쓰고 있던 식별자다 — CSV 일괄 교체 도구(`product-link-bulk.service.ts`)가
 * (itemTemplate, platform)으로 매칭하고 **정확히 1건**을 요구한다. 오늘 시드 링크 67건은
 * 그 쌍이 67개로 전부 다르다(실측). 한 쌍에 시드 링크가 둘 필요해지면 그 링크에
 * `seedKey`를 직접 적는다(`ProductLinkSeed.seedKey`) — 아래 중복 검사가 잊으면 잡는다.
 *
 * **이미 돌던 DB의 기존 행은 어떻게 자기 키를 얻는가.** 마이그레이션이 SQL로 채우지
 * 않는다(시드 목록을 SQL에 한 번 더 베껴 두면 그 사본이 낡는다). 대신 시드가 아래
 * 사다리로 한 번만 **입양**한다 — 입양은 `seed_key` 한 칸만 쓰고 콘텐츠는 손대지 않는다.
 *   1. `seed_key`가 이미 이 키인 행 → 그 행이다(끝).
 *   2. 같은 (준비템, 플랫폼)에서 `seed_key`가 비어 있는 행들 중
 *      ① 제목이 시드와 같은 행 → ② URL이 시드와 같은 행 → ③ 가장 먼저 만들어진 행.
 *      (①이 실패하는 자리가 바로 D3의 제목 편집이고, ②는 플랜 A CSV가 URL까지 바꾼
 *       뒤의 자리다. ③은 둘 다 바뀐 뒤에도 CSV 도구와 같은 식별자로 되찾는다.)
 *   3. 하나도 없으면 새로 만든다.
 * 고르지 않고 남은 행은 지우지 않고 **경고로 보고**한다(파괴는 사람이 정한다).
 */
async function matchSeedProductLink(
  itemTemplateId: string,
  platform: "coupang" | "naver" | "custom",
  seedKey: string,
  seedTitle: string,
  seedUrl: string
): Promise<ProductLinkMatch | null> {
  const byKey = await prisma.productLink.findFirst({
    where: { seedKey },
    select: PRODUCT_LINK_MATCH_SELECT
  });
  if (byKey) {
    return { row: byKey, adopted: false, strays: [] };
  }

  const candidates = await prisma.productLink.findMany({
    where: { itemTemplateId, platform, seedKey: null },
    orderBy: { createdAt: "asc" },
    select: PRODUCT_LINK_MATCH_SELECT
  });
  if (candidates.length === 0) {
    return null;
  }

  const picked =
    candidates.find((candidate) => candidate.title === seedTitle) ??
    candidates.find((candidate) => candidate.url === seedUrl) ??
    candidates[0];

  return {
    row: picked,
    adopted: true,
    strays: candidates
      .filter((candidate) => candidate.id !== picked.id)
      .map((candidate) => ({ id: candidate.id, title: candidate.title }))
  };
}

async function seedProductLinks() {
  const items = await prisma.itemTemplate.findMany({
    where: { code: { in: itemTemplateSeeds.map((item) => item.code) } },
    select: { id: true, code: true }
  });
  const itemIdByCode = new Map(items.map((item) => [item.code, item.id]));

  // 안정 키가 실제로 유일한지 시드 데이터 안에서 먼저 확인한다. 유니크 색인
  // (uq_product_links_seed_key)이 마지막 방어선이지만, 그 실패는 DB 오류로 나가고
  // 어느 두 줄이 부딪혔는지 말해 주지 않는다.
  const seenKeys = new Map<string, string>();
  for (const link of productLinkSeeds) {
    const key = productLinkSeedKey(link);
    const owner = `${link.itemTemplateCode}/${link.platform}/${link.title}`;
    const previous = seenKeys.get(key);
    if (previous) {
      throw new Error(
        `product_links 시드 키가 겹쳐요: "${key}" — ${previous} 와 ${owner}. ` +
          "한 (준비템, 플랫폼)에 시드 링크가 둘 이상이면 ProductLinkSeed.seedKey를 직접 적어 주세요."
      );
    }
    seenKeys.set(key, owner);
  }

  for (const link of productLinkSeeds) {
    const itemTemplateId = itemIdByCode.get(link.itemTemplateCode);
    if (!itemTemplateId) {
      throw new Error(`Missing item template seed for product link: ${link.itemTemplateCode}`);
    }

    const seedKey = productLinkSeedKey(link);
    const match = await matchSeedProductLink(itemTemplateId, link.platform, seedKey, link.title, link.url);

    if (match) {
      if (match.adopted) {
        // 콘텐츠는 건드리지 않는다 — 안정 키 한 칸만 찍는다. 이 쓰기가 있어야 다음
        // 배포가 제목이 바뀐 이 행을 자기 것으로 알아본다(= 중복이 생기지 않는다).
        await prisma.productLink.update({ where: { id: match.row.id }, data: { seedKey } });
        tallies.productLinks.adopted += 1;
      }
      for (const stray of match.strays) {
        warnings.push(
          `product_links 중복 의심: ${link.itemTemplateCode}/${link.platform} — "${stray.title}"(${stray.id})는 ` +
            `시드 키 "${seedKey}"를 받지 못했어요. 지우지 않았으니 어드민에서 확인해 주세요.`
        );
      }

      if (!OVERWRITE_CONTENT) {
        tallies.productLinks.kept += 1;
        continue;
      }

      await prisma.productLink.update({
        where: { id: match.row.id },
        data: { ...buildProductLinkData(itemTemplateId, link, match.row), seedKey }
      });
      tallies.productLinks.overwritten += 1;
      continue;
    }

    // redirectCode is NOT NULL UNIQUE at the DB level; existing rows already have one
    // from the 000007 migration backfill, so only newly created rows need one here.
    await prisma.productLink.create({
      data: {
        ...buildProductLinkData(itemTemplateId, link, null),
        seedKey,
        redirectCode: generateRedirectCode()
      }
    });
    tallies.productLinks.created += 1;
  }

  await reportDuplicateSeedLinks(itemIdByCode);
}

function buildProductLinkData(
  itemTemplateId: string,
  link: (typeof productLinkSeeds)[number],
  existing: { priceSnapshotKrw: number | null; priceCheckedAt: Date | null } | null
) {
  return {
    itemTemplateId,
    platform: link.platform,
    title: link.title,
    url: link.url,
    affiliateUrl: link.affiliateUrl,
    affiliatePartnerCode: link.affiliatePartnerCode,
    isAffiliate: link.isAffiliate,
    isSponsored: link.isSponsored,
    sponsorLabel: link.sponsorLabel,
    priceSnapshotKrw: link.priceSnapshotKrw,
    // 라운드 51 #9(000020): 가격의 기준 시각. 서버는 이 값이 없으면 가격도 내리지
    // 않으므로(items-catalog.service.ts toProductLinkDto), 시드가 값을 명시한
    // 링크는 여기서 유효화한다 — 시드가 그 가격을 적어 넣은 시점이 곧 확인 시점이다.
    //
    // 이미 같은 가격으로 확인 시각이 남아 있으면 그대로 둔다(시드를 다시 돌렸다는
    // 사실만으로 "방금 확인했다"고 말하지 않는다). 가격이 바뀌었거나 시각이 비어
    // 있을 때만 지금으로 채우고, 가격이 없는 링크는 시각도 없다(둘 다 NULL 규칙).
    priceCheckedAt: resolveSeedPriceCheckedAt(link.priceSnapshotKrw, existing),
    displayOrder: link.displayOrder,
    active: link.active,
    disclosureText: link.disclosureText
  };
}

/**
 * 라운드 107 E — **이미 중복이 생긴 환경을 말해 준다.** 지우지 않는다.
 *
 * 세는 자리는 시드가 아는 (준비템, 플랫폼) 쌍뿐이다. 그 쌍에 행이 둘 이상이면
 * ① 화면에 같은 상품의 구매 CTA가 둘 서고(핵심 루프 4단계가 흐려진다),
 * ② CSV 일괄 교체 도구가 "정확히 1건"을 요구하므로 그 행을 **더는 고칠 수 없다**.
 * 어느 쪽을 남길지는 클릭 이력(affiliate_clicks)이 붙은 행이 어느 쪽인지를 봐야 하는
 * 판단이라 시드가 대신 정하지 않는다.
 */
async function reportDuplicateSeedLinks(itemIdByCode: Map<string, string>) {
  const seedPairs = new Set(
    productLinkSeeds.map((link) => `${itemIdByCode.get(link.itemTemplateCode) ?? ""}|${link.platform}`)
  );
  const groups = await prisma.productLink.groupBy({
    by: ["itemTemplateId", "platform"],
    where: { itemTemplateId: { in: [...itemIdByCode.values()] } },
    _count: { _all: true }
  });
  const codeById = new Map([...itemIdByCode].map(([code, id]) => [id, code]));

  for (const group of groups) {
    if (group._count._all <= 1) continue;
    if (!seedPairs.has(`${group.itemTemplateId}|${group.platform}`)) continue;
    warnings.push(
      `product_links 중복: ${codeById.get(group.itemTemplateId) ?? group.itemTemplateId}/${group.platform} — ` +
        `${group._count._all}행. 구매 CTA가 둘 뜨고 CSV 일괄 교체가 이 쌍을 매칭하지 못해요(정확히 1건 필요).`
    );
  }
}

async function seedAdminUsers() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const nodeEnv = process.env.NODE_ENV;

  if (email && password) {
    await createAdminUserIfMissing(email, password);
    return;
  }

  if (nodeEnv !== "production") {
    // Convenience default for local development only; never used when
    // NODE_ENV=production and the seed env vars are unset (see the warning below).
    await createAdminUserIfMissing("admin@wooriai.local", "wooriai-dev-admin");
    return;
  }

  console.warn(
    "Skipping admin user seed: ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are not set and NODE_ENV=production, " +
      "so no dev-default admin account will be created."
  );
}

// ADM-007: 관리자 자격증명은 "생성 시 1회만" 시드한다. 시드를 재실행해도 기존
// 계정의 passwordHash(운영 중 교체된 비밀번호)와 active(비활성화 상태)를 절대
// 되돌리지 않는다 — 부트스트랩 스크립트가 멱등 재실행되어도 비밀번호 회전이
// 무효화되거나 정지된 계정이 되살아나면 안 되기 때문.
//
// ⚠️ 라운드 107 E: 이 배려는 오랫동안 이 표 **하나에만** 있었다(정찰 S5 D3). 지금은
// 콘텐츠 다섯 표가 같은 규율을 따른다 — 파일 머리말의 경계 표 참조.
async function createAdminUserIfMissing(
  email: string,
  password: string,
  role: "admin" | "editor" = "admin",
  displayName = "Admin"
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true }
  });

  if (existing) {
    console.log(
      `관리자 시드 건너뜀: ${normalizedEmail} 계정이 이미 존재하므로 비밀번호/활성 상태를 변경하지 않습니다.`
    );
    return;
  }

  await prisma.adminUser.create({
    data: {
      email: normalizedEmail,
      passwordHash: hashAdminPassword(password),
      displayName,
      role,
      active: true
    }
  });
}

// COM-103: 작성자(editor)·승인자(admin) 분리 흐름을 로컬/테스트에서 검증하려면 admin
// 외에 editor 역할 계정이 최소 1개 필요하다. 운영(production)에서는 시딩하지 않는다.
async function seedEditorUsers() {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === "production") {
    return;
  }

  await createAdminUserIfMissing("editor@wooriai.local", "wooriai-dev-editor", "editor", "Editor");
}

/** 배포 로그가 "시드가 무엇을 했는가"를 값으로 말하게 한다(관찰형, DNC-018). */
function printSummary() {
  const line = (label: string, tally: SeedTally) =>
    `[시드] ${label}: 신규 ${tally.created} · 유지 ${tally.kept} · 덮어씀 ${tally.overwritten}` +
    (tally.adopted > 0 ? ` · 시드 키 입양 ${tally.adopted}` : "");

  console.log(
    OVERWRITE_CONTENT
      ? "[시드] 콘텐츠 덮어쓰기: 켜짐(SEED_OVERWRITE_CONTENT=1) — 어드민 편집분이 시드 값으로 되돌아갑니다."
      : "[시드] 콘텐츠 덮어쓰기: 꺼짐(기본) — 이미 있는 행은 어드민 편집분 그대로 둡니다."
  );
  console.log(line("카테고리", tallies.categories));
  console.log(line("준비템", tallies.itemTemplates));
  console.log(line("준비템 단계", tallies.itemTemplateStages));
  console.log(line("고지 문구", tallies.disclosures));
  console.log(line("구매 링크", tallies.productLinks));
  for (const warning of warnings) {
    console.warn(`[시드] ⚠️ ${warning}`);
  }
}

async function main() {
  await seedCategories();
  await seedItemTemplates();
  await seedProductLinks();
  await seedDisclosures();
  await seedAdminUsers();
  await seedEditorUsers();
  printSummary();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
