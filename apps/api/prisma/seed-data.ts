import type { ChildStageCode } from "@prisma/client";

export type CategorySeed = {
  code: string;
  name: string;
  iconName: string;
  displayOrder: number;
};

export type ItemTemplateSeed = {
  code: string;
  name: string;
  categoryCode: string;
  necessityLevel: "essential" | "convenience" | "optional";
  timingLabel: string;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  reasonText: string;
  skipReasonText: string | null;
  usedSecondhandOk: boolean;
  safetyNote: string | null;
  medicalDisclaimerRequired: boolean;
  displayOrder: number;
  active: boolean;
  stageCodes: ChildStageCode[];
};

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

export const itemTemplateSeeds: ItemTemplateSeed[] = [
  {
    code: "pregnancy_vitamin",
    name: "임산부 영양제",
    categoryCode: "pregnancy_mother",
    necessityLevel: "essential",
    timingLabel: "임신 초기부터",
    priceMinKrw: 20000,
    priceMaxKrw: 80000,
    reasonText: "산모가 매달 챙기는 지출을 아이 준비 기록과 함께 남길 수 있습니다.",
    skipReasonText: null,
    usedSecondhandOk: false,
    safetyNote: "복용 여부와 종류는 담당 의료진 안내를 우선합니다.",
    medicalDisclaimerRequired: true,
    displayOrder: 10,
    active: true,
    stageCodes: ["pregnancy_early", "pregnancy_mid", "pregnancy_late"]
  },
  {
    code: "car_seat",
    name: "카시트",
    categoryCode: "outing_mobility",
    necessityLevel: "essential",
    timingLabel: "출산 전후",
    priceMinKrw: 150000,
    priceMaxKrw: 700000,
    reasonText: "차량 이동이 있다면 퇴원과 외출 전에 안전 준비 상태를 확인해야 합니다.",
    skipReasonText: null,
    usedSecondhandOk: false,
    safetyNote: "안전 인증과 설치 상태를 확인하고 사고 이력이 있는 중고 제품은 피합니다.",
    medicalDisclaimerRequired: false,
    displayOrder: 20,
    active: true,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    code: "diaper_stock",
    name: "기저귀 첫 준비",
    categoryCode: "diaper_hygiene",
    necessityLevel: "essential",
    timingLabel: "출산 직전~0개월",
    priceMinKrw: 30000,
    priceMaxKrw: 120000,
    reasonText: "출산 직후 반복 구매가 시작되는 기본 소모품입니다.",
    skipReasonText: null,
    usedSecondhandOk: false,
    safetyNote: null,
    medicalDisclaimerRequired: false,
    displayOrder: 30,
    active: true,
    stageCodes: ["pregnancy_late", "newborn_0_3"]
  },
  {
    code: "baby_bath",
    name: "아기 욕조",
    categoryCode: "diaper_hygiene",
    necessityLevel: "convenience",
    timingLabel: "출산 전후",
    priceMinKrw: 15000,
    priceMaxKrw: 80000,
    reasonText: "초기 목욕 시간을 안정적으로 만들 수 있는 편의 준비템입니다.",
    skipReasonText: "세면대나 큰 대야를 안전하게 쓸 수 있다면 바로 사지 않아도 됩니다.",
    usedSecondhandOk: true,
    safetyNote: "물 사용 중에는 아이 곁을 떠나지 않습니다.",
    medicalDisclaimerRequired: false,
    displayOrder: 40,
    active: true,
    stageCodes: ["pregnancy_late", "newborn_0_3", "infant_4_6"]
  },
  {
    code: "stroller",
    name: "유모차",
    categoryCode: "outing_mobility",
    necessityLevel: "optional",
    timingLabel: "외출이 늘어날 때",
    priceMinKrw: 100000,
    priceMaxKrw: 1200000,
    reasonText: "생활 반경과 이동 방식에 따라 외출 부담을 줄여주는 선택 준비템입니다.",
    skipReasonText: "차량 이동이 적거나 아기띠로 충분한 시기라면 구매를 늦춰도 됩니다.",
    usedSecondhandOk: true,
    safetyNote: "프레임 잠금, 브레이크, 안전벨트 상태를 확인합니다.",
    medicalDisclaimerRequired: false,
    displayOrder: 50,
    active: true,
    stageCodes: ["newborn_0_3", "infant_4_6", "infant_7_12"]
  },
  {
    code: "baby_food_maker",
    name: "이유식 조리 도구",
    categoryCode: "feeding_babyfood",
    necessityLevel: "convenience",
    timingLabel: "4~6개월 전후",
    priceMinKrw: 20000,
    priceMaxKrw: 200000,
    reasonText: "이유식 시작 시 조리와 보관 흐름을 편하게 만드는 준비템입니다.",
    skipReasonText: "집에 있는 조리 도구와 보관 용기로 충분하면 별도 구매하지 않아도 됩니다.",
    usedSecondhandOk: true,
    safetyNote: "소독과 세척이 쉬운 구조인지 확인합니다.",
    medicalDisclaimerRequired: false,
    displayOrder: 60,
    active: true,
    stageCodes: ["infant_4_6", "infant_7_12"]
  },
  {
    code: "first_books",
    name: "첫 그림책",
    categoryCode: "toys_books",
    necessityLevel: "optional",
    timingLabel: "7~12개월",
    priceMinKrw: 10000,
    priceMaxKrw: 150000,
    reasonText: "놀이와 책 읽기 기록을 남기고 싶을 때 준비할 수 있습니다.",
    skipReasonText: "도서관, 물려받은 책, 선물 책이 충분하면 새로 사지 않아도 됩니다.",
    usedSecondhandOk: true,
    safetyNote: "찢어진 모서리나 작은 부품이 없는지 확인합니다.",
    medicalDisclaimerRequired: false,
    displayOrder: 70,
    active: true,
    stageCodes: ["infant_7_12", "toddler_1_3"]
  }
];

export const productLinkSeeds: ProductLinkSeed[] = [
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
  }
];
