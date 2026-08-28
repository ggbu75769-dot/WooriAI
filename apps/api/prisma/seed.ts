import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashAdminPassword } from "../src/admin/admin-password";
import {
  categorySeeds,
  disclosureSeeds,
  importStubCategorySeeds,
  itemTemplateSeeds,
  mobileCategoryAliasSeeds,
  productLinkSeeds
} from "./seed-data";

const prisma = new PrismaClient();

// COM-106: product_links.redirect_code는 NOT NULL UNIQUE opaque 코드. 기존 행이면
// seedProductLinks가 이미 저장된 코드를 그대로 두므로 건드리지 않고, 신규 생성 시에만
// 발급한다.
function generateRedirectCode(): string {
  return randomBytes(6).toString("hex");
}

async function seedCategories() {
  for (const category of categorySeeds) {
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
  }
}

async function seedDisclosures() {
  for (const disclosure of disclosureSeeds) {
    await prisma.disclosure.upsert({
      where: { key: disclosure.key },
      update: { text: disclosure.text, active: true },
      create: { key: disclosure.key, text: disclosure.text, active: true }
    });
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

    const savedItem = await prisma.itemTemplate.findUniqueOrThrow({
      where: { code: item.code },
      select: { id: true }
    });

    for (const [index, stageCode] of item.stageCodes.entries()) {
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

async function seedProductLinks() {
  const items = await prisma.itemTemplate.findMany({
    where: { code: { in: itemTemplateSeeds.map((item) => item.code) } },
    select: { id: true, code: true }
  });
  const itemIdByCode = new Map(items.map((item) => [item.code, item.id]));

  for (const link of productLinkSeeds) {
    const itemTemplateId = itemIdByCode.get(link.itemTemplateCode);
    if (!itemTemplateId) {
      throw new Error(`Missing item template seed for product link: ${link.itemTemplateCode}`);
    }

    const existing = await prisma.productLink.findFirst({
      where: {
        itemTemplateId,
        platform: link.platform,
        title: link.title
      },
      select: { id: true, priceSnapshotKrw: true, priceCheckedAt: true }
    });

    const data = {
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

    if (existing) {
      await prisma.productLink.update({ where: { id: existing.id }, data });
    } else {
      // redirectCode is NOT NULL UNIQUE at the DB level; existing rows already have one
      // from the 000007 migration backfill, so only newly created rows need one here.
      await prisma.productLink.create({ data: { ...data, redirectCode: generateRedirectCode() } });
    }
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

async function main() {
  await seedCategories();
  await seedItemTemplates();
  await seedProductLinks();
  await seedDisclosures();
  await seedAdminUsers();
  await seedEditorUsers();
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
