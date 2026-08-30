/**
 * 라운드 83 트랙 D(GAP-083 #3) — **공유 캐시 키의 신선도 정책을 한 장의 표로 모은다.**
 *
 * ## 무엇이 문제였나
 *
 * 이 앱의 react-query 키 중 **둘 이상의 자리가 켜는 키**가 다섯이다(아래 표). 그런데 그 키의
 * 신선도(`staleTime`)는 키가 아니라 **화면**이 정하고 있었다:
 *
 *   - `["categories"]` — 채우는 자리 일곱이 전부 `5 * 60 * 1000`. **한 벌.**
 *   - `["children"]` — 열넷 중 하나(`src/export/ExpenseCsvExport.tsx`)만 5분, 나머지 열셋은
 *     선언이 없어 전역 기본 30초. **두 벌.**
 *   - `["household-members", householdId]` — 일곱 자리 중 둘만 5분, 다섯은 30초. **두 벌.**
 *
 * ⚠️ **한 벌로 만드는 방향은 키마다 다르다**(라운드 83 리뷰 M-3): 위 둘은 긴 쪽으로 모았고,
 * `["household-members"]`는 **짧은 쪽으로** 모았다 — 그 응답이 표시가 아니라 **권한 게이트의
 * 입력**이기 때문이다(아래 ⓑ의 이유 참고). 그래서 그 키의 인라인 5분 **두 자리**
 * (`app/(tabs)/records.tsx` · `app/expenses/[expenseId].tsx`)를 지웠다. 실효 주기는 종전에도
 * 30초였으므로(짧은 쪽이 이긴다) **화면 동작은 불변이고, 사라진 것은 지켜지지 않던 선언**이다.
 *
 * 두 벌이라는 말은 "느슨한 쪽이 이긴다"가 아니다 — **짧은 쪽이 이긴다.** 같은 캐시 항목에
 * `staleTime`이 다른 관찰자 둘이 붙으면, 짧은 쪽이 먼저 stale 판정을 받아 재조회하고 그 응답이
 * **공유 항목을 통째로 갈아 끼우므로** 긴 쪽도 함께 새 데이터를 받는다. 즉 5분이라고 적어 둔
 * 자리는 5분을 얻지 못하고, 실효 주기는 그 키에 붙은 **가장 짧은 선언**이 정한다. 이 문장은
 * 정찰이 소스로만 쟀던 것이라 이 트랙이 react-query 실물로 먼저 못 박았다
 * (`shared-cache-policy.test.ts`의 ⓐ 재현 — 가설대로였다).
 *
 * 그래서 5분을 적은 자리들은 **자기가 요청하지 않은 30초 주기를 얻고 있었고**, 그 사실은
 * 화면 소스 어디에도 적혀 있지 않았다. 정책을 키 옆에 두면 그 어긋남이 생길 자리가 없다.
 *
 * ## 왜 `setQueryDefaults`인가 (그리고 왜 전역 기본은 그대로인가)
 *
 * react-query의 옵션 우선순위는 `defaultOptions.queries` < `setQueryDefaults(key, …)` <
 * 호출부의 인라인 옵션이다. 그래서 이 표는 **키별로만** 덮는다:
 *   - 전역 기본 30초(`app/_layout.tsx`의 MOB-117 근거)는 한 글자도 바뀌지 않는다 — 표에
 *     없는 키는 전부 종전 그대로다.
 *   - 화면이 인라인으로 적어 둔 `staleTime`은 여전히 이긴다. 오늘 남아 있는 여덟 자리는 전부 키
 *     기본과 **같은 값**이고(리뷰 M-3이 `["household-members"]`의 두 자리를 지운 뒤의 값이다),
 *     앞으로 달라지면 아래 ⓑ 대장이 빨개진다.
 *
 * ## 순서가 성패였다 — 무효화가 정책보다 먼저
 *
 * `["children"]`을 길게 두는 일은 **그 키를 바꾸는 쓰기 경로 전부가 스스로 무효화할 때만**
 * 안전하다. 오늘 소스에서 그 전제가 한 자리 깨져 있었다(온보딩의 아이 생성 — 무효화 0건).
 * 30초 기본이 그 구멍을 덮고 있었을 뿐이고, 5분으로 늘리면 같은 구멍이 열 배로 보인다.
 * 그래서 이 트랙은 무효화 한 줄을 **먼저** 넣고(app/(onboarding)/child-profile.tsx) 그 다음에
 * 이 표를 세웠다. 대장은 `CHILDREN_WRITE_LEDGER`에 있고 두 방향으로 검사된다.
 *
 * ⚠️ **그 전제는 "이 기기의 쓰기"까지만 참이다**(라운드 83 리뷰 M-4). 다기기 가구에서 목록을 바꾸는
 * 것은 **다른 기기**이고 대장은 그것을 세지 않는다 — 그 갈래를 어떻게 다루기로 했는지는
 * `["children"]` 줄의 `why`에 값으로 있다.
 *
 * ## 이 파일의 규율
 *
 * react-native / expo / react-query **런타임 import 없이** 순수 데이터로 유지한다
 * (child-switch.ts·child-deletion.ts와 같은 규율) — vitest node 환경에서 그대로 읽힌다.
 * 등록(`setQueryDefaults` 호출)은 `app/_layout.tsx` **한 자리**에서 이 표를 훑는다. 두 번째
 * 등록 자리가 생기면 ⓓ 계약이 빨개진다.
 */

/** 이 표가 다루는 정책 축. 값은 밀리초, `null`은 "키 기본을 두지 않는다 = 전역 30초 그대로". */
export type SharedCachePolicy = {
  /** `setQueryDefaults`가 부분 일치로 잡는 키 접두사. 한 칸 접두사는 `[key, id]` 꼴 전부를 함께 잡는다. */
  readonly queryKeyPrefix: readonly string[];
  /** 이 키의 신선도. `null`이면 등록하지 않는다(전역 기본 30초). */
  readonly staleTimeMs: number | null;
  /** 왜 이 값인가 — 값보다 이 문장이 오래 산다. */
  readonly why: string;
};

/** 5분. 이 파일이 "길게"라고 말할 때의 그 값(화면들이 이미 적어 둔 값과 같다). */
export const LONG_SHARED_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * ⓑ 정책 대장 — **둘 이상의 소스가 켜는 키 전수.**
 *
 * "둘 이상"의 기준은 `queryKey: ["…"` 선언이 등장하는 **서로 다른 파일 수 ≥ 2**이고, 그 전수는
 * 테스트가 저장소를 훑어 스스로 센다(수를 손으로 적지 않는다). 여기 없는 키가 둘째 소비처를
 * 얻는 날 ⓑ가 빨개진다.
 */
