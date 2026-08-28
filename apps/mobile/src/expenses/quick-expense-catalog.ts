import { categoryCatalog } from "../categories";
import type { AppIconName } from "../design-system";

/**
 * DSN-053 P2-C — "분류별 빠른 품목" 아코디언이 펼쳤을 때 그리는 품목 타일의 원천.
 *
 * 라벨·아이콘은 승인 원본(c20deeb `src/expenses/quick-expense-catalog.ts`)에서 그대로 가져왔고,
 * 아이콘 이름은 그쪽과 같은 **MaterialCommunityIcons** 계열이다(design-system의 `AppIcon`이
 * 그리는 이름 공간 — docs/5차/design-restore-spec.md §아이콘 계열 "MCI 그대로 사용").
 *
 * 분류는 **타일 라벨로 묶는다**(`categoryCatalog`의 code가 아니라):
 * - 이 앱의 8타일 중 "분유/유제품"과 "식비"는 서버 시드 code가 같다(`feeding_babyfood`).
 *   code로 묶으면 두 타일이 **같은 목록**을 보여 주고, 그러면 "식비" 타일이 젖병·유축용품을
 *   빠른 품목이라고 말하게 된다 — 사용자가 고른 적 없는 사실이다.
 * - 그래서 이 표의 키는 `src/categories.ts` 카탈로그의 **라벨**이고, 실제 저장에 쓰이는
 *   `categoryId`는 그 카탈로그에서 그대로 파생한다(아래 flatMap). 타일 id가 바뀌어도 이 파일은
 *   따라 움직이며, 라벨을 잘못 적으면 그 타일의 목록이 비어 이 파일의 테스트가 곧바로 잡는다.
 *
 * 이 표는 **입력 보조**일 뿐이다: 고른 품목명은 사용자가 footer에서 그대로 고쳐 쓸 수 있고,
 * 금액·분류·저장 규칙은 한 줄도 이 파일을 거치지 않는다.
 */
export type QuickExpenseCatalogItem = {
  /** Stable id, unique across the whole catalog (used as the React key). */
  id: string;
  label: string;
  /** MaterialCommunityIcons name — rendered through design-system `AppIcon`. */
  icon: AppIconName;
  /** `categoryCatalog` entry id this item records into. Derived, never hand-written. */
  categoryId: string;
};

type QuickExpenseCatalogSeed = Omit<QuickExpenseCatalogItem, "categoryId">;

/** 펼친 분류가 기본으로 보여 주는 품목 수 (승인 원본과 같은 6개). */
export const QUICK_EXPENSE_DEFAULT_LIMIT = 6;

