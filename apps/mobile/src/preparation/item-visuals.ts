import type { AppIconName } from "../design-system";
import { categoryCatalog, type CategoryCode } from "../categories";
import { theme } from "../theme";

export const htmlPreparationItemVisuals = [
  ["유모차", "baby-carriage"],
  ["카시트", "car-child-seat"],
  ["젖병", "baby-bottle-outline"],
  ["아기 침대", "bed-outline"],
  ["속싸개", "cradle-outline"],
  ["체온계", "thermometer"],
  ["아기 욕조", "bathtub-outline"],
  ["배냇저고리", "tshirt-crew-outline"],
  ["손수건", "hand-wash-outline"]
] as const satisfies ReadonlyArray<readonly [string, AppIconName]>;

type PreparationItemVisualInput = {
  code: string;
  nameKo: string;
  primaryCategory: { code: string; iconKey: string | null; nameKo: string } | null;
};

type PreparationItemVisual = {
  icon: AppIconName;
  iconBackgroundColor: string;
  iconColor: string;
};

const approvedIcons = new Set<AppIconName>([
  ...htmlPreparationItemVisuals.map(([, icon]) => icon),
  "account-child-outline",
  "account-heart-outline",
  "account-group-outline",
  "airplane",
  "archive-outline",
  "bag-suitcase-outline",
  "baby-face-outline",
  "bike",
  "book-open-page-variant-outline",
  "calendar-check-outline",
  "camera-outline",
  "clipboard-list-outline",
  "clipboard-pulse-outline",
  "food-apple-outline",
  "hanger",
  "heart-pulse",
  "hospital-box-outline",
  "home-lock",
  "human-baby-changing-table",
  "mother-heart",
  "school-outline",
  "shield-outline",
  "shoe-sneaker",
  "silverware-fork-knife",
  "sofa-outline",
  "swim",
  "toy-brick-outline",
  "tag-outline",
  "toothbrush",
  "washing-machine",
  "wrap"
]);

const keywordIcons: ReadonlyArray<readonly [RegExp, AppIconName]> = [
  [/유모차|stroller|carriage/i, "baby-carriage"],
  [/카시트|child.?seat|car.?seat/i, "car-child-seat"],
  [/젖병|수유병|수유|분유|bottle|feeding|formula/i, "baby-bottle-outline"],
  [/침대|요람|낮잠|수면|crib|bed|sleep/i, "bed-outline"],
  [/속싸개|스와들|swaddle|wrap/i, "cradle-outline"],
  [/체온계|온도계|thermometer/i, "thermometer"],
  [/욕조|목욕|bath/i, "bathtub-outline"],
  [/배냇|의류|옷|팬티|배변훈련|clothes|clothing|underwear|potty/i, "tshirt-crew-outline"],
  [/손수건|거즈|handkerchief|washcloth/i, "hand-wash-outline"],
  [/기저귀|위생|diaper|hygiene/i, "human-baby-changing-table"],
  [/아기띠|캐리어|carrier/i, "account-child-outline"],
  [/블록|장난감|놀잇감|놀이|toy|block|play/i, "toy-brick-outline"],
  [/물려쓰기.*분류|분류 상자|sorting/i, "archive-outline"],
  [/물려쓰기.*(?:자산|목록)|자산 목록|inventory/i, "clipboard-list-outline"],
  [/이름표|이름 라벨|name.?tag/i, "tag-outline"],
  [/산후|도우미|상담|postpartum|counsel/i, "account-heart-outline"],
  [/사진|앨범|photo|camera/i, "camera-outline"],
  [/세탁|빨래|laundry|washing/i, "washing-machine"],
  [/그림책|보드북|책|독서|book|reading/i, "book-open-page-variant-outline"],
  [/이유식|식탁|식기|도시락|주방|spoon|kitchen|meal/i, "silverware-fork-knife"],
  [/칫솔|치약|치아|구강|tooth/i, "toothbrush"],
  [/신발|실내화|운동화|장화|슬리퍼|shoe/i, "shoe-sneaker"],
  [/자전거|킥보드|bike|scooter/i, "bike"],
  [/수영|물놀이|swim/i, "swim"],
  [/여행|장거리|travel|trip/i, "airplane"],
  [/가방|파우치|bag|pouch/i, "bag-suitcase-outline"],
  [/달력|일정|schedule|calendar/i, "calendar-check-outline"],
  [/안전문|잠금|안전장치|home.?safe/i, "home-lock"],
  [/병원|검진|건강|hospital|health/i, "hospital-box-outline"],
  [/산모|임신|mother|pregnancy/i, "mother-heart"],
  [/교육|어린이집|school|education/i, "school-outline"],
  [/보험|저축|insurance|saving/i, "shield-outline"]
];