export const SHARED_CACHE_POLICIES: readonly SharedCachePolicy[] = [
  {
    queryKeyPrefix: ["categories"],
    staleTimeMs: LONG_SHARED_STALE_TIME_MS,
    why:
      "서버가 시드하는 마스터 목록이고 앱 안에 이 목록을 바꾸는 쓰기 경로가 0건이다(사용자는 " +
      "카테고리를 만들 수 없다). 일곱 소비처가 이미 5분을 적고 있었으므로 값이 아니라 자리만 옮긴다. " +
      "CAT-124의 includeAll 규약은 다른 축이고 그 가드(src/categories-cache-contract.test.ts)는 무접촉."
  },
  {
    queryKeyPrefix: ["children"],
    staleTimeMs: LONG_SHARED_STALE_TIME_MS,
    why:
      "아이 목록은 거의 바뀌지 않고, **이 기기의** 쓰기 전수는 성공 뒤 명시 무효화를 갖는다 " +
      "(CHILDREN_WRITE_LEDGER). ⚠️ 라운드 83 리뷰 M-4 — 그 대장과 '목록이 바뀌는 경우'는 " +
      "**모집단이 다르다**: 대장은 같은 기기의 쓰기만 세고, 다가구·다기기에서는 배우자의 기기가 " +
      "아이를 더하거나(createChild) 초대를 수락해 목록을 바꾼다. 그 갈래를 덮는 것은 무효화가 " +
      "아니라 재조회 둘인데, 5분에서는 **포커스 재조회가 창 안에서 발동하지 않는다**(짧은 쪽이 " +
      "이긴다는 ⓐ의 뒷면이다) — 남는 것은 홈의 당김 새로고침 하나다(app/(tabs)/index.tsx가 " +
      "['children']을 함께 무효화한다). 그래도 5분을 유지하는 근거: 이 키는 " +
      "['household-members']와 달리 **권한 게이트의 입력이 아니라 표시·선택의 입력**이라, 늦게 " +
      "도착한 목록이 만드는 최악은 '방금 다른 기기가 추가한 아이가 아직 안 보인다'이고 그 자리는 " +
      "당김 한 번으로 사용자가 스스로 닫을 수 있다. 계정 전환·로그아웃은 teardown이 캐시를 통째로 " +
      "비우므로(FIX-118A) 이 값이 이전 계정의 목록을 늘려 잡을 수도 없다."
  },
  {
    queryKeyPrefix: ["household-members"],
    staleTimeMs: null,
    why:
      "⚠️ 이 응답은 **표시가 아니라 권한 게이트의 입력**이다 — 일곱 소비처 중 셋이 members에서 내 " +
      "role을 찾아 화면을 연다/닫는다(app/family/index.tsx의 canManageMembers, " +
      "app/settings/children.tsx의 myRole·canAddChild). 그 판정을 바꾸는 것은 이 기기의 쓰기가 " +
      "아니라 **같은 가구의 다른 기기**(소유자가 내 역할을 바꾸거나 나를 내보낸다)라서, 이 키에는 " +
      "['children']이 기대는 '쓰기 전수가 스스로 무효화한다'는 전제가 없다. 라운드 83 D는 이 키를 " +
      "5분으로 올렸다가 리뷰 M-3이 되돌렸다: 그 5분은 역할 게이트가 **틀린 권한을 보여 주는 창**을 " +
      "열 배로 늘리고, 포커스 재조회가 그 창 안에서는 아예 발동하지 않는다. 전역 30초를 그대로 " +
      "둔다 — [expenses]·[budget]과 같은 이유(낡은 값이 곧 틀린 값인 축)다."
  },
  {
    queryKeyPrefix: ["expenses"],
    staleTimeMs: null,
    why:
      "홈과 기록 탭이 같은 [expenses, childId, yearMonth] 항목을 공유하지만 이 키는 **길게 두지 " +
      "않는다** — 총액이 늘어나는 것을 보러 오는 화면이라 낡은 숫자는 곧 틀린 숫자다. 오늘 이 키에 " +
      "staleTime을 적은 자리가 0건이라 이미 한 벌(전역 30초)이고, 그 사실을 표에 값으로 남긴다."
  },
  {
    queryKeyPrefix: ["budget"],
    staleTimeMs: null,
    why:
      "홈과 예산 화면이 공유한다. [expenses]와 같은 이유로 전역 30초를 그대로 둔다 — 예산 대비 " +
      "지출은 방금 적은 지출이 즉시 반영돼야 하는 숫자다."
  }
];

/**
 * `["children"]` **목록의 내용을 바꾸는** API 전수. 이 이름들의 호출부가 곧 무효화 대장의
 * 모집단이다(테스트가 app/**·src/** 를 훑어 스스로 찾는다 — 자리 수를 손으로 적지 않는다).
 */
export const CHILDREN_WRITE_APIS: readonly string[] = [
  "createChild",
  "updateChild",
  "confirmChildProfileDeletion",
  "confirmHouseholdLeave",
  "acceptInvite"
];

/**
 * 위 모집단에서 **일부러 뺀** 이름과 그 이유. 숨기지 않고 값으로 남긴다.
 *
 * `confirmAccountDeletion`도 결과적으로 아이 목록을 없애지만, 그 경로는 세션 teardown이 캐시를
 * **통째로** 비운다(FIX-118A의 `clearAppQueryCache`). 키별 무효화가 다룰 축이 아니고, 이 트랙은
 * teardown 경로를 0건 건드린다.
 *
 * `setPreparedItems`·`removeHouseholdMember`는 각각 준비템·구성원 목록을 바꿀 뿐 아이 목록을
 * 바꾸지 않는다.
 */
export const CHILDREN_WRITE_APIS_EXCLUDED: readonly { readonly api: string; readonly why: string }[] = [
  { api: "confirmAccountDeletion", why: "계정 삭제 → 세션 teardown이 캐시 전체를 비운다(FIX-118A)" },
  { api: "setPreparedItems", why: "준비템 상태만 바꾼다 — 아이 목록 불변" },
  { api: "removeHouseholdMember", why: "구성원 목록만 바꾼다 — 아이 목록 불변" }
];

