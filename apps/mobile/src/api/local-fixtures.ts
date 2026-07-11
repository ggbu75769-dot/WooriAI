import type {
  ChildStageCode,
  ExpenseSource,
  ExpenseType,
  MemberRole,
  MemberStatus,
  NecessityLevel,
  PaymentMethod,
  ProductPlatform
} from "@wooriai/domain";

// Fixed identifiers for the local (server-less) test-mode backend. These never touch the
// session store's accessToken/defaultHouseholdId/userId fields -- those must stay null for
// an isTestSession per the local test login contract (see src/test-login-flow.test.ts).
export const LOCAL_CHILD_ID = "local-child-daon";
export const LOCAL_HOUSEHOLD_ID = "local-household-daon";
export const LOCAL_USER_ID = "local-user-self";
export const LOCAL_DAD_USER_ID = "local-user-dad";

export const LOCAL_DEFAULT_BUDGET_KRW = 1_600_000;

export const LOCAL_CATEGORY_DIAPER = "local-category-diaper";
export const LOCAL_CATEGORY_FORMULA = "local-category-formula";
export const LOCAL_CATEGORY_DETERGENT = "local-category-detergent";
export const LOCAL_CATEGORY_IMPORT = "local-category-import";

export const localCategoryNameKo: Record<string, string> = {
  [LOCAL_CATEGORY_DIAPER]: "기저귀",
  [LOCAL_CATEGORY_FORMULA]: "분유/유제품",
  [LOCAL_CATEGORY_DETERGENT]: "유아용 세제",
  [LOCAL_CATEGORY_IMPORT]: "가져오기"
};

export type LocalSeedExpense = {
  categoryId: string;
  amountKrw: number;
  itemName: string;
  daysAgo: number;
  expenseType: ExpenseType;
  source: ExpenseSource;
  paymentMethod: PaymentMethod;
};

export const localSeedExpenses: LocalSeedExpense[] = [
  {
    categoryId: LOCAL_CATEGORY_DIAPER,
    amountKrw: 45_900,
    itemName: "기저귀",
    daysAgo: 0,
    expenseType: "expense",
    source: "manual",
    paymentMethod: "card"
  },
  {
    categoryId: LOCAL_CATEGORY_FORMULA,
    amountKrw: 32_400,
    itemName: "분유/유제품",
    daysAgo: 1,
    expenseType: "expense",
    source: "manual",
    paymentMethod: "card"
  },
  {
    categoryId: LOCAL_CATEGORY_DETERGENT,
    amountKrw: 18_900,
    itemName: "유아용 세제",
    daysAgo: 2,
    expenseType: "expense",
    source: "manual",
    paymentMethod: "card"
  }
];

export type LocalProductLinkFixture = {
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
};

export type LocalItemTemplateFixture = {
  id: string;
  name: string;
  necessityLevel: NecessityLevel;
  timingLabel: string;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  displayOrder: number;
  stageCodes: ChildStageCode[];
};

export const LOCAL_ITEM_DIAPER = "local-item-diaper";
export const LOCAL_ITEM_CARRIER = "local-item-carrier";
export const LOCAL_ITEM_BLOCKS = "local-item-blocks";

