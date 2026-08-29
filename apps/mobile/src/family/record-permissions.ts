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

/**
 * 라운드 70 B — **월 예산 저장**(app/budget.tsx)의 형제 문장.
 *
 * 판정은 새로 만들지 않는다: 예산 저장의 서버 술어가 지출 쓰기와 **같기 때문**이다.
 * `upsertBudget`(apps/api/src/onboarding/onboarding-core.service.ts)이
 * `requireChildAccess(user, childId, true)`(edit = true)를 부르고, 그 안의 판정이 바로 위
 * `EXPENSE_EDIT_ROLES`가 거울로 삼는 `canEdit`(store-shared.ts)이다. 그래서 잠금 여부는
 * `isExpenseEntryLocked` 하나가 그대로 답하고, 이 파일이 더하는 것은 **문장 한 줄**이다.
 *
 * 왜 `EXPENSE_VIEW_ONLY_MESSAGE`를 재사용하지 않는가: 그 문장은 "기록은 …남길 수 있어요"라고
 * 말하는데, 예산 화면에서 막힌 것은 기록이 아니라 예산이다. 같은 판정이라도 사용자가 알아야 할
 * 사실은 화면마다 다르다(라운드 70 정찰 선행 확인 2 — `FORBIDDEN` 한 코드 아래 서버 문장이
 * 일곱인 것과 같은 이유. 답은 표를 좁히는 것이 아니라 화면별 문구다).
 *
 * 형식은 형제 문장 그대로다: 재시도를 권하지 않고(다시 눌러도 같은 403이다), 비난하지 않으며,
 * **누가 할 수 있는지**라는 사실을 준다(DNC-018).
 */
export const BUDGET_VIEW_ONLY_MESSAGE =
  "보기 전용으로 참여하고 있어요. 예산은 관리자·공동부모가 정할 수 있어요.";

/**
 * 라운드 40 J-5 — **빈 자리**(기록이 한 건도 없는 홈·기록 탭·리포트)에 놓는 사실 한 줄.
 *
 * 잠긴 세션에서 문제가 되는 것은 버튼이 아니라 **약속 문장**이다: "첫 지출을 기록해 보세요 /
 * 10초면 돼요", "첫 기록을 남기면 이번 달 비용을 바로 보여드릴게요"는 이 사람이 지금 할 수
 * 없는 일을 조건으로 건 약속이라, 눌러 봐야 안내만 돌아온다(오프라인 실패 카드의 "기록은
 * 지금도 남길 수 있어요"를 잠긴 세션에서 접은 것과 같은 이유 — app/(tabs)/index.tsx).
 *
 * 그렇다고 빈 화면에 아무 말도 남기지 않으면 그것대로 공백이라, 약속 대신 **참인 사실**을
 * 놓는다. 이 문장은 보기 전용 참여자에게도 끝까지 참이다 — 가족이 기록하면 이 자리는 실제로
 * 채워지고, 그 사실 자체가 이 사람이 이 앱에서 하는 일이다.
 */
export const EXPENSE_VIEW_ONLY_EMPTY_TITLE = "가족이 기록하면 여기에 쌓여요";

/** 세션 스토어가 들고 있는 "가구 id → 내 역할" 표. 로그인 응답·초대 수락 응답이 채운다. */
export type HouseholdRoleMap = Record<string, string>;

export type ResolveHouseholdRoleInput = {
  /** 세션 스토어의 `householdRoles`. 구세션·데모 세션이면 null/undefined. */
  householdRoles: HouseholdRoleMap | null | undefined;
  /** 지금 보고 있는 아이가 속한 가구. 모르면 null/undefined. */
  householdId?: string | null;
  /**
   * 라운드 40 J-2 — 세션 스토어의 `householdIds`(로그인·재조회 응답이 말한 **가구 전체**).
   * 모르면 null/undefined이고, 그때는 아래 단일 가구 폴백을 쓰지 않는다.
   */
  knownHouseholdIds?: readonly string[] | null;
};

