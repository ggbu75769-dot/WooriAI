import type { CategoryCode } from "./categories";
import { typography as designSystemTypography } from "./design-system/tokens/typography";

// Round 5A D0 (docs/5차/round5a-design-spec.md §D0) -- coral scale/cream/text/semantic tokens.
// Additive: legacy flat color keys below are kept (nothing deleted) and redirected onto these
// new tokens so both stay in sync, per the spec's "기존 키 재지향" rule.
//
// DSN-053 P1: the scale values are the **approved c20deeb (MOD_V1) palette**, restored verbatim
// from `git show c20deeb:apps/mobile/src/theme.ts` (docs/5차/design-restore-spec.md "토큰 롤백
// 표"). The Round 5A pass had drifted them lighter/warmer; that drift is what made the shipped
// screens stop matching the approved capture set, so the numbers below are not re-derived here --
// they are the capture's own values.
const coral = {
  50: "#FFF4EF",
  100: "#FFE4D8",
  200: "#FFC8B5",
  300: "#FFA58A",
  400: "#F98060",
  500: "#E85F3B",
  600: "#C94627",
  700: "#A93720",
  800: "#862D1D",
  900: "#67251B"
} as const;

const cream = {
  bg: "#FFFDFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F8F6F4"
} as const;

const text = {
  primary: "#211E1C",
  secondary: "#5F5854",
  tertiary: "#7A716B"
} as const;

const semantic = {
  success: "#16794B",
  warning: "#B45309",
  danger: "#B42318",
  info: "#1D4ED8"
} as const;

// Brand identity (런치/스플래시). Not a UI surface palette -- these are the mark's own colors.
const brandIdentity = {
  canvas: "#FFF9F3",
  navy: "#17324D",
  persimmon: "#FF6B4A",
  butter: "#FFD76A"
} as const;

