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
  // 라운드 52 C-05: 가족 화면도 같은 단일 소스로 들어왔다 -- 구성원 목록 조회가 실패했을 때
  // 오프라인이면 "잠시 후 다시"가 사실과 어긋나는 것은 다른 화면과 똑같다.
  "app/family/index.tsx",
  "app/items/[itemTemplateId].tsx",
  // 라운드 72 트랙 B(GAP-072 #2): L-2가 세어 둔 옛 리터럴 자리 중 셋. 같은 사람이 30초 전 홈에서
  // 읽은 문장과 이 세 화면의 문장이 갈려 있었다 -- 판정·문구는 한 벌 그대로이고 배선만 붙는다.
  // 셋 다 EmptyStateCard가 아니라서 카드 프롭 계약을 그대로 받지 않는다(아래 목록에 이유를 적었다).
  "app/settings/children.tsx",
  "app/settings/index.tsx",
  "app/settings/notifications.tsx"
];

/**
 * 라운드 72 트랙 B — 위 목록에 있으나 **조회 실패 카드(EmptyStateCard)가 아닌** 자리와 그 이유.
 *
 * ## 왜 이 목록이 값으로 남는가
 *
 * 위 목록의 계약은 두 겹이다: ① `app/**`에서 `useLoadErrorCopy(`를 쓰는 화면 집합과 목록이
 * 정확히 일치할 것, ② 목록의 화면이 카드의 `title`·`actionLabel` 프롭으로 그 값을 받을 것.
 * 라운드 71까지 목록의 일곱은 전부 EmptyStateCard였기 때문에 두 겹이 하나로 붙어 있었는데,
 * 이번에 들어온 셋은 카드가 아니다(Card+Text+버튼 둘, 요약 한 줄 하나). 여기 이유를 적지 않으면
 * 다음 라운드가 둘 중 하나를 한다 — ②를 만족시키려고 **화면 구조를 카드로 바꾸거나**(레이아웃
 * 변경), 아니면 이 셋을 목록에서 빼서 ①을 깨거나(그러면 세 계약 파일이 다시 이 화면들을
 * 지나쳐 간다 — 라운드 38 H-12가 reports.tsx에서 겪은 그 일).
 *
 * ⚠️ `app/settings/index.tsx`는 특히 **문구 자체가 목록의 계약 밖**이다: 그 자리는 카드 제목이
 * 아니라 요약 카드의 오른쪽 값 한 줄이라 `LoadErrorCopy.title`을 그대로 실을 수 없다(줄이 접혀
 * 레이아웃이 바뀌고, 뒷문장이 가리키는 [다시 시도] 버튼이 그 자리에 없다). 그 화면이 공용 훅에서
 * 받는 것은 **연결 판정 하나**이고, 문구는 같은 단일 소스 문장의 앞 문장을 잘라 쓴다(새 문구 0건).
 * 그래도 목록에 들어오는 이유는 ① 때문이다 — 훅을 쓰는 화면은 예외 없이 여기 이름이 남아야 한다.
 */
export const OFFLINE_AWARE_LOAD_ERROR_NON_CARD_SCREENS: Readonly<Record<string, string>> = {
  "app/settings/children.tsx":
    "Card + Text + [다시 시도] SecondaryButton이라 카드 프롭이 없다. 문구는 {loadErrorCopy.title}, 버튼 라벨은 label={loadErrorCopy.actionLabel}로 같은 값을 받는다(온라인 갈래 바이트 불변).",
  "app/settings/index.tsx":
    "요약 카드의 값 한 줄이라 제목도 [다시 시도] 버튼도 없다. 공용 훅에서 받는 것은 연결 판정뿐이고, 온라인 갈래는 종전 문자열('불러오지 못했어요') 그대로다.",
  "app/settings/notifications.tsx":
    "Card + Text + [다시 시도] SecondaryButton이고, 온라인 갈래만 주어('기기 목록을')를 앞에 붙인다 — 그 접두는 공용 문장 앞에 그대로 얹혀 종전 문자열과 바이트 단위로 같다."
};

/**
 * 화면 경로(mobile 루트 기준 상대 경로)가 오프라인 인지 문구를 쓰는지. 목록에 없는 화면은
 * 아직 배선 전이라 옛 리터럴("불러오지 못했어요. 잠시 후 다시 시도해 주세요.")을 그대로 쓴다.
 */
export function usesOfflineAwareLoadErrorCopy(screenPath: string): boolean {
  return OFFLINE_AWARE_LOAD_ERROR_SCREENS.includes(screenPath);
}