/** 표에서 값이 실제로 있는 항목만. 손상된 값(빈 문자열 등)은 "모름"과 같게 다룬다. */
function usableRoleEntries(householdRoles: HouseholdRoleMap | null | undefined): Array<[string, string]> {
  if (!householdRoles) return [];
  return Object.entries(householdRoles).filter(
    ([householdId, role]) => householdId.length > 0 && typeof role === "string" && role.length > 0
  );
}

/**
 * 라운드 40 J-2 — 역할 표가 이 계정의 **전체 가구를 대변하는 단 하나의 가구**인가.
 *
 * 종전에는 "표의 행이 하나면 가구가 하나뿐"이라고 읽었다. 그런데 표는 세 경로에서 채워지고
 * (로그인 = 전체, 초대 수락·가족 화면 = 한 가구씩) 뒤의 둘은 **부분 표**를 만든다. 그래서
 * H1 owner + H2 viewer 사용자가 마이그레이션으로 표를 잃고(v3 이전 블롭 → null) 가족 화면을
 * 한 번 열어 {H2: "viewer"} 한 줄만 복구하면, 행이 하나라는 이유로 H1의 자기 아이까지 전부
 * 잠겼다 — 서버는 그 아이에 대해 owner라고 말하는데도.
 *
 * 그래서 "하나뿐"은 **서버가 말한 가구 목록**으로만 판정한다: 목록을 알고, 그 길이가 1이고,
 * 표가 바로 그 가구를 담고 있을 때. 목록을 모르면(구세션·데모) 폴백을 쓰지 않는다 —
 * 그쪽의 손해는 예전과 같은 실패 행 한 줄이고, 반대의 손해는 앱을 못 쓰게 되는 것이다.
 */
export function isSingleKnownHousehold({
  householdRoles,
  knownHouseholdIds
}: Pick<ResolveHouseholdRoleInput, "householdRoles" | "knownHouseholdIds">): boolean {
  if (!knownHouseholdIds || knownHouseholdIds.length !== 1) return false;
  const entries = usableRoleEntries(householdRoles);
  return entries.length === 1 && entries[0][0] === knownHouseholdIds[0];
}

/**
 * 지금 적용할 역할 하나를 고른다 — **모르면 추측하지 않는다**
 * (src/expenses/records-list-view.ts의 `resolveExpenseHouseholdId`와 같은 규칙).
 *
 *  - 표가 비었으면 undefined (구세션·데모 세션 — 잠그지 않는다);
 *  - 가구를 알고 표에 있으면 그 역할;
 *  - 가구를 아는데 표에 없으면 undefined (다른 계정의 잔여 표·부분 표일 수 있다);
 *  - 가구를 모르면, **서버가 가구가 하나뿐이라고 말했고 표가 그 가구일 때만** 그 역할을 쓴다
 *    (라운드 40 J-2 — 위 `isSingleKnownHousehold` 참고). 다가구 계정이나 부분 표에서 아무거나
 *    고르면 A 가구의 owner를 B 가구의 viewer로 잘못 잠글 수 있다.
 */
export function resolveHouseholdRole({
  householdRoles,
  householdId,
  knownHouseholdIds
}: ResolveHouseholdRoleInput): string | undefined {
  const entries = usableRoleEntries(householdRoles);
  if (entries.length === 0) return undefined;
  if (householdId) {
    return entries.find(([id]) => id === householdId)?.[1];
  }
  return isSingleKnownHousehold({ householdRoles, knownHouseholdIds }) ? entries[0][1] : undefined;
}

/**
 * 라운드 40 J-2(2/2) — 잠금을 판정하려면 "지금 보고 있는 아이가 어느 가구인가"를 알아내야
 * 하는가. 표가 비었으면(모름) 어차피 잠기지 않으므로 아이 목록이 필요 없고, 서버가 가구가
 * 하나뿐이라고 말했으면 그 하나를 쓰면 되므로 역시 필요 없다. 그 밖(다가구 · 부분 표)에서만
 * 아이-가구 해석이 필요하다 — 대부분의 계정에서 추가 요청은 여전히 0건이다.
 */
