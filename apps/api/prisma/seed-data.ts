export type CategorySeed = {
  code: string;
  name: string;
  iconName: string;
  displayOrder: number;
};

import { catalogItems } from "../src/catalog/catalog";

export type { CatalogItem as ItemTemplateSeed } from "../src/catalog/catalog";

export type ProductLinkSeed = {
  itemTemplateCode: string;
  platform: "coupang" | "naver" | "custom";
  title: string;
  url: string;
  affiliateUrl: string | null;
  affiliatePartnerCode: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  sponsorLabel: string | null;
  priceSnapshotKrw: number | null;
  displayOrder: number;
  active: boolean;
  disclosureText: string | null;
};

export type DisclosureSeed = {
  key: string;
  text: string;
};

export type MobileCategoryAliasSeed = {
  /**
   * Fixed id, matched byte-for-byte against apps/mobile/src/categories.ts'
   * `categoryCatalog` entries. The mobile quick-expense tiles hardcode these UUID
   * literals client-side rather than fetching a canonical id from the server (see
   * that file's comments), so `POST /children/:childId/expenses` from the mobile
   * app always carries one of these exact ids. Round 4 adds server-side validation
   * that `categoryId` must reference an existing `categories` row; without seeding
   * these exact ids too, every mobile-originated expense would 400. These are kept
   * separate from `categorySeeds` (the locked 12) since two mobile tiles
   * intentionally share one taxonomy code ("분유/유제품" and "식비" both map to
   * `feeding_babyfood`), which the unique-per-code canonical list can't represent.
   */
  id: string;
  code: string;
  name: string;
  iconName: string;
  displayOrder: number;
};

export const categorySeeds: CategorySeed[] = [
  { code: "pregnancy_mother", name: "임신/산모", iconName: "mother", displayOrder: 10 },
  { code: "hospital_checkup", name: "병원/검사", iconName: "hospital", displayOrder: 20 },
  { code: "birth_postpartum", name: "출산/조리원", iconName: "birth", displayOrder: 30 },
  { code: "diaper_hygiene", name: "기저귀/위생", iconName: "diaper", displayOrder: 40 },
  { code: "feeding_babyfood", name: "수유/이유식", iconName: "bottle", displayOrder: 50 },
  { code: "clothes_laundry", name: "의류/세탁", iconName: "clothes", displayOrder: 60 },
  { code: "sleep_furniture", name: "수면/가구", iconName: "bed", displayOrder: 70 },
  { code: "outing_mobility", name: "외출/이동", iconName: "stroller", displayOrder: 80 },
  { code: "toys_books", name: "장난감/책", iconName: "book", displayOrder: 90 },
  { code: "care_education", name: "돌봄/교육", iconName: "education", displayOrder: 100 },
  { code: "insurance_savings", name: "보험/저축", iconName: "shield", displayOrder: 110 },
  { code: "etc", name: "기타", iconName: "more", displayOrder: 999 }
];

export { catalogItems as itemTemplateSeeds } from "../src/catalog/catalog";

export const disclosureSeeds: DisclosureSeed[] = [
  {
    key: "affiliate_purchase",
    text: "Purchases through affiliate links may generate a commission for WooriAI."
  },
  {
    key: "sponsored_product",
    text: "Sponsored products are marked separately from general recommendations."
  },
  {
    key: "nutrition_supplement",
    text: "Nutrition and supplement content is informational and is not medical advice."
  }
];

// Mirrors apps/mobile/src/categories.ts `categoryCatalog` exactly (id, code, label -> name).
// See MobileCategoryAliasSeed's doc comment for why these live outside categorySeeds.
export const mobileCategoryAliasSeeds: MobileCategoryAliasSeed[] = [
  { id: "c0a7e901-0000-4c01-8c01-c47e900ec001", code: "mobile_diaper_hygiene", name: "기저귀", iconName: "diaper", displayOrder: 1001 },
  { id: "c0a7e901-0000-4c02-8c02-c47e900ec002", code: "mobile_feeding_dairy", name: "분유/유제품", iconName: "bottle", displayOrder: 1002 },
  { id: "c0a7e901-0000-4c03-8c03-c47e900ec003", code: "mobile_feeding_meal", name: "식비", iconName: "bottle", displayOrder: 1003 },
  { id: "c0a7e901-0000-4c04-8c04-c47e900ec004", code: "mobile_clothes_laundry", name: "의류", iconName: "clothes", displayOrder: 1004 },
  { id: "c0a7e901-0000-4c05-8c05-c47e900ec005", code: "mobile_outing_mobility", name: "약품/교통", iconName: "stroller", displayOrder: 1005 },
  { id: "c0a7e901-0000-4c06-8c06-c47e900ec006", code: "mobile_hospital_checkup", name: "병원/약", iconName: "hospital", displayOrder: 1006 },
  { id: "c0a7e901-0000-4c07-8c07-c47e900ec007", code: "mobile_toys_books", name: "교육/도서", iconName: "book", displayOrder: 1007 },
  { id: "c0a7e901-0000-4c08-8c08-c47e900ec008", code: "mobile_etc", name: "기타", iconName: "more", displayOrder: 1008 }
];

