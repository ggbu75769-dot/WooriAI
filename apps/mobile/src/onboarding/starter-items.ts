import type { AppIconName } from "../design-system";

type StarterItemRegistryEntry = {
  categoryCode: string;
  icon: AppIconName;
  label: string;
};

export const ONBOARDING_STARTER_ITEM_REGISTRY = {
  diaper: { categoryCode: "diaper_hygiene", icon: "human-baby-changing-table", label: "기저귀" },
  baby_carrier: { categoryCode: "mobility", icon: "account-child-outline", label: "아기띠" },
  blocks: { categoryCode: "play", icon: "toy-brick-outline", label: "블록 세트" },
  crib: { categoryCode: "sleep", icon: "bed-outline", label: "아기 침대" },
  newborn_clothing: { categoryCode: "clothing", icon: "tshirt-crew-outline", label: "배냇저고리" },
  swaddle: { categoryCode: "sleep", icon: "wrap", label: "속싸개" },
  baby_bottle: { categoryCode: "feeding", icon: "baby-bottle-outline", label: "젖병" },
  thermometer: { categoryCode: "health", icon: "thermometer", label: "체온계" },
  baby_bathtub: { categoryCode: "bath", icon: "bathtub-outline", label: "아기 욕조" },
  handkerchief: { categoryCode: "hygiene", icon: "texture", label: "손수건" },
  car_seat: { categoryCode: "mobility_safety", icon: "car-child-seat", label: "카시트" },
  stroller: { categoryCode: "mobility", icon: "baby-carriage", label: "유모차" }
} as const satisfies Record<string, StarterItemRegistryEntry>;

const ALLOWED_ICON_BY_NAME: Readonly<Record<string, AppIconName>> = {
  "human-baby-changing-table": "human-baby-changing-table",
  "account-child-outline": "account-child-outline",
  "toy-brick-outline": "toy-brick-outline",
  "bed-outline": "bed-outline",
  "tshirt-crew-outline": "tshirt-crew-outline",
  wrap: "wrap",
  "baby-bottle-outline": "baby-bottle-outline",
  thermometer: "thermometer",
  "bathtub-outline": "bathtub-outline",
  texture: "texture",
  "car-child-seat": "car-child-seat",
  "baby-carriage": "baby-carriage",
  "package-variant-closed": "package-variant-closed"
};

const CATEGORY_ICON_BY_CODE: Readonly<Record<string, AppIconName>> = Object.fromEntries(
  Object.values(ONBOARDING_STARTER_ITEM_REGISTRY).map((entry) => [entry.categoryCode, entry.icon])
);
const STARTER_ITEM_BY_CODE: Readonly<Record<string, StarterItemRegistryEntry>> = ONBOARDING_STARTER_ITEM_REGISTRY;

export function resolveOnboardingStarterIcon(item: {
  code: string;
  categoryCode: string | null;
  iconKey: string | null;
}): AppIconName {
  return ALLOWED_ICON_BY_NAME[item.iconKey ?? ""]
    ?? STARTER_ITEM_BY_CODE[item.code]?.icon
    ?? CATEGORY_ICON_BY_CODE[item.categoryCode ?? ""]
    ?? "package-variant-closed";
}

export function columnCountForPreparedItems(width: number, height: number): 3 | 4 {
  return width >= 480 || width > height ? 4 : 3;
}
