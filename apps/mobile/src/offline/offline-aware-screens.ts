/**
 * UX-N / 라운드 38 H-12 — "이 화면의 조회 실패 문구가 오프라인 인지 문구인가"의 **단일 소스**.
 *
 * 배경: 조회 실패 카드를 그리는 화면들의 계약은 세 파일에 나뉘어 있다.
 *  - src/screen-phase.test.ts          — 에러 분기가 로딩 분기보다 앞에 오는가(MOB-130)
 *  - src/loading-skeleton-contract.test.ts — 로딩 자리가 스켈레톤인가(MOB-119)
 *  - src/offline/messages.test.ts      — 문구가 공용 단일 소스에서 오는가(UX-N)
 * 세 파일이 각자 "이 화면은 오프라인 인지 문구를 쓴다"는 **같은 사실**을 손으로 적고 있었다.
 * 한 화면을 배선하면서 한 곳만 켜면 나머지 계약은 옛 리터럴을 계속 기대하거나(거짓 통과),
 * 아예 그 화면을 빼먹은 채로 남는다 — 실제로 reports.tsx가 배선을 끝내고도 두 목록 어디에도
 * 없었다. 사실을 여기 한 번만 적고 세 파일이 이 목록을 읽는다.
 *
 * 이 모듈은 화면 코드가 import하지 않는다(계약 전용 데이터라 앱 번들에 실리지 않는다). 목록이
 * 현실과 갈라지지 않도록, `src/offline/messages.test.ts`가 app/** 을 훑어 `useLoadErrorCopy(`를
 * 실제로 쓰는 화면 집합과 이 목록이 **정확히 일치**하는지 확인한다 — 새 화면을 배선하면 그
 * 테스트가 먼저 깨지며 여기 한 줄을 추가하라고 말한다.
 */
export const OFFLINE_AWARE_LOAD_ERROR_SCREENS: ReadonlyArray<string> = [
  "app/(tabs)/index.tsx",
  "app/(tabs)/items.tsx",
  "app/(tabs)/records.tsx",
  "app/(tabs)/reports.tsx",
  "app/budget.tsx",
  "app/items/[itemTemplateId].tsx"
];

/**
 * 화면 경로(mobile 루트 기준 상대 경로)가 오프라인 인지 문구를 쓰는지. 목록에 없는 화면은
 * 아직 배선 전이라 옛 리터럴("불러오지 못했어요. 잠시 후 다시 시도해 주세요.")을 그대로 쓴다.
 */
export function usesOfflineAwareLoadErrorCopy(screenPath: string): boolean {
  return OFFLINE_AWARE_LOAD_ERROR_SCREENS.includes(screenPath);
}
