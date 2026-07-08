import { PrismaClient } from "@prisma/client";
import { categorySeeds, itemTemplateSeeds, productLinkSeeds } from "./seed-data";

const prisma = new PrismaClient();

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
      await prisma.productLink.create({ data });
    }
  }
}

async function main() {
  await seedCategories();
  await seedItemTemplates();
  await seedProductLinks();
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