/** ⓒ 무효화 대장의 한 줄. */
export type ChildrenWritePath = {
  /** 쓰기 API를 실제로 부르는 소스(저장소 루트 기준 상대경로). */
  readonly writeSite: string;
  /** 그 소스 안에서 이 쓰기를 담고 있는 이름 — 대장이 낡으면 이 이름이 먼저 사라진다. */
  readonly mutation: string;
  /** 이 경로가 부르는 쓰기 API. */
  readonly apis: readonly string[];
  /** 성공 뒤 무효화가 적힌 소스. 헬퍼가 쓰기를 하는 경우 그 호출부일 수 있다. */
  readonly invalidatedIn: string;
  /** 그 소스에 실재해야 하는 무효화 표현식(문자열 그대로 찾는다). */
  readonly invalidation: string;
  /**
   * 무효화를 **그 뮤테이션 구간 안에서 직접** 하지 않고 헬퍼를 거치는 경우 그 헬퍼 이름.
   *
   * ⚠️ 라운드 83 리뷰 M-5 — 이 칸이 없던 동안 ⓒ 계약은 **파일 단위**로 물었다: 무효화 문자열이
   * 그 파일 어딘가에만 있으면 초록이라, 형제 뮤테이션이 그것을 쓰고 이 뮤테이션은 쓰지 않아도
   * 아무것도 빨개지지 않았다(app/settings/children.tsx는 세 뮤테이션이 같은 헬퍼를 부르므로
   * 정확히 그 모양이었다). 이제 검사는 `const <mutation> = useMutation(`부터 다음 useMutation
   * 선언까지를 **잘라** 그 구간에서만 찾고, `via`가 있으면 ① 구간이 그 헬퍼를 부르는지 ②
   * 헬퍼 정의가 실제 무효화를 담고 있는지를 **2단계**로 확인한다.
   */
  readonly via?: string;
  readonly why: string;
};

/**
 * ⓒ 무효화 대장 — `["children"]`을 바꾸는 쓰기 경로 전수.
 *
 * ⚠️ **라운드 83 이전, 이 대장의 첫 줄은 빨간 줄이었다** — 온보딩의 아이 생성만 성공 뒤 아무것도
 * 무효화하지 않았고, 전역 30초 기본이 그 구멍을 덮고 있었다(그래서 아무도 증상을 보지 못했다).
 * 그 한 줄을 먼저 채운 뒤에야 위 `["children"]` 정책을 5분으로 올릴 수 있었다.
 */
export const CHILDREN_WRITE_LEDGER: readonly ChildrenWritePath[] = [
  {
    writeSite: "src/onboarding/child-create.ts",
    mutation: "save",
    apis: ["createChild", "updateChild"],
    invalidatedIn: "app/(onboarding)/child-profile.tsx",
    invalidation: 'queryClient.invalidateQueries({ queryKey: ["children"] })',
    why:
      "온보딩이 이 계정의 첫 아이를 만든다. 화면 자신은 [children]을 읽지 않아 무효화가 없어도 " +
      "온보딩 안에서는 증상이 없었지만, 그 다음에 서는 탭 다섯이 전부 이 키를 읽는다."
  },
  {
    writeSite: "app/settings/children.tsx",
    mutation: "addChild",
    apis: ["createChild"],
    invalidatedIn: "app/settings/children.tsx",
    invalidation: 'await queryClient.invalidateQueries({ queryKey: ["children"] });',
    via: "invalidateChildScopedQueries",
    why: "둘째 이상 추가. 목록 + 아이 스코프 캐시 전부(invalidateChildScopedQueries)."
  },
  {
    writeSite: "app/settings/children.tsx",
    mutation: "saveEdit",
    apis: ["updateChild"],
    invalidatedIn: "app/settings/children.tsx",
    invalidation: 'await queryClient.invalidateQueries({ queryKey: ["children"] });',
    via: "invalidateChildScopedQueries",
    why: "예정일/생년월일 수정이 서버 계산 단계를 옮긴다 — 목록의 내용이 바뀐다."
  },
  {
    writeSite: "app/settings/children.tsx",
    mutation: "markChildBorn",
    apis: ["updateChild"],
    invalidatedIn: "app/settings/children.tsx",
    invalidation: 'await queryClient.invalidateQueries({ queryKey: ["children"] });',
    via: "invalidateChildScopedQueries",
    why: "CHILD-127 임신 → 출생 전환. 되돌릴 수 없고 목록의 stageMode가 바뀐다."
  },
  {
    writeSite: "app/settings/privacy.tsx",
    mutation: "childDelete",
    apis: ["confirmChildProfileDeletion"],
    invalidatedIn: "app/settings/privacy.tsx",
    invalidation: "CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))",
    via: "finishChildRemoval",
    why: "아이 프로필 삭제 — 목록에서 한 명이 사라진다(R19-C의 공통 뒤처리 finishChildRemoval)."
  },
  {
    writeSite: "app/settings/privacy.tsx",
    mutation: "householdLeave",
    apis: ["confirmHouseholdLeave"],
    invalidatedIn: "app/settings/privacy.tsx",
    invalidation: "CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))",
    via: "finishChildRemoval",
    why: "가구 탈퇴 — 그 가구의 아이 전부가 목록에서 사라진다(같은 뒤처리)."
  },
  {
    writeSite: "app/family/accept/[token].tsx",
    mutation: "accept",
    apis: ["acceptInvite"],
    invalidatedIn: "app/family/accept/[token].tsx",
    invalidation: "HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))",
    why: "FAM-121A 초대 수락 — 새 가구의 아이가 목록에 들어온다."
  }
];

