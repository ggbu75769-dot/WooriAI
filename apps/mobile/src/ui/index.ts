// Round 5A D0 foundation component barrel (docs/5차/round5a-design-spec.md §D0).
// New, additive components living alongside (not replacing) src/ui.tsx.
//
// DSN-053 P2 후속 정리: P1이 c20deeb에서 되돌렸던 MoneyText/ListRow/EmptyState는 P2가
// 채택하지 않아 다시 지웠다 — 홈은 design-system의 ListRow(ApplicationPrimitives, c20deeb
// 원본 홈과 동일)를, 화면들의 빈 상태는 src/ui.tsx의 EmptyStateCard를 쓴다. 같은 역할의
// 컴포넌트를 미사용 채로 두면 import 한 줄 차이로 다른 렌더가 나가므로(MOB-121·CLN-130과
// 같은 판단) 실제 소비자가 있는 StageBadge(더보기 프로필 카드)와 Skeleton만 남긴다.
export { Skeleton, SkeletonCard, SkeletonRow } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";
export { StageBadge } from "./StageBadge";
export type { StageBadgeProps } from "./StageBadge";
