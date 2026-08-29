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
 *
 * ## 라운드 73 트랙 E — 이 파일이 **두 목록**의 단일 소스가 된다
 *
 * 조회 쪽은 위 형식 덕에 라운드마다 숫자가 줄었는데, **저장 쪽에는 목록 자체가 없었다**.
 * 그래서 아래 셋이 함께 산다: 배선된 조회 화면(`OFFLINE_AWARE_LOAD_ERROR_SCREENS`) ·
 * 배선하지 않기로 한 조회 자리와 그 이유(`OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS`) ·
 * 배선된 저장 화면(`OFFLINE_AWARE_SAVE_ERROR_SCREENS`). 세 목록 모두 같은 계약 형식을 진다 —
 * **화면을 세는 것은 손배열이 아니라 app/** 스윕이다.**
 *
 * ## 라운드 74 트랙 D — 그 스윕이 세지 못하던 축
 *
 * 위 스윕들은 전부 **훅을 부르는 화면**을 센다. 그래서 라운드 73 L-2가 미리 적어 둔 사각이
 * 그대로 남아 있었다: *"새 화면이 공용 훅을 아예 부르지 않고 자기 문장을 손으로 적으면 사용
 * 집합에도 목록에도 없으므로 **양쪽이 일치한 채 통과한다.**"* 실제로 그렇게 통과한 채 살아
 * 있던 옛 리터럴이 화면 셋 · 자리 일곱이었고, 그 위에서 L-2는 "P3 0개"라고 적혀 있었다.
 *
 * 그래서 반대 방향의 단언이 하나 더 선다(`messages.test.ts`): **`app/**`에 옛 실패 리터럴이
 * 살아 있는 화면은 배선 목록이나 제외 목록에 예외 없이 이름이 있어야 한다.** 조회·저장 두
 * 쪽 모두 같은 모양이라, 저장 쪽 제외 목록(`OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS`)도
 * 함께 선다 — 오늘 그 목록은 비어 있고, **비어 있다는 것 자체가 스윕이 센 값**이다.
 */
