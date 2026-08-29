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

/* ------------------------------------------------- 전환 Alert의 버튼 판정 (라운드 61 #1) */

/**
 * RN Alert(Android)의 버튼 상한. Alert.js가 `buttons.slice(0, 3)`으로 **말없이 잘라내고**
 * 네이티브 AlertDialog에는 positive/negative/neutral 세 자리밖에 없다. 이 앱의 배포 대상은
 * Android다(app.json).
 *
 * 이 저장소는 이미 이 사실을 세 번 적어 두었다(src/expenses/record-row-actions.ts ·
 * src/notifications/notification-row-actions.ts · src/family/invite-flow.ts) — 관례는 "Alert
 * 버튼을 만드는 모듈이 자기 상한을 들고 그 근거를 함께 적는다"이다. 네 번째인 이 자리가
 * 정확히 그 관례를 지나친 곳이었다: 라운드 60이 신설한 "다른 가구 보기"는 버튼이
 * `1(닫기) + 가구 수`라, **3가구부터 마지막 후보가 조용히 사라졌다**(그 마지막이 대개
 * `collectKnownHouseholdIds`가 맨 뒤에 넣는 기본 가구 쪽이다).
 */
export const ANDROID_ALERT_BUTTON_LIMIT = 3;

/** 전환 Alert의 본문 — 이 전환이 무엇을 바꾸고 무엇을 바꾸지 않는지. */
export const HOUSEHOLD_SCOPE_SWITCH_MESSAGE =
  "관리할 가구를 골라 주세요. 이 화면에서만 바뀌고 아이 선택은 그대로예요.";

/** 전환 Alert의 닫기 버튼 라벨(상한에 밀리면 이 버튼부터 뺀다). */
export const HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL = "닫기";

/**
 * 후보가 상한을 넘어 **버튼만으로는 전부 누를 수 없을 때** 본문에 덧붙이는 한 줄.
 *
 * 약속하지 않는다: 지금 이 형태(Alert)로 나머지에 도달할 길은 없다. 그래서 도달 방법을
 * 지어내는 대신 사실만 말한다 — 조용히 잘려 나가던 종전과 다른 점이 정확히 이것이다.
 */
export const HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE = "가구가 많아 여기서는 일부만 고를 수 있어요.";

export type HouseholdSwitchPrompt = {
  title: string;
  message: string;
  /**
   * 후보 **전부**. 상한을 넘어도 여기서 자르지 않는다 — 자르는 일은 RN이 이미 하고 있고,
   * 이 판정이 할 일은 그 사실을 되돌려주는 것이지 잘라 낸 결과를 정답인 척 넘기는 것이
   * 아니다. 전체 목록이 필요한 호출부(후속의 전용 화면)는 이 배열을 그대로 쓴다.
   */
  options: readonly HouseholdSwitchOption[];
  /** 닫기 버튼을 넣어도 후보가 잘리지 않는가. */
  showsCloseButton: boolean;
  /** 닫기 버튼이 없을 때 바깥 탭/뒤로가기로 닫을 수 있어야 한다(Android 기본값은 false). */
  cancelable: boolean;
  /** 닫기를 빼고도 후보가 상한을 넘는가 = **Alert이라는 형태 자체가 이 계정에 맞지 않다.** */
  exceedsButtonLimit: boolean;
  /** 이 플랫폼에서 실제로 눌리는 후보 수(초과하지 않으면 곧 후보 전부). */
  reachableOptionCount: number;
};

/**
 * "다른 가구 보기" Alert의 구성. 플랫폼을 인자로 받는 순수 함수다(호출부가 `Platform.OS`를
 * 넘긴다 — `inviteRolePrompt`와 같은 형태).
 *
 * 규칙은 초대 역할 Alert에서 이미 정해 둔 그대로다: **후보를 자르지 않고 닫기 버튼을 먼저
 * 뺀다.** 어느 쪽이든 하나는 사라져야 한다면, 사라져도 되는 것은 "닫기"다 — 그 자리는
 * 바깥 탭/뒤로가기(`cancelable`)가 대신할 수 있지만, 잘려 나간 가구를 대신할 것은 화면에
 * 아무것도 없다. 2가구 계정(= 오늘 대부분)에서는 닫기가 그대로 남아 종전과 같은 다이얼로그다.
 *
 * 후보가 넷 이상이면 닫기를 빼도 상한을 넘는다. 그때는 **초과했다는 사실을 결과로 돌려준다**
 * (`exceedsButtonLimit`) — 판정이 조용히 성공한 척하지 않아야 다음 라운드가 대안(전체 목록
 * 화면)을 만들 자리를 알아볼 수 있고, 그때까지는 본문 한 줄이 사용자에게도 같은 사실을 말한다.
 */