const quickExpenseSeedsByCategoryLabel: Record<string, readonly QuickExpenseCatalogSeed[]> = {
  기저귀: [
    { id: "diaper", label: "기저귀", icon: "baby-face-outline" },
    { id: "wet-wipes", label: "물티슈", icon: "water-outline" },
    { id: "bath-supplies", label: "목욕용품", icon: "bathtub-outline" },
    { id: "diaper-cream", label: "기저귀 크림", icon: "pill" },
    { id: "baby-wash", label: "베이비워시", icon: "water-outline" },
    { id: "baby-lotion", label: "아기 로션", icon: "water-outline" },
    { id: "cotton-swab", label: "아기 면봉", icon: "dots-horizontal-circle-outline" },
    { id: "diaper-bag", label: "기저귀 봉투", icon: "bag-personal-outline" }
  ],
  "분유/유제품": [
    { id: "formula", label: "분유", icon: "baby-bottle-outline" },
    { id: "bottle", label: "젖병", icon: "baby-bottle-outline" },
    { id: "nipple", label: "젖꼭지", icon: "baby-bottle-outline" },
    { id: "breast-pump", label: "유축용품", icon: "baby-bottle-outline" },
    { id: "baby-food", label: "이유식", icon: "food-apple-outline" },
    { id: "feeding-tableware", label: "이유식기", icon: "food-outline" },
    { id: "baby-snack", label: "아기 간식", icon: "food-outline" },
    { id: "feeding-chair", label: "식탁의자", icon: "chair-rolling" }
  ],
  식비: [
    { id: "grocery", label: "장보기", icon: "cart-outline" },
    { id: "dining-out", label: "외식", icon: "silverware-fork-knife" },
    { id: "food-delivery", label: "배달", icon: "truck-delivery-outline" },
    { id: "ingredients", label: "식재료", icon: "food-apple-outline" },
    { id: "side-dish", label: "반찬", icon: "bowl-mix-outline" },
    { id: "convenience-meal", label: "간편식", icon: "food-outline" },
    { id: "cafe", label: "카페", icon: "coffee-outline" },
    { id: "drinking-water", label: "생수", icon: "water-outline" }
  ],
  의류: [
    { id: "clothes", label: "의류", icon: "tshirt-crew-outline" },
    { id: "underwear", label: "내의", icon: "tshirt-crew-outline" },
    { id: "outerwear", label: "외투", icon: "tshirt-crew-outline" },
    { id: "shoes", label: "신발", icon: "shoe-sneaker" },
    { id: "hat", label: "모자", icon: "tshirt-crew-outline" },
    { id: "detergent", label: "세제", icon: "washing-machine" },
    { id: "fabric-softener", label: "섬유유연제", icon: "washing-machine" },
    { id: "laundry-net", label: "세탁망", icon: "washing-machine" }
  ],
  "약품/교통": [
    { id: "transportation", label: "교통비", icon: "bus" },
    { id: "taxi", label: "택시비", icon: "car" },
    { id: "stroller", label: "유모차", icon: "baby-carriage" },
    { id: "car-seat", label: "카시트", icon: "car-child-seat" },
    { id: "baby-carrier", label: "아기띠", icon: "account-child-outline" },
    { id: "outing-bag", label: "외출가방", icon: "bag-personal-outline" },
    { id: "stroller-accessory", label: "유모차 용품", icon: "baby-carriage" },
    { id: "travel", label: "가족 여행", icon: "bag-suitcase-outline" }
  ],
  "병원/약": [
    { id: "hospital-cost", label: "병원비", icon: "hospital-box-outline" },
    { id: "medicine", label: "약", icon: "pill" },
    { id: "vaccination", label: "예방접종", icon: "needle" },
    { id: "health-checkup", label: "건강검진", icon: "clipboard-pulse-outline" },
    { id: "dental-care", label: "치과", icon: "hospital-box-outline" },
    { id: "therapy", label: "치료·상담", icon: "account-heart-outline" },
    { id: "medical-device", label: "의료용품", icon: "thermometer" },
    { id: "hospital-transport", label: "병원 교통비", icon: "bus" }
  ],
  "교육/도서": [
    { id: "book", label: "책", icon: "book-open-page-variant-outline" },
    { id: "picture-book", label: "그림책", icon: "book-open-page-variant-outline" },
    { id: "toy", label: "장난감", icon: "toy-brick-outline" },
    { id: "learning-toy", label: "교구", icon: "puzzle-outline" },
    { id: "blocks", label: "블록", icon: "toy-brick-outline" },
    { id: "art-supplies", label: "미술용품", icon: "palette-outline" },
    { id: "music-toy", label: "음악놀이", icon: "music-note" },
    { id: "rental-toy", label: "장난감 대여", icon: "toy-brick-outline" }
  ],
  기타: [
    { id: "photo", label: "사진", icon: "camera-outline" },
    { id: "birthday", label: "생일", icon: "party-popper" },
    { id: "family-event", label: "가족행사", icon: "account-group-outline" },
    { id: "event-cost", label: "행사비", icon: "party-popper" },
    { id: "subscription", label: "구독료", icon: "calendar-blank-outline" },
    { id: "delivery", label: "배송비", icon: "truck-delivery-outline" },
    { id: "secondhand", label: "중고거래", icon: "swap-horizontal" },
    { id: "other-supplies", label: "기타용품", icon: "dots-horizontal-circle-outline" }
  ]
};

export const quickExpenseItemCatalog: readonly QuickExpenseCatalogItem[] = categoryCatalog.flatMap((category) =>
  (quickExpenseSeedsByCategoryLabel[category.label] ?? []).map((seed) => ({ ...seed, categoryId: category.id }))
);

/** 한 분류 타일이 펼쳤을 때 보여 줄 품목들 (표에 적힌 순서 그대로). */
export function quickExpenseItemsForCategory(categoryId: string): readonly QuickExpenseCatalogItem[] {
  return quickExpenseItemCatalog.filter((item) => item.categoryId === categoryId);
}

/**
 * "더 보기"가 한 번에 넓히는 폭 (승인 원본 `nextQuickExpenseLimit`과 같은 계단: 6 -> 12 -> 24).
 * 총 개수를 넘어서 늘어나지 않으므로 마지막 단계에서는 버튼 자체가 사라진다.
 */
export function nextQuickExpenseLimit(current: number, total: number): number {
  return Math.min(total, current <= QUICK_EXPENSE_DEFAULT_LIMIT ? 12 : 24);
}