/**
 * `defaultImportCategoryId` in src/onboarding/onboarding-store.service.ts's Excel
 * import stub-row generator (used until real parsing lands) hardcodes this same id
 * for every stub row. Round 4's "categoryId must exist in categories" validation
 * (see requireExistingCategory) means confirming an import job now needs this id to
 * resolve too, or every stub-derived expense would 400 on confirm.
 */
export const importStubCategorySeeds: MobileCategoryAliasSeed[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    code: "import_stub_default",
    name: "가져오기 기본",
    iconName: "more",
    displayOrder: 1009
  }
];

const baseProductLinkSeeds: ProductLinkSeed[] = [
  {
    itemTemplateCode: "car_seat",
    platform: "custom",
    title: "개발용 카시트 비교 링크",
    url: "https://example.com/dev/car-seat",
    affiliateUrl: "https://example.com/dev/affiliate/car-seat",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 250000,
    displayOrder: 10,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "stroller",
    platform: "custom",
    title: "개발용 유모차 스폰서 링크",
    url: "https://example.com/dev/stroller-sponsored",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: true,
    sponsorLabel: "스폰서 예시",
    priceSnapshotKrw: 320000,
    displayOrder: 20,
    active: true,
    disclosureText: "스폰서 상품 예시입니다."
  },
  {
    itemTemplateCode: "baby_bath",
    platform: "custom",
    title: "개발용 아기 욕조 링크",
    url: "https://example.com/dev/baby-bath",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 25000,
    displayOrder: 30,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "maternity_underwear",
    platform: "custom",
    title: "개발용 임산부 속옷 비교 링크",
    url: "https://example.com/dev/maternity-underwear",
    affiliateUrl: "https://example.com/dev/affiliate/maternity-underwear",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 37500,
    displayOrder: 40,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "anti_nausea_relief",
    platform: "custom",
    title: "개발용 입덧 완화 식품 링크",
    url: "https://example.com/dev/anti-nausea-relief",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 24000,
    displayOrder: 50,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "pregnancy_diary",
    platform: "custom",
    title: "개발용 태교 일기장 스폰서 링크",
    url: "https://example.com/dev/pregnancy-diary",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: true,
    sponsorLabel: "스폰서 예시",
    priceSnapshotKrw: 15000,
    displayOrder: 60,
    active: true,
    disclosureText: "스폰서 상품 예시입니다."
  },
  {
    itemTemplateCode: "maternity_clothes",
    platform: "custom",
    title: "개발용 수유 겸용 임부복 상의 비교 링크",
    url: "https://example.com/dev/maternity-clothes",
    affiliateUrl: "https://example.com/dev/affiliate/maternity-clothes",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 90000,
    displayOrder: 70,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "body_pillow",
    platform: "custom",
    title: "개발용 임산부 바디필로우 링크",
    url: "https://example.com/dev/body-pillow",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 75000,
    displayOrder: 80,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "stretch_care_cream",
    platform: "custom",
    title: "개발용 튼살 크림 링크",
    url: "https://example.com/dev/stretch-care-cream",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 37500,
    displayOrder: 90,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "iron_supplement",
    platform: "custom",
    title: "개발용 철분제 비교 링크",
    url: "https://example.com/dev/iron-supplement",
    affiliateUrl: "https://example.com/dev/affiliate/iron-supplement",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 25000,
    displayOrder: 100,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "prenatal_class",
    platform: "custom",
    title: "개발용 출산 준비 교실 링크",
    url: "https://example.com/dev/prenatal-class",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 100000,
    displayOrder: 110,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "hospital_bag",
    platform: "custom",
    title: "개발용 출산 가방 준비 링크",
    url: "https://example.com/dev/hospital-bag",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 125000,
    displayOrder: 120,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "newborn_clothes_set",
    platform: "custom",
    title: "개발용 배냇저고리 세트 비교 링크",
    url: "https://example.com/dev/newborn-clothes-set",
    affiliateUrl: "https://example.com/dev/affiliate/newborn-clothes-set",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 50000,
    displayOrder: 130,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "feeding_bottle_set",
    platform: "custom",
    title: "개발용 젖병/소독 세트 링크",
    url: "https://example.com/dev/feeding-bottle-set",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 90000,
    displayOrder: 140,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "breast_pump",
    platform: "custom",
    title: "개발용 유축기 링크",
    url: "https://example.com/dev/breast-pump",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 225000,
    displayOrder: 150,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "nursing_pads",
    platform: "custom",
    title: "개발용 수유 패드/산모 패드 비교 링크",
    url: "https://example.com/dev/nursing-pads",
    affiliateUrl: "https://example.com/dev/affiliate/nursing-pads",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 25000,
    displayOrder: 160,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "crib",
    platform: "custom",
    title: "개발용 아기 침대/요람 링크",
    url: "https://example.com/dev/crib",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 350000,
    displayOrder: 170,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "wipes_bulk",
    platform: "custom",
    title: "개발용 물티슈 대량 구매 스폰서 링크",
    url: "https://example.com/dev/wipes-bulk",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: true,
    sponsorLabel: "스폰서 예시",
    priceSnapshotKrw: 37500,
    displayOrder: 180,
    active: true,
    disclosureText: "스폰서 상품 예시입니다."
  },
  {
    itemTemplateCode: "formula",
    platform: "custom",
    title: "개발용 분유 비교 링크",
    url: "https://example.com/dev/formula",
    affiliateUrl: "https://example.com/dev/affiliate/formula",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 72500,
    displayOrder: 190,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "swaddle",
    platform: "custom",
    title: "개발용 속싸개/겉싸개 링크",
    url: "https://example.com/dev/swaddle",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 37500,
    displayOrder: 200,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "baby_thermometer",
    platform: "custom",
    title: "개발용 체온계 링크",
    url: "https://example.com/dev/baby-thermometer",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 47500,
    displayOrder: 210,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "baby_detergent",
    platform: "custom",
    title: "개발용 유아 세제 비교 링크",
    url: "https://example.com/dev/baby-detergent",
    affiliateUrl: "https://example.com/dev/affiliate/baby-detergent",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 19000,
    displayOrder: 220,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "baby_skincare",
    platform: "custom",
    title: "개발용 아기 로션/보습 링크",
    url: "https://example.com/dev/baby-skincare",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 25000,
    displayOrder: 230,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "nail_care_set",
    platform: "custom",
    title: "개발용 아기 손톱 관리 세트 링크",
    url: "https://example.com/dev/nail-care-set",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 12500,
    displayOrder: 240,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "baby_carrier",
    platform: "custom",
    title: "개발용 아기띠 비교 링크",
    url: "https://example.com/dev/baby-carrier",
    affiliateUrl: "https://example.com/dev/affiliate/baby-carrier",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 150000,
    displayOrder: 250,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "mobile_toy",
    platform: "custom",
    title: "개발용 아기 침대 모빌 링크",
    url: "https://example.com/dev/mobile-toy",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 47500,
    displayOrder: 260,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "high_chair",
    platform: "custom",
    title: "개발용 아기 식탁의자 링크",
    url: "https://example.com/dev/high-chair",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 175000,
    displayOrder: 270,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "weaning_tableware",
    platform: "custom",
    title: "개발용 이유식 식기/스푼 비교 링크",
    url: "https://example.com/dev/weaning-tableware",
    affiliateUrl: "https://example.com/dev/affiliate/weaning-tableware",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 30000,
    displayOrder: 280,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "teether",
    platform: "custom",
    title: "개발용 치발기 링크",
    url: "https://example.com/dev/teether",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 15000,
    displayOrder: 290,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "play_mat",
    platform: "custom",
    title: "개발용 충격완화 거실매트 링크",
    url: "https://example.com/dev/play-mat",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 175000,
    displayOrder: 300,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "safety_gate",
    platform: "custom",
    title: "개발용 안전문/안전가드 비교 링크",
    url: "https://example.com/dev/safety-gate",
    affiliateUrl: "https://example.com/dev/affiliate/safety-gate",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 90000,
    displayOrder: 310,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "corner_guards",
    platform: "custom",
    title: "개발용 모서리/콘센트 보호 링크",
    url: "https://example.com/dev/corner-guards",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 17500,
    displayOrder: 320,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "push_walker",
    platform: "custom",
    title: "개발용 걸음마 보조 장난감 스폰서 링크",
    url: "https://example.com/dev/push-walker",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: true,
    sponsorLabel: "스폰서 예시",
    priceSnapshotKrw: 75000,
    displayOrder: 330,
    active: true,
    disclosureText: "스폰서 상품 예시입니다."
  },
  {
    itemTemplateCode: "first_shoes",
    platform: "custom",
    title: "개발용 첫 걸음마 신발 비교 링크",
    url: "https://example.com/dev/first-shoes",
    affiliateUrl: "https://example.com/dev/affiliate/first-shoes",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 50000,
    displayOrder: 340,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "snack_container",
    platform: "custom",
    title: "개발용 간식 용기/빨대컵 링크",
    url: "https://example.com/dev/snack-container",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 17500,
    displayOrder: 350,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "potty_trainer",
    platform: "custom",
    title: "개발용 유아 변기 링크",
    url: "https://example.com/dev/potty-trainer",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 37500,
    displayOrder: 360,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "toddler_dental",
    platform: "custom",
    title: "개발용 유아 칫솔/치약 비교 링크",
    url: "https://example.com/dev/toddler-dental",
    affiliateUrl: "https://example.com/dev/affiliate/toddler-dental",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 15000,
    displayOrder: 370,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "toddler_tableware",
    platform: "custom",
    title: "개발용 유아 식기 세트 링크",
    url: "https://example.com/dev/toddler-tableware",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 30000,
    displayOrder: 380,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "ride_on_car",
    platform: "custom",
    title: "개발용 붕붕카 링크",
    url: "https://example.com/dev/ride-on-car",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 90000,
    displayOrder: 390,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "sticker_books",
    platform: "custom",
    title: "개발용 스티커북/놀이책 비교 링크",
    url: "https://example.com/dev/sticker-books",
    affiliateUrl: "https://example.com/dev/affiliate/sticker-books",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 34000,
    displayOrder: 400,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "daycare_kit",
    platform: "custom",
    title: "개발용 어린이집 준비물 링크",
    url: "https://example.com/dev/daycare-kit",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 75000,
    displayOrder: 410,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "toddler_rain_gear",
    platform: "custom",
    title: "개발용 유아 우비/장화 링크",
    url: "https://example.com/dev/toddler-rain-gear",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 30000,
    displayOrder: 420,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "kids_scooter",
    platform: "custom",
    title: "개발용 킥보드와 보호장비 비교 링크",
    url: "https://example.com/dev/kids-scooter",
    affiliateUrl: "https://example.com/dev/affiliate/kids-scooter",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 120000,
    displayOrder: 430,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "learning_desk",
    platform: "custom",
    title: "개발용 유아 책상·의자 링크",
    url: "https://example.com/dev/learning-desk",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 240000,
    displayOrder: 440,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "hangul_learning",
    platform: "custom",
    title: "개발용 한글/숫자 교구 링크",
    url: "https://example.com/dev/hangul-learning",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 82500,
    displayOrder: 450,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "art_supplies",
    platform: "custom",
    title: "개발용 미술놀이 세트 비교 링크",
    url: "https://example.com/dev/art-supplies",
    affiliateUrl: "https://example.com/dev/affiliate/art-supplies",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 35000,
    displayOrder: 460,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "kindergarten_kit",
    platform: "custom",
    title: "개발용 유치원 입학 준비물 링크",
    url: "https://example.com/dev/kindergarten-kit",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 125000,
    displayOrder: 470,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "kids_bicycle",
    platform: "custom",
    title: "개발용 네발 자전거와 헬멧 스폰서 링크",
    url: "https://example.com/dev/kids-bicycle",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: true,
    sponsorLabel: "스폰서 예시",
    priceSnapshotKrw: 215000,
    displayOrder: 480,
    active: true,
    disclosureText: "스폰서 상품 예시입니다."
  },
  {
    itemTemplateCode: "school_bag",
    platform: "custom",
    title: "개발용 초등 책가방 비교 링크",
    url: "https://example.com/dev/school-bag",
    affiliateUrl: "https://example.com/dev/affiliate/school-bag",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 145000,
    displayOrder: 490,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "school_supplies",
    platform: "custom",
    title: "개발용 학용품 세트 링크",
    url: "https://example.com/dev/school-supplies",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 60000,
    displayOrder: 500,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "study_desk_lamp",
    platform: "custom",
    title: "개발용 학습 책상/스탠드 링크",
    url: "https://example.com/dev/study-desk-lamp",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 300000,
    displayOrder: 510,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "kids_watch_phone",
    platform: "custom",
    title: "개발용 키즈폰/스마트워치 비교 링크",
    url: "https://example.com/dev/kids-watch-phone",
    affiliateUrl: "https://example.com/dev/affiliate/kids-watch-phone",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 175000,
    displayOrder: 520,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "workbook_set",
    platform: "custom",
    title: "개발용 문제집/학습지 링크",
    url: "https://example.com/dev/workbook-set",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 45000,
    displayOrder: 530,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "sports_equipment",
    platform: "custom",
    title: "개발용 운동용품 링크",
    url: "https://example.com/dev/sports-equipment",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 55000,
    displayOrder: 540,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "school_uniform",
    platform: "custom",
    title: "개발용 교복 비교 링크",
    url: "https://example.com/dev/school-uniform",
    affiliateUrl: "https://example.com/dev/affiliate/school-uniform",
    affiliatePartnerCode: null,
    isAffiliate: true,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 325000,
    displayOrder: 550,
    active: true,
    disclosureText: "이 링크는 제휴 링크 예시이며 구매 시 수수료가 발생할 수 있습니다."
  },
  {
    itemTemplateCode: "study_tablet",
    platform: "custom",
    title: "개발용 인강용 태블릿 링크",
    url: "https://example.com/dev/study-tablet",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 600000,
    displayOrder: 560,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "reference_books",
    platform: "custom",
    title: "개발용 참고서 세트 링크",
    url: "https://example.com/dev/reference-books",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 90000,
    displayOrder: 570,
    active: true,
    disclosureText: null
  },
  {
    itemTemplateCode: "ergonomic_chair",
    platform: "custom",
    title: "개발용 학습 의자 링크",
    url: "https://example.com/dev/ergonomic-chair",
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: 240000,
    displayOrder: 580,
    active: true,
    disclosureText: null
  }
];