export function householdSwitchPrompt(
  platform: string,
  options: readonly HouseholdSwitchOption[]
): HouseholdSwitchPrompt {
  const buttonLimit = platform === "android" ? ANDROID_ALERT_BUTTON_LIMIT : Number.POSITIVE_INFINITY;
  const showsCloseButton = options.length + 1 <= buttonLimit;
  const reachableOptionCount = Math.min(options.length, showsCloseButton ? buttonLimit - 1 : buttonLimit);
  const exceedsButtonLimit = reachableOptionCount < options.length;
  return {
    title: HOUSEHOLD_SCOPE_SWITCH_LABEL,
    message: exceedsButtonLimit
      ? `${HOUSEHOLD_SCOPE_SWITCH_MESSAGE}\n${HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE}`
      : HOUSEHOLD_SCOPE_SWITCH_MESSAGE,
    options,
    showsCloseButton,
    cancelable: !showsCloseButton,
    exceedsButtonLimit,
    reachableOptionCount
  };
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

/* --------------------------------------- 파괴적 카드의 대상 표기 · 아이 쪽 짝 (라운드 63 #2) */

/**
 * 라운드 63 #2 — **아이 프로필 삭제가 어느 아이를 지우는지.**
 *
 * 왜 이 두 함수가 가구 모듈에 있나: 약관 및 개인정보 화면(app/settings/privacy.tsx)에는 되돌릴
 * 수 없는 카드가 셋 서 있고(아이 삭제 · 가구 탈퇴 · 계정 삭제), 그중 둘의 대상 표기는 이미 바로
 * 위 `householdScopeLeaveNotice`가 지고 있다. 세 번째 카드만 문구를 화면 안에 두면 같은 화면의
 * 같은 규율("되돌릴 수 없는 동작은 대상을 말한다")이 두 자리로 갈린다 — 이 모듈의 첫 번째 계약이
 * **규칙을 두 벌로 만들지 않는 것**이므로 짝을 여기에 둔다.
 *
 * 라벨 판정은 만들지 않는다: 아이 이름은 `resolveChildScopeLabel`
 * (src/children/child-switch.ts) 한 벌이 이미 정하고, 호출부가 그 결과를 넘긴다. 그 판정은
 * **아이가 2명 이상일 때만** 값을 내므로(그 모듈의 라운드 48 T4 규율) 1아이 계정에서는 여기서도
 * null이고, 카드가 종전과 한 글자도 달라지지 않는다.
 *
 * ⚠️ 1아이 계정에도 이름을 적는 편이 더 정직하다는 판단이 있다(지우는 대상을 말하는 데
 * 아이 수는 사실 상관이 없다). 그럼에도 이번 라운드가 다자녀 게이트를 고른 근거는 둘이다:
 *  1. 라운드 63 트랙 계약이 **1아이 계정 결과 불변**(SET-003 · SET-004)을 명시했고,
 *  2. 바로 위 가구 쪽 짝이 같은 문턱("2 이상일 때만")으로 서 있어, 한 화면의 두 카드가 서로
 *     다른 규율로 대상을 말하기 시작하면 다음 라운드가 둘 중 하나를 되돌린다.
 * 문턱을 낮추는 판단은 두 카드를 **함께** 옮기는 별도 판단이다(정찰 노트의 설계 긴장 그대로).
 */
export function childScopeDeleteNotice(childLabel: string | null | undefined): string | null {
  const label = childLabel?.trim();
  return label ? `${label} 프로필을 삭제해요.` : null;
}

/**
 * 삭제 확인 Alert의 제목, 또는 이름을 모르면 `null`(호출부는 **종전 제목 그대로**).
 *
 * 가족 화면의 구성원 삭제가 이미 같은 형태다(`${memberDisplayName}님을 삭제할까요?` —
 * app/family/index.tsx). 마지막 확인은 되돌릴 수 없는 동작 직전의 한 문장이라, 카드에만 이름을
 * 적고 여기서 "정말 삭제할까요?"로 되돌아가면 화면을 떠난 뒤 마지막으로 읽는 문장이 다시 대상을
 * 말하지 않는다 — 라운드 62 #2가 늘려 놓은 "선택 아이가 조용히 바뀌는 순간"이 정확히 그 사이에 있다.
 */
export function childScopeDeleteConfirmTitle(childLabel: string | null | undefined): string | null {
  const label = childLabel?.trim();
  return label ? `${label} 프로필을 삭제할까요?` : null;
}

/* ------------------------------------------- 화면 → 화면으로 가구를 넘기는 한 벌 (라운드 62 #4) */

/**
 * 가족 화면의 가구 전환을 **다른 화면까지** 들고 갈 때 쓰는 쿼리 파라미터 이름.
 *
 * 라운드 61 #3이 초대 화면에 처음 놓은 그 파라미터다(그때 이름은 `INVITE_HOUSEHOLD_PARAM`).
 * 라운드 62 #4에서 두 번째 받는 화면이 생기면서(가구 탈퇴) 규칙의 집이 여기로 옮겨 왔다 —
 * 파라미터 이름도, 아래 화이트리스트 검증도 이 모듈이 이미 지고 있는 "관리 대상 가구" 규율의
 * 일부이고, 이 모듈의 첫 번째 계약이 **규칙을 두 벌로 만들지 않는 것**이기 때문이다.
 * 초대 흐름은 종전 이름을 그대로 쓴다(src/family/invite-flow.ts가 이 두 값을 다시 내보낸다).
 */
export const HOUSEHOLD_SCOPE_PARAM = "householdId";

/**
 * 받은 `householdId` 파라미터를 **아는 가구일 때만** 통과시킨다. 모르면 `null`이다.
 *
 * 화이트리스트는 호출부가 넘긴다: 이 계정이 아는 가구는 위 `collectKnownHouseholdIds`가 모으는
 * 그 사실들이고(아이의 가구 · 서버가 말한 목록 · 기본 가구), 그 판정은 받는 화면들이 이미
 * 쓰고 있다. 목록에 없으면 **조용히 무시**한다 — 호출부는 종전의 아이 기준 판정
 * (`resolveManagedHouseholdId`)으로 떨어지므로, 딥링크나 손으로 고친 URL이 남의 가구 id를
 * 들이밀어도 화면이 그 가구를 대상으로 삼거나 "이 가구에서 나가요"라는 거짓 문장을 그리는 일이
 * 없다. **검증 실패는 차단이 아니라 종전 동작**이라는 규율이 특히 중요한 곳이 탈퇴 화면이다:
 * 모르는 값 하나 때문에 화면을 잠그면, 정작 나갈 수 있어야 할 사람이 못 나간다.
 *
 * 배열 처리는 expo-router 때문이다(`useLocalSearchParams`는 같은 이름이 여러 번 오면 배열을
 * 준다) — `parseInviteRoleParam`과 같은 규율이다.
 */
export function parseHouseholdScopeParam(
  value: unknown,
  knownHouseholdIds: readonly string[] | null | undefined
): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const householdId = typeof candidate === "string" ? candidate.trim() : "";
  if (!householdId) return null;
  return knownHouseholdIds?.includes(householdId) ? householdId : null;
}

