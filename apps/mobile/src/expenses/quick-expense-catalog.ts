import { categoryCatalog, type CategoryCode } from "../categories";
import type { AppIconName } from "../ui";

export type QuickExpenseCatalogItem = {
  id: string;
  label: string;
  icon: AppIconName;
  categoryCode: CategoryCode;
  aliases?: readonly string[];
  tags?: readonly string[];
  commonUseRank?: number;
};

export const quickExpenseItemCatalog: readonly QuickExpenseCatalogItem[] = [
  { id: "prenatal-checkup", label: "산전검사", icon: "clipboard-pulse-outline", categoryCode: "pregnancy_mother", aliases: ["임신검사", "산부인과"], tags: ["진료", "검진"], commonUseRank: 100 },
  { id: "maternal-supplement", label: "영양제", icon: "pill", categoryCode: "pregnancy_mother", aliases: ["비타민", "철분제", "엽산"], commonUseRank: 90 },
  { id: "maternity-clothes", label: "임부복", icon: "tshirt-crew-outline", categoryCode: "pregnancy_mother" },
  { id: "prenatal-class", label: "출산교실", icon: "school-outline", categoryCode: "pregnancy_mother", aliases: ["태교교실"] },
  { id: "maternity-support", label: "임산부용품", icon: "bag-personal-outline", categoryCode: "pregnancy_mother", tags: ["복대", "쿠션"] },
  { id: "prenatal-transport", label: "검진 교통비", icon: "bus", categoryCode: "pregnancy_mother" },
  { id: "prenatal-care", label: "임산부 관리", icon: "heart-pulse", categoryCode: "pregnancy_mother", aliases: ["산전관리"] },
  { id: "maternity-meal", label: "임산부 식비", icon: "food-outline", categoryCode: "pregnancy_mother" },

  { id: "hospital-cost", label: "병원비", icon: "hospital-box-outline", categoryCode: "hospital_checkup", aliases: ["진료비", "병원", "의료비"], commonUseRank: 100 },
  { id: "medicine", label: "약", icon: "pill", categoryCode: "hospital_checkup", aliases: ["약값", "의약품"], commonUseRank: 95 },
  { id: "vaccination", label: "예방접종", icon: "needle", categoryCode: "hospital_checkup" },
  { id: "health-checkup", label: "건강검진", icon: "clipboard-pulse-outline", categoryCode: "hospital_checkup" },
  { id: "dental-care", label: "치과", icon: "hospital-box-outline", categoryCode: "hospital_checkup" },
  { id: "therapy", label: "치료·상담", icon: "account-heart-outline", categoryCode: "hospital_checkup" },
  { id: "medical-device", label: "의료용품", icon: "thermometer", categoryCode: "hospital_checkup" },
  { id: "hospital-transport", label: "병원 교통비", icon: "bus", categoryCode: "hospital_checkup" },

  { id: "delivery-cost", label: "출산비", icon: "hospital-building", categoryCode: "birth_postpartum" },
  { id: "postpartum-center", label: "산후조리원", icon: "home-heart", categoryCode: "birth_postpartum" },
  { id: "postpartum-supplies", label: "산후용품", icon: "bag-personal-outline", categoryCode: "birth_postpartum" },
  { id: "delivery-room", label: "분만실 비용", icon: "hospital-box-outline", categoryCode: "birth_postpartum" },
  { id: "postpartum-helper", label: "산후도우미", icon: "account-heart-outline", categoryCode: "birth_postpartum" },
  { id: "postpartum-meal", label: "산후 식비", icon: "food-outline", categoryCode: "birth_postpartum" },
  { id: "lactation-care", label: "모유수유 관리", icon: "baby-bottle-outline", categoryCode: "birth_postpartum" },
  { id: "birth-document", label: "출생 행정비", icon: "clipboard-pulse-outline", categoryCode: "birth_postpartum" },

  { id: "diaper", label: "기저귀", icon: "baby-face-outline", categoryCode: "diaper_hygiene", aliases: ["다이퍼", "diaper"], tags: ["배변", "위생"], commonUseRank: 100 },
  { id: "wet-wipes", label: "물티슈", icon: "water-outline", categoryCode: "diaper_hygiene", aliases: ["아기물티슈"], commonUseRank: 95 },
  { id: "bath-supplies", label: "목욕용품", icon: "bathtub-outline", categoryCode: "diaper_hygiene" },
  { id: "diaper-cream", label: "기저귀 크림", icon: "pill", categoryCode: "diaper_hygiene", aliases: ["발진크림"] },
  { id: "baby-wash", label: "베이비워시", icon: "water-outline", categoryCode: "diaper_hygiene", aliases: ["아기워시"] },
  { id: "baby-lotion", label: "아기 로션", icon: "water-outline", categoryCode: "diaper_hygiene" },
  { id: "cotton-swab", label: "아기 면봉", icon: "dots-horizontal-circle-outline", categoryCode: "diaper_hygiene" },
  { id: "diaper-bag", label: "기저귀 봉투", icon: "bag-personal-outline", categoryCode: "diaper_hygiene" },

  { id: "formula", label: "분유", icon: "baby-bottle-outline", categoryCode: "feeding_babyfood", aliases: ["포뮬라", "formula"], commonUseRank: 100 },
  { id: "baby-food", label: "이유식", icon: "food-apple-outline", categoryCode: "feeding_babyfood" },
  { id: "snack", label: "간식", icon: "food-outline", categoryCode: "feeding_babyfood" },
  { id: "bottle", label: "젖병", icon: "baby-bottle-outline", categoryCode: "feeding_babyfood" },
  { id: "nipple", label: "젖꼭지", icon: "baby-bottle-outline", categoryCode: "feeding_babyfood" },
  { id: "feeding-tableware", label: "이유식기", icon: "food-outline", categoryCode: "feeding_babyfood", aliases: ["아기식기"] },
  { id: "breast-pump", label: "유축용품", icon: "baby-bottle-outline", categoryCode: "feeding_babyfood" },
  { id: "feeding-chair", label: "식탁의자", icon: "chair-rolling", categoryCode: "feeding_babyfood", aliases: ["하이체어"] },

  { id: "clothes", label: "의류", icon: "tshirt-crew-outline", categoryCode: "clothes_laundry" },
  { id: "shoes", label: "신발", icon: "shoe-sneaker", categoryCode: "clothes_laundry" },
  { id: "detergent", label: "세제", icon: "washing-machine", categoryCode: "clothes_laundry" },
  { id: "underwear", label: "내의", icon: "tshirt-crew-outline", categoryCode: "clothes_laundry" },
  { id: "outerwear", label: "외투", icon: "tshirt-crew-outline", categoryCode: "clothes_laundry" },
  { id: "hat", label: "모자", icon: "tshirt-crew-outline", categoryCode: "clothes_laundry" },
  { id: "laundry-net", label: "세탁망", icon: "washing-machine", categoryCode: "clothes_laundry" },
  { id: "fabric-softener", label: "섬유유연제", icon: "washing-machine", categoryCode: "clothes_laundry" },

  { id: "bedding", label: "침구", icon: "bed-outline", categoryCode: "sleep_furniture" },
  { id: "baby-bed", label: "아기침대", icon: "bed-king-outline", categoryCode: "sleep_furniture" },
  { id: "sleep-supplies", label: "수면용품", icon: "sleep", categoryCode: "sleep_furniture" },
  { id: "mattress", label: "매트리스", icon: "bed-outline", categoryCode: "sleep_furniture" },
  { id: "sleeping-bag", label: "수면조끼", icon: "sleep", categoryCode: "sleep_furniture" },
  { id: "blackout-curtain", label: "암막용품", icon: "window-closed-variant", categoryCode: "sleep_furniture" },
  { id: "storage-furniture", label: "수납가구", icon: "package-variant-closed", categoryCode: "sleep_furniture" },
  { id: "safety-guard", label: "침대 안전가드", icon: "shield-check-outline", categoryCode: "sleep_furniture" },

  { id: "stroller", label: "유모차", icon: "baby-carriage", categoryCode: "outing_mobility" },
  { id: "car-seat", label: "카시트", icon: "car-child-seat", categoryCode: "outing_mobility" },
  { id: "transportation", label: "교통비", icon: "bus", categoryCode: "outing_mobility" },
  { id: "baby-carrier", label: "아기띠", icon: "account-child-outline", categoryCode: "outing_mobility", aliases: ["베이비캐리어"] },
  { id: "outing-bag", label: "외출가방", icon: "bag-personal-outline", categoryCode: "outing_mobility", aliases: ["기저귀가방"] },
  { id: "stroller-accessory", label: "유모차 용품", icon: "baby-carriage", categoryCode: "outing_mobility" },
  { id: "taxi", label: "택시비", icon: "car", categoryCode: "outing_mobility" },
  { id: "travel", label: "가족 여행", icon: "bag-suitcase-outline", categoryCode: "outing_mobility" },

  { id: "toy", label: "장난감", icon: "toy-brick-outline", categoryCode: "toys_books" },
  { id: "book", label: "책", icon: "book-open-page-variant-outline", categoryCode: "toys_books" },
  { id: "learning-toy", label: "교구", icon: "puzzle-outline", categoryCode: "toys_books" },
  { id: "picture-book", label: "그림책", icon: "book-open-page-variant-outline", categoryCode: "toys_books" },
  { id: "blocks", label: "블록", icon: "toy-brick-outline", categoryCode: "toys_books" },
  { id: "art-supplies", label: "미술용품", icon: "palette-outline", categoryCode: "toys_books" },
  { id: "music-toy", label: "음악놀이", icon: "music-note", categoryCode: "toys_books" },
  { id: "rental-toy", label: "장난감 대여", icon: "toy-brick-outline", categoryCode: "toys_books" },

  { id: "daycare", label: "어린이집", icon: "home-group", categoryCode: "care_education" },
  { id: "care-cost", label: "돌봄비", icon: "account-heart-outline", categoryCode: "care_education" },
  { id: "education-cost", label: "교육비", icon: "school-outline", categoryCode: "care_education" },
  { id: "kindergarten", label: "유치원", icon: "school-outline", categoryCode: "care_education" },
  { id: "babysitter", label: "베이비시터", icon: "account-heart-outline", categoryCode: "care_education" },
  { id: "academy", label: "학원비", icon: "school-outline", categoryCode: "care_education" },
  { id: "class-material", label: "수업 준비물", icon: "pencil-plus-outline", categoryCode: "care_education" },
  { id: "field-trip", label: "체험활동", icon: "map-marker-outline", categoryCode: "care_education" },

  { id: "insurance", label: "보험료", icon: "shield-check-outline", categoryCode: "insurance_savings" },
  { id: "savings", label: "적금", icon: "piggy-bank-outline", categoryCode: "insurance_savings" },
  { id: "education-savings", label: "교육저축", icon: "bank-outline", categoryCode: "insurance_savings" },
  { id: "child-insurance", label: "어린이보험", icon: "shield-check-outline", categoryCode: "insurance_savings" },
  { id: "medical-insurance", label: "실손보험", icon: "shield-check-outline", categoryCode: "insurance_savings" },
  { id: "child-account", label: "아이 통장", icon: "bank-outline", categoryCode: "insurance_savings" },
  { id: "investment", label: "아이 투자", icon: "chart-box-outline", categoryCode: "insurance_savings" },
  { id: "emergency-savings", label: "비상금", icon: "piggy-bank-outline", categoryCode: "insurance_savings" },

  { id: "photo", label: "사진", icon: "camera-outline", categoryCode: "etc" },
  { id: "event-cost", label: "행사비", icon: "party-popper", categoryCode: "etc" },
  { id: "other-supplies", label: "기타용품", icon: "dots-horizontal-circle-outline", categoryCode: "etc" },
  { id: "birthday", label: "생일", icon: "party-popper", categoryCode: "etc" },
  { id: "family-event", label: "가족행사", icon: "account-group-outline", categoryCode: "etc" },
  { id: "subscription", label: "구독료", icon: "calendar-blank-outline", categoryCode: "etc" },
  { id: "delivery", label: "배송비", icon: "truck-delivery-outline", categoryCode: "etc" },
  { id: "secondhand", label: "중고거래", icon: "swap-horizontal", categoryCode: "etc" }
];