/* ===========================================================================================
 * 라운드 84 트랙 D(GAP-084 #4) — **무효화 대장의 모집단을 공유 키 전수로 넓히고, 지출 한 건을
 * 바꾸는 다섯 경로의 무효화 집합을 대장으로 만든다.**
 *
 * ## 무엇이 문제였나
 *
 * 라운드 83이 세운 위의 대장은 **키 하나(`["children"]`)** 만 센다. 공유 키는 다섯인데
 * 나머지 넷에는 "이 키를 바꾸는 쓰기가 무엇이고 그것이 무효화하는가"를 묻는 자리가 없었다.
 * 그 사각에서 오늘 실제로 갈려 있는 것이 **지출**이다 — 지출 한 건을 바꾸는 경로 다섯의
 * 무효화 키 집합이 서로 다르고, **셋은 `["home"]`을 무효화하지 않는다**(상세 수정 · 상세 삭제 ·
 * 기록 탭 행 삭제).
 *
 * ## ⚠️⚠️ 그런데 그 셋에 `["home"]`을 더하는 것이 고침이 아니다
 *
 * 이 앱의 지출 쓰기는 전부 **로컬 우선**이다(`createExpenseOffline` · `updateExpenseOffline` ·
 * `deleteExpenseOffline`은 SQLite에 먼저 적고 flush를 fire-and-forget으로 띄운다). 즉 화면의
 * `onSuccess`가 도는 시점에 **서버는 아직 이 변경을 모른다.** 그 시점에 `["home", childId]`
 * (누적 총액 · 최근 기록 · 추천)를 무효화하면 **서버의 옛 값을 다시 받아온다** — 화면이 방금
 * 적은 기록을 잃는 방향이다. 확정 시점의 무효화는 이미 제자리에 있다:
 * `src/offline/sync-controller.ts`의 `attemptFlush`가 `summary.synced > 0` 갈래에서
 * `["expenses"]`와 `["home"]`을 함께 무효화한다.
 *
 * **그러니까 오늘의 정합은 "화면이 잘 무효화해서"가 아니라 "flush가 뒤에서 덮어서" 성립한다.**
 * 같은 사실이 `["items"]`에 대해서는 그 파일에 값으로 적혀 있는데(FIX-119B/F1 주석 —
 * *"준비템 무효화의 실제 시점은 여기다"*), `["home"]`에 대해서는 그 문장이 어디에도 없었다.
 *
 * 그래서 이 트랙은 **배선을 만들지 않는다**: 무효화를 한 줄도 더하지 않고, 한 줄도 지우지
 * 않는다(`app/**`·`src/offline/**` 0건). 만드는 것은 **그 의존을 아는 자리**다. 다음 라운드가
 * *"요청 수를 줄이자"* 며 `attemptFlush`의 `["home"]`을 조건부로 만들면 — 그 파일에는 이미
 * *"어떤 mutation이 연결 지출이었는지 FlushSummary가 알지 못하므로 조건 없이 무효화한다"* 는
 * 문단이 있다, 즉 조건을 붙이고 싶어질 자리라는 뜻이다 — 아래 대장이 빨개진다.
 *
 * ## 이 대장들이 세는 것과 세지 않는 것
 *
 * 스윕은 **리터럴**만 센다: 쿼리 선언은 `queryKey: ["…"`(위 정책 대장과 같은 규칙),
 * 무효화 자리는 `invalidateQueries({ queryKey: ["…"`. 상수를 거치는 무효화
 * (`CHILD_SCOPED_QUERY_KEY_PREFIXES` · `CHILD_REMOVAL_INVALIDATE_KEYS` ·
 * `HOUSEHOLD_JOIN_INVALIDATE_KEYS`)는 그 스윕에 잡히지 않으므로 **쓰기 줄이 표현식 그대로**
 * 들고 있고, 테스트가 그 상수의 실제 값으로 확인한다. 리터럴이 아닌 `queryKey` 선언은
 * `NON_LITERAL_QUERY_KEY_SITES`가 이름과 이유로 센다.
 * =========================================================================================== */

/** 공유 키 한 줄이 세는 쓰기 경로 하나. */
export type SharedKeyWrite = {
  /** 쓰기 API를 실제로 부르는 소스(저장소 루트 기준 상대경로). */
  readonly writeSite: string;
  /** 그 소스 안에서 이 쓰기를 담은 이름 — 대장이 낡으면 이 이름이 먼저 사라진다. */
  readonly mutation: string;
  /** 그 이름의 구간을 자르는 시작 표시(소스에 그대로 실재해야 한다). */
  readonly sliceStart: string;
  /** 그 구간의 끝 표시 = 다음 구간의 첫 줄(파일 단위 검사가 되지 않게 자른다 — 라운드 83 M-5). */
  readonly sliceEnd: string;
  /** 성공 뒤 무효화가 적힌 소스. `null`이면 **무효화 0건**이고 `why`가 그 이유를 진다. */
  readonly invalidatedIn: string | null;
  /** 그 구간에 실재해야 하는 무효화 표현식(문자열 그대로 찾는다). `invalidatedIn`이 null이면 null. */
  readonly invalidation: string | null;
  /**
   * 무효화를 그 구간 안에서 **직접** 하지 않고 헬퍼를 거치는 경우 그 헬퍼 이름
   * (라운드 83 M-5와 같은 2단계 검사: ① 구간이 그 헬퍼를 부르는가 ② 헬퍼 정의가 무효화를 담는가).
   */
  readonly via?: string;
  readonly why: string;
};

/** ⓐ 무효화 대장의 한 줄 = **공유 키 하나**. 모집단은 정책 대장과 같은 스윕이 센다. */
export type SharedKeyCoverage = {
  readonly queryKeyPrefix: readonly string[];
  /**
   * ① **앱 안 쓰기 경로 0건.** true면 `writeApis`·`writes`·`detailLedger`가 모두 비어야 하고,
   * 이 키를 무효화하는 자리는 전부 `otherInvalidationSites`(= 쓰기 뒤처리가 아닌 자리)여야 한다.
   */
  readonly hasNoAppWrites: boolean;
  /** ② 이 키의 내용을 바꾸는 API 이름 전수. 테스트가 호출부를 스윕해 `writes`와 두 방향으로 맞춘다. */
  readonly writeApis: readonly string[];
  /** ② 그 호출부 전수 + 각 경로의 무효화 자리. */
  readonly writes: readonly SharedKeyWrite[];
  /**
   * ② 경로별 세부를 **다른 대장**이 세는 경우 그 대장 이름 — 이 키의 두 번째 모집단이다.
   * (`["children"]`은 `CHILDREN_WRITE_LEDGER`, `["expenses"]`·`["budget"]`은 `EXPENSE_WRITE_LEDGER`.)
   */
  readonly detailLedger: string | null;
  /** 쓰기 뒤처리가 **아닌** 무효화 자리(당김 새로고침 · 다른 키의 쓰기가 곁들여 지우는 자리)와 그 이유. */
  readonly otherInvalidationSites: readonly { readonly file: string; readonly why: string }[];
  readonly why: string;
};

/**
 * ⓐ **공유 키 전수의 무효화 대장.** 줄 = 위 `SHARED_CACHE_POLICIES`의 키 전수이고, 그 전수는
 * 테스트가 저장소를 훑어 스스로 센다(수를 손으로 적지 않는다).
 *
 * 라운드 83까지 이 자리에 있던 것은 `["children"]` 한 줄뿐이었다(known-limitations X-3이 남긴
 * 질문 — *"공유 키 중 무효화 대장을 갖지 않은 것은?"* 의 오늘 답은 **다섯 중 넷**이었다).
 */