/**
 * 라운드 62 #4 — 가족 화면의 **"이 가구에서 나가기"** 진입점 라벨.
 *
 * 왜 이 진입점이 필요한가: 탈퇴 대상은 `resolveManagedHouseholdId`가 정하는데, 그 판정은
 * **아이가 하나도 없는 가구를 구조적으로 가리킬 수 없다**(1단계는 선택 아이의 가구, 3단계는
 * 기본 가구). 그래서 초대를 수락해 들어간 빈 가구는 "다른 가구 보기"로 볼 수는 있어도 앱 안에서
 * 나갈 방법이 없었다 — 계정에 영구히 붙어 있는 가구가 생긴다. 전환해서 보고 있는 그 가구를
 * 탈퇴 화면까지 파라미터로 들고 가면 그 막다른 길이 열린다.
 *
 * "이 가구"라고 쓴다: 어느 가구인지는 바로 위 `householdScopeManageNotice` 한 줄이 이미 말하고
 * 있고(전환 중일 때만 그려지는 진입점이라 그 문장도 반드시 함께 서 있다), 여기서 이름을 한 번
 * 더 지어내면 가리키는 사실이 두 벌이 된다.
 */
export const HOUSEHOLD_SCOPE_LEAVE_LABEL = "이 가구에서 나가기";

/**
 * 가구 탈퇴 화면으로 가는 목적지. 초대 화면으로 갈 때와 **같은 관례**다
 * (src/family/invite-flow.ts의 `inviteScreenHref`): 전환 중일 때만 가구를 싣고, 전환하지 않았다면
 * 아무것도 싣지 않는다 — 두 화면이 같은 입력으로 같은 판정을 내리므로 파라미터가 없는 편이
 * 정확하고, 그래야 1가구 계정에서는 **파라미터 자체가 생기지 않아** 탈퇴 화면이 종전과 한 글자도
 * 달라지지 않는다(SET-003의 1가구 문자열 불변 계약 — **캡처 아님**. 라운드 66 F 정정: 픽셀락
 * 캡처 라우트 아홉 중 설정 계열은 SET-001 하나뿐이고 SET-003은 그 목록에 없다 —
 * `app/pixel-lock.tsx`. 지키는 계약은 실재하지만 그것을 잠그는 것은 캡처가 아니라 아래 테스트다).
 */
