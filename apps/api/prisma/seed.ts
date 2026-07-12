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
        active: true
      },
      create: {
        code: category.code,
        name: category.name,
        iconName: category.iconName,
        displayOrder: category.displayOrder,
        isSystem: true,
        active: true
      }
    });
  }

  // See MobileCategoryAliasSeed's doc comment (prisma/seed-data.ts): these keep the
  // mobile app's hardcoded quick-expense `categoryId` literals valid against the
  // server-side "categoryId must exist in categories" check, without disturbing the
  // locked 12-category list above (seed-data.test.ts asserts that list exactly).
  for (const alias of [...mobileCategoryAliasSeeds, ...importStubCategorySeeds]) {
    await prisma.category.upsert({
      where: { id: alias.id },
      update: {
        code: alias.code,
        name: alias.name,
        iconName: alias.iconName,
        displayOrder: alias.displayOrder,
        isSystem: false,
        active: true
      },
      create: {
        id: alias.id,
        code: alias.code,
        name: alias.name,
        iconName: alias.iconName,
        displayOrder: alias.displayOrder,
        isSystem: false,
        active: true
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
      select: { id: true }
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
    await upsertAdminUser(email, password);
    return;
  }

  if (nodeEnv !== "production") {
    // Convenience default for local development only; never used when
    // NODE_ENV=production and the seed env vars are unset (see the warning below).
    await upsertAdminUser("admin@wooriai.local", "wooriai-dev-admin");
    return;
  }

  console.warn(
    "Skipping admin user seed: ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are not set and NODE_ENV=production, " +
      "so no dev-default admin account will be created."
  );
}

async function upsertAdminUser(
  email: string,
  password: string,
  role: "admin" | "editor" = "admin",
  displayName = "Admin"
) {
  const normalizedEmail = email.trim().toLowerCase();
  await prisma.adminUser.upsert({
    where: { email: normalizedEmail },
    update: {
      passwordHash: hashAdminPassword(password),
      role,
      active: true
    },
    create: {
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

  await upsertAdminUser("editor@wooriai.local", "wooriai-dev-editor", "editor", "Editor");
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
