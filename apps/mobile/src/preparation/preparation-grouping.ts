export const preparationDisplayGroupIds = [
  "health_care",
  "clothing",
  "comfort_recovery",
  "hygiene_bath",
  "hospital_birth",
  "feeding",
  "sleep_home",
  "diaper_daily",
  "outing_growth",
  "family_records"
] as const;

export type PreparationDisplayGroupId = (typeof preparationDisplayGroupIds)[number];

const displayGroupByDomain: Readonly<Record<string, PreparationDisplayGroupId>> = {
  C01: "health_care", C02: "clothing", C03: "comfort_recovery", C04: "hygiene_bath",
  C05: "hospital_birth", C06: "comfort_recovery", C07: "feeding", C08: "feeding",
  C09: "sleep_home", C10: "diaper_daily", C11: "hygiene_bath", C12: "health_care",
  C13: "clothing", C14: "hygiene_bath", C15: "sleep_home", C16: "feeding",
  C17: "outing_growth", C18: "diaper_daily", C19: "outing_growth", C20: "outing_growth",
  C21: "outing_growth", C22: "outing_growth", C23: "outing_growth", C24: "family_records"
};

const recordItemPattern = /(계획|일정표|시간표|역할 분담표|기록지|기록표|기록장|기록 파일|기록 카드|결과 파일|서류|메모|연락 카드|정보 카드|인계 카드|요청 카드|체크리스트|점검표|확인표|수첩|목록|안내서|안내판|도면|상담 기록|인계 노트|예산표|연락망|갱신 일정표)/;

export function resolvePreparationDisplayGroupId(item: { code: string; nameKo: string }): PreparationDisplayGroupId {
  if (item.nameKo !== "아기 손톱 파일" && recordItemPattern.test(item.nameKo)) return "family_records";
  const domainCode = item.code.match(/R4-(C\d{2})-/)?.[1] ?? "C24";
  return displayGroupByDomain[domainCode] ?? "family_records";
}