export const SHARED_KEY_COVERAGE: readonly SharedKeyCoverage[] = [
  {
    queryKeyPrefix: ["categories"],
    hasNoAppWrites: true,
    writeApis: [],
    writes: [],
    detailLedger: null,
    otherInvalidationSites: [
      {
        file: "app/(tabs)/index.tsx",
        why:
          "홈의 당김 새로고침 — 사용자가 명시적으로 요청한 재조회이지 쓰기 뒤처리가 아니다. " +
          "이 자리가 무효화 대장을 필요로 하는 종류의 자리라면 아래 writes에 있어야 한다."
      }
    ],
    why:
      "서버가 시드하는 마스터 목록이고, 카테고리를 만들거나 고치거나 지우는 화면이 앱 안에 " +
      "0건이다 — 무효화할 쓰기 자체가 없다. 위 정책 줄이 이 키만 조건 없이 5분으로 둘 수 있는 " +
      "근거가 바로 이 0건이고, 그래서 그 0건을 **값으로** 적어 둔다: 언젠가 카테고리 편집이 " +
      "생기면 그 화면의 무효화가 아래 otherInvalidationSites에 이유 없이 나타나 빨개진다."
  },
  {
    queryKeyPrefix: ["children"],
    hasNoAppWrites: false,
    writeApis: [],
    writes: [],
    detailLedger: "CHILDREN_WRITE_LEDGER",
    otherInvalidationSites: [
      { file: "app/(tabs)/index.tsx", why: "홈의 당김 새로고침(쓰기 뒤처리가 아니다)." },
      { file: "app/(tabs)/items.tsx", why: "준비템 탭의 당김 새로고침." },
      { file: "app/(tabs)/reports.tsx", why: "리포트 탭의 당김 새로고침." }
    ],
    why:
      "라운드 83 D가 세운 CHILDREN_WRITE_LEDGER가 이 키의 쓰기 전수(CHILDREN_WRITE_APIS의 " +
      "호출부)와 각 경로의 무효화 자리를 이미 두 방향으로 센다 — 여기서 그 모집단을 두 벌로 " +
      "적지 않고 그 대장을 가리키기만 한다(같은 사실을 두 곳에 적으면 한쪽만 낡는다)."
  },
  {
    queryKeyPrefix: ["household-members"],
    hasNoAppWrites: false,
    writeApis: ["removeHouseholdMember", "cancelHouseholdInvite", "confirmHouseholdLeave", "acceptInvite"],
    writes: [
      {
        writeSite: "app/family/index.tsx",
        mutation: "removeMember",
        sliceStart: "const removeMember = useMutation({",
        sliceEnd: "const setHouseholdRole = useSessionStore(",
        invalidatedIn: "app/family/index.tsx",
        invalidation: 'await queryClient.invalidateQueries({ queryKey: ["household-members"] });',
        why: "구성원 삭제 — 목록에서 한 명이 사라진다."
      },
      {
        writeSite: "app/family/index.tsx",
        mutation: "cancelInvite",
        sliceStart: "const cancelInvite = useMutation({",
        sliceEnd: "const membersPhase = resolveScreenPhase({",
        invalidatedIn: "app/family/index.tsx",
        invalidation: 'await queryClient.invalidateQueries({ queryKey: ["household-members"] });',
        why:
          "초대 취소는 **구성원 목록을 바꾸지 않는다**(구성원이 되는 것은 수락이다) — 같은 화면이 " +
          "초대 목록과 구성원 목록을 나란히 그려서 함께 무효화할 뿐이다. 이 줄이 대장에 있는 " +
          "이유는 그 사실을 적어 두기 위해서다: 지워도 화면은 멀쩡하지만, 지우는 판단은 이 " +
          "문장을 읽고 하는 것이지 무효화 목록만 보고 하는 것이 아니다."
      },
      {
        writeSite: "app/settings/privacy.tsx",
        mutation: "householdLeave",
        sliceStart: "const householdLeave = useMutation({",
        sliceEnd: "const accountPreview = useMutation({",
        invalidatedIn: "app/settings/privacy.tsx",
        invalidation: 'await queryClient.invalidateQueries({ queryKey: ["household-members"] });',
        why: "가구 탈퇴 — 내가 그 목록에서 사라진다(라운드 61 #2가 세션 스토어까지 함께 정리한다)."
      },
      {
        writeSite: "app/family/accept/[token].tsx",
        mutation: "accept",
        sliceStart: "const accept = useMutation({",
        sliceEnd: "const inviteUnavailable = ",
        invalidatedIn: "app/family/accept/[token].tsx",
        invalidation: "HOUSEHOLD_JOIN_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))",
        via: "finishHouseholdJoin",
        why:
          "FAM-121A 초대 수락 — 내가 새 가구의 구성원이 된다. 무효화는 뮤테이션 구간이 아니라 " +
          "수락 뒤처리 헬퍼(finishHouseholdJoin — 새 목록 조회 → 무효화 → 아이 재선택)에 있고, " +
          "리터럴이 아니라 키 집합 상수를 거친다(스윕에 잡히지 않는다). 그래서 두 겹으로 " +
          '확인한다: 헬퍼 정의가 그 표현식을 담는가 · 그 상수의 **실제 값**에 ["household-members"]가 있는가.'
      }
    ],
    detailLedger: null,
    otherInvalidationSites: [],
    why:
      "쓰기 넷이 전부 무효화한다 — **값 0건**(고칠 것이 없다는 사실 자체가 이 줄의 값이다). " +
      "이 키가 전역 30초를 그대로 두는 이유는 무효화의 구멍이 아니라 **다른 기기**다(위 정책 " +
      "줄의 why — 소유자가 내 역할을 바꾸는 것은 이 기기의 쓰기가 아니다)."
  },
  {
    queryKeyPrefix: ["expenses"],
    hasNoAppWrites: false,
    writeApis: ["confirmImport", "undoImport"],
    writes: [
      {
        writeSite: "app/import/[importJobId].tsx",
        mutation: "confirm",
        sliceStart: "const confirm = useMutation({",
        sliceEnd: "const toggleFailureOnline = useErrorTimeConnectivity(",
        invalidatedIn: "app/import/[importJobId].tsx",
        invalidation: 'await queryClient.invalidateQueries({ queryKey: ["expenses"] });',
        why:
          "가져오기 확정 — 지출을 **묶음으로** 만든다(서버가 한 번에 넣는다). 로컬 우선 경로가 " +
          "아니라 서버 쓰기가 끝난 뒤 onSuccess가 돌므로, 아래 다섯 경로와 달리 이 시점의 " +
          "무효화는 새 값을 받아온다 — 그래서 이 자리는 [\"home\"]도 함께 무효화한다."
      },
      {
        writeSite: "app/import/index.tsx",
        mutation: "undo",
        sliceStart: "const undo = useMutation({",
        sliceEnd: "const confirmUndo = ",
        invalidatedIn: "app/import/index.tsx",
        invalidation: 'await queryClient.invalidateQueries({ queryKey: ["expenses"] });',
        why:
          "라운드 67 #3 되돌리기 — 확정의 반대 방향이고 무효화 목록도 확정과 같은 넷이다. " +
          "확정과 같은 이유로 서버 확정 뒤에 도는 무효화다."
      }
    ],
    detailLedger: "EXPENSE_WRITE_LEDGER",
    otherInvalidationSites: [
      { file: "app/(tabs)/index.tsx", why: "홈의 당김 새로고침(쓰기 뒤처리가 아니다)." }
    ],
    why:
      "⚠️ 이 키의 쓰기는 **두 모집단**이다: 지출 한 건을 바꾸는 다섯 경로(EXPENSE_WRITE_LEDGER — " +
      "전부 로컬 우선이라 무효화 시점이 서버보다 앞선다)와, 여기 적힌 가져오기 묶음 둘(서버 " +
      "확정 뒤에 돈다). 둘을 한 줄에 섞지 않는 이유는 **무효화 시점의 성질이 반대**이기 " +
      "때문이다 — 묶음 쪽은 즉시 무효화가 옳고, 단건 쪽은 즉시 무효화가 옛 값을 불러온다."
  },
  {
    queryKeyPrefix: ["budget"],
    hasNoAppWrites: false,
    writeApis: ["upsertBudget"],
    writes: [
      {
        writeSite: "app/budget.tsx",
        mutation: "save",
        sliceStart: "const save = useMutation({",
        sliceEnd: "const canSave = ",
        invalidatedIn: "app/budget.tsx",
        invalidation: '[["budget"], ["home"], ["report"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))',
        why:
          "예산 저장(BUD-001) — 무효화가 리터럴 세 줄이 아니라 배열 map이라 스윕에는 잡히지 " +
          "않는다. 그래서 표현식을 그대로 들고 있다. 지출 목록을 건드리지 않는 것이 이 자리의 " +
          "**의도**다(예산을 바꿔도 지출은 한 건도 달라지지 않는다 — 그 문장이 그 파일에 있다)."
      },
      {
        writeSite: "app/(onboarding)/budget.tsx",
        mutation: "save",
        sliceStart: "const save = useMutation({",
        sliceEnd: "function skip() {",
        invalidatedIn: null,
        invalidation: null,
        why:
          "⚠️ **무효화 0건이고 그것이 오늘은 맞다** — 온보딩 마지막 단계(ONB-004)라 이 성공 " +
          "분기에서 markHomeReached()가 **처음** 서고 그 다음에 탭이 마운트된다. 즉 이 시점에 " +
          "[\"budget\", childId, yearMonth] 캐시 항목이 아직 없어 무효화할 대상이 0건이다. " +
          "재개 조건: 온보딩을 마친 계정이 이 화면에 다시 설 수 있게 되면(또는 이 화면 앞에 " +
          "홈이 서게 되면) 그 전제가 깨지고 이 줄은 무효화를 요구하는 줄이 된다."
      }
    ],
    detailLedger: "EXPENSE_WRITE_LEDGER",
    otherInvalidationSites: [
      { file: "app/(tabs)/index.tsx", why: "홈의 당김 새로고침(쓰기 뒤처리가 아니다)." },
      {
        file: "app/import/[importJobId].tsx",
        why: "가져오기 확정이 지출을 묶음으로 더한다 — 예산 응답의 usedAmountKrw가 그만큼 달라진다."
      },
      { file: "app/import/index.tsx", why: "가져오기 되돌리기 — 같은 이유로 usedAmountKrw가 줄어든다." }
    ],
    why:
      "⚠️ 이 키를 바꾸는 것은 **예산 저장만이 아니다**: 응답의 usedAmountKrw는 지출이 늘고 줄 " +
      "때마다 달라지므로 지출 쓰기 전부가 이 키의 쓰기 경로이기도 하다(detailLedger). 위 정책 " +
      "줄이 이 키를 전역 30초로 두는 이유도 그것이다 — 낡은 예산 사용액은 곧 틀린 숫자다."
  }
];

