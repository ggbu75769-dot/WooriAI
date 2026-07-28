import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashAdminPassword } from "../src/admin/admin-password";
import {
  childLifecycleCodes,
  motherLifecycleCodes,
  release4BundleDefinitions,
  release4CatalogEvidenceSources,
  release4CatalogItems,
  release4CatalogNodes,
  validateRelease4Catalog
} from "@wooriai/domain";
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

const legalDocumentSeeds = [
  {
    documentType: "terms",
    title: "서비스 이용약관 (법률 검토 전 템플릿)",
    bodyMarkdown: "# 서비스 이용약관\n\n법률 검토와 운영자 승인이 필요한 출시 전 템플릿입니다.",
    required: true
  },
  {
    documentType: "privacy",
    title: "개인정보 처리방침 (법률 검토 전 템플릿)",
    bodyMarkdown: "# 개인정보 처리방침\n\n법률 검토와 운영자 승인이 필요한 출시 전 템플릿입니다.",
    required: true
  },
  {
    documentType: "marketing",
    title: "소식 알림 동의 (운영 검토 전 템플릿)",
    bodyMarkdown: "# 소식 알림 동의\n\n선택 동의이며 기본값은 동의하지 않음입니다.",
    required: false
  },
  {
    documentType: "analytics",
    title: "서비스 분석 동의 (운영 검토 전 템플릿)",
    bodyMarkdown: "# 서비스 분석 동의\n\n선택 동의이며 기본값은 동의하지 않음입니다.",
    required: false
  }
] as const;

