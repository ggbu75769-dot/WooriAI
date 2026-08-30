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
 *   - 화면이 인라인으로 적어 둔 `staleTime`은 여전히 이긴다. 다만 오늘 그 값들은 전부 키
 *     기본과 **같은 값**이라 편집이 0건이고, 앞으로 달라지면 아래 ⓑ 대장이 빨개진다.
 *
 * ## 순서가 성패였다 — 무효화가 정책보다 먼저
 *
 * `["children"]`을 길게 두는 일은 **그 키를 바꾸는 쓰기 경로 전부가 스스로 무효화할 때만**
 * 안전하다. 오늘 소스에서 그 전제가 한 자리 깨져 있었다(온보딩의 아이 생성 — 무효화 0건).
 * 30초 기본이 그 구멍을 덮고 있었을 뿐이고, 5분으로 늘리면 같은 구멍이 열 배로 보인다.
 * 그래서 이 트랙은 무효화 한 줄을 **먼저** 넣고(app/(onboarding)/child-profile.tsx) 그 다음에
 * 이 표를 세웠다. 대장은 `CHILDREN_WRITE_LEDGER`에 있고 두 방향으로 검사된다.
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
  /** `setQueryDefaults`가 부분 일치로 잡는 키 접두사. `["household-members"]`는 `[key, id]`도 잡는다. */
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
      "아이 목록은 거의 바뀌지 않고, 바뀌는 자리는 전부 앱 안의 쓰기다 — 그 전수가 성공 뒤 명시 " +
      "무효화를 갖는다(CHILDREN_WRITE_LEDGER). 계정 전환·로그아웃은 teardown이 캐시를 통째로 " +
      "비우므로(FIX-118A) 이 값이 이전 계정의 목록을 늘려 잡을 수 없다. 열넷 중 하나만 5분이던 " +
      "두 벌을 한 벌로 만든다."
  },
  {
    queryKeyPrefix: ["household-members"],
    staleTimeMs: LONG_SHARED_STALE_TIME_MS,
    why:
      "구성원은 거의 바뀌지 않고 초대 수락·구성원 관리 경로가 이미 이 키를 무효화한다 — 기록 탭이 " +
      "자기 자리에 적어 둔 그 이유(app/(tabs)/records.tsx)가 나머지 다섯 자리에도 똑같이 참이라 " +
      "키로 올린다. 접두사 한 칸이라 ['household-members', householdId] 전부에 부분 일치로 닿는다."
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
    why: "둘째 이상 추가. 목록 + 아이 스코프 캐시 전부(invalidateChildScopedQueries)."
  },
  {
    writeSite: "app/settings/children.tsx",
    mutation: "saveEdit",
    apis: ["updateChild"],
    invalidatedIn: "app/settings/children.tsx",
    invalidation: 'await queryClient.invalidateQueries({ queryKey: ["children"] });',
    why: "예정일/생년월일 수정이 서버 계산 단계를 옮긴다 — 목록의 내용이 바뀐다."
  },
  {
    writeSite: "app/settings/children.tsx",
    mutation: "markChildBorn",
    apis: ["updateChild"],
    invalidatedIn: "app/settings/children.tsx",
    invalidation: 'await queryClient.invalidateQueries({ queryKey: ["children"] });',
    why: "CHILD-127 임신 → 출생 전환. 되돌릴 수 없고 목록의 stageMode가 바뀐다."
  },
  {
    writeSite: "app/settings/privacy.tsx",
    mutation: "childDelete",
    apis: ["confirmChildProfileDeletion"],
    invalidatedIn: "app/settings/privacy.tsx",
    invalidation: "CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))",
    why: "아이 프로필 삭제 — 목록에서 한 명이 사라진다(R19-C의 공통 뒤처리 finishChildRemoval)."
  },
  {
    writeSite: "app/settings/privacy.tsx",
    mutation: "householdLeave",
    apis: ["confirmHouseholdLeave"],
    invalidatedIn: "app/settings/privacy.tsx",
    invalidation: "CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))",
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
