/**
 * UX-R(M) — "보기 전용" 역할의 지출 기록 진입 판정 단일 소스.
 *
 * 왜 필요한가: 서버는 지출 생성·수정·삭제를 가구의 **편집 역할**(owner·co_parent)에게만 허용한다
 * (apps/api/src/onboarding/store-shared.ts의 `canEdit`, households/child-access.service.ts의
 * `requireChildAccess(..., edit = true)` — 아니면 403 FORBIDDEN). 그런데 앱은 역할을 아예 들고
 * 있지 않았고, 지출 저장은 SQLite 우선이라 viewer/gift_participant가 기록을 남겨도 화면은 늘
 * 성공("기기에 저장했어요 …")이라고 말했다. 그 행은 flush에서 403을 받고 'failed'로 굳는다.
 * 초대 화면은 보기 전용을 "기록만 확인"이라고 설명해 두고, 앱은 같은 사람에게 기록 CTA를 그대로
 * 주고 저장됐다고 말한 셈이다 — 가족 공유 신뢰가 깨지는 자리다.
 *
 * 이 모듈은 **드러내기만 한다**. 서버 계약도 DNC-008(역할 원칙)도 바꾸지 않는다.
 *
 * 고정하는 것 두 가지.
 *
 * 1) **어떤 세션에서 잠그는가** — `hasSession && 역할이 알려진 보기 전용`일 때만이다.
 *    - 비세션(hasSession=false)은 절대 잠그지 않는다. 픽셀락 HOME-001·EXP-001·ITEM-001/002
 *      캡처가 바로 그 상태(app/pixel-lock.tsx가 clearSession으로 세션을 지우고 찍는다)라,
 *      여기서 버튼이 사라지거나 문구가 붙으면 기준 이미지가 깨진다.
 *    - **역할 미상(undefined/null)도 잠그지 않는다.** 이것이 초대 진입점 판정
 *      (invite-permissions.ts의 `isInviteEntryPointLocked`)과 정반대 방향인데, 의도한 것이다:
 *      거기서 잘못 열면 눌러도 아무 일도 없는 403 무반응이 되살아나지만, 여기서 잘못 **잠그면**
 *      정상 사용자의 기록 진입이 통째로 막혀 이 앱의 핵심 루프(지출 기록 → 총액 확인)가 죽는다.
 *      잘못 열었을 때의 손해는 예전과 똑같은 실패 행 한 줄이고, 잘못 잠갔을 때의 손해는 앱을
 *      쓸 수 없게 되는 것이다. 그래서 "모르면 예전 동작 그대로"가 안전한 쪽이다.
 *
 * 2) **무엇을 보고 잠그는가** — `canRecordExpenses`의 단순 부정이 아니라 **알려진 보기 전용
 *    역할 목록**을 본다. 서버가 나중에 새 역할을 추가하면 `canRecordExpenses`(서버 canEdit의
 *    거울)는 그 역할에 false를 주는데, 그 값으로 잠그면 위 1)의 "모르면 열어 둔다"가 무너진다.
 *
 * 화면(react-native)은 이 repo의 vitest에서 렌더할 수 없으므로 판정은 여기서 단위 테스트하고,
 * 배선은 소스 grep 계약 테스트가 맡는다(record-permissions.test.ts) — invite-permissions.ts와
 * 같은 관례다.
 */

/** 서버가 편집을 허용하는 역할(apps/api/src/onboarding/store-shared.ts의 `canEdit`와 같은 목록). */
export const EXPENSE_EDIT_ROLES = ["owner", "co_parent"] as const;

/**
 * 서버에 쓰기 권한이 없다고 **확실히 아는** 역할. 잠금은 이 목록으로만 발동한다(위 2) 참고).
 * 초대 화면(app/family/accept/[token].tsx의 roleLabel)이 "보기 전용"·"선물 참여"라고 부르는
 * 바로 그 두 역할이다.
 */
export const VIEW_ONLY_ROLES = ["viewer", "gift_participant"] as const;