export function needsChildHouseholdResolution(
  input: Pick<ResolveHouseholdRoleInput, "householdRoles" | "knownHouseholdIds">
): boolean {
  if (usableRoleEntries(input.householdRoles).length === 0) return false;
  return !isSingleKnownHousehold(input);
}

/**
 * 라운드 41 K-3 — 역할 표는 있는데 **서버가 말한 가구 목록을 모르는** 상태인가.
 *
 * 이 조합은 두 경로에서 실제로 만들어지고, 둘 다 스스로 빠져나오지 못했다:
 *  - v3 블롭에서 올라온 세션(`householdRoles`는 저장돼 있고 `householdIds` 키는 없다);
 *  - 초대 수락으로 참여한 계정(로그인 시점에는 가구가 없어 `households: []` → 둘 다 null이었고,
 *    수락 응답의 `setHouseholdRole`이 표에 한 줄만 더한다 — 목록은 계속 null).
 *
 * 그 상태에서는 `isSingleKnownHousehold`가 항상 거짓이라 단일 가구 폴백이 꺼지고, 역할은
 * undefined(모름)로 떨어져 **보기 전용이 잠기지 않는다**. 그러면 화면은 종전처럼 저장했다고
 * 말하고 그 행은 flush에서 403을 받아 'failed'로 굳는다 — UX-R이 없애려던 바로 그 시퀀스인데,
 * 재검증은 잠금 안내에서만 발화하므로(잠기지 않으니 안내도 없다) 회복 경로가 아예 없었다.
 *
 * 그래서 이 판정이 참이면 호출부가 **앱 세션당 한 번** 백그라운드 재검증을 걸어 표와 목록을
 * 서버 응답 한 벌로 함께 채운다(useExpenseEntryGate). 판정 자체는 여기 순수 모듈에 둔다 —
 * "표가 쓸 만한가"의 기준(usableRoleEntries)이 이 파일에만 있어야 어긋나지 않는다.
 *
 * 비세션·데모 판정은 하지 않는다: 호출부가 실토큰이 없으면 애초에 요청을 만들지 않는다.
 */
export function needsHouseholdIdsRepair({
  householdRoles,
  knownHouseholdIds
}: Pick<ResolveHouseholdRoleInput, "householdRoles" | "knownHouseholdIds">): boolean {
  if (knownHouseholdIds && knownHouseholdIds.length > 0) return false;
  return usableRoleEntries(householdRoles).length > 0;
}

/**
 * 라운드 40 J-1 — 잠긴 세션에서 "지출을 만드는 동작"을 감싸는 규칙 한 줄.
 *
 * 진입점 열 곳을 잠가도 목적지 화면(app/expenses/new.tsx)이 그대로면 딥링크
 * (`wooriai:///expenses/new`)나 아직 잠기지 않은 새 진입점 하나로 저장 버튼까지 도달할 수
 * 있고, 거기서 저장하면 UX-R이 없애려던 바로 그 시퀀스("기기에 저장했어요" → flush 403 →
 * failed 행)가 되살아난다. 그래서 저장 **실행** 자체도 같은 판정을 지난다.
 *
 * 열람은 막지 않는다(시트는 열린다) — 보기 전용 참여자도 무엇이 기록되는지 볼 수 있어야 하고,
 * 잠긴 컨트롤은 사라지는 대신 눌렀을 때 사실을 말한다(useExpenseEntryGate 주석의 관례).
 */
export function guardExpenseAction<TArgs extends unknown[]>(
  locked: boolean,
  explain: () => void,
  action: (...args: TArgs) => void
): (...args: TArgs) => void {
  return (...args: TArgs) => {
    if (locked) {
      explain();
      return;
    }
    action(...args);
  };
}
