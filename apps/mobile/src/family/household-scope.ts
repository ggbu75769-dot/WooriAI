import { resolveExpenseHouseholdId, type ChildHouseholdRef } from "../expenses/records-list-view";

/**
 * 라운드 60 트랙 A — **쓰기·파괴·관리 화면이 다루는 가구**를 한 곳에서 정한다.
 *
 * 왜 필요한가: 읽기 경로는 라운드 27 L-4에서 "보고 있는 아이의 가구"로 고쳐졌는데
 * (src/expenses/records-list-view.ts의 `resolveExpenseHouseholdId`), 아이 추가·가족 관리·초대
 * 생성·가구 탈퇴·요약 카드는 그대로 세션의 `defaultHouseholdId`를 썼다. 그 값은 다른 가구의
 * 초대를 수락하는 순간 **영구적으로** 바뀌므로(app/family/accept/[token].tsx), 수락 이후에는
 *   - 둘째 아이가 시가 가구에 생성되고(앱 안에서 되돌릴 방법이 없다 — 다른 가족이 열람한다),
 *   - 원래 가구의 구성원 관리·초대에 도달할 방법이 사라지고,
 *   - "가구 탈퇴"가 어느 가구를 나가는 것인지 화면 어디에도 적히지 않았다.
 *
 * 규칙을 두 벌로 만들지 않는 것이 이 모듈의 첫 번째 계약이다: 아이 → 가구 판정은 위 L-4 함수에
 * **위임**하고, 여기서는 쓰기 화면에만 필요한 "아직 모를 때 어떻게 할 것인가"와 표기 규율만 더한다.
 *
 * 두 번째 계약은 **1가구 계정 불변**이다. 가구가 하나뿐인(또는 몇인지 모르는) 계정에서는 아이의
 * `householdId`가 곧 `defaultHouseholdId`이고, 아래 표기 함수는 모두 `null`을 돌려주므로 화면
 * 문자열이 종전과 한 글자도 달라지지 않는다(FAM-001 · SET-001 픽셀락 포함).
 */

/** `Child`(src/api/client.ts)에서 이 모듈이 쓰는 구조적 최소치 — 태명은 표기에만 쓴다. */
export type HouseholdScopeChildRef = ChildHouseholdRef & {
  nickname?: string | null;
  /**
   * 이 행이 속한 가구의 이름. **오늘 서버는 이 필드를 내려주지 않는다**(apps/api의
   * store-shared.ts `toChildDto`) — 그래서 optional이고, 없으면 아래 판정이 이름을 말하지 않는다.
   * 서버가 나중에 실어 주면 화면을 고치지 않아도 이름 표기가 살아난다.
   */
  householdName?: string | null;
};

/**
 * 쓰기·관리의 대상 가구, 또는 아직 정할 수 없으면 `null`.
 *
 * 판정 순서:
 *  1. 선택된 아이의 가구(= `resolveExpenseHouseholdId` 그대로 — 규칙은 그 함수 하나뿐이다);
 *  2. `["children"]` 조회가 **아직 끝나지 않았으면** `null`. 여기서 기본 가구로 메우면 다가구
 *     계정에서 잠깐 다른 가구의 구성원 목록·삭제 버튼·초대 폼이 그려진다 — 파괴적 동작이 달린
 *     화면에서 "잠깐 틀린 가구"는 라벨이 잠깐 틀리는 것과 무게가 다르다. 호출부는 이 창을
 *     스켈레톤/비활성으로 덮는다;
 *  3. 조회가 끝났는데도 아이 기준으로 좁힐 수 없으면(선택된 아이가 없다 · 아이가 0명인 첫
 *     가입 계정 · 목록에 없는 아이) 계정의 기본 가구. 그때는 그것이 우리가 아는 **유일한
 *     사실**이고, 종전 동작이기도 하다.
 */
/**
 * 라운드 60 리뷰(P2-4) — `childrenSettled`를 **한 벌로** 만든다.
 *
 * 여섯 화면이 같은 뜻을 각자 적고 있었다(`!authToken || q.isSuccess || q.isError`가 넷,
 * `q.isSuccess || q.isError`가 둘). 같은 규칙이 여섯 벌이면 한 곳만 고쳐지는 날이 오고, 그
 * 날의 증상은 "어떤 화면에서만 잠깐 다른 가구가 보인다"이다 -- 이 모듈이 존재하는 이유와
 * 정확히 같은 문제다.
 *
 * 규칙: **토큰이 없으면 기다릴 조회가 없다**(쿼리 자체가 `enabled: Boolean(authToken)`이라
 * 영원히 pending으로 남는다 — 그 상태를 "아직 모른다"로 읽으면 비로그인 화면이 스켈레톤에
 * 갇힌다). 토큰이 있으면 성공·실패 어느 쪽이든 끝난 것이다.
 */
