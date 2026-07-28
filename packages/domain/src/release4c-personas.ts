import type { CatalogScenarioCode, ChildLifecycleCode, MotherLifecycleCode } from "./release4-catalog";

export type Release4cPersona = {
  id: string;
  labelKo: string;
  lifecycleAxis: "mother" | "child";
  lifecycleCode: MotherLifecycleCode | ChildLifecycleCode;
  contextCodes: CatalogScenarioCode[];
  householdRole: "owner" | "co_parent" | "gift_participant";
  expectedBundleNameKo: string;
  expectedContextMatch: boolean;
  safetyConstraint?: "professional_review_required";
};

export const release4cPersonas: Release4cPersona[] = [
  { id: "pregnancy-planning", labelKo: "임신 준비 중", lifecycleAxis: "mother", lifecycleCode: "pregnancy_planning", contextCodes: [], householdRole: "owner", expectedBundleNameKo: "임신 초기 생활 적응", expectedContextMatch: false },
  { id: "pregnancy-early-first", labelKo: "임신 초기 첫째", lifecycleAxis: "mother", lifecycleCode: "pregnancy_early", contextCodes: ["first_child"], householdRole: "owner", expectedBundleNameKo: "임신 초기 생활 적응", expectedContextMatch: false },
  { id: "pregnancy-late-first", labelKo: "임신 후기 첫째", lifecycleAxis: "mother", lifecycleCode: "pregnancy_late", contextCodes: ["first_child"], householdRole: "owner", expectedBundleNameKo: "출산 입원 가방", expectedContextMatch: false },
  { id: "planned-cesarean", labelKo: "제왕절개 예정", lifecycleAxis: "mother", lifecycleCode: "pregnancy_late", contextCodes: ["cesarean_delivery"], householdRole: "owner", expectedBundleNameKo: "제왕절개 입원·회복", expectedContextMatch: true, safetyConstraint: "professional_review_required" },
  { id: "multiple-pregnancy", labelKo: "쌍둥이 임신", lifecycleAxis: "mother", lifecycleCode: "pregnancy_late", contextCodes: ["multiple_birth"], householdRole: "owner", expectedBundleNameKo: "쌍둥이·다태아", expectedContextMatch: true, safetyConstraint: "professional_review_required" },
  { id: "postpartum-two-weeks", labelKo: "산후 2주", lifecycleAxis: "mother", lifecycleCode: "postpartum_0_6w", contextCodes: [], householdRole: "owner", expectedBundleNameKo: "산후 2주 회복", expectedContextMatch: false },
  { id: "breastfeeding", labelKo: "모유수유", lifecycleAxis: "mother", lifecycleCode: "feeding_ongoing", contextCodes: ["breastfeeding"], householdRole: "owner", expectedBundleNameKo: "모유수유 시작", expectedContextMatch: true },
  { id: "formula-feeding", labelKo: "분유수유", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: ["formula_feeding"], householdRole: "owner", expectedBundleNameKo: "분유수유 시작", expectedContextMatch: true },
  { id: "newborn", labelKo: "신생아", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: [], householdRole: "owner", expectedBundleNameKo: "신생아 집 맞이", expectedContextMatch: false },
  { id: "weaning-six-months", labelKo: "6개월 이유식 시작", lifecycleAxis: "child", lifecycleCode: "infant_4_6m", contextCodes: [], householdRole: "owner", expectedBundleNameKo: "이유식 시작", expectedContextMatch: false },
  { id: "daycare-twelve-months", labelKo: "12개월 어린이집", lifecycleAxis: "child", lifecycleCode: "toddler_1_2y", contextCodes: ["daycare"], householdRole: "owner", expectedBundleNameKo: "어린이집 입소", expectedContextMatch: true },
  { id: "potty-training-two-years", labelKo: "2세 배변 훈련", lifecycleAxis: "child", lifecycleCode: "toddler_2_3y", contextCodes: [], householdRole: "owner", expectedBundleNameKo: "배변 훈련", expectedContextMatch: false },
  { id: "no-car-family", labelKo: "차량 없는 가족", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: ["no_car", "public_transport_primary"], householdRole: "owner", expectedBundleNameKo: "대중교통 이동", expectedContextMatch: true },
  { id: "small-home", labelKo: "작은 집", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: ["small_home"], householdRole: "owner", expectedBundleNameKo: "작은 집·수납 최소화", expectedContextMatch: true },
  { id: "budget-secondhand", labelKo: "저예산·중고 선호", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: ["budget_saving", "secondhand_preferred"], householdRole: "owner", expectedBundleNameKo: "중고·대여 중심 준비", expectedContextMatch: true },
  { id: "kindergarten-four-five", labelKo: "4~5세 유치원", lifecycleAxis: "child", lifecycleCode: "preschool_4_5y", contextCodes: ["kindergarten"], householdRole: "owner", expectedBundleNameKo: "유치원·학교 입학", expectedContextMatch: true },
  { id: "elementary-entry", labelKo: "초등 입학", lifecycleAxis: "child", lifecycleCode: "elementary_lower", contextCodes: ["school"], householdRole: "owner", expectedBundleNameKo: "유치원·학교 입학", expectedContextMatch: true },
  { id: "middle-school", labelKo: "중학생", lifecycleAxis: "child", lifecycleCode: "middle_school", contextCodes: ["school"], householdRole: "owner", expectedBundleNameKo: "응급·재난 대비", expectedContextMatch: true },
  { id: "co-parenting", labelKo: "공동 양육 가족", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: [], householdRole: "co_parent", expectedBundleNameKo: "신생아 집 맞이", expectedContextMatch: false },
  { id: "gift-family-member", labelKo: "선물을 준비하는 가족 구성원", lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", contextCodes: [], householdRole: "gift_participant", expectedBundleNameKo: "신생아 집 맞이", expectedContextMatch: false }
];