const domainVisuals = {
  C01: { icon: "clipboard-pulse-outline", paletteIndex: 5 },
  C02: { icon: "hanger", paletteIndex: 8 },
  C03: { icon: "bed-outline", paletteIndex: 7 },
  C04: { icon: "hand-wash-outline", paletteIndex: 4 },
  C05: { icon: "bag-suitcase-outline", paletteIndex: 0 },
  C06: { icon: "heart-pulse", paletteIndex: 8 },
  C07: { icon: "mother-heart", paletteIndex: 8 },
  C08: { icon: "baby-bottle-outline", paletteIndex: 1 },
  C09: { icon: "cradle-outline", paletteIndex: 7 },
  C10: { icon: "human-baby-changing-table", paletteIndex: 0 },
  C11: { icon: "bathtub-outline", paletteIndex: 5 },
  C12: { icon: "hospital-box-outline", paletteIndex: 5 },
  C13: { icon: "tshirt-crew-outline", paletteIndex: 2 },
  C14: { icon: "washing-machine", paletteIndex: 4 },
  C15: { icon: "sofa-outline", paletteIndex: 7 },
  C16: { icon: "silverware-fork-knife", paletteIndex: 1 },
  C17: { icon: "baby-carriage", paletteIndex: 3 },
  C18: { icon: "home-lock", paletteIndex: 6 },
  C19: { icon: "toy-brick-outline", paletteIndex: 4 },
  C20: { icon: "book-open-page-variant-outline", paletteIndex: 6 },
  C21: { icon: "school-outline", paletteIndex: 6 },
  C22: { icon: "bike", paletteIndex: 3 },
  C23: { icon: "airplane", paletteIndex: 3 },
  C24: { icon: "account-group-outline", paletteIndex: 9 }
} as const satisfies Record<string, { icon: AppIconName; paletteIndex: number }>;

type DomainCode = keyof typeof domainVisuals;

function resolveDomainCode(item: PreparationItemVisualInput): DomainCode | null {
  const encoded = `${item.code} ${item.primaryCategory?.code ?? ""}`;
  const match = encoded.match(/C(?:0[1-9]|1\d|2[0-4])/i)?.[0]?.toUpperCase();
  return match && match in domainVisuals ? match as DomainCode : null;
}

export function resolvePreparationItemVisual(item: PreparationItemVisualInput): PreparationItemVisual {
  const approvedCategoryIcon = item.primaryCategory?.iconKey as AppIconName | undefined;
  const searchable = [item.nameKo, item.code, item.primaryCategory?.nameKo, item.primaryCategory?.code]
    .filter(Boolean)
    .join(" ");
  const keywordIcon = keywordIcons.find(([pattern]) => pattern.test(searchable))?.[1];
  const domainCode = resolveDomainCode(item);
  const domainVisual = domainCode ? domainVisuals[domainCode] : null;
  const isExactHtmlCard = htmlPreparationItemVisuals.some(([nameKo]) => nameKo === item.nameKo);
  return {
    icon: approvedCategoryIcon && approvedIcons.has(approvedCategoryIcon)
      ? approvedCategoryIcon
      : keywordIcon ?? domainVisual?.icon ?? "baby-face-outline",
    iconBackgroundColor: isExactHtmlCard || !domainVisual
      ? theme.colors.coral[50]
      : theme.colors.categoryPalette[domainVisual.paletteIndex],
    iconColor: isExactHtmlCard || !domainVisual
      ? theme.colors.coral[700]
      : theme.colors.text.primary
  };
}

/**
 * DSN-053 P1 어댑터 — 분류 코드 → MaterialCommunityIcons 이름.
 *
 * c20deeb에서는 `categoryCatalog[].icon`이 이미 MCI 이름이라 원본은 그 값을 그대로 썼다
 * (`category.icon as AppIconName`). 현재 트리의 `src/categories.ts`는 D1 후속 결정으로 그
 * 필드를 **Ionicons 이름**으로 바꿔 두었고, 그 결정은 이번 트랙의 범위 밖이다(기존 화면의
 * Ionicons는 건드리지 않는다). 두 이름 체계는 겹치지 않으므로 그대로 넘기면 렌더되지 않는
 * 아이콘 이름이 된다.
 *
 * 그래서 여기서 **분류 코드**를 기준으로 c20deeb 카탈로그가 쓰던 MCI 이름을 되짚는다 —
 * 원본이 실제로 그리던 것과 같은 글리프이고, `categories.ts`는 한 글자도 바뀌지 않는다.
 */
const expenseCategoryIcons: Readonly<Record<CategoryCode, AppIconName>> = {
  pregnancy_mother: "mother-heart",
  hospital_checkup: "hospital-box-outline",
  birth_postpartum: "baby-carriage",
  diaper_hygiene: "baby-face-outline",
  feeding_babyfood: "baby-bottle-outline",
  clothes_laundry: "tshirt-crew-outline",
  sleep_furniture: "bed-outline",
  // c20deeb 카탈로그는 "stroller"였지만 현재 설치된 @expo/vector-icons(v14)의 MCI 글리프맵에는
  // 그 이름이 없다 -- 없는 이름은 아무것도 그리지 않으므로, 같은 대상(유모차)을 가리키면서
  // 이 트리에 실제로 있는 "baby-carriage"를 쓴다(이 파일의 C17 도메인 아이콘과도 같다).
  outing_mobility: "baby-carriage",
  toys_books: "toy-brick-outline",
  care_education: "school-outline",
  insurance_savings: "shield-outline",
  etc: "dots-horizontal-circle-outline"
};

export function expenseCategoryVisual(categoryId: string): {
  icon: AppIconName;
  iconBackgroundColor: string;
  iconColor: string;
} {
  const category = categoryCatalog.find((entry) => entry.id === categoryId);
  if (!category) {
    return {
      icon: "receipt",
      iconBackgroundColor: theme.colors.coral[50],
      iconColor: theme.colors.coral[700]
    };
  }
  return {
    icon: expenseCategoryIcons[category.code],
    iconBackgroundColor: theme.colors.categoryColors[category.code],
    iconColor: "#443F3C"
  };
}