export function isChildrenSettled(input: {
  authToken?: string | null;
  isSuccess?: boolean;
  isError?: boolean;
}): boolean {
  if (!input.authToken) return true;
  return Boolean(input.isSuccess || input.isError);
}

export function resolveManagedHouseholdId(input: {
  /** `["children"]` 캐시의 목록. 로딩 중이거나 실패했으면 undefined/null. */
  children: readonly HouseholdScopeChildRef[] | null | undefined;
  childId: string | null | undefined;
  /** 세션의 `defaultHouseholdId`(데모 세션이면 LOCAL_HOUSEHOLD_ID). */
  fallbackHouseholdId?: string | null;
  /** `["children"]` 조회가 끝났는가(성공·실패 모두 포함). 진행 중이면 false. */
  childrenSettled?: boolean;
}): string | null {
  const fallbackHouseholdId = input.fallbackHouseholdId ?? null;
  const scoped = resolveExpenseHouseholdId({
    children: input.children,
    childId: input.childId,
    fallbackHouseholdId
  });
  if (scoped) return scoped;
  if (!input.childrenSettled) return null;
  return fallbackHouseholdId;
}

/** 표기 판정이 세는 가구 목록 — 아는 사실만 모은다(중복·빈 값 제거). */
export function collectKnownHouseholdIds(input: {
  children?: readonly HouseholdScopeChildRef[] | null;
  /** 세션 스토어의 `householdIds`(서버가 로그인·수락 응답으로 말한 목록). 모르면 null. */
  knownHouseholdIds?: readonly string[] | null;
  fallbackHouseholdId?: string | null;
}): string[] {
  const ids: string[] = [];
  const push = (value: string | null | undefined) => {
    const id = value?.trim();
    if (!id || ids.includes(id)) return;
    ids.push(id);
  };
  for (const child of input.children ?? []) push(child?.householdId);
  for (const id of input.knownHouseholdIds ?? []) push(id);
  push(input.fallbackHouseholdId);
  return ids;
}

/**
 * 이 계정이 가구를 둘 이상 알고 있는가.
 *
 * 모르면 `false`다 — 그래야 판정이 서지 않는 동안 화면이 종전 그대로 남는다(아이 스코프 라벨의
 * "2명 이상일 때만" 규율과 같은 안전한 실패, src/children/child-switch.ts).
 */
export function isMultiHouseholdAccount(input: {
  children?: readonly HouseholdScopeChildRef[] | null;
  knownHouseholdIds?: readonly string[] | null;
  fallbackHouseholdId?: string | null;
}): boolean {
  return collectKnownHouseholdIds(input).length >= 2;
}

/** 캐시 행이 실제로 싣고 있는 가구 이름, 없으면 null. */
function householdNameOf(row: unknown, householdId: string): string | null {
  if (!row || typeof row !== "object") return null;
  const candidate = row as { householdId?: unknown; householdName?: unknown };
  if (candidate.householdId !== householdId) return null;
  const name = typeof candidate.householdName === "string" ? candidate.householdName.trim() : "";
  return name.length > 0 ? name : null;
}

/**
 * 가구의 **이름**, 모르면 `null` — 지어내지 않는다.
 *
 * 이름을 물어볼 수 있는 곳은 이 화면들이 이미 쓰는 두 캐시뿐이다(`["children"]`,
 * `["household-members", householdId]`). 서버는 오늘 그 두 응답 어디에도 가구 이름을 싣지
 * 않으므로(apps/api store-shared.ts의 toChildDto · households의 멤버 DTO) 실제 세션에서는 거의
 * 언제나 `null`이고, 호출부는 그때 **아무것도 적지 않는다**. 이름을 알 수 있는 경로는 초대
 * 미리보기/수락 응답의 `householdName`뿐인데(src/api/client.ts) 그건 이 화면들이 읽는 캐시가
 * 아니다 — 서버를 바꾸지 않는 한 여기서 이름을 만들어 내는 것은 허위 표시다.
 *
 * 그래서 판정은 "행이 실제로 `householdName`을 들고 있으면 그 값"이다(수기 미러 타입에 없는
 * 필드를 방어적으로 읽는 `expenseCreatedByUserId`와 같은 관례). 서버가 나중에 그 필드를 실어
 * 주면 화면은 고치지 않아도 이름을 말하기 시작한다.
 */