/**
 * ⓑ 지출 한 건을 바꾸는 경로의 쓰기 API 전수. 이 이름들의 호출부가 곧 아래 대장의 모집단이다
 * (테스트가 app/** 를 훑어 스스로 찾는다 — 자리 수를 손으로 적지 않는다).
 *
 * 셋 다 `src/offline/sync-controller.ts`가 정의하는 **로컬 우선** 쓰기다: SQLite에 먼저 적고
 * outbox flush를 fire-and-forget으로 띄운다. 그 사실이 아래 divergence 이유의 전부다.
 */
export const EXPENSE_WRITE_APIS: readonly string[] = [
  "createExpenseOffline",
  "updateExpenseOffline",
  "deleteExpenseOffline"
];

/**
 * 위 모집단에서 **일부러 뺀** 이름과 그 이유(숨기지 않고 값으로 남긴다).
 *
 * 가져오기 확정·되돌리기도 지출을 만들고 지우지만 **한 건을 바꾸는 경로가 아니고**, 무엇보다
 * 로컬 우선이 아니라 서버 확정 뒤에 도는 무효화다(성질이 반대다). 그 둘은
 * `SHARED_KEY_COVERAGE`의 `["expenses"]` 줄이 센다.
 */
export const EXPENSE_WRITE_APIS_EXCLUDED: readonly { readonly api: string; readonly why: string }[] = [
  { api: "confirmImport", why: "가져오기 확정 — 서버가 묶음으로 넣는다(SHARED_KEY_COVERAGE의 [\"expenses\"] 줄)" },
  { api: "undoImport", why: "가져오기 되돌리기 — 같은 묶음 경로의 반대 방향" }
];

