/**
 * 준비 상태 **어휘의 단일 소스** (DSN-053 P1 후속).
 *
 * 고치는 문제: 같은 `ItemStatus` 값이 화면마다 다른 단어로 나왔다. 준비템 목록의 상태 pill은
 * 승인 캡처의 어휘("보유 · 알아보기 · 필요 · 선물")를 쓰는데, 상세 화면의 "내 준비 상태" 줄과
 * 동기화 화면은 `src/items/item-labels.ts`가 따로 들고 있던 어휘("이미 준비 · 관심 · 준비 전 ·
 * 선물 받음")를 썼다. 사용자가 목록에서 "보유"로 바꾼 항목이 상세에서는 "이미 준비"로 보이면,
 * 같은 값인지 다른 값인지 확인할 방법이 화면에 없다.
 *
 * 승인된 쪽은 **목록 어휘**다(캡처가 그것을 확정했다). 그래서 그 어휘를 이 파일 하나에 두고,
 * 목록 pill(`components/ModV1Primitives.tsx`)과 상세/동기화(`src/items/item-labels.ts`)가 모두
 * 여기서 읽는다.
 *
 * 이 파일이 design-system 안에 있으면서도 `.ts`(컴포넌트 아님)인 이유: react-native를 import하는
 * 모듈은 이 저장소의 vitest에서 실행할 수 없다(design-system-restore.test.ts 머리말 참고).
 * 어휘는 순수 데이터라 여기 두면 두 소비자 모두 import할 수 있고, 값 자체를 테스트로 고정할 수
 * 있다.
 *
 * 어휘를 늘리거나 바꾸지 않는다 — 아래 값들은 c20deeb 원본(ModV1Primitives)의 문자열 그대로다.
 */

/** 캡처가 확정한 ModV1 준비 상태 8종의 라벨. */
export const MOD_V1_ITEM_STATUS_LABELS = {
  researching: "알아보기",
  planned: "예정",
  ordered: "주문",
  owned: "보유",
  rented: "대여",
  gifted: "선물",
  replacement_needed: "교체",
  retired: "종료"
} as const;

/**
 * 카탈로그 어휘에만 있는 상태의 라벨. 라벨이 없으면 "미정"으로 뭉개져 서로 다른 상태가 한
 * 단어로 보인다.
 */
export const CATALOG_ONLY_ITEM_STATUS_LABELS = {
  borrowed: "대여",
  gift_expected: "선물 예정",
  replacement_due: "교체 시기",
  replaced: "교체 완료",
  not_needed: "필요 없음",
  need: "필요",
  ended: "사용 종료"
} as const;

/** 아는 값이 하나도 없을 때. 없는 상태를 지어내지 않고 "모른다"고만 말한다. */
export const UNKNOWN_ITEM_STATUS_LABEL = "미정";

const allLabels: Readonly<Record<string, string>> = {
  ...MOD_V1_ITEM_STATUS_LABELS,
  ...CATALOG_ONLY_ITEM_STATUS_LABELS
};

/** 카탈로그 상태 문자열 → 화면에 보이는 한국어 라벨. */
export function catalogItemStatusLabel(value: string | null | undefined): string {
  if (!value) return UNKNOWN_ITEM_STATUS_LABEL;
  return allLabels[value] ?? UNKNOWN_ITEM_STATUS_LABEL;
}