export const localItemTemplateFixtures: LocalItemTemplateFixture[] = [
  {
    id: LOCAL_ITEM_DIAPER,
    name: "네이처러브 기저귀 팬티형",
    necessityLevel: "essential",
    timingLabel: "12-24개월",
    priceMinKrw: 42_900,
    priceMaxKrw: 48_900,
    reasonText: "소모가 빠른 물건이라 월별 예산과 함께 준비 상태를 체크하기 좋아요.",
    skipReasonText: "가정에 충분한 재고가 있거나 선물로 받은 경우",
    usedSecondhandOk: false,
    safetyNote: "피부에 닿는 제품은 사이즈와 소재를 확인해 주세요.",
    displayOrder: 10,
    stageCodes: ["toddler_1_3"]
  },
  {
    id: LOCAL_ITEM_CARRIER,
    name: "베이비 아기띠 힙시트",
    necessityLevel: "essential",
    timingLabel: "12-24개월",
    priceMinKrw: 89_000,
    priceMaxKrw: 89_000,
    reasonText: "걷기 시작한 아이를 안전하게 이동시키기 위해 필요해요.",
    skipReasonText: "이미 다른 이동 수단이 있거나 물려받은 경우",
    usedSecondhandOk: true,
    safetyNote: "허리 지지대와 안전벨트를 항상 확인해 주세요.",
    displayOrder: 20,
    stageCodes: ["toddler_1_3"]
  },
  {
    id: LOCAL_ITEM_BLOCKS,
    name: "도담도담 원목 블록 세트",
    necessityLevel: "optional",
    timingLabel: "24개월+",
    priceMinKrw: 33_800,
    priceMaxKrw: 33_800,
    reasonText: "소근육 발달과 색·모양 인지에 도움이 돼요.",
    skipReasonText: "이미 비슷한 놀잇감이 충분한 경우",
    usedSecondhandOk: true,
    safetyNote: "작은 조각을 삼키지 않도록 사용 연령을 확인해 주세요.",
    displayOrder: 30,
    stageCodes: ["kid_4_7"]
  }
];

export const localProductLinkFixtures: LocalProductLinkFixture[] = [
  {
    id: "local-link-diaper-affiliate",
    itemTemplateId: LOCAL_ITEM_DIAPER,
    platform: "custom",
    title: "우리아이몰",
    url: "https://example.com/wooriai-mall/diaper",
    affiliateUrl: "https://example.com/wooriai-mall/diaper?ref=wooriai",
    isAffiliate: true,
    isSponsored: false,
    disclosureText: "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요.",
    displayOrder: 10
  },
  {
    id: "local-link-diaper-sponsored",
    itemTemplateId: LOCAL_ITEM_DIAPER,
    platform: "custom",
    title: "네이처 공식몰",
    url: "https://example.com/nature-official/diaper",
    affiliateUrl: null,
    isAffiliate: true,
    isSponsored: true,
    disclosureText: "스폰서 상품이며 구매 CTA 근처에 광고/제휴 고지를 표시합니다.",
    displayOrder: 20
  },
  {
    id: "local-link-carrier-coupang",
    itemTemplateId: LOCAL_ITEM_CARRIER,
    platform: "coupang",
    title: "쿠팡",
    url: "https://example.com/coupang/carrier",
    affiliateUrl: "https://example.com/coupang/carrier?ref=wooriai",
    isAffiliate: true,
    isSponsored: false,
    disclosureText: "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요.",
    displayOrder: 10
  },
  {
    id: "local-link-blocks-naver",
    itemTemplateId: LOCAL_ITEM_BLOCKS,
    platform: "naver",
    title: "네이버 스토어",
    url: "https://example.com/naver/blocks",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    displayOrder: 10
  }
];

export type LocalMemberFixture = {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
};

export const localMemberFixtures: LocalMemberFixture[] = [
  {
    id: "local-member-self",
    householdId: LOCAL_HOUSEHOLD_ID,
    userId: LOCAL_USER_ID,
    displayName: "엄마 (나)",
    role: "owner",
    status: "active"
  },
  {
    id: "local-member-dad",
    householdId: LOCAL_HOUSEHOLD_ID,
    userId: LOCAL_DAD_USER_ID,
    displayName: "아빠",
    role: "co_parent",
    status: "active"
  }
];

export const localImportStubRows: Array<{
  rowIndex: number;
  itemName: string;
  amountKrw: number;
  confidence: number;
  daysAgo: number;
  selectedByDefault: boolean;
}> = [
  { rowIndex: 0, itemName: "가져온 기저귀 내역", amountKrw: 32_000, confidence: 0.94, daysAgo: 6, selectedByDefault: true },
  { rowIndex: 1, itemName: "가져온 분유 내역", amountKrw: 33_000, confidence: 0.86, daysAgo: 5, selectedByDefault: true },
  { rowIndex: 2, itemName: "중복 의심 물티슈 내역", amountKrw: 9_000, confidence: 0.62, daysAgo: 4, selectedByDefault: false }
];