export const OFFLINE_AWARE_LOAD_ERROR_SCREENS: ReadonlyArray<string> = [
  "app/(tabs)/index.tsx",
  "app/(tabs)/items.tsx",
  "app/(tabs)/records.tsx",
  "app/(tabs)/reports.tsx",
  "app/budget.tsx",
  // 라운드 74 트랙 D(GAP-074 #4): 지출 상세 조회. 핵심 루프 한가운데다(기록 → 총액 → 상세) —
  // 30초 전 기록 탭에서 "지금은 오프라인이에요"를 읽은 사람이 줄을 눌러 들어온 자리라, 여기만
  // "잠시 후 다시"로 남으면 한 여정 안에서 앱이 두 가지를 말하게 된다.
  "app/expenses/[expenseId].tsx",
  // 라운드 73 트랙 E(GAP-073 #5): 초대 정보 조회. 지하철에서 초대 링크를 누른 사람이 읽는
  // 첫 문장이라, 이 자리만 "잠시 후 다시"로 남으면 가족에 합류하는 그 한 번의 여정에서만
  // 앱이 기다리라고 말하게 된다(같은 화면의 참여 실패는 아래 저장 쪽 목록에 있다).
  "app/family/accept/[token].tsx",
  // 라운드 52 C-05: 가족 화면도 같은 단일 소스로 들어왔다 -- 구성원 목록 조회가 실패했을 때
  // 오프라인이면 "잠시 후 다시"가 사실과 어긋나는 것은 다른 화면과 똑같다.
  "app/family/index.tsx",
  // 라운드 74 트랙 D(GAP-074 #4): 가져오기 검수 화면의 **조회** 두 자리(잡 조회 · 행 목록 조회).
  // 이 화면의 저장 쪽(행 체크 · 분류 편집 · 확정)은 라운드 71 A가 이미 자기 여정의 문구
  // (importFailureMessage)로 갈라 뒀고, 그 배선이 쓰는 연결 판정도 같은 공용 한 벌이다
  // (useErrorTimeConnectivity — 라운드 72 E). 남아 있던 것은 조회 둘뿐이다.
  "app/import/[importJobId].tsx",
  "app/items/[itemTemplateId].tsx",
  // 라운드 72 트랙 B(GAP-072 #2): L-2가 세어 둔 옛 리터럴 자리 중 셋. 같은 사람이 30초 전 홈에서
  // 읽은 문장과 이 세 화면의 문장이 갈려 있었다 -- 판정·문구는 한 벌 그대로이고 배선만 붙는다.
  // 셋 다 EmptyStateCard가 아니라서 카드 프롭 계약을 그대로 받지 않는다(아래 목록에 이유를 적었다).
  "app/settings/children.tsx",
  "app/settings/index.tsx",
  "app/settings/notifications.tsx",
  // 라운드 74 트랙 D(GAP-074 #4): 동의 내역 조회 하나와 **파기 미리보기 셋**(아이 삭제 · 가구
  // 탈퇴 · 계정 삭제). 같은 파일이 라운드 71 B부터 저장 실패에는 이미 정직했다
  // (useErrorTimeConnectivity → destructiveFlowErrorMessage) — 형제 훅 하나가 같은 모듈 안에서
  // 조회 자리 넷을 지나쳐 가고 있었다. 되돌릴 수 없는 버튼 바로 위에서 기다릴 대상이 없는데
  // 기다리라고 말하던 자리라, 이 라운드가 마지막으로 닫는다.
  "app/settings/privacy.tsx"
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
  "app/family/accept/[token].tsx":
    "Card + Text + [다시 시도] SecondaryButton이라 카드 프롭이 없다. 문구는 온라인 갈래에만 주어('초대 정보를')를 붙여 종전 문자열과 바이트 단위로 같고, 버튼 라벨은 label={inviteLoadErrorCopy.actionLabel}로 같은 값을 받는다(만료·사용된 초대 카드는 이 갈래에 서지 않는다 — 라운드 70 A).",
  "app/settings/children.tsx":
    "Card + Text + [다시 시도] SecondaryButton이라 카드 프롭이 없다. 문구는 {loadErrorCopy.title}, 버튼 라벨은 label={loadErrorCopy.actionLabel}로 같은 값을 받는다(온라인 갈래 바이트 불변).",
  "app/settings/index.tsx":
    "요약 카드의 값 한 줄이라 제목도 [다시 시도] 버튼도 없다. 공용 훅에서 받는 것은 연결 판정뿐이고, 온라인 갈래는 종전 문자열('불러오지 못했어요') 그대로다.",
  "app/settings/notifications.tsx":
    "Card + Text + [다시 시도] SecondaryButton이고, 온라인 갈래만 주어('기기 목록을')를 앞에 붙인다 — 그 접두는 공용 문장 앞에 그대로 얹혀 종전 문자열과 바이트 단위로 같다.",
  // 라운드 74 트랙 D — 아래 둘은 **한 화면 안에 자리가 여럿**인 첫 항목이다. 그래서 이유가
  // 적는 것도 하나 더 늘었다: 자리 모양뿐 아니라 **왜 훅을 자리마다 하나씩 부르는가**.
  "app/import/[importJobId].tsx":
    "Card + Text + [다시 시도] SecondaryButton이 **두 벌**이라(잡 조회 · 행 목록 조회) 카드 프롭이 없다. 두 조회는 동시에 실패할 수 있고 원인이 서로 다를 수 있어 자리마다 훅을 하나씩 부른다(같은 화면의 저장 셋이 이미 그 규율이다 — 라운드 71 리뷰 S-6). 문구는 {jobLoadErrorCopy.title}·{rowsLoadErrorCopy.title}, 버튼 라벨은 같은 값의 actionLabel이라 온라인 갈래는 종전 문자열과 바이트 단위로 같다. ⚠️ 일괄 선택의 중간 실패(IMPORT_BULK_PARTIAL_FAILURE_TEXT)는 이 자리가 아니다 — 그 자리에 조회 문구를 돌려 쓰면 '앞부분은 이미 서버에 남아 있다'는 사실을 감춘다(K-10).",
  "app/settings/privacy.tsx":
    "Card 안 Text 한 줄이 **넷**이다(동의 내역 조회 하나 + 파기 미리보기 셋). 넷은 동시에 화면에 설 수 있고 각자 다른 요청이라 자리마다 훅을 하나씩 부른다 — 같은 파일의 저장 쪽 넷이 이미 그 규율이고(라운드 71 B의 useFlowFailureText), 한쪽의 연결 판정이 다른 쪽 문장에 얹히지 않게 한 라운드 70 리뷰 M-2·71 리뷰 S-6의 판정 그대로다. ⚠️ 미리보기 셋에는 [다시 시도] 버튼이 없는데도 배선하는 이유: 그 자리의 재시도 수단은 바로 위 [확인] 버튼이고 실패해도 계속 눌린다 — 공용 문장이 가리키는 행동이 그 자리에 실제로 있다(버튼도 더 구체적인 문장도 없어 제외한 온보딩 준비물 한 줄과 갈리는 지점이다). 온라인 갈래는 넷 다 종전 문자열 그대로다."
};

