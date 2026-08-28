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
//
// 실기기 피드백 1 이후 이 파일은 두 종류로 나뉜다:
//   1) **앱 콘텐츠** -- 준비템 카탈로그(localItemTemplateFixtures)·상품 링크·고지 문구·
//      카테고리·엑셀 가져오기 스텁 행. 실서버 시드에 해당하고 로컬 세션에서도 항상 살아 있다.
//   2) **테스트 픽스처** -- localSeedExpenses·localMemberFixtures·LOCAL_DEFAULT_BUDGET_KRW.
//      예전에는 테스트 로그인 시 자동으로 심어지던 "다온이" 데모 데이터였지만, 이제 테스트
//      로그인도 데이터 0에서 시작하므로 프로덕션 경로에서는 아무도 쓰지 않는다. 남겨 둔
//      이유는 "이미 기록이 쌓인 세션"을 arrange 하는 테스트 헬퍼
//      (local-backend.ts의 seedLocalDemoFixturesForTests) 하나뿐이다.
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

// UUID-shaped literals (not slugs): the real API validates item template ids with @IsUUID
// (e.g. PreparedItemsDto), so screens that send these ids in a real session would 400 on a
// readable slug. The trailing hex digit encodes the fixture index for determinism.
export const LOCAL_ITEM_DIAPER = "10ca11fe-0000-4a01-8a01-f1c7deb0a001";
export const LOCAL_ITEM_CARRIER = "10ca11fe-0000-4a02-8a02-f1c7deb0a002";
export const LOCAL_ITEM_BLOCKS = "10ca11fe-0000-4a03-8a03-f1c7deb0a003";
// 실기기 피드백 1: 임신~첫돌 시기의 카탈로그. 테스트 로그인이 데이터 0에서 시작하면서 아이의
// 시기도 사용자가 정하게 됐는데, 예전 카탈로그는 걸음마기(toddler_1_3)와 그 이후만 담고 있어
// 임신 중이나 신생아로 시작한 사용자에게 준비템 탭이 통째로 비어 보였다 -- 이 앱의 핵심 루프가
// 도는 바로 그 시기다. 이름·시기·문구는 실서버 시드(apps/api/prisma/seed-data.ts의
// itemTemplateSeeds)에서 그대로 가져와, 데모와 실계정이 같은 준비물을 말하게 한다.
export const LOCAL_ITEM_PREGNANCY_VITAMIN = "10ca11fe-0000-4a04-8a04-f1c7deb0a004";
export const LOCAL_ITEM_CAR_SEAT = "10ca11fe-0000-4a05-8a05-f1c7deb0a005";
export const LOCAL_ITEM_DIAPER_STOCK = "10ca11fe-0000-4a06-8a06-f1c7deb0a006";
export const LOCAL_ITEM_BABY_BATH = "10ca11fe-0000-4a07-8a07-f1c7deb0a007";
export const LOCAL_ITEM_STROLLER = "10ca11fe-0000-4a08-8a08-f1c7deb0a008";
export const LOCAL_ITEM_BABY_FOOD_MAKER = "10ca11fe-0000-4a09-8a09-f1c7deb0a009";