export function leaveScreenHref(householdId?: string | null): {
  pathname: "/settings/privacy";
  params: Record<string, string>;
} {
  const scopedHouseholdId = householdId?.trim();
  return {
    pathname: "/settings/privacy",
    params: scopedHouseholdId ? { [HOUSEHOLD_SCOPE_PARAM]: scopedHouseholdId } : {}
  };
}

/**
 * 라운드 63 #7 — 가족 화면의 **"이 가구에 아이 추가하기"** 진입점 라벨.
 *
 * 라운드 62 #4가 연 문의 나머지 절반이다. 그 라운드 뒤로 아이가 하나도 없는 가구는 볼 수도,
 * **나갈 수도** 있게 됐지만, 정작 그 가구를 만든 목적("여기에 우리 아이를 등록한다")은 여전히
 * 불가능했다 — 아이 추가의 대상 가구는 `resolveManagedHouseholdId`가 정하고, 그 판정은 아이가
 * 없는 가구를 구조적으로 가리킬 수 없다(1단계는 선택 아이의 가구, 3단계는 기본 가구). 배우자가
 * 만든 빈 가구의 초대를 수락한 사람에게 남는 결론은 "이 앱은 가구를 보여 주고 나가게 해 주지만
 * 쓸 수는 없게 한다"였다.
 *
 * 서버는 이미 이 절반을 지지한다: `POST /children`은 본문의 `householdId`를 받고
 * (apps/api children.controller.ts), 그 가구의 owner/co_parent인지 가드가 검사한다 — 즉 모자란
 * 것은 클라이언트가 **어느 가구인지 말하지 않는 것**뿐이었다. 서버는 한 줄도 바뀌지 않는다.
 *
 * "이 가구"라고 쓰는 이유는 탈퇴 라벨과 같다: 어느 가구인지는 `householdScopeManageNotice`
 * 한 줄이 이미 말하고 있고(전환 중일 때만 그려지는 진입점이라 그 문장도 반드시 함께 서 있다),
 * 여기서 이름을 한 번 더 지어내면 가리키는 사실이 두 벌이 된다.
 */
export const HOUSEHOLD_SCOPE_ADD_CHILD_LABEL = "이 가구에 아이 추가하기";

/**
 * 라운드 63 #7 — 전환한 가구에 아이를 만든 **직후**에 함께 뜨는 한 줄.
 *
 * 아이 관리 화면은 추가에 성공하면 그 아이를 곧바로 선택한다(온보딩 ONB-002와 같은 동작).
 * 이 흐름에서는 그게 맞지만 — 만들자마자 그 아이를 보러 간다 — 그 한 줄이 "가구 전환"을 조용히
 * **"아이 전환"으로 승격**시키는 셈이라, 사용자가 방금 만든 아이의 홈으로 앱 전체가 옮겨 간다.
 * 전환해 들어온 흐름에서만 이 문장을 덧붙여 그 사실을 말한다(파라미터가 없는 계정 — 1가구
 * 계정을 포함해 — 에서는 토스트가 종전과 한 글자도 달라지지 않는다: SET-005).
 */
export const HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE = "지금부터 이 아이 화면으로 바뀌어요.";

/**
 * 아이 관리 화면으로 가는 목적지. 탈퇴·초대 화면으로 갈 때와 **한 글자도 다르지 않은 관례**다
 * (`leaveScreenHref` · `inviteScreenHref`): 전환 중일 때만 가구를 싣고, 전환하지 않았다면 아무것도
 * 싣지 않는다 — 두 화면이 같은 입력으로 같은 판정을 내리므로 파라미터가 없는 편이 정확하고,
 * 그래야 1가구 계정에서는 **파라미터 자체가 생기지 않아** 아이 관리 화면이 종전과 한 글자도
 * 달라지지 않는다(SET-005).
 */
export function addChildScreenHref(householdId?: string | null): {
  pathname: "/settings/children";
  params: Record<string, string>;
} {
  const scopedHouseholdId = householdId?.trim();
  return {
    pathname: "/settings/children",
    params: scopedHouseholdId ? { [HOUSEHOLD_SCOPE_PARAM]: scopedHouseholdId } : {}
  };
}
