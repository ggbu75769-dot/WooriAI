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
import {
  LOCAL_CHILD_ID,
  LOCAL_DAD_USER_ID,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_MOTHER_PROFILE_ID,
  LOCAL_USER_ID
} from "./fixture-identifiers";
import { PREPARED_ITEM_CARRIER_ID, PREPARED_ITEM_DIAPER_ID } from "./prepared-item-ids";

// Fixed identifiers for the local (server-less) test-mode backend. These never touch the
// session store's accessToken/defaultHouseholdId/userId fields -- those must stay null for
// an isTestSession per the local test login contract (see src/test-login-flow.test.ts).
export {
  LOCAL_CHILD_ID,
  LOCAL_DAD_USER_ID,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_MOTHER_PROFILE_ID,
  LOCAL_USER_ID
} from "./fixture-identifiers";

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

// UUID-shaped literals (not slugs): the real API validates item template ids with @IsUUID
// (e.g. PreparedItemsDto), so screens that send these ids in a real session would 400 on a
// readable slug. The trailing hex digit encodes the fixture index for determinism.
export const LOCAL_ITEM_DIAPER = PREPARED_ITEM_DIAPER_ID;
export const LOCAL_ITEM_CARRIER = PREPARED_ITEM_CARRIER_ID;
export const LOCAL_ITEM_BLOCKS = "10ca11fe-0000-4a03-8a03-f1c7deb0a003";

export const localItemTemplateFixtures: LocalItemTemplateFixture[] = [
  {
    id: LOCAL_ITEM_DIAPER,
    name: "기저귀",
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
    name: "아기띠",
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
    name: "블록 세트",
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
  },
  {
    id: "10ca11fe-0000-4a04-8a04-f1c7deb0a004",
    name: "아기 침대",
    necessityLevel: "essential",
    timingLabel: "출산 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "안전한 수면 공간을 미리 확인해요.",
    skipReasonText: "이미 안전한 수면 공간이 있는 경우",
    usedSecondhandOk: true,
    safetyNote: "매트리스 밀착과 난간 간격을 확인해 주세요.",
    displayOrder: 40,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a05-8a05-f1c7deb0a005",
    name: "배냇저고리",
    necessityLevel: "essential",
    timingLabel: "출산 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "처음 입을 옷을 계절에 맞게 준비해요.",
    skipReasonText: "물려받거나 선물 받은 옷이 충분한 경우",
    usedSecondhandOk: true,
    safetyNote: null,
    displayOrder: 50,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a06-8a06-f1c7deb0a006",
    name: "속싸개",
    necessityLevel: "convenience",
    timingLabel: "출산 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "신생아 돌봄에 필요한 수량을 점검해요.",
    skipReasonText: "대체할 수 있는 천이 있는 경우",
    usedSecondhandOk: true,
    safetyNote: "수면 중 얼굴을 덮지 않도록 주의해 주세요.",
    displayOrder: 60,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a07-8a07-f1c7deb0a007",
    name: "젖병",
    necessityLevel: "convenience",
    timingLabel: "필요 시",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "수유 계획에 맞춰 필요한 수량만 준비해요.",
    skipReasonText: "현재 수유 계획상 필요하지 않은 경우",
    usedSecondhandOk: false,
    safetyNote: "제품별 소독 방법을 확인해 주세요.",
    displayOrder: 70,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a08-8a08-f1c7deb0a008",
    name: "체온계",
    necessityLevel: "essential",
    timingLabel: "출산 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "가정에서 상태를 확인할 기본 도구를 준비해요.",
    skipReasonText: "이미 정상 작동하는 제품이 있는 경우",
    usedSecondhandOk: true,
    safetyNote: "사용법과 측정 위치를 제품 설명서에서 확인해 주세요.",
    displayOrder: 80,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a09-8a09-f1c7deb0a009",
    name: "아기 욕조",
    necessityLevel: "convenience",
    timingLabel: "출산 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "목욕 공간과 보관 위치를 함께 확인해요.",
    skipReasonText: "안전한 대체 목욕 공간이 있는 경우",
    usedSecondhandOk: true,
    safetyNote: "물 높이와 온도를 항상 보호자가 확인해 주세요.",
    displayOrder: 90,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a0a-8a0a-f1c7deb0a00a",
    name: "손수건",
    necessityLevel: "essential",
    timingLabel: "출산 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "세탁 주기를 고려해 필요한 수량을 준비해요.",
    skipReasonText: "사용 가능한 손수건이 충분한 경우",
    usedSecondhandOk: true,
    safetyNote: null,
    displayOrder: 100,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a0b-8a0b-f1c7deb0a00b",
    name: "카시트",
    necessityLevel: "essential",
    timingLabel: "퇴원 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "첫 이동 전에 차량과 설치 호환성을 확인해요.",
    skipReasonText: "차량 이동 계획이 없거나 적합한 제품이 있는 경우",
    usedSecondhandOk: false,
    safetyNote: "사용 연령, 설치 방향, 사고 이력을 반드시 확인해 주세요.",
    displayOrder: 110,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: "10ca11fe-0000-4a0c-8a0c-f1c7deb0a00c",
    name: "유모차",
    necessityLevel: "convenience",
    timingLabel: "외출 전",
    priceMinKrw: null,
    priceMaxKrw: null,
    reasonText: "생활 동선과 보관 공간에 맞는지 확인해요.",
    skipReasonText: "다른 안전한 이동 수단이 있는 경우",
    usedSecondhandOk: true,
    safetyNote: "브레이크와 안전벨트 작동을 확인해 주세요.",
    displayOrder: 120,
    stageCodes: ["newborn_0_3", "infant_4_6"]
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
