import type { CategoryCode } from "../categories";
import type { AppIconName } from "../ui";

export type QuickExpenseCatalogItem = {
  id: string;
  label: string;
  icon: AppIconName;
  categoryCode: CategoryCode;
};

export const quickExpenseItemCatalog: readonly QuickExpenseCatalogItem[] = [
  { id: "prenatal-checkup", label: "산전검사", icon: "clipboard-pulse-outline", categoryCode: "pregnancy_mother" },
  { id: "maternal-supplement", label: "영양제", icon: "pill", categoryCode: "pregnancy_mother" },
  { id: "maternity-clothes", label: "임부복", icon: "tshirt-crew-outline", categoryCode: "pregnancy_mother" },

  { id: "hospital-cost", label: "병원비", icon: "hospital-box-outline", categoryCode: "hospital_checkup" },
  { id: "medicine", label: "약", icon: "pill", categoryCode: "hospital_checkup" },
  { id: "vaccination", label: "예방접종", icon: "needle", categoryCode: "hospital_checkup" },

  { id: "delivery-cost", label: "출산비", icon: "hospital-building", categoryCode: "birth_postpartum" },
  { id: "postpartum-center", label: "산후조리원", icon: "home-heart", categoryCode: "birth_postpartum" },
  { id: "postpartum-supplies", label: "산후용품", icon: "bag-personal-outline", categoryCode: "birth_postpartum" },

  { id: "diaper", label: "기저귀", icon: "baby-face-outline", categoryCode: "diaper_hygiene" },
  { id: "wet-wipes", label: "물티슈", icon: "water-outline", categoryCode: "diaper_hygiene" },
  { id: "bath-supplies", label: "목욕용품", icon: "bathtub-outline", categoryCode: "diaper_hygiene" },

  { id: "formula", label: "분유", icon: "baby-bottle-outline", categoryCode: "feeding_babyfood" },
  { id: "baby-food", label: "이유식", icon: "food-apple-outline", categoryCode: "feeding_babyfood" },
  { id: "snack", label: "간식", icon: "food-outline", categoryCode: "feeding_babyfood" },

  { id: "clothes", label: "의류", icon: "tshirt-crew-outline", categoryCode: "clothes_laundry" },
  { id: "shoes", label: "신발", icon: "shoe-sneaker", categoryCode: "clothes_laundry" },
  { id: "detergent", label: "세제", icon: "washing-machine", categoryCode: "clothes_laundry" },

  { id: "bedding", label: "침구", icon: "bed-outline", categoryCode: "sleep_furniture" },
  { id: "baby-bed", label: "아기침대", icon: "bed-king-outline", categoryCode: "sleep_furniture" },
  { id: "sleep-supplies", label: "수면용품", icon: "sleep", categoryCode: "sleep_furniture" },

  { id: "stroller", label: "유모차", icon: "baby-carriage", categoryCode: "outing_mobility" },
  { id: "car-seat", label: "카시트", icon: "car-child-seat", categoryCode: "outing_mobility" },
  { id: "transportation", label: "교통비", icon: "bus", categoryCode: "outing_mobility" },

  { id: "toy", label: "장난감", icon: "toy-brick-outline", categoryCode: "toys_books" },
  { id: "book", label: "책", icon: "book-open-page-variant-outline", categoryCode: "toys_books" },
  { id: "learning-toy", label: "교구", icon: "puzzle-outline", categoryCode: "toys_books" },

  { id: "daycare", label: "어린이집", icon: "home-group", categoryCode: "care_education" },
  { id: "care-cost", label: "돌봄비", icon: "account-heart-outline", categoryCode: "care_education" },
  { id: "education-cost", label: "교육비", icon: "school-outline", categoryCode: "care_education" },

  { id: "insurance", label: "보험료", icon: "shield-check-outline", categoryCode: "insurance_savings" },
  { id: "savings", label: "적금", icon: "piggy-bank-outline", categoryCode: "insurance_savings" },
  { id: "education-savings", label: "교육저축", icon: "bank-outline", categoryCode: "insurance_savings" },

  { id: "photo", label: "사진", icon: "camera-outline", categoryCode: "etc" },
  { id: "event-cost", label: "행사비", icon: "party-popper", categoryCode: "etc" },
  { id: "other-supplies", label: "기타용품", icon: "dots-horizontal-circle-outline", categoryCode: "etc" }
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
  const normalized = label.trim().toLocaleLowerCase("ko-KR");
  return quickExpenseItemCatalog.find((item) => item.label.toLocaleLowerCase("ko-KR") === normalized);
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