export const defaultQuickExpenseItemIds = [
  "diaper",
  "formula",
  "baby-food",
  "hospital-cost",
  "medicine",
  "clothes"
] as const;

export function quickExpenseItemsForCategory(categoryCode: CategoryCode) {
  return quickExpenseItemCatalog.filter((item) => item.categoryCode === categoryCode);
}

export function quickExpenseCatalogItemForLabel(label: string) {
  const normalized = normalizeQuickExpenseQuery(label);
  return quickExpenseItemCatalog.find((item) =>
    [item.label, ...(item.aliases ?? [])].some((value) => normalizeQuickExpenseQuery(value) === normalized)
  );
}

// NFKC converts compatibility jamo such as "ㄱ" to the canonical choseong
// form "ᄀ". Emit that same form for Hangul syllables so direct choseong
// queries and derived item initials compare in one normalized alphabet.
const CHOSEONG = "ᄀᄁᄂᄃᄄᄅᄆᄇᄈᄉᄊᄋᄌᄍᄎᄏᄐᄑᄒ";

export function normalizeQuickExpenseQuery(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s·._,/()-]/g, "");
}

export function toHangulChoseong(value: string) {
  return Array.from(normalizeQuickExpenseQuery(value)).map((character) => {
    const code = character.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? CHOSEONG[Math.floor(code / 588)] : character;
  }).join("");
}