/** ⓒ 무효화 집합이 갈리는 자리 한 줄. 이유가 비어 있을 수 없고, 그 이유의 참이 소스로 확인된다. */
export type ExpenseWriteDivergence = {
  /** 갈리는 키의 첫 칸. */
  readonly keyHead: string;
  /** `missing` = 확정 시점 집합에 있는데 이 경로에 없다 · `extra` = 이 경로에만 있다. */
  readonly direction: "missing" | "extra";
  /**
   * ⚠️ 이 이유가 **기대는 사실의 이름**. 테스트가 이름마다 검증기를 돌린다(이름이 없으면 빨강):
   *   - `flush-confirm` — `sync-controller.ts`의 `summary.synced > 0` 갈래가 그 키를 무효화한다;
   *   - `single-file-key` — 그 키를 켜는 파일이 이 경로 자신 하나뿐이다(공유 키가 아니다).
   */
  readonly provenBy: "flush-confirm" | "single-file-key";
  readonly why: string;
};

/** ⓑ 지출 쓰기 대장의 한 줄. */
export type ExpenseWritePath = {
  /** 사람이 읽는 이름(정찰 표의 그 이름). */
  readonly label: string;
  /** 쓰기와 무효화가 함께 있는 소스(저장소 루트 기준 상대경로). */
  readonly writeSite: string;
  /**
   * `screen` = 화면의 뮤테이션(쓰기 API 호출부 스윕이 세는 자리) ·
   * `flush` = 서버 확정 시점(그 파일은 쓰기 API를 **정의**하는 자리라 호출부 스윕에 잡히지 않는다).
   */
  readonly kind: "screen" | "flush";
  /** 그 소스 안에서 이 무효화를 담은 이름 — 대장이 낡으면 이 이름이 먼저 사라진다. */
  readonly mutation: string;
  /** 구간을 자르는 시작 표시(소스에 그대로 실재해야 한다). */
  readonly sliceStart: string;
  /** 구간의 끝 표시 = 다음 구간의 첫 줄. 파일 단위 검사가 되지 않게 자른다(라운드 83 M-5). */
  readonly sliceEnd: string;
  /**
   * ⚠️ 그 구간이 무효화하는 키의 첫 칸 **전수**. 테스트가 소스에서 세어 이 배열과 정확히 같은지
   * 본다(두 방향) — 무효화가 늘거나 줄면 여기가 먼저 빨개진다.
   */
  readonly invalidatedKeyHeads: readonly string[];
  /** 확정 시점 집합(아래 `EXPENSE_CONFIRM_BASELINE`)과 갈리는 자리 전수. 빈 배열 = 갈림 0건. */
  readonly divergences: readonly ExpenseWriteDivergence[];
  readonly why: string;
};

/**
 * ⓑ **지출 쓰기 대장 — 지출 한 건을 바꾸는 경로 다섯과 각자의 무효화 키 집합.**
 *
 * 비교의 기준선은 **확정 시점의 집합**이다(`flush` 줄 = `attemptFlush`의 `summary.synced > 0`
 * 갈래). 그 갈래가 기준선인 이유: 서버가 이 변경을 실제로 받은 뒤에 도는 유일한 무효화라,
 * "낡을 수 있는 캐시 전수"를 가장 정직하게 적어 둔 자리이기 때문이다.
 */
