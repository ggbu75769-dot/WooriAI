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
  /**
   * 라운드 52 C-01: 판매처별 가격 스냅샷과 그 확인 시각. 실서버와 같은 규칙으로
   * **둘 다 있거나 둘 다 없다**(local-backend getItemDetail이 그 짝을 그대로 내보낸다).
   * 값은 아래 LOCAL_PRICE_CHECKED_AT_* 고정 상수다 — 자세한 이유는 그 주석 참고.
   */
  priceSnapshotKrw: number | null;
  priceCheckedAt: string | null;
  displayOrder: number;
};

/**
 * 데모 링크의 가격 확인 시각 — **고정 상수**다. `new Date()`/`Date.now()`로 만들지 않는다.
 *
 * 실행할 때마다 "오늘 확인함"이 되면 데모가 늘 갓 확인한 가격인 척하게 되는데, 실제로는
 * 픽스처에 박아 둔 숫자일 뿐이다(허위 신선도). 서버 시드도 같은 이유로 재실행만으로는
 * 확인 시각을 오늘로 밀지 않는다(apps/api/prisma/seed.ts resolveSeedPriceCheckedAt).
 * 값은 UTC ISO — 09:00Z는 서울 18:00이라 두 달력 어디서도 날짜가 갈리지 않는다.
 *
 * FIX-C(2026-09-03): 플랜 B 정합으로 픽스처 행의 가격 스냅샷이 전부 null이 되면서 이 두 상수를
 * 참조하는 행은 없어졌다. 상수는 남긴다 — 순수 판정 테스트(link-price.test.ts)가 고정 시각
 * 입력으로 쓰고, 가격 스냅샷이 되살아나는 날(플랜 A CSV 전환) 같은 규율로 다시 쓰인다.
 */
export const LOCAL_PRICE_CHECKED_AT = "2026-08-20T09:00:00.000Z";
/** 같은 상세 화면에서 확인 시각이 행마다 다를 수 있다는 사실을 데모에서도 보이게 하는 짝. */
export const LOCAL_PRICE_CHECKED_AT_OLDER = "2026-07-02T09:00:00.000Z";

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

/**
 * FIX-C(2026-09-03) — 데모 링크를 서버 시드 **플랜 B**(2026-09-02, apps/api/prisma/seed-data.ts
 * productLinkSeeds 머리말)와 같은 원칙으로 맞춘다(두 시점).
 *
 * ① 종전 픽스처는 example.com 플레이스홀더 URL에 `isAffiliate: true`·제휴 고지 문구·가격
 *    스냅샷·스폰서 행("네이처 공식몰")을 실었다 — standalone APK가 이 내장 데이터로 돌므로,
 *    실계정이 이미 플랜 B로 옮겨 간 뒤에도 앱은 "제휴" 배지와 "459,000원 · 7월 2일 확인" 같은
 *    옛 데이터를 계속 말했다.
 * ② FIX-C: 쿠팡 파트너스 승인 전 출시 상태를 데모도 그대로 말한다.
 *    - **실 쿠팡 검색 URL**(`https://www.coupang.com/np/search?q=<품목명>`) — 계정·키 없이
 *      동작하는 실 링크라 죽은 CTA가 없다.
 *    - **전 행 `isAffiliate: false` · `affiliateUrl: null` · `disclosureText: null`** — 검색
 *      링크로는 수수료를 받지 않으므로 제휴 고지가 서면 그것이 허위 고지다(DNC-010의 반대
 *      방향 오류). 화면 판정은 link-marker의 `productLinksDisclosureText`가 **집합**으로
 *      내리므로, 제휴도 스폰서도 없는 이 픽스처에서는 고지 문장이 서지 않는다(undefined).
 *    - **가격 스냅샷 제거**(`priceSnapshotKrw/priceCheckedAt: null`) — 검색 결과 페이지에는
 *      단일 가격이 없다. 확인할 수 없는 가격을 적어 두면 데모가 그것을 확인 시각과 함께
 *      유효화한다(허위 데이터).
 *    - **활성 스폰서 0** — 서버 시드는 스폰서 예시 다섯을 `active: false`로 내려 두었는데,
 *      로컬 픽스처에는 active 축이 없어 실린 행이 곧 활성이다. 그래서 스폰서 행
 *      ("local-link-diaper-sponsored")은 행째로 지운다(계약 성사 시 실 값으로 되살린다).
 *      일반 검색 링크가 "스폰서" 배지를 달면 DNC-011의 반대 방향 오류다.
 *    - id는 전부 종전 그대로다(테스트·큐가 id로 행을 찾는다). platform은 실제 목적지대로
 *      전 행 `coupang`, title은 시드와 같은 "<품목명> 쿠팡 검색" 관례를 쓴다.
 *    추천 점수·정렬은 무변경(DNC-009).
 */
export const localProductLinkFixtures: LocalProductLinkFixture[] = [
  {
    id: "local-link-car-seat-coupang",
    itemTemplateId: LOCAL_ITEM_CAR_SEAT,
    platform: "coupang",
    title: "카시트 쿠팡 검색",
    url: "https://www.coupang.com/np/search?q=%EC%B9%B4%EC%8B%9C%ED%8A%B8",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    priceSnapshotKrw: null,
    priceCheckedAt: null,
    displayOrder: 10
  },
  {
    id: "local-link-diaper-stock-naver",
    itemTemplateId: LOCAL_ITEM_DIAPER_STOCK,
    platform: "coupang",
    title: "기저귀 쿠팡 검색",
    url: "https://www.coupang.com/np/search?q=%EA%B8%B0%EC%A0%80%EA%B7%80",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    priceSnapshotKrw: null,
    priceCheckedAt: null,
    displayOrder: 10
  },
  {
    id: "local-link-stroller-coupang",
    itemTemplateId: LOCAL_ITEM_STROLLER,
    platform: "coupang",
    title: "유모차 쿠팡 검색",
    url: "https://www.coupang.com/np/search?q=%EC%9C%A0%EB%AA%A8%EC%B0%A8",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    priceSnapshotKrw: null,
    priceCheckedAt: null,
    displayOrder: 10
  },
  {
    id: "local-link-diaper-affiliate",
    itemTemplateId: LOCAL_ITEM_DIAPER,
    platform: "coupang",
    title: "기저귀 팬티형 쿠팡 검색",
    url: "https://www.coupang.com/np/search?q=%EA%B8%B0%EC%A0%80%EA%B7%80%20%ED%8C%AC%ED%8B%B0%ED%98%95",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    priceSnapshotKrw: null,
    priceCheckedAt: null,
    displayOrder: 10
  },
  {
    id: "local-link-carrier-coupang",
    itemTemplateId: LOCAL_ITEM_CARRIER,
    platform: "coupang",
    title: "아기띠 쿠팡 검색",
    url: "https://www.coupang.com/np/search?q=%EC%95%84%EA%B8%B0%EB%9D%A0",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    priceSnapshotKrw: null,
    priceCheckedAt: null,
    displayOrder: 10
  },
  {
    id: "local-link-blocks-naver",
    itemTemplateId: LOCAL_ITEM_BLOCKS,
    platform: "coupang",
    title: "원목 블록 쿠팡 검색",
    url: "https://www.coupang.com/np/search?q=%EC%9B%90%EB%AA%A9%20%EB%B8%94%EB%A1%9D",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    priceSnapshotKrw: null,
    priceCheckedAt: null,
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