/**
 * 라운드 73 트랙 E — **배선하지 않기로 한 조회 실패 자리와 그 이유.**
 *
 * L-2(known-limitations)는 여덟 라운드 동안 `app/(onboarding)/prepared-items.tsx`의 한 줄을
 * "남은 P3"로 이월해 왔다. 이번 라운드가 그 자리를 다시 재어 보니 **배선이 답이 아니었다** —
 * 그런데 "배선하지 않는다"는 판정은 어떤 단언도 깨지 않으므로, 적어 두지 않으면 다음 라운드가
 * 같은 줄을 또 세고 또 이월한다. 그래서 제외를 **값으로** 적는다.
 *
 * 이 목록의 계약은 두 방향이다: 여기 이름이 있는 화면은 위 배선 목록에 **없고**(둘 다에 있을 수
 * 없다), 그리고 실제로 공용 훅을 **부르지 않는다**(제외해 놓고 조용히 배선되어 있지 않다).
 * 이유는 빈 문자열일 수 없다 — 이유가 값으로 남아 있을 때만 제외다.
 *
 * ## 라운드 74 트랙 D — 이 목록이 스윕의 **두 번째 출구**가 된다
 *
 * 라운드 73은 이 기계를 만들고 넷 중 하나만 넣은 뒤 "P3 0개"라고 적었다. 나머지 셋의 제외
 * 사유는 known-limitations의 **산문 한 문단**에만 있었고, 값 목록은 그것을 세지 않았다.
 * 이제 옛 리터럴 스윕이 이 목록을 읽는다 — 리터럴이 살아 있는 화면은 배선되거나 **여기
 * 이유와 함께 있거나** 둘 중 하나다. 산문으로는 더 이상 제외할 수 없다.
 */
export const OFFLINE_AWARE_LOAD_ERROR_EXEMPT_SCREENS: Readonly<Record<string, string>> = {
  "app/(onboarding)/prepared-items.tsx":
    "① 조회 실패 카드가 아니라 Card 안 Text 한 줄이고, ② 그 한 줄을 조회 실패와 '이 시기 준비물 0건'이 같은 조건(!isLoadingOptions && !hasOptions)으로 나눠 쓰며, ③ 이미 이 화면 전용의 더 구체적인 탈출구 문장을 갖고 있다('이 단계는 건너뛰고 나중에 준비템 탭에서 체크해도 돼요'). 공용 문장은 [다시 시도]를 가리키는데 이 자리에는 그 버튼이 없으므로, 배선은 더 좋은 문장을 공용 문장으로 후퇴시킨다."
};