export const localItemTemplateFixtures: LocalItemTemplateFixture[] = [
  // --- 임신~첫돌 (실서버 시드 미러) ---
  {
    id: LOCAL_ITEM_PREGNANCY_VITAMIN,
    name: "임산부 영양제",
    necessityLevel: "essential",
    timingLabel: "임신 초기부터",
    priceMinKrw: 20_000,
    priceMaxKrw: 80_000,
    reasonText: "산모가 매달 챙기는 지출을 아이 준비 기록과 함께 남길 수 있어요.",
    skipReasonText: null,
    usedSecondhandOk: false,
    safetyNote: "복용 여부와 종류는 담당 의료진 안내를 우선해요.",
    displayOrder: 1,
    stageCodes: ["pregnancy_early", "pregnancy_mid", "pregnancy_late"]
  },
  {
    id: LOCAL_ITEM_CAR_SEAT,
    name: "카시트",
    necessityLevel: "essential",
    timingLabel: "출산 전후",
    priceMinKrw: 150_000,
    priceMaxKrw: 700_000,
    reasonText: "차량 이동이 있다면 퇴원과 외출 전에 안전 준비 상태를 확인해야 해요.",
    skipReasonText: null,
    usedSecondhandOk: false,
    safetyNote: "안전 인증과 설치 상태를 확인하고 사고 이력이 있는 중고 제품은 피해요.",
    displayOrder: 2,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: LOCAL_ITEM_DIAPER_STOCK,
    name: "기저귀 첫 준비",
    necessityLevel: "essential",
    timingLabel: "출산 직전~0개월",
    priceMinKrw: 30_000,
    priceMaxKrw: 120_000,
    reasonText: "출산 직후 반복 구매가 시작되는 기본 소모품이에요.",
    skipReasonText: null,
    usedSecondhandOk: false,
    safetyNote: null,
    displayOrder: 3,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    id: LOCAL_ITEM_BABY_BATH,
    name: "아기 욕조",
    necessityLevel: "convenience",
    timingLabel: "출산 전후",
    priceMinKrw: 15_000,
    priceMaxKrw: 80_000,
    reasonText: "초기 목욕 시간을 안정적으로 만들 수 있는 편의 준비템이에요.",
    skipReasonText: "세면대나 큰 대야를 안전하게 쓸 수 있다면 바로 사지 않아도 돼요.",
    usedSecondhandOk: true,
    safetyNote: "물 사용 중에는 아이 곁을 떠나지 않아요.",
    displayOrder: 4,
    stageCodes: ["pregnancy_late", "newborn_0_3", "infant_4_6"]
  },
  {
    id: LOCAL_ITEM_STROLLER,
    name: "유모차",
    necessityLevel: "optional",
    timingLabel: "외출이 늘어날 때",
    priceMinKrw: 100_000,
    priceMaxKrw: 1_200_000,
    reasonText: "생활 반경과 이동 방식에 따라 외출 부담을 줄여주는 선택 준비템이에요.",
    skipReasonText: "차량 이동이 적거나 아기띠로 충분한 시기라면 구매를 늦춰도 돼요.",
    usedSecondhandOk: true,
    safetyNote: "프레임 잠금, 브레이크, 안전벨트 상태를 확인해요.",
    displayOrder: 5,
    stageCodes: ["newborn_0_3", "infant_4_6", "infant_7_12"]
  },
  {
    id: LOCAL_ITEM_BABY_FOOD_MAKER,
    name: "이유식 조리 도구",
    necessityLevel: "convenience",
    timingLabel: "4~6개월 전후",
    priceMinKrw: 20_000,
    priceMaxKrw: 200_000,
    reasonText: "이유식 시작 시 조리와 보관 흐름을 편하게 만드는 준비템이에요.",
    skipReasonText: "집에 있는 조리 도구와 보관 용기로 충분하면 별도 구매하지 않아도 돼요.",
    usedSecondhandOk: true,
    safetyNote: "소독과 세척이 쉬운 구조인지 확인해요.",
    displayOrder: 6,
    stageCodes: ["infant_4_6", "infant_7_12"]
  },
  // --- 걸음마기 이후(기존 픽스처) ---
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
  // 임신~첫돌 준비템의 구매 링크. 제휴 여부 고지는 실제 노출 문구 그대로 싣는다(DNC-010) --
  // 데모라고 해서 고지를 비우거나 없는 제휴를 있는 척하지 않는다.
  {
    id: "local-link-car-seat-coupang",
    itemTemplateId: LOCAL_ITEM_CAR_SEAT,
    platform: "coupang",
    title: "쿠팡",
    url: "https://example.com/coupang/car-seat",
    affiliateUrl: "https://example.com/coupang/car-seat?ref=wooriai",
    isAffiliate: true,
    isSponsored: false,
    disclosureText: "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요.",
    displayOrder: 10
  },
  {
    id: "local-link-diaper-stock-naver",
    itemTemplateId: LOCAL_ITEM_DIAPER_STOCK,
    platform: "naver",
    title: "네이버 스토어",
    url: "https://example.com/naver/diaper-stock",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    displayOrder: 10
  },
  {
    id: "local-link-stroller-coupang",
    itemTemplateId: LOCAL_ITEM_STROLLER,
    platform: "coupang",
    title: "쿠팡",
    url: "https://example.com/coupang/stroller",
    affiliateUrl: "https://example.com/coupang/stroller?ref=wooriai",
    isAffiliate: true,
    isSponsored: false,
    disclosureText: "이 링크로 구매하면 우리아이가 제휴수수료를 받을 수 있어요.",
    displayOrder: 10
  },
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
    // 라운드 44 리뷰 N-1: 예전 값은 "스폰서 상품이며 구매 CTA 근처에 광고/제휴 고지를
    // 표시합니다."였다 -- 사용자에게 보여 줄 고지가 아니라 **개발 스펙을 적어 둔 메모**였고
    // (합쇼체라 앱 어디와도 말투가 다르다), 스폰서 우선 규칙 탓에 데모 기저귀 상세의 구매
    // CTA 옆에 그대로 렌더됐다. 실사용 문구로 바꾼다: 광고임을 먼저 밝히고(DNC-011) 같은
    // 줄에서 수수료 고지를 잇는다(DNC-010). 해요체(DNC-018).
    disclosureText: "스폰서 광고 링크예요. 이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요.",
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