export function resolveHouseholdName(input: {
  householdId: string | null | undefined;
  children?: readonly unknown[] | null;
  members?: readonly unknown[] | null;
}): string | null {
  const householdId = input.householdId?.trim();
  if (!householdId) return null;
  for (const row of input.children ?? []) {
    const name = householdNameOf(row, householdId);
    if (name) return name;
  }
  for (const row of input.members ?? []) {
    const name = householdNameOf(row, householdId);
    if (name) return name;
  }
  return null;
}

/**
 * 그 가구에 있다고 **우리가 아는** 아이들의 태명(" · "로 이음), 하나도 모르면 `null`.
 *
 * 이름이 아니라 사실이다: `["children"]`은 이 계정이 접근할 수 있는 모든 가구의 아이를 내려
 * 주므로, 그중 이 가구에 속한 행만 추린 것이다. 아래 `householdScopePhrase`가 "…의 가구"라고
 * 적는 이유도 이것이 가구의 이름이 아니기 때문이다.
 */
export function resolveHouseholdChildrenLabel(input: {
  householdId: string | null | undefined;
  children: readonly HouseholdScopeChildRef[] | null | undefined;
}): string | null {
  const householdId = input.householdId?.trim();
  if (!householdId || !input.children) return null;
  const nicknames: string[] = [];
  for (const child of input.children) {
    if (child?.householdId?.trim() !== householdId) continue;
    const nickname = child.nickname?.trim();
    if (nickname) nicknames.push(nickname);
  }
  return nicknames.length > 0 ? nicknames.join(" · ") : null;
}

/** 표기 대상 가구를 무엇으로 가리킬지 — 이름(서버가 알려준 것)인지, 그 가구의 아이들인지. */
export type HouseholdScopeDescriptor = {
  kind: "name" | "children";
  text: string;
};

/**
 * 화면에 붙일 가구 식별자, 또는 붙이지 않을 때 `null`.
 *
 * "2명 이상일 때만" 규율을 가구에 그대로 적용한다(resolveChildScopeLabel): 가구가 하나뿐이거나
 * 몇인지 모르면 종전 화면 그대로 둔다 — 모든 계정에 늘 붙는 문장은 정보가 아니라 소음이고,
 * 1가구 계정의 픽셀락·문자열 계약을 깨뜨린다.
 */
export function describeHouseholdScope(input: {
  householdId: string | null | undefined;
  children: readonly HouseholdScopeChildRef[] | null | undefined;
  members?: readonly unknown[] | null;
  knownHouseholdIds?: readonly string[] | null;
  fallbackHouseholdId?: string | null;
}): HouseholdScopeDescriptor | null {
  const householdId = input.householdId?.trim();
  if (!householdId) return null;
  if (
    !isMultiHouseholdAccount({
      children: input.children,
      knownHouseholdIds: input.knownHouseholdIds,
      fallbackHouseholdId: input.fallbackHouseholdId
    })
  ) {
    return null;
  }
  return descriptorForHousehold(householdId, input.children, input.members);
}

/** 다가구 판정을 이미 통과한 뒤의 표기 판정 한 벌(이름 → 그 가구의 아이 → 가리킬 사실 없음). */
function descriptorForHousehold(
  householdId: string,
  children: readonly HouseholdScopeChildRef[] | null | undefined,
  members?: readonly unknown[] | null
): HouseholdScopeDescriptor | null {
  const name = resolveHouseholdName({ householdId, children, members });
  if (name) return { kind: "name", text: name };
  const childrenLabel = resolveHouseholdChildrenLabel({ householdId, children });
  if (childrenLabel) return { kind: "children", text: childrenLabel };
  // 이름도 모르고 그 가구의 아이도 모른다 -- 가리킬 수 있는 사실이 없으므로 아무것도 적지 않는다.
  return null;
}

/**
 * 문장에 끼워 넣는 구(句). 이름을 아는 가구는 따옴표 안의 이름으로, 그렇지 않으면 그 가구의
 * 아이들로 가리킨다.
 *
 * 조사 없이 "…의 가구"로 잇는 이유: 태명·가구 이름은 받침 유무를 알 수 없는 임의 문자열이라
 * "이/가"·"와/과"를 붙이면 "콩가 있는 가구" 같은 문장이 나온다. "의"는 어느 쪽에도 맞는다.
 */
export function householdScopePhrase(descriptor: HouseholdScopeDescriptor | null): string | null {
  if (!descriptor) return null;
  const text = descriptor.text.trim();
  if (!text) return null;
  return descriptor.kind === "name" ? `‘${text}’ 가구` : `${text}의 가구`;
}

