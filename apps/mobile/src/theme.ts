import type { CategoryCode } from "./categories";

// Round 5A D0 (docs/5차/round5a-design-spec.md §D0) -- coral scale/cream/text/semantic tokens.
// Additive: legacy flat color keys below are kept (nothing deleted) and redirected onto these
// new tokens so both stay in sync, per the spec's "기존 키 재지향" rule. See
// artifacts/design-progress.md for the notes on each redirected key.
const coral = {
  50: "#FFF3F0",
  100: "#FFE4DD",
  200: "#FFC9BB",
  300: "#FFA88E",
  400: "#F97B5C",
  500: "#EF6644",
  600: "#DB4F2E",
  700: "#B93E23"
} as const;

const cream = {
  // Spec text lists bg:"#FBF4EC" but annotates it "(현 배경 유지)" -- i.e. this token should
  // encode the app's *current* background, not a new color. The app's actual current background
  // is "#FFF8F1" (theme.colors.background below), so cream.bg is pinned to that value rather than
  // the literal spec hex, to avoid silently recoloring every screen's background as a side effect
  // of a token-only pass. Flagged in artifacts/design-progress.md for orchestrator review.
  bg: "#FFF8F1",
  surface: "#FFFFFF",
  surfaceAlt: "#FFF9F3"
} as const;

const text = {
  primary: "#3D3733",
  secondary: "#6E645C",
  tertiary: "#9C918A"
} as const;

const semantic = {
  success: "#2E9E6B",
  warning: "#E8A13A",
  danger: "#D3382F",
  info: "#5B7FA6"
} as const;

// Fixed 10-color warm-pastel category palette (D0), mapped onto the 12 existing category codes
// from src/categories.ts. Two low-frequency code pairs intentionally share a palette color
// (pregnancy_mother/birth_postpartum -- both maternal-care categories; insurance_savings/etc --
// both miscellaneous/financial catch-alls) so the fixed palette stays within the 8-10 spec range.
const categoryPalette = [
  "#F4A896",
  "#F6C28B",
  "#F2D48C",
  "#C9D9A0",
  "#9FCBB8",
  "#8FC6D9",
  "#A7B7E0",
  "#C6A3D0",
  "#E3A6C2",
  "#C9A188"
] as const;

const categoryColors: Record<CategoryCode, string> = {
  diaper_hygiene: categoryPalette[0],
  feeding_babyfood: categoryPalette[1],
  clothes_laundry: categoryPalette[2],
  outing_mobility: categoryPalette[3],
  toys_books: categoryPalette[4],
  hospital_checkup: categoryPalette[5],
  care_education: categoryPalette[6],
  sleep_furniture: categoryPalette[7],
  pregnancy_mother: categoryPalette[8],
  birth_postpartum: categoryPalette[8],
  insurance_savings: categoryPalette[9],
  etc: categoryPalette[9]
};

export const theme = {
  colors: {
    // D0 scale/nested tokens (new).
    coral,
    cream,
    text,
    semantic,
    categoryPalette,
    categoryColors,
    // Legacy flat keys -- unchanged names, kept for every existing call site, but redirected
    // onto the D0 tokens above wherever a clear mapping exists (round5a-design-spec.md "기존 키
    // 재지향으로 회귀 최소화"). mainCoral/subCoral/peach/beige/brown/gray600/textPrimary/
    // textSecondary/success/warning/danger change *value* here; ui-pixel-lock-flow.test.ts and
    // onboarding-flow.test.ts style assertions were updated to match (see design-progress.md).
    mainCoral: coral[500],
    subCoral: coral[400],
    peach: coral[100],
    mint: "#E8F6F1",
    sky: "#E8F1FF",
    brown: text.primary,
    gray900: "#1F1F1F",
    gray600: text.secondary,
    gray300: "#E5E5E5",
    beige: cream.surfaceAlt,
    white: cream.surface,
    primary500: "#FF8A7A",
    primary100: "#FFE6E0",
    secondary500: "#7DDCC7",
    background: cream.bg,
    surface: cream.surface,
    textPrimary: text.primary,
    textSecondary: text.secondary,
    success: semantic.success,
    warning: semantic.warning,
    danger: semantic.danger
  },
  spacing: {
    screen: 24,
    gap: 12,
    card: 16,
    section: 20
  },
  radii: {
    small: 12,
    pill: 999,
    button: 20,
    card: 22,
    sheet: 28
  },
  typography: {
    headline1: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
    headline2: { fontSize: 22, lineHeight: 30, fontWeight: "700" },
    headline3: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
    body1: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
    body2: { fontSize: 13, lineHeight: 20, fontWeight: "400" },
    caption: { fontSize: 11, lineHeight: 16, fontWeight: "400" }
  },
  // D0 money typography: three-tier hierarchy for amount text (hero/section/row), all
  // tabular-nums so digits stay aligned. Consumed by src/money.ts's MoneyText component.
  money: {
    hero: { fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] },
    section: { fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
    row: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }
  },
  shadows: {
    card:
      typeof document !== "undefined"
        ? {
            boxShadow: "0px 8px 18px rgba(74, 63, 53, 0.08)"
          }
        : {
            shadowColor: "#4A3F35",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 18,
            elevation: 2
          }
  },
  touchTarget: 44,
  ctaHeight: 56
} as const;