export const EXPENSE_WRITE_LEDGER: readonly ExpenseWritePath[] = [
  {
    label: "빠른 기록(새 지출)",
    writeSite: "app/expenses/new.tsx",
    kind: "screen",
    mutation: "saveExpense",
    sliceStart: "const saveExpense = useMutation({",
    sliceEnd: "const isPixelLockAmountCapture",
    invalidatedKeyHeads: ["expenses", "home", "report", "budget", "items", "item-detail"],
    divergences: [],
    why:
      "확정 시점 집합과 **같다**. 단, [\"items\"]·[\"item-detail\"] 두 줄은 " +
      "`if (linkedItemTemplateId)` 안에 있어 연결 기록에서만 돈다(그 파일의 FIX-119B/F1 주석이 " +
      "이유를 적어 두었다 — 실서버에서 실제로 듣는 것은 flush 쪽 무효화이고, 이 자리는 동기 " +
      "인메모리 백엔드를 쓰는 데모/로컬 세션 때문에 남아 있다). 이 대장은 **구간에 적힌 것**을 " +
      "세므로 그 조건 분기는 집합에 함께 들어온다 — 조건이 사라지거나 붙어도 집합은 그대로다."
  },
  {
    label: "상세 수정",
    writeSite: "app/expenses/[expenseId].tsx",
    kind: "screen",
    mutation: "save",
    sliceStart: "const save = useMutation({",
    sliceEnd: "const remove = useMutation({",
    invalidatedKeyHeads: ["expenses", "expense", "report", "budget"],
    divergences: [
      {
        keyHead: "home",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "⚠️ **오늘 이것이 다치지 않는 이유는 이 화면에 있지 않다.** updateExpenseOffline은 " +
          "로컬 우선이라 이 onSuccess는 서버가 아직 옛 금액을 들고 있는 시점에 돈다 — 여기서 " +
          "[\"home\", childId](누적 총액·최근 기록·추천)를 무효화하면 **그 옛 값을 다시 받아온다**. " +
          "확정 시점의 무효화는 sync-controller.ts attemptFlush의 summary.synced > 0 갈래가 하고 " +
          "(이 쓰기는 곧바로 void flushInBackground(...)를 건다), 그 사실이 이 줄의 provenBy로 " +
          "검증된다. ⚠️ 그 갈래의 [\"home\"]이 조건부가 되는 날 이 화면의 홈은 옛 값을 든다."
      },
      {
        keyHead: "items",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "서버가 준비템을 '준비 완료'로 올리는 전이(store-shared.ts markLinkedItemPrepared)는 " +
          "연결 지출 **생성**에만 붙는다 — 수정은 그 전이를 일으키지 않는다. flush는 어떤 " +
          "mutation이었는지 모르므로 조건 없이 덮는다(그 파일의 FIX-119B/F1 문단)."
      },
      {
        keyHead: "item-detail",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "위 [\"items\"]와 같은 이유 — 준비템 **상세**도 서버의 준비 완료 전이에만 걸리고, " +
          "그 전이는 연결 지출 생성에만 붙는다. 확정 시점에는 flush가 조건 없이 함께 덮는다."
      },
      {
        keyHead: "expense",
        direction: "extra",
        provenBy: "single-file-key",
        why:
          "[\"expense\", expenseId]는 **이 화면 자신이 여는 단건 캐시**다. 저장 뒤 사용자가 이 " +
          "화면에 남아 바뀐 값을 다시 보므로 여기서만 필요하다 — 삭제 두 경로는 그 화면을 " +
          "떠나고, flush는 어느 화면이 떠 있는지 모른다. 그 키를 켜는 파일이 이 파일 하나뿐이라 " +
          "공유 키도 아니다(정책 대장의 모집단 밖 — provenBy가 그 사실을 스윕으로 확인한다)."
      }
    ],
    why: "GAP-054/GAP-062의 그 화면. 금액·분류·날짜가 달라지면 서버 집계와 예산 사용액이 함께 달라진다."
  },
  {
    label: "상세 삭제",
    writeSite: "app/expenses/[expenseId].tsx",
    kind: "screen",
    mutation: "remove",
    sliceStart: "const remove = useMutation({",
    sliceEnd: "function confirmDelete() {",
    invalidatedKeyHeads: ["expenses", "report", "budget"],
    divergences: [
      {
        keyHead: "home",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "deleteExpenseOffline도 로컬 우선이다 — 서버는 아직 그 행을 들고 있으므로 지금 " +
          "[\"home\"]을 무효화하면 지운 금액이 그대로 든 옛 값을 받아온다. 홈·기록 탭은 " +
          "대기 중인 삭제를 재조정으로 이미 가린다(src/offline/expense-list-reconciliation.ts). " +
          "확정 시점의 무효화는 flush가 한다."
      },
      {
        keyHead: "items",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "삭제는 준비템 전이를 일으키지 않는다(수정 줄과 같은 이유 — markLinkedItemPrepared는 " +
          "연결 지출 **생성**에만 붙는다). 확정 시점에는 flush가 조건 없이 함께 덮는다."
      },
      {
        keyHead: "item-detail",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "준비템 상세도 같은 전이에만 걸린다 — 지출을 지워도 서버가 그 준비템을 되돌리지 " +
          "않으므로 이 화면이 지금 무효화할 이유가 없다. 확정 시점의 덮기는 flush에 있다."
      }
    ],
    why: "확인 Alert에서 이어지는 삭제. 지운 금액만큼 리포트 집계와 예산 사용액이 줄어든다."
  },
  {
    label: "기록 탭 행 삭제",
    writeSite: "app/(tabs)/records.tsx",
    kind: "screen",
    mutation: "removeExpense",
    sliceStart: "const removeExpense = useMutation({",
    sliceEnd: "const removeExpenseMutate",
    invalidatedKeyHeads: ["expenses", "report", "budget"],
    divergences: [
      {
        keyHead: "home",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "상세 삭제와 **완전히 같은 경로**를 탄다(그 파일의 UX-L(A) 주석 — adoptServerExpense 뒤 " +
          "deleteExpenseOffline). 그래서 이유도 같다: 로컬 우선이라 지금의 무효화는 옛 값을 " +
          "받아오고, 확정 시점은 flush다."
      },
      {
        keyHead: "items",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "상세 삭제와 같은 경로이므로 이유도 같다 — 삭제는 서버의 준비 완료 전이를 일으키지 " +
          "않고, 확정 시점에는 flush가 조건 없이 준비템 목록을 함께 덮는다."
      },
      {
        keyHead: "item-detail",
        direction: "missing",
        provenBy: "flush-confirm",
        why:
          "준비템 상세도 같다 — 이 목록 화면은 그 캐시를 열지도 않는다. 확정 시점의 덮기는 " +
          "flush의 같은 갈래에 있다(그 갈래가 조건부가 되면 이 이유도 함께 무너진다)."
      }
    ],
    why:
      "UX-L(A) 행 액션시트의 삭제 — 상세 화면과 같은 삭제를 목록에서 실행한다. 상세 수정과 달리 " +
      "[\"expense\"]가 없는 것은 이 화면이 단건 캐시를 열지 않기 때문이다(갈림이 아니라 없음)."
  },
  {
    label: "flush 확정(서버가 받은 시점)",
    writeSite: "src/offline/sync-controller.ts",
    kind: "flush",
    mutation: "attemptFlush",
    sliceStart: "if (summary.synced > 0) {",
    sliceEnd: "if (summary.itemStatusSynced > 0) {",
    invalidatedKeyHeads: ["expenses", "home", "items", "item-detail", "report", "budget"],
    divergences: [],
    why:
      "⚠️ **기준선이자, 위 세 경로가 실제로 기대고 있는 자리.** 로컬 우선 쓰기 셋은 전부 성공 " +
      "직후 void flushInBackground(...)를 걸고, 서버가 그 변경을 받은 뒤 이 갈래가 홈까지 함께 " +
      "무효화한다. 이 트랙은 이 파일을 **한 글자도 건드리지 않는다** — 여기서 하는 일은 위 " +
      "경로들의 이유가 이 갈래의 내용에 걸려 있다는 사실을 대장으로 남기는 것뿐이다."
  }
];

/**
 * ⓔ **리터럴이 아닌 `queryKey` 선언 전수와 그 이유.**
 *
 * 정책 대장의 스윕은 `queryKey: ["…"` 리터럴만 센다. 키를 상수로 뽑아 쓰는 자리는 그 스윕의
 * **사각**이라 — 오늘은 둘 다 단일 파일 키여서 값이 0건이지만 — 공유 키가 상수로 선언되는 날
 * 그 키는 모집단에 들어오지 못한다. 그래서 이름과 이유로 여기 등재하고, 테스트가 ① 그 자리
 * 전수가 이 표와 같은지 ② 각 키가 정말 단일 파일인지를 스윕으로 확인한다.
 */
export const NON_LITERAL_QUERY_KEY_SITES: readonly {
  readonly file: string;
  readonly constantName: string;
  readonly declaration: string;
  readonly keyHead: string;
  readonly why: string;
}[] = [
  {
    file: "app/settings/notifications.tsx",
    constantName: "deviceListQueryKey",
    declaration: 'const deviceListQueryKey = ["my-devices"] as const;',
    keyHead: "my-devices",
    why:
      "같은 화면이 조회와 무효화 셋에서 같은 키를 쓰므로 상수로 뽑았다. 그 키를 켜는 파일이 " +
      "이 파일 하나뿐이라 공유 키가 아니고, 따라서 정책 대장의 모집단 밖이다 — 값 0건."
  },
  {
    file: "app/import/[importJobId].tsx",
    constantName: "rowsQueryKey",
    declaration: 'const rowsQueryKey = useMemo(() => ["import-rows", importJobId] as const, [importJobId]);',
    keyHead: "import-rows",
    why:
      "낙관적 갱신(setQueryData·cancelQueries)이 같은 키를 여러 번 쓰므로 useMemo 상수다. " +
      "역시 이 파일 하나뿐이라 공유 키가 아니다 — 값 0건."
  }
];
