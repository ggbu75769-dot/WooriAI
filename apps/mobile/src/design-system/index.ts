// DSN-053 P1: c20deeb `src/design-system/index.ts`의 배럴을 **이식한 모듈 범위로만** 옮긴 것.
//
// 원본 배럴은 components 11종 전부를 내보냈다. P1의 이식 범위는 스펙(docs/5차/design-restore-spec.md
// §P1 ③)이 지정한 ApplicationPrimitives·CorePrimitives·ModV1Primitives·KoreanText와, 그 넷이
// 실제로 import하는 것들(patterns/AsyncState, ScreenScaffold, 토큰 전부, responsive,
// compact-korean-label)이다. 아직 옮기지 않은 컴포넌트(NoticeCard·PageHeader·ResponsiveGrid·
// SectionCard·StatusChip·OnboardingScaffold·OnboardingControls)는 여기서도 내보내지 않는다 --
// 없는 파일을 가리키는 배럴은 컴파일되지 않고, "있는 척"하는 export는 이식 범위를 흐린다.
export { ScreenScaffold } from "./components/ScreenScaffold";
export { AffiliateDisclosure, AppIcon, AppScreen, Card, CategoryChip, EmptyStateCard, IconButton, ListRow, PrimaryButton, SampleDataBanner, ScreenHeader, SecondaryButton, StatusBadge, TextButton, Toast, type AppIconName } from "./components/ApplicationPrimitives";
export { AmountDisplay, AppHeader, AppTabBar, ChildSwitcher, OfflineBanner, SectionHeader, SelectionCard, SummaryCard } from "./components/CorePrimitives";
// `itemStatusLabel`은 일부러 배럴에 없다: 같은 이름이 `src/items/item-labels.ts`에도 있어서,
// 배럴로 나가면 import 한 줄을 잘못 골라 상세 화면이 목록과 다른 어휘를 그리는 사고가 열린다
// (실제로 그렇게 갈라졌던 문제를 어휘 단일화로 닫았다). 어휘 자체가 필요하면
// `./item-status-vocabulary`를, 화면 라벨이 필요하면 `src/items/item-labels.ts`를 쓴다.
export { AccessibleDataTable, BottomSheet, BudgetSummary, CheckCard, ItemStatusControl, MoneyField, MoneyText, PreparationItemCard, TopAppBar, modV1ItemStatuses, type ModV1ItemStatus } from "./components/ModV1Primitives";
export { catalogItemStatusLabel, CATALOG_ONLY_ITEM_STATUS_LABELS, MOD_V1_ITEM_STATUS_LABELS, UNKNOWN_ITEM_STATUS_LABEL } from "./item-status-vocabulary";
export { KoreanText } from "./components/KoreanText";
export { EmptyState, ErrorState, LoadingState, OfflineState, SyncStatusBar, type AppSyncStatus } from "./patterns/AsyncState";
export { balanceCompactKoreanLabel } from "./compact-korean-label";
export { protectKoreanWordBoundaries } from "./korean-word-boundaries";
export { adaptiveTabBarHeight, compactGridColumnCount, compactGridItemWidth, usesLargeTextLayout, LARGE_TEXT_SCALE_THRESHOLD } from "./responsive";
export { breakpoints, horizontalPaddingForWidth } from "./tokens/breakpoint";
export { chartColors, semanticColors } from "./tokens/color";
export { elevation } from "./tokens/elevation";
export { iconSize } from "./tokens/icon";
export { motion } from "./tokens/motion";
export { radius } from "./tokens/radius";
export { spacing } from "./tokens/spacing";
export { typography } from "./tokens/typography";