export function searchQuickExpenseCatalog(query: string) {
  const normalized = normalizeQuickExpenseQuery(query);
  if (!normalized) return [];
  const choseong = toHangulChoseong(query);
  return quickExpenseItemCatalog
    .map((item) => {
      const categoryLabel = categoryCatalog.find((category) => category.code === item.categoryCode)?.label ?? "";
      const values = [item.label, categoryLabel, ...(item.aliases ?? []), ...(item.tags ?? [])];
      const exact = values.some((value) => normalizeQuickExpenseQuery(value) === normalized);
      const prefix = values.some((value) => normalizeQuickExpenseQuery(value).startsWith(normalized));
      const contains = values.some((value) => normalizeQuickExpenseQuery(value).includes(normalized));
      const choseongMatch = values.some((value) => toHangulChoseong(value).includes(choseong));
      const matchScore = exact ? 400 : prefix ? 300 : contains ? 200 : choseongMatch ? 100 : 0;
      return { item, score: matchScore === 0 ? 0 : matchScore + (item.commonUseRank ?? 0) };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label, "ko-KR"))
    .map(({ item }) => item);
}

export function nextQuickExpenseLimit(current: number, total: number) {
  return Math.min(total, current <= 6 ? 12 : 24);
}

export function amountAfterQuickExpenseSelection(input: {
  currentItemName: string;
  currentCategoryId: string;
  currentAmountText: string;
  nextItemName: string;
  nextCategoryId: string;
  defaultAmountText?: string;
}) {
  if (input.defaultAmountText) return input.defaultAmountText;
  const sameItem =
    input.currentItemName.trim() === input.nextItemName.trim() &&
    input.currentCategoryId === input.nextCategoryId;
  return sameItem ? input.currentAmountText : "";
}