async function seedLegalDocuments() {
  for (const document of legalDocumentSeeds) {
    const contentHash = createHash("sha256").update(document.bodyMarkdown).digest("hex");
    await prisma.legalDocument.upsert({
      where: {
        documentType_locale_version: {
          documentType: document.documentType,
          locale: "ko-KR",
          version: "2026-07-06"
        }
      },
      update: {
        title: document.title,
        bodyMarkdown: document.bodyMarkdown,
        contentHash,
        required: document.required,
        placeholder: true
      },
      create: {
        documentType: document.documentType,
        locale: "ko-KR",
        version: "2026-07-06",
        title: document.title,
        bodyMarkdown: document.bodyMarkdown,
        contentHash,
        required: document.required,
        placeholder: true,
        effectiveAt: new Date("2026-07-06T00:00:00.000Z"),
        publishedAt: new Date("2026-07-06T00:00:00.000Z")
      }
    });
  }
  if (process.env.NODE_ENV === "test") {
    for (const document of legalDocumentSeeds) {
      const bodyMarkdown = `# ${document.title}\n\n테스트 환경에서 동의 계약을 검증하기 위한 문서입니다.`;
      const contentHash = createHash("sha256").update(bodyMarkdown).digest("hex");
      await prisma.legalDocument.upsert({
        where: {
          documentType_locale_version: {
            documentType: document.documentType,
            locale: "ko-KR-test",
            version: "2026-07-06"
          }
        },
        update: {
          title: document.title,
          bodyMarkdown,
          publicUrl: null,
          contentHash,
          required: document.required,
          placeholder: false,
          effectiveAt: new Date("2026-07-06T00:00:00.000Z"),
          publishedAt: new Date("2026-07-06T00:00:00.000Z"),
          retiredAt: null
        },
        create: {
          documentType: document.documentType,
          locale: "ko-KR-test",
          version: "2026-07-06",
          title: document.title,
          bodyMarkdown,
          publicUrl: null,
          contentHash,
          required: document.required,
          placeholder: false,
          effectiveAt: new Date("2026-07-06T00:00:00.000Z"),
          publishedAt: new Date("2026-07-06T00:00:00.000Z")
        }
      });
    }
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
        shortReason: item.shortReason,
        skipReasonText: item.skipReasonText,
        usedSecondhandOk: item.usedSecondhandOk,
        safetyNote: item.safetyNote,
        medicalDisclaimerRequired: item.medicalDisclaimerRequired,
        displayOrder: item.displayOrder,
        active: item.active,
        reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
        reviewedByAdminId: item.reviewedByAdminId,
        nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt) : null,
        sourceNote: item.sourceNote,
        contentStatus: item.contentStatus
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
        shortReason: item.shortReason,
        skipReasonText: item.skipReasonText,
        usedSecondhandOk: item.usedSecondhandOk,
        safetyNote: item.safetyNote,
        medicalDisclaimerRequired: item.medicalDisclaimerRequired,
        displayOrder: item.displayOrder,
        active: item.active,
        reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : null,
        reviewedByAdminId: item.reviewedByAdminId,
        nextReviewAt: item.nextReviewAt ? new Date(item.nextReviewAt) : null,
        sourceNote: item.sourceNote,
        contentStatus: item.contentStatus
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

const expenseCategoryByDomain: Record<string, string> = {
  C01: "pregnancy_mother_health",
  C02: "pregnancy_mother_health",
  C03: "pregnancy_mother_health",
  C04: "pregnancy_mother_health",
  C05: "birth_postpartum",
  C06: "birth_postpartum",
  C07: "feeding_food",
  C08: "feeding_food",
  C09: "sleep_furniture_storage",
  C10: "diaper_hygiene",
  C11: "diaper_hygiene",
  C12: "hospital_health",
  C13: "clothes_shoes_laundry",
  C14: "clothes_shoes_laundry",
  C15: "sleep_furniture_storage",
  C16: "feeding_food",
  C17: "outing_mobility_travel",
  C18: "safety_emergency",
  C19: "play_books_development",
  C20: "play_books_development",
  C21: "care_education",
  C22: "outing_mobility_travel",
  C23: "outing_mobility_travel",
  C24: "service_rental"
};

async function seedRelease4Catalog() {
  const validationErrors = validateRelease4Catalog();
  if (validationErrors.length) throw new Error(validationErrors.join("\n"));

  const nodeIdByCode = new Map<string, string>();
  for (const node of release4CatalogNodes) {
    const parentId = node.parentCode ? nodeIdByCode.get(node.parentCode) : null;
    if (node.parentCode && !parentId) throw new Error(`Release 4 catalog parent missing: ${node.parentCode}`);
    const saved = await prisma.catalogNode.upsert({
      where: { code: node.code },
      update: {
        parentId,
        level: node.level,
        nameKo: node.nameKo,
        displayOrder: node.displayOrder,
        active: true,
        version: 1
      },
      create: {
        code: node.code,
        parentId,
        level: node.level,
        nameKo: node.nameKo,
        displayOrder: node.displayOrder,
        active: true,
        version: 1
      },
      select: { id: true }
    });
    nodeIdByCode.set(node.code, saved.id);
  }

  const expenseCategories = await prisma.expenseCategoryV2.findMany({
    where: { householdId: null },
    select: { id: true, code: true }
  });
  const expenseCategoryIdByCode = new Map(expenseCategories.map((category) => [category.code, category.id]));
  const itemIdByCode = new Map<string, string>();

  for (const item of release4CatalogItems) {
    const safetyNote = item.nameKo === "역류방지쿠션"
      ? "영아의 수면 공간에는 두지 마세요. 수면 중에는 단단하고 평평한 수면면과 고정형 시트만 사용하고, 이 품목은 의료적 효능을 단정하지 않습니다."
      : item.safetyTier === "high"
        ? "안전·의학 관련 조건은 판매 상품보다 전문가 확인과 최신 공공 지침 확인이 우선입니다."
      : item.safetyTier === "elevated"
        ? "사용 환경과 대상 연령을 확인하고 제조사 안전 안내를 따르세요."
        : null;
    const sourceSummary = `preparation-necessity-v2-2026-07-20; evidence class: ${item.evidenceClass}; sources: ${item.evidenceSourceIds.join(",")}; popularity is a proxy and never a sales-volume claim.`;
    const reasonText = item.personalizedDiscovery
      ? `가족 상황과 생애주기에 맞춰 ${item.nameKo}의 필요 여부, 수량, 준비 시기를 검토하고 기록할 수 있습니다.`
      : `${item.nameKo}은 문서·기록 또는 조건부 품목으로 개인화 추천에서는 제외하고 검색과 전체 목록에서만 제공합니다.`;
    const saved = await prisma.$transaction(async (tx) => {
      const savedDefinition = await tx.itemDefinition.upsert({
        where: { code: item.code },
        update: {
          nameKo: item.nameKo,
          shortDescription: `${item.nameKo}의 필요 여부와 준비 상태를 관리하는 일반 품목입니다.`,
          targetSubject: item.targetSubject,
          necessity: item.necessity,
          recommendationState: item.recommendationState,
          reasonText,
          skipReasonText: "가족 상황과 사용 계획에 맞지 않으면 준비하지 않아도 됩니다.",
          quantityGuidance: "가족 구성과 사용 빈도에 따라 수량을 정하세요.",
          timingSummary: "연결된 생애주기와 실제 생활 계획을 함께 확인하세요.",
          priceMinKrw: null,
          priceMaxKrw: null,
          priceCheckedAt: null,
          secondhandPolicy: item.safetyTier === "normal" ? "allowed" : "inspect",
          rentalPolicy: "conditional",
          safetyTier: item.safetyTier,
          safetyNote,
          medicalDisclaimerRequired: item.safetyTier === "high",
          sourceSummary,
          contentVersion: 2,
          reviewedAt: null,
          reviewedByAdminId: null,
          status: "in_review",
          displayOrder: item.displayOrder,
          onboardingEligible: item.onboardingEligible,
          onboardingPriority: item.onboardingPriority
        },
        create: {
          code: item.code,
          nameKo: item.nameKo,
          shortDescription: `${item.nameKo}의 필요 여부와 준비 상태를 관리하는 일반 품목입니다.`,
          targetSubject: item.targetSubject,
          necessity: item.necessity,
          recommendationState: item.recommendationState,
          reasonText,
          skipReasonText: "가족 상황과 사용 계획에 맞지 않으면 준비하지 않아도 됩니다.",
          quantityGuidance: "가족 구성과 사용 빈도에 따라 수량을 정하세요.",
          timingSummary: "연결된 생애주기와 실제 생활 계획을 함께 확인하세요.",
          secondhandPolicy: item.safetyTier === "normal" ? "allowed" : "inspect",
          rentalPolicy: "conditional",
          safetyTier: item.safetyTier,
          safetyNote,
          medicalDisclaimerRequired: item.safetyTier === "high",
          sourceSummary,
          contentVersion: 2,
          status: "in_review",
          displayOrder: item.displayOrder,
          onboardingEligible: item.onboardingEligible,
          onboardingPriority: item.onboardingPriority
        },
        select: { id: true }
      });

      await tx.itemDefinitionCategory.deleteMany({ where: { itemDefinitionId: savedDefinition.id } });
      await tx.itemDefinitionCategory.createMany({
        data: [
          { itemDefinitionId: savedDefinition.id, catalogNodeId: nodeIdByCode.get(item.domainCode)!, displayOrder: 10 },
          { itemDefinitionId: savedDefinition.id, catalogNodeId: nodeIdByCode.get(item.categoryCode)!, displayOrder: 20 },
          { itemDefinitionId: savedDefinition.id, catalogNodeId: nodeIdByCode.get(item.subcategoryCode)!, isPrimary: true, displayOrder: 30 }
        ]
      });

      await tx.itemLifecycleRule.deleteMany({ where: { itemDefinitionId: savedDefinition.id } });
      await tx.itemLifecycleRule.createMany({
        data: item.lifecycles.map((lifecycle) => ({
          itemDefinitionId: savedDefinition.id,
          axis: lifecycle.axis,
          lifecycleCode: lifecycle.code,
          timingText: "해당 생애주기에서 필요 여부를 확인하세요.",
          priorityWeight: lifecycle.priorityWeight
        }))
      });

      const contextRules = [{ code: "all", weight: 0, required: false }, ...item.contextRules];
      const contextCodes = contextRules.map((rule) => rule.code);
      await tx.itemContextRule.deleteMany({
        where: { itemDefinitionId: savedDefinition.id, contextCode: { notIn: contextCodes } }
      });
      for (const contextRule of contextRules) {
        await tx.itemContextRule.upsert({
          where: { itemDefinitionId_contextCode: { itemDefinitionId: savedDefinition.id, contextCode: contextRule.code } },
          update: { weight: contextRule.weight, required: contextRule.required },
          create: { itemDefinitionId: savedDefinition.id, contextCode: contextRule.code, weight: contextRule.weight, required: contextRule.required }
        });
      }

      await tx.itemSynonym.deleteMany({ where: { itemDefinitionId: savedDefinition.id } });
      await tx.itemSynonym.createMany({
        data: item.aliases.map((alias) => ({
          itemDefinitionId: savedDefinition.id,
          synonym: alias,
          normalizedSynonym: alias.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "")
        })),
        skipDuplicates: true
      });

      if (item.safetyTier === "high") {
        await tx.itemSafetyRule.upsert({
          where: { itemDefinitionId_ruleCode: { itemDefinitionId: savedDefinition.id, ruleCode: "professional-review-gate" } },
          update: {
            severity: "high",
            guidanceText: safetyNote!,
            blocksRecommendation: true,
            reviewedAt: null,
            expiresAt: null
          },
          create: {
            itemDefinitionId: savedDefinition.id,
            ruleCode: "professional-review-gate",
            severity: "high",
            guidanceText: safetyNote!,
            blocksRecommendation: true
          }
        });
      } else {
        await tx.itemSafetyRule.deleteMany({
          where: { itemDefinitionId: savedDefinition.id, ruleCode: "professional-review-gate" }
        });
      }

      for (const sourceId of item.evidenceSourceIds) {
        const source = release4CatalogEvidenceSources[sourceId];
        const existingSource = await tx.itemEvidenceSource.findFirst({
          where: {
            itemDefinitionId: savedDefinition.id,
            sourceType: source.sourceType,
            publicUrl: source.url
          },
          select: { id: true }
        });
        if (!existingSource) {
          await tx.itemEvidenceSource.create({
            data: {
              itemDefinitionId: savedDefinition.id,
              sourceType: source.sourceType,
              title: source.title,
              publicUrl: source.url,
              publisher: source.publisher,
              checkedAt: new Date(`${source.checkedAt}T00:00:00.000Z`),
              status: "draft"
            }
          });
        }
      }

      const expenseCategoryCode = expenseCategoryByDomain[item.domainCode] ?? "other";
      const expenseCategoryId = expenseCategoryIdByCode.get(expenseCategoryCode);
      if (!expenseCategoryId) throw new Error(`Release 4 expense category missing: ${expenseCategoryCode}`);
      await tx.itemExpenseCategoryMapping.updateMany({
        where: { itemDefinitionId: savedDefinition.id, expenseCategoryId: { not: expenseCategoryId }, isDefault: true },
        data: { isDefault: false }
      });
      await tx.itemExpenseCategoryMapping.upsert({
        where: {
          itemDefinitionId_expenseCategoryId: {
            itemDefinitionId: savedDefinition.id,
            expenseCategoryId
          }
        },
        update: { isDefault: true },
        create: { itemDefinitionId: savedDefinition.id, expenseCategoryId, isDefault: true }
      });
      return savedDefinition;
    });
    itemIdByCode.set(item.code, saved.id);
  }

  // Release 3 may contain reviewed catalog rows that are not part of the current
  // canonical seed. Preserve those rows, but never leave them orphaned in the new
  // taxonomy. The mapping is deterministic and remains in_review until an editor
  // confirms the migrated classification.
  const legacyDomainByCategory: Record<string, string> = {
    pregnancy_mother: "C01",
    birth_postpartum: "C06",
    hospital_checkup: "C12",
    diaper_hygiene: "C10",
    feeding_babyfood: "C16",
    clothes_laundry: "C13",
    sleep_furniture: "C15",
    outing_mobility: "C17",
    toys_books: "C19",
    care_education: "C21",
    insurance_savings: "C24"
  };
  const orphanLegacyItems = await prisma.$queryRaw<Array<{ id: string; legacyCategoryCode: string | null }>>`
    SELECT definition.id, category.code AS "legacyCategoryCode"
    FROM item_definitions definition
    JOIN item_templates template ON template.id = definition.legacy_item_template_id
    LEFT JOIN categories category ON category.id = template.category_id
    WHERE NOT EXISTS (
      SELECT 1 FROM item_definition_categories mapping
      WHERE mapping.item_definition_id = definition.id
    )
  `;
  for (const legacy of orphanLegacyItems) {
    const legacyCategory = legacy.legacyCategoryCode ?? "";
    const domainCode = legacyDomainByCategory[legacyCategory] ?? "C24";
    const level2 = release4CatalogNodes.find((node) => node.level === "category" && node.parentCode === domainCode);
    const level3 = release4CatalogNodes.find((node) => node.level === "subcategory" && node.parentCode === level2?.code);
    if (!level2 || !level3) throw new Error(`Release 4 legacy taxonomy fallback missing: ${domainCode}`);
    await prisma.itemDefinitionCategory.createMany({
      data: [
        { itemDefinitionId: legacy.id, catalogNodeId: nodeIdByCode.get(domainCode)!, displayOrder: 10 },
        { itemDefinitionId: legacy.id, catalogNodeId: nodeIdByCode.get(level2.code)!, displayOrder: 20 },
        { itemDefinitionId: legacy.id, catalogNodeId: nodeIdByCode.get(level3.code)!, isPrimary: true, displayOrder: 30 }
      ],
      skipDuplicates: true
    });
    await prisma.itemContextRule.upsert({
      where: { itemDefinitionId_contextCode: { itemDefinitionId: legacy.id, contextCode: "all" } },
      update: { weight: 0, required: false },
      create: { itemDefinitionId: legacy.id, contextCode: "all", weight: 0, required: false }
    });
    const expenseCategoryCode = expenseCategoryByDomain[domainCode] ?? "service_rental";
    const expenseCategoryId = expenseCategoryIdByCode.get(expenseCategoryCode);
    if (!expenseCategoryId) throw new Error(`Release 4 legacy expense category missing: ${expenseCategoryCode}`);
    await prisma.itemExpenseCategoryMapping.upsert({
      where: { itemDefinitionId_expenseCategoryId: { itemDefinitionId: legacy.id, expenseCategoryId } },
      update: { isDefault: true },
      create: { itemDefinitionId: legacy.id, expenseCategoryId, isDefault: true }
    });
  }

  for (const [bundleIndex, definition] of release4BundleDefinitions.entries()) {
    const nameKo = definition.nameKo;
    const code = `R4-BUNDLE-${String(bundleIndex + 1).padStart(3, "0")}`;
    const bundle = await prisma.itemBundle.upsert({
      where: { code },
      update: { nameKo, description: `${nameKo} 상황에서 준비 여부를 함께 확인하는 묶음입니다.`, status: "in_review", displayOrder: bundleIndex + 1 },
      create: { code, nameKo, description: `${nameKo} 상황에서 준비 여부를 함께 확인하는 묶음입니다.`, status: "in_review", displayOrder: bundleIndex + 1 },
      select: { id: true }
    });
    await prisma.itemBundleMember.deleteMany({ where: { bundleId: bundle.id } });
    const members = definition.itemCodes.map((itemCode) => release4CatalogItems.find((item) => item.code === itemCode));
    if (members.some((item) => !item)) throw new Error(`Release 4 bundle contains an unknown canonical item: ${nameKo}`);
    await prisma.itemBundleMember.createMany({
      data: members.map((item, memberIndex) => ({
        bundleId: bundle.id,
        itemDefinitionId: itemIdByCode.get(item!.code)!,
        necessity: item!.necessity,
        defaultQuantity: 1,
        displayOrder: memberIndex + 1
      }))
    });
  }

  await prisma.catalogCoverageDecision.deleteMany({ where: { contextCode: "all" } });
  const necessities = ["required", "recommended", "conditional", "optional"] as const;
  const lifecycleCells = [
    ...motherLifecycleCodes.map((code) => ({ axis: "mother" as const, code })),
    ...childLifecycleCodes.map((code) => ({ axis: "child" as const, code }))
  ];
  await prisma.catalogCoverageDecision.createMany({
    data: release4CatalogNodes
      .filter((node) => node.level === "domain")
      .flatMap((domain) => lifecycleCells.flatMap((lifecycle) => necessities.map((necessity) => {
        const sameDomainNecessityExists = release4CatalogItems.some((item) => item.domainCode === domain.code && item.necessity === necessity);
        const covered = release4CatalogItems.some((item) =>
          item.domainCode === domain.code &&
          item.necessity === necessity &&
          item.lifecycles.some((rule) => rule.axis === lifecycle.axis && rule.code === lifecycle.code)
        );
        return {
          domainNodeId: nodeIdByCode.get(domain.code)!,
          lifecycleAxis: lifecycle.axis,
          lifecycleCode: lifecycle.code,
          contextCode: "all",
          necessity,
          state: covered ? "covered" as const : "gap" as const,
          applicability: covered
            ? necessity === "required" ? "required" as const : necessity === "optional" ? "optional" as const : "recommended" as const
            : "review_needed" as const,
          gapType: covered ? null : sameDomainNecessityExists ? "missing_lifecycle_rule" as const : "missing_item" as const,
          reason: covered
            ? "Release 4 canonical item coverage"
            : "External editorial applicability review is required; no item or lifecycle rule was auto-created."
        };
      })))
  });
}

async function main() {
  await seedCategories();
  await seedItemTemplates();
  await seedProductLinks();
  await seedDisclosures();
  await seedLegalDocuments();
  await seedAdminUsers();
  await seedEditorUsers();
  await seedRelease4Catalog();
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