/**
 * 라운드 60 리뷰(P1-3) — 가족 화면의 **가구 전환 입구**.
 *
 * 무엇이 없었나: 관리 대상 가구는 "보고 있는 아이의 가구"로 정해지는데(resolveManagedHouseholdId),
 * 그 규칙은 **아이가 하나도 없는 가구를 영영 가리킬 수 없다**. 초대를 수락해 기본 가구가 바뀌던
 * 종전 동작에서는 그것이 곧 원래 가구의 소실이었고, 수락 화면이 기본 가구를 더 이상 덮어쓰지
 * 않게 된 뒤에도(app/family/accept/[token].tsx) "아이가 아직 없는 새 가구"에는 도달할 길이
 * 없었다 -- 그 가구의 구성원 관리·초대·대기 초대 취소가 전부 화면 밖이다.
 *
 * 그래서 아는 가구 전부를 후보로 세운다. 후보 목록은 `collectKnownHouseholdIds`가 이미 모으는
 * 그 사실들이고(아이의 가구 · 서버가 말한 목록 · 기본 가구), **아이가 없는 가구도 목록에
 * 들어온다**(서버가 말한 목록이 그것을 안다).
 *
 * 표기는 이 모듈의 규율 그대로다: 이름을 알면 이름, 모르면 그 가구의 아이들, 둘 다 없으면
 * **이름 대신 사실**(`HOUSEHOLD_SCOPE_EMPTY_LABEL`)을 적는다 -- 아이가 없는 가구에 "○○의 가구"
 * 같은 이름을 지어내지 않는다.
 *
 * 1가구(또는 몇인지 모르는) 계정에서는 빈 배열이다 -- 호출부가 아무것도 그리지 않으므로 화면이
 * 종전과 한 노드도 달라지지 않는다(FAM-001 픽셀락 포함).
 */
export type HouseholdSwitchOption = {
  householdId: string;
  /** 화면에 그대로 적는 문자열. 지어낸 이름이 아니라 아는 사실이다. */
  label: string;
  /** 지금 이 화면이 관리하고 있는 가구인가. */
  isCurrent: boolean;
};

/** 이름도 모르고 아이도 없는 가구를 가리키는 **사실** 표기. */
export const HOUSEHOLD_SCOPE_EMPTY_LABEL = "아이가 아직 없는 가구";

/** 가족 화면의 전환 입구 라벨. */
export const HOUSEHOLD_SCOPE_SWITCH_LABEL = "다른 가구 보기";

export function listHouseholdSwitchOptions(input: {
  currentHouseholdId: string | null | undefined;
  children: readonly HouseholdScopeChildRef[] | null | undefined;
  members?: readonly unknown[] | null;
  knownHouseholdIds?: readonly string[] | null;
  fallbackHouseholdId?: string | null;
}): HouseholdSwitchOption[] {
  const ids = collectKnownHouseholdIds({
    children: input.children,
    knownHouseholdIds: input.knownHouseholdIds,
    fallbackHouseholdId: input.fallbackHouseholdId
  });
  // "2개 이상일 때만" -- 표기 규율과 같은 문턱이다(1가구 계정 불변).
  if (ids.length < 2) return [];
  const currentHouseholdId = input.currentHouseholdId?.trim() ?? null;
  return ids.map((householdId) => ({
    householdId,
    label:
      householdScopePhrase(descriptorForHousehold(householdId, input.children, input.members)) ??
      HOUSEHOLD_SCOPE_EMPTY_LABEL,
    isCurrent: householdId === currentHouseholdId
  }));
}

/** 아이 추가 폼(app/settings/children.tsx): 이 아이가 **어느 가구에** 생기는지. */
export function householdScopeAddChildNotice(phrase: string | null): string | null {
  return phrase ? `${phrase}에 추가돼요.` : null;
}

/** 가족 관리(app/family/index.tsx): 지금 화면이 **어느 가구를** 관리하고 있는지. */
export function householdScopeManageNotice(phrase: string | null): string | null {
  return phrase ? `${phrase}를 관리하고 있어요.` : null;
}

/** 초대 만들기(app/family/invite.tsx): 이 링크가 **어느 가구로** 부르는지. */
export function householdScopeInviteNotice(phrase: string | null): string | null {
  return phrase ? `${phrase}로 초대해요.` : null;
}

/**
 * 가구 탈퇴(app/settings/privacy.tsx): **어느 가구를** 나가는지.
 *
 * 되돌릴 수 없는 동작의 대상이므로 서버가 내려주는 영향 목록(preview.impact) 앞에 이 한 줄이
 * 필요하다 — 영향 문구는 서버 몫이고 가구를 특정하지 않는다.
 */
export function householdScopeLeaveNotice(phrase: string | null): string | null {
  return phrase ? `${phrase}에서 나가요.` : null;
}