/**
 * 라운드 73 트랙 E(GAP-073 #5) — **저장 실패 쪽의 같은 단일 소스.**
 *
 * 조회 쪽은 라운드 38 H-12 이후 목록이 있었고(위), `messages.test.ts`가 `app/**`을 훑어 그
 * 목록과 실제 사용 집합의 일치를 봐 왔다. 그래서 조회 쪽 숫자는 라운드마다 줄었다.
 * **저장 쪽에는 목록이 없었다** — `useSaveErrorCopy`를 지키던 계약은 두 경로를 손으로 적은
 * 배열이었고, `app/**`을 훑는 스윕이 없어 **새 저장 실패 문구가 생겨도 아무도 세지 않았다.**
 * 라운드 71 L-1("여정 목록이 없다")·라운드 72 M-3("상황 목록이 없다")과 같은 층의 사각이
 * 한 칸 옆으로 옮겨간 것이라, 같은 형식으로 닫는다: 목록은 여기 한 번만 적고
 * `messages.test.ts`가 `app/**`의 `useSaveErrorCopy(` 사용 집합과의 정확한 일치를 본다.
 *
 * 이 목록의 화면은 저장 실패 문구를 **스스로 고르지 않는다**: 판정은 `resolveSaveErrorCopy`
 * 한 벌(아는 코드 → 오프라인 → 모르는 실패)이고, 화면이 더하는 것은 주어 한 조각이거나
 * 그 화면 전용 폴백 문장 하나다(온라인 갈래는 종전과 바이트 단위로 같다).
 */
export const OFFLINE_AWARE_SAVE_ERROR_SCREENS: ReadonlyArray<string> = [
  // 라운드 52 C-07 · QA P3-1: 서버 직행 저장 둘(월 예산 · 아이 프로필) — 아웃박스를 거치지
  // 않아 오프라인에서 그냥 실패하는데도 "잠시 후 다시"만 말하던 자리.
  "app/budget.tsx",
  // 라운드 73 트랙 E: 초대 참여(POST). HOUSEHOLD_ALREADY_MEMBER 갈래는 바이트 불변이고,
  // 오프라인 문장은 **아는 코드가 없을 때만** 선다(판정 순서가 이미 그렇다).
  "app/family/accept/[token].tsx",
  "app/settings/children.tsx",
  // 라운드 73 트랙 E: 기기 알림 스위치 저장(PATCH). 같은 화면의 **조회** 실패는 라운드 72가
  // 이미 정직하게 만들어 뒀는데 저장만 남아, 한 화면 안에서 조회는 정직하고 저장은 아니었다.
  "app/settings/notifications.tsx"
];

/**
 * 라운드 74 트랙 D — **저장 쪽 옛 리터럴 스윕의 제외 목록**(조회 쪽 제외와 같은 형식).
 *
 * ## 오늘 이 목록이 비어 있다는 것이 무슨 뜻인가
 *
 * 스윕이 세는 것은 `app/**`의 화면이 **자기 손으로 적은** 옛 저장 실패 리터럴이다
 * (`SAVE_ERROR_NOTICE`의 앞 문장). 오늘 그런 자리는 0건이다 — 화면들이 그리는 저장 실패
 * 문장은 전부 순수 모듈에서 오고(`src/expenses/save-error-messages.ts` ·
 * `src/import/import-failure-messages.ts` · `src/settings/destructive-flow-messages.ts` ·
 * `src/onboarding/step-ui.ts` · `src/security/app-lock.ts`), 그 모듈들은 각자 자기 여정의
 * 판정을 이미 지고 있다. 그러니 이 0은 "아직 안 봤다"가 아니라 **스윕이 세어 본 값**이다.
 *
 * 비어 있다고 목록을 없애지 않는 이유: 조회 쪽 사각이 정확히 "제외를 값으로 적을 자리가
 * 없어서 산문으로 갔다"였다. 저장 쪽에 그 자리를 미리 내어 두면, 손으로 문장을 적는 화면이
 * 하나 생기는 날 만든 사람이 두 답 중 하나를 **값으로** 고르게 된다(배선하거나, 여기 이유를
 * 적거나). 이유는 조회 쪽과 같은 규율로 빈 문자열일 수 없다.
 */
export const OFFLINE_AWARE_SAVE_ERROR_EXEMPT_SCREENS: Readonly<Record<string, string>> = {};

/**
 * 화면 경로(mobile 루트 기준 상대 경로)가 오프라인 인지 문구를 쓰는지. 목록에 없는 화면은
 * 아직 배선 전이라 옛 리터럴("불러오지 못했어요. 잠시 후 다시 시도해 주세요.")을 그대로 쓴다.
 */
export function usesOfflineAwareLoadErrorCopy(screenPath: string): boolean {
  return OFFLINE_AWARE_LOAD_ERROR_SCREENS.includes(screenPath);
}