// Named surfaces preserve the approved Android Pixel Lock palette while keeping
// route/component code free of raw colour literals. They are presentation tokens,
// never catalog or finance data.
const presentation = {
  dangerSurface: "#FFF0ED",
  segmentedTrack: "#F5F0EA",
  chartPlot: "#FFF4EE",
  splashStageSurface: "#FFF9F4",
  importCanvas: "#FFFCFA",
  previewCoral: "#FFF0EA",
  previewYellow: "#FFF5D7",
  previewGreen: "#EAF7F2",
  previewPeach: "#FFECE6",
  previewNeutral: "#ECECEC",
  // 라운드 101 웨이브 2 TK — 색 리터럴 토큰화 1차(다크 모드 선행). 아래 키들은 화면에 흩어져
  // 있던 리터럴을 **같은 값 그대로** 이름으로 끌어올린 것이다(DNC-017: 값 교체 0건 — 값이
  // 바뀌면 그것은 팔레트 개정이고 변경 요청이 먼저다). 값=종전 리터럴의 대조표는
  // src/color-literal-tokenization.test.ts가 두 시점으로 문다.
  // 헤어라인 2종: #4A3F35(카드 그림자 색)의 8%/10% — 카드·칩·목록 행의 외곽선 관례값.
  hairline: "rgba(74, 63, 53, 0.08)",
  hairlineStrong: "rgba(74, 63, 53, 0.10)",
  // 라운드 101 TK2(2차 — 1차 잔여 회수): 헤어라인 셋째 변종 #4A3F35 12% — 가족 화면
  // "가족 초대하기" 버튼(familyInviteButtonStyle)의 외곽선. 값=종전 리터럴 대조는 1차와
  // 같은 대조표(src/color-literal-tokenization.test.ts)가 두 시점으로 문다.
  hairlineHeavy: "rgba(74, 63, 53, 0.12)",
  // 라운드 102 TK3(3차 — 2차 잔여 회수): 준비템 상세의 플로팅 크롬(뒤로가기·공유하기) 원형
  // 버튼 서피스 — 상품 이미지 위 흰 반투명 82%(승인 캡처 ITEM-002의 값 그대로). 값=종전
  // 리터럴 대조는 같은 대조표(src/color-literal-tokenization.test.ts)가 두 시점으로 문다.
  floatingChromeSurface: "rgba(255, 255, 255, 0.82)",
  // 코랄 히어로 위 흰색 반투명 2종(홈 히어로 진행 바 트랙 0.45 · 준비 히어로 트랙/구분선 0.28).
  heroProgressTrack: "rgba(255,255,255,0.45)",
  heroOverlaySoft: "rgba(255,255,255,0.28)",
  // 리포트 추이 카드의 격자선(퍼시몬 8%).
  chartGridLine: "rgba(255, 107, 82, 0.08)",
  // 지출 분류 팔레트 위 아이콘 잉크(item-visuals.ts expenseCategoryVisual).
  categoryIconInk: "#443F3C",
  // 준비 목록(PreparationListParity) 분류 헤더의 진행 바 트랙.
  prepGroupProgressTrack: "#F5E8DF",
  // 준비 목록 그룹 카드의 틴트/잉크 10쌍(색상 이름 기준 — 시기 밴드도 같은 값 셋을 공유한다:
  // coral/mint/butter). 값은 c20deeb 이식본(DSN-053 P2-B)의 리터럴 그대로다.
  prepTintCoral: "#FFF0EC",
  prepInkCoral: "#C54A2C",
  prepTintPink: "#FFF0F4",
  prepInkPink: "#B8476C",
  prepTintLavender: "#EEE9FF",
  prepInkLavender: "#7157A8",
  prepTintMint: "#E5F7F2",
  prepInkMint: "#147A66",
  prepTintSky: "#EAF3FF",
  prepInkSky: "#2866A3",
  prepTintButter: "#FFF6DD",
  prepInkButter: "#A86400",
  prepTintViolet: "#F1EDFF",
  prepInkViolet: "#6553A3",
  prepTintSeafoam: "#EAF8F4",
  prepInkSeafoam: "#19735F",
  prepTintPowderBlue: "#EEF5FF",
  prepInkPowderBlue: "#3268A8",
  prepTintSand: "#F7F1EA",
  prepInkSand: "#8A5A2B"
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
    brandIdentity,
    presentation,
    categoryPalette,
    categoryColors,
    brandNavy: brandIdentity.navy,
    brandPersimmon: brandIdentity.persimmon,
    brandButter: brandIdentity.butter,
    brandCanvas: brandIdentity.canvas,
    // Legacy flat keys -- unchanged names, kept for every existing call site, but redirected
    // onto the D0 tokens above wherever a clear mapping exists (round5a-design-spec.md "기존 키
    // 재지향으로 회귀 최소화"). mainCoral/subCoral/peach/beige/brown/gray600/textPrimary/
    // textSecondary/success/warning/danger change *value* here; ui-pixel-lock-flow.test.ts and
    // onboarding-flow.test.ts style assertions were updated to match (see design-progress.md).
    mainCoral: coral[600],
    subCoral: coral[500],
    peach: coral[100],
    mint: "#E8F6F1",
    sky: "#E8F1FF",
    brown: text.primary,
    gray900: text.primary,
    gray600: text.secondary,
    gray300: "#E5DFDB",
    beige: cream.surfaceAlt,
    white: cream.surface,
    primary500: coral[600],
    primary100: coral[100],
    secondary500: "#267A68",
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
  // T1(디자인 시스템) — 타이포 이중 체계의 **1단계 값 재지향**: 값이 이미 같은 키
  // (headline1↔heading1 · body1↔body)는 src/design-system/tokens/typography.ts를 단일
  // 소스로 읽는다. 값이 서로 다른 키(headline2/3·body2·caption)는 화면들이 그 수치의
  // 픽셀락 캡처를 물고 있어 여기 남는다 — 합치는 것은 캡처 재대조를 부르는 2단계 몫이다.
  typography: {
    headline1: designSystemTypography.heading1,
    headline2: { fontSize: 22, lineHeight: 30, fontWeight: "700" },
    headline3: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
    body1: designSystemTypography.body,
    body2: { fontSize: 13, lineHeight: 20, fontWeight: "400" },
    // ⚠️ 두 시점(토스 리뷰 H) — T1은 여기서 caption을 design-system caption(12/18)으로
    // 재지향했는데, 그 재지향이 textStyles.caption 경로를 타고 픽셀락 비세션 캡처 3종
    // (HOME-001·REP-001·ITEM-001)의 렌더를 승인 재대조 없이 움직였다(diff bbox 실측:
    // HOME-001 (10,119,380,772) 등). 바로 위 규칙("값이 서로 다른 키는 캡처를 물고 있어
    // 남는다")이 caption(11≠12)에도 그대로 적용돼야 하므로 11/16 리터럴로 되돌린다 —
    // 12/18 채택은 headline2/3·body2와 같은 2단계(캡처 재대조 + 변경 요청 문서) 몫이다.
    caption: { fontSize: 11, lineHeight: 16, fontWeight: "400" },
    // 금액 타이포 3단 스케일. 값은 design-system의 amount 티어(전부 tabular-nums)가 단일
    // 소스다 — 금액이 품목명보다 작게 그려지던 자리(공용 ListRow·히어로)가 이 티어를 쓴다.
    amountLarge: designSystemTypography.amountLarge,
    amountMedium: designSystemTypography.amountMedium,
    amountRegular: designSystemTypography.amountRegular
  },
  // (옛 D0 `theme.money` 3단 스케일은 유일 소비자였던 src/ui/MoneyText·ListRow가 DSN-053
  // P2에서 재삭제되며 함께 제거됐다. 이번 T1의 `typography.amount*`는 그 부활이 아니라
  // design-system amount 티어의 재지향이다 — 값의 단일 소스는 여전히 그쪽이다.)
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
  touchTarget: 48,
  ctaHeight: 56
} as const;