const linkedItemCodes = new Set(baseProductLinkSeeds.map((link) => link.itemTemplateCode));

/**
 * Sprint 2 commerce policy A: keep the broad one-link catalog coverage and give
 * 40 core items a second, non-affiliate comparison destination. Essential items
 * are selected first, followed by the remaining reviewed catalog order. The
 * catalog report asserts that all 40 still have at least two active links.
 */
export const commerceCoreItemCodes = [
  ...catalogItems.filter(
    (item) => item.active && item.contentStatus === "reviewed" && item.necessityLevel === "essential"
  ),
  ...catalogItems.filter(
    (item) => item.active && item.contentStatus === "reviewed" && item.necessityLevel !== "essential"
  )
]
  .map((item) => item.code)
  .filter((code) => linkedItemCodes.has(code))
  .slice(0, 40);

const itemNameByCode = new Map(catalogItems.map((item) => [item.code, item.name]));
const baseLinkByItemCode = new Map(baseProductLinkSeeds.map((link) => [link.itemTemplateCode, link]));

const comparisonProductLinkSeeds: ProductLinkSeed[] = commerceCoreItemCodes.map((itemCode, index) => {
  const baseLink = baseLinkByItemCode.get(itemCode);
  const itemName = itemNameByCode.get(itemCode);
  if (!baseLink || !itemName) throw new Error(`Missing core commerce seed for ${itemCode}`);

  return {
    itemTemplateCode: itemCode,
    platform: "naver",
    title: `${itemName} 네이버 쇼핑 비교`,
    url: `https://shopping.naver.com/search/all?query=${encodeURIComponent(itemName)}`,
    affiliateUrl: null,
    affiliatePartnerCode: null,
    isAffiliate: false,
    isSponsored: false,
    sponsorLabel: null,
    priceSnapshotKrw: baseLink.priceSnapshotKrw,
    displayOrder: 1000 + index,
    active: true,
    disclosureText: null
  };
});

export const productLinkSeeds: ProductLinkSeed[] = [
  ...baseProductLinkSeeds,
  ...comparisonProductLinkSeeds
];