/**
 * 이 역할이 지출을 기록할 수 있는가. 서버 `canEdit`의 거울이라 **모르는 역할은 false**다
 * (서버 기준을 앱에서 넓혀 말하지 않는다). 진입점 잠금 판정에는 이 값을 쓰지 않는다 —
 * 잠금은 `isExpenseEntryLocked`가, 알려진 보기 전용 역할로만 한다.
 */
export function canRecordExpenses(role: string | null | undefined): boolean {
  return (EXPENSE_EDIT_ROLES as readonly string[]).includes(role ?? "");
}

/** 서버 쓰기 권한이 없다고 확실히 아는 역할인가. */
export function isViewOnlyRole(role: string | null | undefined): boolean {
  return (VIEW_ONLY_ROLES as readonly string[]).includes(role ?? "");
}

export type ExpenseEntryPointInput = {
  /** 실제 로그인/데모 세션인가. 비세션 미리보기(픽셀락 캡처 포함)면 false. */
  hasSession: boolean;
  /** 이 가구에서 내 역할. 아직/끝내 모르면 undefined·null. */
  role: string | null | undefined;
};

/**
 * 지출 생성·수정·삭제 진입점을 잠글 것인가.
 *
 * ⚠ 픽셀락: `hasSession`이 false면 무조건 false다. HOME-001(홈 FAB·빠른 기록),
 * EXP-001(기록 시트), ITEM-001/002(준비템 목록·상세) 캡처가 모두 비세션 렌더다.
 */
export function isExpenseEntryLocked({ hasSession, role }: ExpenseEntryPointInput): boolean {
  if (!hasSession) return false;
  return isViewOnlyRole(role);
}

/**
 * 잠긴 진입점을 눌렀을 때 보여줄 안내. 비난하지 않고(DNC-018), 재시도를 권하지 않는다 —
 * 다시 눌러도 결과가 같기 때문이다. 대신 "누가 기록할 수 있는지"라는 사실을 준다.
 */
export const EXPENSE_VIEW_ONLY_MESSAGE =
  "보기 전용으로 참여하고 있어요. 기록은 관리자·공동부모가 남길 수 있어요.";

/** 위 안내를 Alert로 띄울 때의 제목. */
export const EXPENSE_VIEW_ONLY_ALERT_TITLE = "보기 전용이에요";

/** 세션 스토어가 들고 있는 "가구 id → 내 역할" 표. 로그인 응답·초대 수락 응답이 채운다. */
export type HouseholdRoleMap = Record<string, string>;

export type ResolveHouseholdRoleInput = {
  /** 세션 스토어의 `householdRoles`. 구세션·데모 세션이면 null/undefined. */
  householdRoles: HouseholdRoleMap | null | undefined;
  /** 지금 보고 있는 아이가 속한 가구. 모르면 null/undefined. */
  householdId?: string | null;
};

/**
 * 지금 적용할 역할 하나를 고른다 — **모르면 추측하지 않는다**
 * (src/expenses/records-list-view.ts의 `resolveExpenseHouseholdId`와 같은 규칙).
 *
 *  - 표가 비었으면 undefined (구세션·데모 세션 — 잠그지 않는다);
 *  - 가구를 알고 표에 있으면 그 역할;
 *  - 가구를 아는데 표에 없으면 undefined (다른 계정의 잔여 표일 수 있다);
 *  - 가구를 모르면, 표에 가구가 **하나뿐일 때만** 그 역할을 쓴다. 다가구 계정에서 아무거나
 *    고르면 A 가구의 owner를 B 가구의 viewer로 잘못 잠글 수 있다.
 */
export function resolveHouseholdRole({
  householdRoles,
  householdId
}: ResolveHouseholdRoleInput): string | undefined {
  if (!householdRoles) return undefined;
  const entries = Object.entries(householdRoles).filter(([, role]) => typeof role === "string" && role.length > 0);
  if (entries.length === 0) return undefined;
  if (householdId) {
    return entries.find(([id]) => id === householdId)?.[1];
  }
  return entries.length === 1 ? entries[0][1] : undefined;
}
