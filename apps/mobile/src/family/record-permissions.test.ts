import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BUDGET_VIEW_ONLY_MESSAGE,
  canRecordExpenses,
  CHILD_EDIT_VIEW_ONLY_MESSAGE,
  EXPENSE_EDIT_ROLES,
  EXPENSE_VIEW_ONLY_ALERT_TITLE,
  EXPENSE_VIEW_ONLY_EMPTY_TITLE,
  EXPENSE_VIEW_ONLY_MESSAGE,
  guardExpenseAction,
  isExpenseEntryLocked,
  isSingleKnownHousehold,
  isViewOnlyRole,
  needsChildHouseholdResolution,
  needsHouseholdIdsRepair,
  RECURRING_VIEW_ONLY_MESSAGE,
  resolveHouseholdRole,
  SYNC_STATUS_VIEW_ONLY_MESSAGE,
  VIEW_ONLY_HEADLINES,
  VIEW_ONLY_ROLES
} from "./record-permissions";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 주석을 걷어 낸 소스 — 화면이 **부르는 것**만 본다(a11y-contract.test.ts·invite-flow.test.ts가
 * 같은 이유로 갖고 있는 그 헬퍼다).
 *
 * 라운드 70 리뷰(S-6): 아래 쓰기 화면 스윕은 "게이트를 참조하는가"를 소스 grep으로 판정하는데,
 * 이 저장소는 설계 근거를 주석에 길게 남기는 관례라 **게이트를 부르지 않으면서 그 이름을 적어
 * 둔 화면**이 통과할 수 있었다(예: "이 화면은 useExpenseEntryGate를 지나지 않는다"라고 적는
 * 순간 그 화면은 그물을 빠져나간다). 주석을 먼저 걷어 내면 그런 통과가 불가능해진다.
 */
const withoutComments = (sourceText: string) =>
  sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("UX-R(M) 역할별 기록 권한 판정", () => {
  it("서버 canEdit과 같은 역할만 기록할 수 있다", () => {
    expect(canRecordExpenses("owner")).toBe(true);
    expect(canRecordExpenses("co_parent")).toBe(true);
    expect(canRecordExpenses("viewer")).toBe(false);
    expect(canRecordExpenses("gift_participant")).toBe(false);
  });

  it("모르는 역할·미상은 기록 권한을 주장하지 않는다(서버 기준을 앱에서 넓히지 않는다)", () => {
    expect(canRecordExpenses(undefined)).toBe(false);
    expect(canRecordExpenses(null)).toBe(false);
    expect(canRecordExpenses("")).toBe(false);
    expect(canRecordExpenses("grandparent")).toBe(false);
  });

  it("보기 전용 역할 목록은 초대 화면이 이름 붙인 두 역할이다", () => {
    expect([...VIEW_ONLY_ROLES]).toEqual(["viewer", "gift_participant"]);
    expect([...EXPENSE_EDIT_ROLES]).toEqual(["owner", "co_parent"]);
    expect(isViewOnlyRole("viewer")).toBe(true);
    expect(isViewOnlyRole("gift_participant")).toBe(true);
    expect(isViewOnlyRole("owner")).toBe(false);
    expect(isViewOnlyRole(undefined)).toBe(false);
  });
});

describe("UX-R(M) 진입점 잠금 판정", () => {
  it("실세션의 viewer·gift_participant만 잠근다", () => {
    expect(isExpenseEntryLocked({ hasSession: true, role: "viewer" })).toBe(true);
    expect(isExpenseEntryLocked({ hasSession: true, role: "gift_participant" })).toBe(true);
  });

  it("owner·co_parent는 잠그지 않는다", () => {
    expect(isExpenseEntryLocked({ hasSession: true, role: "owner" })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: "co_parent" })).toBe(false);
  });

  it("역할 미상(구세션·로딩 전·데모)은 잠그지 않는다 — 초대 판정과 반대 방향인 것이 의도다", () => {
    // 여기서 잘못 열면 남는 것은 예전과 똑같은 403 실패 행 한 줄이지만, 잘못 잠그면 정상
    // 사용자의 핵심 루프(지출 기록)가 통째로 죽는다.
    expect(isExpenseEntryLocked({ hasSession: true, role: undefined })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: null })).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: "" })).toBe(false);
    // 서버가 나중에 새 역할을 추가해도 마찬가지다(canRecordExpenses의 단순 부정이 아니다).
    expect(canRecordExpenses("grandparent")).toBe(false);
    expect(isExpenseEntryLocked({ hasSession: true, role: "grandparent" })).toBe(false);
  });

  it("⚠ 픽셀락 HOME-001·EXP-001·ITEM-001/002: 비세션은 어떤 역할이 와도 잠기지 않는다", () => {
    // 캡처는 app/pixel-lock.tsx가 clearSession으로 세션을 지운 뒤 찍는다.
    for (const role of ["viewer", "gift_participant", "owner", undefined, null]) {
      expect(isExpenseEntryLocked({ hasSession: false, role })).toBe(false);
    }
  });
});

/**
 * 라운드 70 B — **예산 저장의 네 좌표.** 판정을 새로 만들지 않았다는 것을 값으로 고정한다:
 * 예산 저장이 묻는 질문은 지출 쓰기가 묻는 질문과 **같은 함수**다(서버 술어가 같기 때문이다).
 */
describe("라운드 70 B 예산 저장 잠금의 네 좌표", () => {
  const budgetSaveLocked = (input: { hasSession: boolean; role: string | null | undefined }) =>
    isExpenseEntryLocked(input);

  it("편집 역할(owner·co_parent)은 저장이 종전 그대로 실행된다 — 성공/실패 모두", () => {
    for (const role of EXPENSE_EDIT_ROLES) {
      expect(budgetSaveLocked({ hasSession: true, role })).toBe(false);
      const mutate = vi.fn();
      const explain = vi.fn();
      guardExpenseAction(budgetSaveLocked({ hasSession: true, role }), explain, mutate)();
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(explain).not.toHaveBeenCalled();
    }
  });

  it("보기 전용은 저장 시도가 뮤테이션을 시작하지 않고 사실을 말한다(요청 0건)", () => {
    for (const role of VIEW_ONLY_ROLES) {
      expect(budgetSaveLocked({ hasSession: true, role })).toBe(true);
      const mutate = vi.fn();
      const explain = vi.fn();
      guardExpenseAction(budgetSaveLocked({ hasSession: true, role }), explain, mutate)();
      expect(mutate).not.toHaveBeenCalled();
      expect(explain).toHaveBeenCalledTimes(1);
    }
  });

  it("⚠ 화면 읽기는 잠금과 무관하다 — 이 판정이 답하는 것은 '저장'뿐이다", () => {
    // 판정 함수는 boolean 하나이고, 화면을 접는 두 번째 값을 만들지 않는다(구조 계약은
    // 아래 app/budget.tsx 소스 계약이 본다: 조기 return·조건부 렌더가 없다).
    expect(typeof budgetSaveLocked({ hasSession: true, role: "viewer" })).toBe("boolean");
  });

  it("⚠ 데모·비세션·역할 미상은 종전 동작 그대로다(모르면 잠그지 않는다)", () => {
    // 데모 세션은 역할 표가 null이라 역할이 undefined로 떨어진다.
    expect(budgetSaveLocked({ hasSession: true, role: resolveHouseholdRole({ householdRoles: null }) })).toBe(false);
    expect(budgetSaveLocked({ hasSession: true, role: undefined })).toBe(false);
    expect(budgetSaveLocked({ hasSession: true, role: "grandparent" })).toBe(false);
    // ⚠ 라운드 71 트랙 E 표기 정정: 종전 주석은 이 줄을 "BUD-001 픽셀락 캡처는 비세션이다"라고
    // 적었지만, 픽셀락 캡처는 아홉이고(app/pixel-lock.tsx의 `pixelLockRoutes`) 그 목록에 BUD-001은
    // 없다 — `screen-BUD-001`은 QA 화면 id일 뿐이다. 이 좌표가 지키는 사실은 그대로다:
    // **비세션 렌더는 어떤 역할이 와도 잠기지 않는다**(판정·값은 한 글자도 바뀌지 않았다).
    for (const role of ["viewer", "gift_participant", "owner", undefined]) {
      expect(budgetSaveLocked({ hasSession: false, role })).toBe(false);
    }
  });
});

describe("UX-R(M) 가구 역할 해석", () => {
  it("가구를 알면 그 가구의 역할을 쓴다", () => {
    expect(
      resolveHouseholdRole({ householdRoles: { "h-1": "owner", "h-2": "viewer" }, householdId: "h-2" })
    ).toBe("viewer");
  });

  it("가구를 모르면 서버가 '가구가 하나뿐'이라고 말했을 때만 쓴다(다가구에서 남의 역할로 잠그지 않는다)", () => {
    expect(resolveHouseholdRole({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] })).toBe("viewer");
    expect(
      resolveHouseholdRole({
        householdRoles: { "h-1": "owner", "h-2": "viewer" },
        knownHouseholdIds: ["h-1", "h-2"]
      })
    ).toBeUndefined();
  });

  it("표에 없는 가구·빈 표·null은 모두 모름이다", () => {
    expect(resolveHouseholdRole({ householdRoles: { "h-1": "owner" }, householdId: "h-9" })).toBeUndefined();
    expect(resolveHouseholdRole({ householdRoles: {} })).toBeUndefined();
    expect(resolveHouseholdRole({ householdRoles: null })).toBeUndefined();
    expect(resolveHouseholdRole({ householdRoles: undefined, householdId: "h-1" })).toBeUndefined();
  });

  it("모름은 잠금으로 이어지지 않는다(두 함수를 이어 붙인 실제 경로)", () => {
    const role = resolveHouseholdRole({ householdRoles: null, householdId: "h-1" });
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
  });
});

/**
 * 라운드 40 J-2 — 1행짜리 **부분 표**가 "가구가 하나뿐"으로 오해되어 다른 가구의 내 아이까지
 * 잠그던 문제.
 *
 * 재현: H1의 owner이자 H2의 viewer인 사용자. v3 이전 블롭에서 올라와 역할 표가 null이 된 뒤,
 * 가족 화면이나 초대 수락으로 {H2: "viewer"} 한 줄만 복구된다. 표의 행 수만 보면 "가구가
 * 하나"라서, H1의 자기 아이를 보고 있어도(아이-가구 해석 실패 포함) 전부 잠겼다.
 */
describe("라운드 40 J-2 부분 표 vs 서버가 말한 가구 수", () => {
  const partialTable = { householdRoles: { "h-2": "viewer" }, knownHouseholdIds: null } as const;

  it("서버 가구 목록을 모르면 1행 표를 전체로 치지 않는다 — 아이-가구 해석 실패는 열림(undefined)", () => {
    expect(isSingleKnownHousehold(partialTable)).toBe(false);
    const role = resolveHouseholdRole({ ...partialTable, householdId: null });
    expect(role).toBeUndefined();
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
  });

  it("다른 가구(H1)의 아이를 보고 있으면 잠기지 않는다 — 표에 없는 가구는 모름이다", () => {
    const role = resolveHouseholdRole({ ...partialTable, householdId: "h-1" });
    expect(role).toBeUndefined();
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
  });

  it("부분 표가 담고 있는 그 가구(H2)의 아이는 종전대로 잠긴다", () => {
    const role = resolveHouseholdRole({ ...partialTable, householdId: "h-2" });
    expect(role).toBe("viewer");
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(true);
  });

  it("진짜 단일 가구(로그인 응답이 그렇게 말한다)는 종전대로 잠긴다", () => {
    const single = { householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] };
    expect(isSingleKnownHousehold(single)).toBe(true);
    const role = resolveHouseholdRole({ ...single, householdId: null });
    expect(role).toBe("viewer");
    expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(true);
  });

  it("서버가 말한 가구가 표의 가구와 다르면(잔여 표) 폴백하지 않는다", () => {
    expect(isSingleKnownHousehold({ householdRoles: { "h-9": "viewer" }, knownHouseholdIds: ["h-1"] })).toBe(false);
    expect(
      resolveHouseholdRole({ householdRoles: { "h-9": "viewer" }, knownHouseholdIds: ["h-1"] })
    ).toBeUndefined();
  });

  it("아이 목록 조회는 판정이 실제로 필요할 때만 켠다(대부분의 계정은 추가 요청 0건)", () => {
    // 표가 비었으면 어차피 잠기지 않는다.
    expect(needsChildHouseholdResolution({ householdRoles: null, knownHouseholdIds: null })).toBe(false);
    expect(needsChildHouseholdResolution({ householdRoles: {}, knownHouseholdIds: ["h-1"] })).toBe(false);
    // 서버가 가구가 하나뿐이라고 말했으면 그 하나를 쓰면 된다.
    expect(
      needsChildHouseholdResolution({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] })
    ).toBe(false);
    // 다가구 · 부분 표에서만 아이-가구 해석이 필요하다.
    expect(needsChildHouseholdResolution({ ...partialTable })).toBe(true);
    expect(
      needsChildHouseholdResolution({
        householdRoles: { "h-1": "owner", "h-2": "viewer" },
        knownHouseholdIds: ["h-1", "h-2"]
      })
    ).toBe(true);
  });

  /**
   * 라운드 41 K-3 — "표는 있는데 목록은 모름"은 스스로 빠져나오지 못하던 막힌 상태였다.
   * 잠기지 않으니 잠금 안내가 없고, 안내가 없으니 J-3의 재검증도 발화하지 않았다.
   */
  it("K-3: 표가 있는데 서버 가구 목록을 모르면 자가 치유 대상이다", () => {
    // v3 블롭 · 초대 수락 계정이 만드는 바로 그 조합.
    expect(needsHouseholdIdsRepair({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: null })).toBe(true);
    expect(needsHouseholdIdsRepair({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: [] })).toBe(true);
    // 목록을 알면 고칠 것이 없다(폴백이 정상 작동한다).
    expect(needsHouseholdIdsRepair({ householdRoles: { "h-1": "viewer" }, knownHouseholdIds: ["h-1"] })).toBe(false);
    // 표가 없거나 쓸 만한 항목이 없으면 애초에 "모름"이라 이 경로가 아니다(구세션·데모).
    expect(needsHouseholdIdsRepair({ householdRoles: null, knownHouseholdIds: null })).toBe(false);
    expect(needsHouseholdIdsRepair({ householdRoles: {}, knownHouseholdIds: null })).toBe(false);
    expect(needsHouseholdIdsRepair({ householdRoles: { "h-1": "" }, knownHouseholdIds: null })).toBe(false);
  });
});

/**
 * 라운드 40 J-1 — 저장 **실행**을 감싸는 규칙. 진입점을 다 잠가도 목적지 화면(app/expenses/
 * new.tsx)이 그대로면 딥링크 한 번으로 "기기에 저장했어요 → 403 failed 행"이 되살아난다.
 */
describe("라운드 40 J-1 저장 실행 가드", () => {
  it("잠긴 역할의 저장 시도는 뮤테이션을 실행하지 않고 안내만 한다", () => {
    const mutate = vi.fn();
    const explain = vi.fn();
    guardExpenseAction(true, explain, mutate)();
    expect(mutate).not.toHaveBeenCalled();
    expect(explain).toHaveBeenCalledTimes(1);
  });

  it("잠기지 않았으면 인자까지 그대로 원래 동작으로 넘긴다", () => {
    const action = vi.fn();
    const explain = vi.fn();
    guardExpenseAction<[string, number]>(false, explain, action)("expense-1", 3);
    expect(action).toHaveBeenCalledWith("expense-1", 3);
    expect(explain).not.toHaveBeenCalled();
  });
});

describe("UX-R(M) 문구", () => {
  it("과제가 정한 안내 문구를 그대로 쓴다", () => {
    expect(EXPENSE_VIEW_ONLY_MESSAGE).toBe("보기 전용으로 참여하고 있어요. 기록은 관리자·공동부모가 남길 수 있어요.");
  });

  it("DNC-018: 해요체이고, 비난하지 않으며, 재시도를 권하지 않는다", () => {
    for (const copy of [EXPENSE_VIEW_ONLY_MESSAGE, EXPENSE_VIEW_ONLY_ALERT_TITLE, BUDGET_VIEW_ONLY_MESSAGE]) {
      expect(copy).toMatch(/요\.?$/);
      expect(copy).not.toContain("다시 시도");
      expect(copy).not.toContain("권한이 없");
    }
  });

  /**
   * 라운드 70 B — 예산 저장의 형제 문장. 판정은 하나이고 문장만 화면의 것이다.
   */
  it("예산 문구는 형제 문장과 같은 형식이되, 막힌 것이 무엇인지 정확히 말한다", () => {
    expect(BUDGET_VIEW_ONLY_MESSAGE).toBe("보기 전용으로 참여하고 있어요. 예산은 관리자·공동부모가 정할 수 있어요.");
    // 앞 절(참여 상태)은 형제와 같고, 뒷 절(할 수 있는 사람)만 예산의 것이다.
    const [viewOnlyClause] = EXPENSE_VIEW_ONLY_MESSAGE.split(". ");
    expect(BUDGET_VIEW_ONLY_MESSAGE.startsWith(`${viewOnlyClause}. `)).toBe(true);
    expect(BUDGET_VIEW_ONLY_MESSAGE).not.toBe(EXPENSE_VIEW_ONLY_MESSAGE);
    // 기록이 아니라 예산이 막혔다고 말한다 — 같은 판정이라도 화면마다 알아야 할 사실이 다르다.
    expect(BUDGET_VIEW_ONLY_MESSAGE).toContain("예산");
    expect(BUDGET_VIEW_ONLY_MESSAGE).not.toContain("기록");
    // 그리고 **누가 할 수 있는지**를 말한다(두 문장이 같은 두 역할을 부른다).
    expect(BUDGET_VIEW_ONLY_MESSAGE).toContain("관리자·공동부모");
    expect(EXPENSE_VIEW_ONLY_MESSAGE).toContain("관리자·공동부모");
  });
});

describe("UX-R(M) 세션 스토어 배선 (source contract)", () => {
  const sessionStoreSource = source("src/stores/session.store.ts");

  it("역할 표를 세션 스토어가 들고, 저장 버전을 함께 올린다", () => {
    expect(sessionStoreSource).toContain("householdRoles: Record<string, string> | null;");
    // 라운드 40 J-2: 4는 `householdIds`(서버가 말한 가구 목록)를 더한 버전이다.
    expect(sessionStoreSource).toContain("version: 4,");
    expect(sessionStoreSource).toContain("function normalizeHouseholdRoles(");
    expect(sessionStoreSource).toContain("householdIds: string[] | null;");
    expect(sessionStoreSource).toContain("function normalizeHouseholdIds(");
  });

  it("라운드 40 J-2: setHouseholdRole은 한 가구 사실만 담고 '가구 목록 전체'로 넓히지 않는다", () => {
    // 라운드 78 트랙 E: 두 표식이 **인자 이름**을 그대로 담고 있어(`(householdId, role)`),
    // 인자 하나만 이름이 바뀌어도 -1이 됐다. 접두로 줄이되, 같은 이름이 위 타입 선언에도
    // 있으므로(`setHouseholdRole: (householdId: string, …)`) **구현 블록부터** 찾는다 —
    // 그러지 않으면 끝점이 시작점보다 앞이 되어 구간이 비고, 아래 부정 단언이 늘 통과한다.
    const storeImplStart = sessionStoreSource.indexOf("export const useSessionStore = create<");
    const setOneStart = sessionStoreSource.indexOf("setHouseholdRole: (", storeImplStart);
    const setOneEnd = sessionStoreSource.indexOf("setHouseholdRoles: (", setOneStart);
    expect(storeImplStart, "세션 스토어 구현 시작을 찾지 못했어요").toBeGreaterThan(-1);
    expect(setOneStart, "setHouseholdRole 구현을 찾지 못했어요").toBeGreaterThan(storeImplStart);
    expect(setOneEnd, "setHouseholdRoles 구현을 찾지 못했어요").toBeGreaterThan(setOneStart);
    const setOne = sessionStoreSource.slice(setOneStart, setOneEnd);
    // 이미 아는 목록에 없는 가구면 그 하나만 더한다 -- 모르는 목록(null)을 지어내지 않는다.
    expect(setOne).toContain("state.householdIds && !state.householdIds.includes(householdId)");
    expect(setOne).not.toContain("householdIds: [householdId]");
  });

  it("라운드 40 J-3: /me 재조회 응답은 표 전체를 갈아 끼운다(부분 표가 남지 않는다)", () => {
    expect(sessionStoreSource).toContain("setHouseholdRoles: (households) =>");
    const replaceAll = sessionStoreSource.slice(
      sessionStoreSource.indexOf("setHouseholdRoles: (households) =>"),
      sessionStoreSource.indexOf("startTestSession: () => {")
    );
    expect(replaceAll).toContain("householdRolesFrom(households)");
    expect(replaceAll).toContain("householdIdsFrom(households)");
  });

  it("로그아웃은 역할을 지우고, 만료는 유지한다(AUTH-127 규칙과 같은 갈래)", () => {
    const clearBlock = sessionStoreSource.slice(sessionStoreSource.indexOf("clearSession: (reason: SessionEndReason"));
    const expiredShape = clearBlock.slice(clearBlock.indexOf('reason === "expired"'), clearBlock.indexOf(": {"));
    expect(expiredShape).not.toContain("householdRoles");
    expect(clearBlock).toContain("householdRoles: null,");
  });

  it("데모(테스트) 세션은 역할을 지어내지 않는다", () => {
    const testSessionBlock = sessionStoreSource.slice(
      sessionStoreSource.indexOf("startTestSession: () => {"),
      sessionStoreSource.indexOf("clearSession: (reason: SessionEndReason")
    );
    expect(testSessionBlock).toContain("householdRoles: null,");
  });

  it("로그인·초대 수락이 서버가 준 역할을 그대로 담는다(새 엔드포인트 없음)", () => {
    expect(source("app/(auth)/login.tsx")).toContain("households: result.user.households");
    expect(source("app/family/accept/[token].tsx")).toContain(
      "setHouseholdRole(result.household.id, result.household.role)"
    );
    // 가족 화면은 구성원 목록에서 확인한 내 역할로 스토어를 최신화한다(역할 변경 반영).
    expect(source("app/family/index.tsx")).toContain("setHouseholdRole(householdId, myRole);");
  });
});

describe("UX-R(M) 화면 배선 (source contract — 화면은 vitest에서 렌더할 수 없다)", () => {
  it("모든 지출 생성 진입점이 같은 판정 훅 하나를 거친다", () => {
    const wired: Array<[string, string]> = [
      // 홈: 퀵액션(비세션 프리뷰) · "자주 기록해요" 칩(세션) · 빈 상태 · FAB · 첫 실행 유도 카드.
      ["app/(tabs)/index.tsx", 'label="지출 기록" onPress={expenseGate.guard(() => router.push("/expenses/new"))}'],
      // DSN-053 P2-A: 세션 홈의 기록 입구는 캡처 문법의 칩 4개다 -- 품목 프리필도 같은 게이트를 지난다.
      ["app/(tabs)/index.tsx", "onPress={expenseGate.guard(() => {"],
      ["app/(tabs)/index.tsx", 'actionLabel="기록하기"'],
      ["app/(tabs)/index.tsx", '<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />'],
      // DSN-053 P2-A: 첫 실행 안내 카드는 준비템 갈래(first-items)를 준비 현황 카드에 넘기고
      // 나머지 갈래만 접힘 목록에 남는다 -- 잠금 판정이 붙는 자리는 종전과 같은 지출 갈래다.
      ["app/(tabs)/index.tsx", 'if (foldableFirstRunGuide.variant === "first-expense" && expenseGate.locked) {'],
      // 기록 탭: 상단 CTA · 빈 상태 · 행 액션(또 기록 · 삭제).
      ["app/(tabs)/records.tsx", 'label="빠른 지출 기록" onPress={expenseGate.guard(() => router.push("/expenses/new"))}'],
      ["app/(tabs)/records.tsx", "if (expenseEntryLocked) {"],
      // 리포트 탭 빈 상태. GAP-072 트랙 C(#3) 이후 이 카드의 onPress는 갈래가 둘이라(끝난 기간은
      // 화면 이동이고 지출 생성이 아니다) `onPress={…}` 한 줄이 아니지만, **지출 생성 갈래**는
      // 종전과 같은 게이트 표현 그대로다.
      ["app/(tabs)/reports.tsx", 'expenseGate.guard(() => router.push("/expenses/new"))'],
      // 준비템 목록의 "지출도 기록할까요?" · 상세의 "이미 샀어요" / "지출 기록하고 준비 완료".
      ["app/(tabs)/items.tsx", "const openExpenseLinkPrompt = expenseGate.guard("],
      ["app/items/[itemTemplateId].tsx", "onPress={expenseGate.guard(() =>"],
      // 구매 확인 카드의 "샀어요".
      ["src/commerce/PurchaseFollowupPrompt.tsx", "if (expenseGate.locked) {"],
      // 지출 상세의 수정 저장 · 삭제.
      ["app/expenses/[expenseId].tsx", "onPress={expenseGate.guard(() => save.mutate())}"],
      ["app/expenses/[expenseId].tsx", "if (expenseGate.locked) {"],
      // 라운드 40 J-6: CSV/엑셀 가져오기 -- 업로드(첫 걸음)와 확정(마지막 걸음) 둘 다.
      ["app/import/index.tsx", "if (expenseGate.locked) {"],
      ["app/import/[importJobId].tsx", "onPress={expenseGate.guard(() => confirm.mutate())}"]
    ];
    for (const [file, snippet] of wired) {
      expect(source(file), `${file} — ${snippet}`).toContain(snippet);
    }
  });

  it("판정 훅을 쓰는 화면은 모두 같은 모듈에서 가져온다(화면마다 조건을 다시 적지 않는다)", () => {
    const screens = [
      "app/(tabs)/index.tsx",
      "app/(tabs)/records.tsx",
      "app/(tabs)/reports.tsx",
      "app/(tabs)/items.tsx",
      "app/items/[itemTemplateId].tsx",
      "app/expenses/[expenseId].tsx",
      "app/import/index.tsx",
      "app/import/[importJobId].tsx",
      "src/commerce/PurchaseFollowupPrompt.tsx"
    ];
    for (const screen of screens) {
      const text = source(screen);
      expect(text, screen).toContain("useExpenseEntryGate");
      expect(text, screen).toMatch(/from "(\.\.\/)+(src\/)?family\/useExpenseEntryGate"/);
      // 역할 문자열을 화면에서 직접 비교하는 복제 판정이 생기지 않게 한다.
      expect(text, screen).not.toContain('=== "gift_participant"');
    }
  });

  it("행 탭·행 액션의 '수정'은 막지 않는다 — 보기 전용도 지출 상세를 볼 수 있어야 한다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    const handler = recordsSource.slice(
      recordsSource.indexOf("const handleRowAction = useCallback<RecordRowActionHandler>("),
      recordsSource.indexOf("// EXP-005: not-yet-synced local expenses")
    );
    // 잠금 검사는 반드시 "edit" 조기 반환 **뒤**에 온다.
    expect(handler.indexOf('if (action === "edit")')).toBeLessThan(handler.indexOf("if (expenseEntryLocked)"));
    expect(handler.indexOf("if (expenseEntryLocked)")).toBeLessThan(handler.indexOf('if (action === "repeat")'));
  });

  it("훅은 판정을 스스로 적지 않고 순수 모듈에 위임한다", () => {
    const hookSource = source("src/family/useExpenseEntryGate.ts");
    expect(hookSource).toContain('from "./record-permissions"');
    expect(hookSource).toContain("isExpenseEntryLocked({ hasSession, role })");
    expect(hookSource).toContain("resolveHouseholdRole({ householdRoles, householdId, knownHouseholdIds })");
    expect(hookSource).toContain("guardExpenseAction(locked, explainExpenseViewOnly, action)");
    // 판정이 아이-가구 해석을 실제로 필요로 할 때만 아이 목록을 부른다(추가 요청 0건).
    expect(hookSource).toContain("enabled: hasSession && needsHouseholdLookup");
    expect(hookSource).toContain("needsChildHouseholdResolution({ householdRoles, knownHouseholdIds })");
  });

  /**
   * 라운드 40 J-1: 진입점 화이트리스트만으로는 부족하다 — 목적지 화면 자체가 저장을 막아야
   * 딥링크(`wooriai:///expenses/new`)와 아직 잠기지 않은 새 진입점이 같은 거짓말을 되살리지
   * 못한다.
   */
  it("라운드 40 J-1: 목적지 화면(app/expenses/new.tsx)의 저장 실행이 같은 게이트를 지난다", () => {
    const screen = source("app/expenses/new.tsx");
    expect(screen).toContain("useExpenseEntryGate");
    expect(screen).toContain("const expenseGate = useExpenseEntryGate();");
    // 라운드 48 T4(D1): 저장 버튼이 둘이 됐다("저장하기" · "저장하고 계속 기록"). 둘 다 같은
    // 뮤테이션을 같은 게이트 뒤에서 시작한다 -- 게이트를 우회하는 두 번째 경로가 생기면 안 된다.
    expect(screen.match(/onPress=\{expenseGate\.guard\(/g) ?? []).toHaveLength(2);
    expect(screen.match(/saveExpense\.mutate\(\)/g) ?? []).toHaveLength(2);
    // 시트 진입 자체는 막지 않는다 -- 열람 후 안내가 이 앱의 관례다.
    expect(screen).not.toContain("if (expenseGate.locked) return null;");
    // 픽셀락 EXP-001: 저장 버튼의 disabled 조건은 여전히 두 버튼이 같은 한 줄이다(비세션은
    // 애초에 잠기지 않는다 -- GAP-056 #1로 판정 이름이 isSaveBlocked로 넓어졌을 뿐이고, 그
    // 안의 두 항 모두 세션이 없으면 false다).
    expect(screen.match(/disabled=\{saveExpense\.isPending \|\| isSaveBlocked\}/g) ?? []).toHaveLength(2);
  });

  /**
   * 라운드 40 J-9 — **역방향 계약**. 위 화이트리스트는 "적어 둔 진입점"만 지킨다. 새 진입점이
   * 하나 생기면 목록에 없으니 통과해 버리므로, 여기서는 반대로 소스를 훑어 `/expenses/new`로
   * 실제로 이동하는 파일 집합을 찾아내고 **그 집합의 모든 파일**이 게이트를 참조하는지 본다.
   * 새 진입점의 기본값은 실패다.
   *
   * 파일 단위 검사인 이유: app/(tabs)/index.tsx의 오프라인 실패 카드 입구
   * (`OFFLINE_RECORDING_ENTRY_LABEL`)는 src/offline/messages.test.ts가 guard 없는 원문 그대로
   * 고정하고 있다(그 화면은 잠금과 무관하게 "기록은 지금도 남길 수 있어요"를 약속한다).
   * 그 한 줄은 J-1의 화면 게이트가 목적지에서 받아 주므로, 여기서는 파일이 게이트를 알고
   * 있는지만 확인해 두 계약이 충돌하지 않게 한다.
   */
  it("라운드 40 J-9: /expenses/new로 이동하는 모든 파일이 게이트를 참조한다(새 진입점 = 실패)", () => {
    const navigatesToNewExpense = /router\.(?:push|replace)\(\s*(?:\{[^{}]*)?["']\/expenses\/new["']/;
    const referencesGate = /useExpenseEntryGate|expenseGate\.(?:guard|locked|explain)|expenseEntryLocked/;

    const sourceFiles: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const fullPath = join(directory, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        sourceFiles.push(fullPath);
      }
    };
    walk(join(mobileRoot, "app"));
    walk(join(mobileRoot, "src"));

    const entryPoints = sourceFiles
      .filter((fullPath) => navigatesToNewExpense.test(readFileSync(fullPath, "utf8")))
      .map((fullPath) => relative(mobileRoot, fullPath).split("\\").join("/"))
      .sort();

    // 스캔이 무언가를 실제로 찾았는지부터 확인한다(정규식이 조용히 죽으면 통과해 버린다).
    expect(entryPoints.length).toBeGreaterThan(3);
    expect(entryPoints).toContain("app/(tabs)/index.tsx");
    expect(entryPoints).toContain("src/commerce/PurchaseFollowupPrompt.tsx");

    const ungated = entryPoints.filter((path) => !referencesGate.test(source(path)));
    expect(ungated, `게이트를 거치지 않는 지출 기록 진입점: ${ungated.join(", ")}`).toEqual([]);
  });

  /**
   * 라운드 40 J-6 — **두 번째 역방향 계약**. J-9의 스캔은 `/expenses/new`로 **이동**하는 파일만
   * 본다. 그래서 CSV 임포트 확정처럼 화면 이동 없이 곧바로 지출을 만드는 경로는 그 그물에
   * 걸리지 않았고, 보기 전용 참여자가 업로드 → 검수 → 확정까지 간 뒤 마지막 버튼에서
   * "불러오지 못했어요. 잠시 후 다시 시도해 주세요."라는 틀린 이유(실제로는 403)를 받았다.
   *
   * 그래서 이번에는 **지출을 실제로 만드는/바꾸는 호출**을 기준으로 훑는다. 새 화면이 이 함수를
   * 부르기 시작하면 기본값은 실패다.
   */
  it("라운드 40 J-6: 지출을 만들거나 바꾸는 호출을 하는 모든 화면이 게이트를 참조한다", () => {
    const writesExpenses = /\b(?:createExpenseOffline|updateExpenseOffline|deleteExpenseOffline|confirmImport|createExcelImport)\s*\(/;
    const referencesGate = /useExpenseEntryGate|expenseGate\.(?:guard|locked|explain)|expenseEntryLocked/;

    const screenFiles: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const fullPath = join(directory, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        screenFiles.push(fullPath);
      }
    };
    walk(join(mobileRoot, "app"));

    const writers = screenFiles
      .filter((fullPath) => writesExpenses.test(readFileSync(fullPath, "utf8")))
      .map((fullPath) => relative(mobileRoot, fullPath).split("\\").join("/"))
      .sort();

    // 스캔이 실제로 무언가를 찾았는지부터 확인한다(정규식이 조용히 죽으면 통과해 버린다).
    expect(writers).toContain("app/expenses/new.tsx");
    expect(writers).toContain("app/import/[importJobId].tsx");
    expect(writers).toContain("app/import/index.tsx");

    const ungated = writers.filter((path) => !referencesGate.test(source(path)));
    expect(ungated, `게이트를 거치지 않는 지출 생성 경로: ${ungated.join(", ")}`).toEqual([]);
  });

  /**
   * 라운드 40 J-5 — 잠긴 세션에 남아 있던 **약속 문장들**. 진입점을 잠그는 것만으로는 화면이
   * 여전히 "첫 지출을 기록해 보세요 / 10초면 돼요", "첫 기록을 남기면 … 보여드릴게요"라고
   * 말한다. 그 조건을 만족시킬 수 없는 사람에게 조건부 약속을 남기지 않는다.
   */
  it("라운드 40 J-5: 빈 자리의 약속 문구는 잠긴 세션에서 사실 한 줄로 바뀐다", () => {
    // 홈: 판정·문구 모두 순수 모듈이 고른다(첫 실행 카드).
    expect(source("app/(tabs)/index.tsx")).toContain("expenseEntryLocked: expenseGate.locked");
    // 기록 탭: 그 달 빈 상태 제목이 같은 판정을 받는다(GAP-067 이후에도 같은 호출부다 —
    // 그 아래에 달력 보기 여부가 한 줄 더 붙었을 뿐, 잠금 갈래는 종전 그대로 순수 모듈이 고른다).
    expect(source("app/(tabs)/records.tsx")).toContain("const emptyMonthState = buildRecordsEmptyMonthState({");
    expect(source("app/(tabs)/records.tsx")).toContain("    expenseEntryLocked,\n");
    // 리포트 탭: 카테고리 빈 상태 제목. GAP-072 트랙 C(#3) 이후 이 갈래도 기록 탭과 **같은
    // 모양**이다 — 화면이 제목을 고르지 않고 순수 모듈에 잠금 판정을 넘긴다(그 모듈은 문장을
    // 다시 짓지 않고 buildRecordsEmptyMonthState를 그대로 부른다 = 저장소에 문장 한 벌).
    expect(source("app/(tabs)/reports.tsx")).toContain("const emptyPeriodCard = buildReportEmptyPeriodCard({");
    expect(source("app/(tabs)/reports.tsx")).toContain("    expenseEntryLocked: expenseGate.locked\n");
    // 문구는 한 곳에서만 정의된다 -- 화면들이 각자 적으면 갈라진다.
    for (const screen of ["app/(tabs)/index.tsx", "app/(tabs)/records.tsx", "app/(tabs)/reports.tsx"]) {
      expect(source(screen), screen).not.toContain(`"${EXPENSE_VIEW_ONLY_EMPTY_TITLE}"`);
    }
  });

  /**
   * 라운드 70 B — **예산 저장**이 같은 게이트를 지난다.
   *
   * 서버 술어가 지출 쓰기와 같으므로(upsertBudget → requireChildAccess(edit) → canEdit) 판정을
   * 새로 만들지 않고 이 훅을 읽는다. 화면은 잠그지 않고 **저장만** 잠근다 — 서버가 읽기를
   * 허용하므로 보기 전용 참여자도 이번 달 예산이 얼마인지 볼 수 있어야 한다.
   */
  it("라운드 70 B: 예산 저장이 같은 게이트를 지나고, 화면 읽기는 그대로다", () => {
    const screen = source("app/budget.tsx");
    expect(screen).toContain("const expenseGate = useExpenseEntryGate();");
    expect(screen).toMatch(/from "(\.\.\/)+(src\/)?family\/useExpenseEntryGate"/);
    // 판정을 화면에서 다시 적지 않는다(역할 문자열 비교·새 술어 금지).
    expect(screen).not.toContain('=== "gift_participant"');
    expect(screen).not.toContain('=== "viewer"');
    expect(screen).not.toContain("canRecordExpenses");
    // 저장 실행이 공용 가드를 지난다 — 잠겼으면 뮤테이션이 시작되지 않는다.
    //
    // 라운드 70 리뷰 P-B / 라운드 71 트랙 E: 안내는 화면 지역 함수(`explainBudgetViewOnly`)가
    // 아니라 **게이트의 explain에 본문을 넘기는 것**이다 — 재구현 마지막 한 벌이 사라졌다.
    expect(screen).toContain("guardExpenseAction(");
    expect(screen).toContain("expenseGate.locked,");
    expect(screen).toContain("() => expenseGate.explain(VIEW_ONLY_HEADLINES.budget),");
    expect(screen).toContain("() => save.mutate()");
    expect(screen, "재구현이 남지 않는다").not.toContain("explainBudgetViewOnly");
    expect(screen, "Alert를 화면이 다시 띄우지 않는다").not.toContain("Alert.alert(");
    expect(screen).toContain("onPress={saveBudget}");
    // 게이트를 우회하는 두 번째 저장 경로가 없다.
    expect(screen.match(/save\.mutate\(\)/g) ?? []).toHaveLength(1);

    // ⚠ 화면을 잠그지 않는다: 조기 return도, 입력·조회를 접는 분기도 없다.
    expect(screen).not.toContain("if (expenseGate.locked) return null;");
    /**
     * 라운드 71 트랙 E — 종전에는 `expenseGate.locked ?`가 **한 번도** 나오지 않는 것이 이
     * 계약이었다(삼항이 곧 화면을 접는 분기였다). 이제 판정을 읽는 자리가 하나 생겼다:
     * **머리말 한 줄**이다. 그래서 계약을 "삼항 금지"에서 **"삼항은 subtitle 하나뿐"**으로
     * 옮긴다 — 읽기·레이아웃·순서·버튼 배치는 여전히 한 줄도 판정에 걸리지 않는다.
     */
    expect(screen.match(/expenseGate\.locked \?/g) ?? [], "판정을 읽는 삼항은 하나뿐이다").toHaveLength(1);
    expect(screen, "그 삼항은 머리말의 것이다").toContain(
      "subtitle={expenseGate.locked ? VIEW_ONLY_HEADLINES.budget :"
    );
    // JSX 조건부 렌더(카드·입력·버튼을 접는 분기)는 여전히 0건이다. 삼항은 위에서 하나로
    // 묶었고(그 하나가 subtitle이다), `&&` 갈래는 아예 없다.
    expect(screen, "판정으로 노드를 접지 않는다").not.toContain("{expenseGate.locked &&");
    expect(screen, "판정으로 노드를 접지 않는다").not.toContain("expenseGate.locked ? (");
    // ⚠ 버튼은 사라지지도 비활성이 되지도 않는다 — 눌렀을 때 사실을 말하는 것이 이 앱의 관례다.
    expect(screen).toContain("disabled={!canSave || save.isPending}");
    expect(screen).not.toContain("disabled={!canSave || save.isPending || expenseGate.locked}");

    // 문구는 순수 모듈에서 온다(화면이 문장을 다시 적으면 두 개의 계약이 된다).
    // 라운드 71 트랙 E: 화면이 읽는 이름은 머리말 표의 항목이고, 그 값이 형제 문장 그대로다.
    expect(screen).toContain("VIEW_ONLY_HEADLINES.budget");
    expect(VIEW_ONLY_HEADLINES.budget).toBe(BUDGET_VIEW_ONLY_MESSAGE);
    expect(screen).not.toContain(`"${BUDGET_VIEW_ONLY_MESSAGE}"`);
    /**
     * 안내가 곧 역할 재검증 트리거다(라운드 40 J-3의 그 경로를 그대로 쓴다) — 라운드 71 트랙 E
     * 이후 그 세 줄은 **게이트 안에 한 벌만** 있다. 화면은 본문을 넘기고, 재검증은 그 안에서
     * 종전과 똑같이 일어난다.
     */
    expect(screen, "화면에 재구현이 남지 않는다").not.toContain("revalidateHouseholdRoles();");
    expect(source("src/family/useExpenseEntryGate.ts"), "재검증은 게이트 안에 한 벌").toContain(
      "revalidateHouseholdRoles();"
    );
  });

  /**
   * 라운드 70 B — **세 번째 역방향 계약**. J-9는 `/expenses/new`로 **이동**하는 파일을,
   * J-6은 **지출을 만드는 호출**을 훑는다. 둘 다 지출이라는 한 도메인의 그물이라, 예산 저장처럼
   * 지출이 아닌 서버 직행 쓰기는 어느 쪽에도 걸리지 않았다 — 그래서 라운드 70까지 **앱에서
   * 유일하게 역할 게이트를 지나지 않는 쓰기**가 살아남았고, 어떤 단언도 그 사실을 말해 주지
   * 않았다(정찰 선행 확인 7).
   *
   * 그래서 이번 그물은 도메인이 아니라 **행위**로 짠다: `app/`에서 `useMutation(`을 부르는 파일
   * 전량이 쓰기 진입점이고, 그 집합의 모든 파일은 역할 게이트를 참조하거나 **이유가 적힌 제외
   * 목록**에 있어야 한다. 새 쓰기 화면의 기본값은 실패다.
   *
   * 제외 목록에는 "지금은 왜 게이트가 필요 없는가"를 값으로 적는다. 목록이 낡으면(그 파일이
   * 더 이상 쓰기가 아니거나, 사라지거나) 그것도 함께 빨개진다.
   *
   * ## 라운드 70 리뷰(S-6) — 이 그물이 실제로 보장하는 범위
   *
   * 넓어 보이지만 조건이 둘 있고, 둘 다 이 그물의 **밖**을 만든다.
   *  1. **`app/` 아래만 훑는다.** `src/`의 컴포넌트가 쓰기를 들고 있으면 걸리지 않는다(오늘은
   *     0건 — `src/`에 `useMutation`이 하나도 없다. 예컨대 src/commerce/PurchaseFollowupPrompt.tsx는
   *     게이트를 지나지만 그것은 이 그물이 아니라 위 J-9 화이트리스트가 잡고 있는 것이다).
   *  2. **`useMutation(`을 부르는 파일만** 쓰기로 친다. 화면이 react-query를 거치지 않고
   *     클라이언트 함수를 **직접 await**하면(핸들러 안의 `await createX(...)`) 이 판정은 그
   *     파일을 아예 쓰기로 세지 않는다.
   *
   * 그리고 판정은 **주석을 걷어 낸 소스**로 한다(`withoutComments` — 위 헬퍼): 게이트 이름을
   * 설명으로 적어 둔 화면이 부르지 않고도 통과하던 구멍을 막는다.
   */
  it("라운드 70 B: app/의 모든 쓰기 화면이 역할 게이트를 지나거나, 지나지 않는 이유가 적혀 있다", () => {
    const writesSomething = /\buseMutation\s*\(/;
    // ⚠ 판정을 **부르는** 자리만 센다. `revalidateHouseholdRoles`만 가져다 쓰는 화면
    // (개인정보·초대 수락)은 같은 모듈을 import하지만 게이트를 지나는 것이 아니다.
    const referencesRoleGate =
      /useExpenseEntryGate\(\)|expenseGate\.(?:guard|locked|explain)|expenseEntryLocked|useItemStatusGate\(\)|itemStatusGate\.|canEditChildren|canAddChild|canManageMembers/;

    /**
     * 게이트를 지나지 않는 쓰기와 그 이유. **역할이 판정에 개입하지 않는 쓰기만** 여기 온다.
     */
    const UNGATED_WITH_REASON: Readonly<Record<string, string>> = {
      // 온보딩 셋: 자기 아이를 방금 만든 사람의 흐름이라 보기 전용이 도달하지 않고,
      // 실패 배선도 다르다(OnboardingSaveErrorCard).
      "app/(onboarding)/child-profile.tsx": "온보딩 — 아이를 만드는 그 사람의 흐름이다(가구도 이때 생긴다)",
      "app/(onboarding)/budget.tsx": "온보딩 — 방금 자기 아이를 만든 사람의 흐름이다",
      "app/(onboarding)/prepared-items.tsx": "온보딩 — 같은 흐름의 준비템 초기 선택",
      // 가족: 초대 **수락**은 아직 구성원이 아닌 사람의 요청이라 가구 역할이 존재하지 않는다.
      "app/family/accept/[token].tsx": "초대 수락 — 요청자에게 아직 이 가구의 역할이 없다",
      // 초대 **생성** 화면의 진입점은 가족 화면이 `inviteLocked`로 잠근다(invite-permissions.ts).
      // 이 화면 자체의 문구·판정은 트랙 C가 소유한다 — 이 라운드는 읽기만 한다.
      "app/family/invite.tsx": "초대 생성 — 진입점을 app/family/index.tsx의 inviteLocked가 잠근다",
      // 본인 기기/본인 계정: 가구 역할이 개입하지 않는다.
      "app/settings/notifications.tsx": "알림 설정 — 본인 기기의 토글이다",
      "app/settings/privacy.tsx": "개인정보 — 본인 계정(탈퇴·삭제·동의)이고, 아이 삭제는 서버가 요청자 기준으로 판정한다"
    };

    const screenFiles: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const fullPath = join(directory, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        screenFiles.push(fullPath);
      }
    };
    walk(join(mobileRoot, "app"));

    const writers = screenFiles
      .filter((fullPath) => writesSomething.test(readFileSync(fullPath, "utf8")))
      .map((fullPath) => relative(mobileRoot, fullPath).split("\\").join("/"))
      .sort();

    // 스캔이 실제로 무언가를 찾았는지부터 확인한다(정규식이 조용히 죽으면 통과해 버린다).
    expect(writers.length).toBeGreaterThanOrEqual(16);
    expect(writers).toContain("app/budget.tsx");
    expect(writers).toContain("app/settings/children.tsx");

    // 라운드 70 리뷰(S-6): 주석을 걷어 낸 뒤 판정한다 — 이름을 적어 둔 것은 배선이 아니다.
    const ungated = writers.filter((path) => !referencesRoleGate.test(withoutComments(source(path))));
    const unexplained = ungated.filter((path) => !Object.prototype.hasOwnProperty.call(UNGATED_WITH_REASON, path));
    expect(unexplained, `역할 게이트도 이유도 없는 쓰기 화면: ${unexplained.join(", ")}`).toEqual([]);

    // 제외 목록이 낡지 않게 — 적어 둔 파일이 여전히 쓰기 진입점이고 여전히 게이트 밖인지 본다.
    expect(Object.keys(UNGATED_WITH_REASON).sort()).toEqual(ungated.sort());
    for (const reason of Object.values(UNGATED_WITH_REASON)) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  /**
   * 라운드 71 트랙 E — **네 번째 역방향 계약: 화면의 첫 문장.**
   *
   * J-9는 `/expenses/new`로 **이동**하는 파일을, J-6은 **지출을 만드는 호출**을, 라운드 70 B는
   * `app/`의 **모든 쓰기 진입점**을 센다. 셋 다 **버튼**의 그물이다. 화면의 **문장**은 그 어느
   * 목록에도 없었고, 그래서 라운드 40~70이 게이트를 하나씩 세우는 동안 그 화면들의 머리말은
   * 라운드 39 이전 값 그대로 남았다 — 잠긴 계정에게 앱이 자기 자신과 모순되는 말을 했다
   * (머리말: "필요할 때 언제든 예산을 조정할 수 있어요" / 저장 버튼: "보기 전용으로 참여하고
   * 있어요"). 어떤 단언도 그 사실을 말해 주지 않았다(정찰 코드 건강 판정 — 게이트 스윕의
   * 구조적 사각).
   *
   * 그래서 이 그물은 **판정을 읽는 화면 중 머리말을 가진 것**을 세고, 그 머리말이 같은 판정을
   * 읽는지 묻는다. 새 쓰기 화면이 머리말을 달고 들어오면 기본값은 실패다.
   *
   * 판정은 **주석을 걷어 낸 소스**로 한다(위 헬퍼) — 게이트 이름을 설명으로 적어 둔 화면이
   * 부르지 않고도 통과하던 구멍은 여기서도 같다.
   */
  it("라운드 71 E: 게이트를 읽는 화면의 머리말이 그 판정을 읽거나, 읽지 않는 이유가 적혀 있다", () => {
    /**
     * 라운드 71 리뷰 S-10 — **라운드 70 B 스윕과 같은 집합을 본다.**
     *
     * 종전에는 훅 호출(`useExpenseEntryGate()`)이나 순수 판정 호출 두 형태만 셌다. 그런데 게이트를
     * 읽는 형태는 그 둘만이 아니다: 값만 넘겨받은 화면(`expenseGate.locked`·`expenseEntryLocked`),
     * 준비템 상태 게이트, 아이·구성원 관리의 역할 판정도 전부 같은 그물이 세야 할 자리다.
     * 그래서 판정 집합을 위 라운드 70 B 스윕(`referencesRoleGate`)과 **같게** 맞춘다 — 두 그물이
     * 다른 집합을 보면, 한쪽만 통과하는 화면이 조용히 생긴다.
     */
    const readsGate =
      /useExpenseEntryGate\(\)|expenseGate\.(?:guard|locked|explain)|expenseEntryLocked|useItemStatusGate\(\)|itemStatusGate\.|canEditChildren|canAddChild|canManageMembers|isExpenseEntryLocked\s*\(/;
    const readsHeadline = /VIEW_ONLY_HEADLINES\./;

    /**
     * 머리말이 판정을 읽지 **않아도 되는** 화면과 그 이유. "약속을 하지 않는 머리말"만 여기 온다.
     */
    const HEADLINE_UNGATED_WITH_REASON: Readonly<Record<string, string>> = {
      // 홈: 머리말은 아이 이름·단계이고 부제는 앱 전체의 성격 한 줄이라 이 사람이 지금 할 수
      // 있는 일을 조건으로 걸지 않는다. 잠긴 세션에서 접히는 **약속 문장**은 빈 자리 쪽이고,
      // 그것은 라운드 40 J-5가 이미 판정에서 파생시켜 뒀다(위 단언). HOME-001 픽셀락 캡처이기도 하다.
      "app/(tabs)/index.tsx": "머리말이 아이 이름·앱 성격이고, 잠긴 세션의 약속 문장은 J-5가 이미 판정에서 파생시킨다",
      // 기록 탭: 부제는 "확인해 보세요"라는 **읽기** 안내다(보기 전용도 끝까지 참이다).
      // 이 화면의 약속 문장(그 달 빈 상태 제목)도 J-5가 파생시킨다.
      "app/(tabs)/records.tsx": "부제가 읽기 안내('확인해 보세요')라 잠긴 계정에게도 참이다 — 약속 문장은 J-5가 판정에서 파생시킨다"
    };

    /**
     * ⚠️ 트랙 A로 이관됐던 자리. 트랙 E는 문장(`VIEW_ONLY_HEADLINES.importReview`)만 세우고,
     * 검수 화면의 머리말 배선은 그 화면을 소유한 트랙 A가 읽어 썼다(라운드 70의 C→A 읽기 방향).
     *
     * **라운드 71 리뷰 M-1에서 A가 이었으므로 이 목록은 비었다.** 상수는 남겨 둔다 — 다음 라운드에
     * 같은 이관이 또 생기면 여기에 적고, 아래 두 staleness 단언이 "이었으니 지워라 / 게이트에서
     * 이탈했다"를 그 자리에서 말해 준다.
     */
    const TRACK_A_PENDING: readonly string[] = [];

    const screenFiles: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const fullPath = join(directory, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx$/.test(name) || /\.test\.tsx$/.test(name)) continue;
        screenFiles.push(fullPath);
      }
    };
    walk(join(mobileRoot, "app"));

    const headlineScreens = screenFiles
      .map((fullPath) => relative(mobileRoot, fullPath).split("\\").join("/"))
      .filter((path) => {
        const src = source(path);
        return src.includes("<ScreenHeader") && readsGate.test(withoutComments(src));
      })
      .sort();

    // 스캔이 실제로 무언가를 찾았는지부터 확인한다(정규식이 조용히 죽으면 통과해 버린다).
    expect(headlineScreens.length).toBeGreaterThanOrEqual(7);
    expect(headlineScreens).toContain("app/budget.tsx");
    expect(headlineScreens).toContain("app/settings/children.tsx");

    const withoutLockCopy = headlineScreens.filter((path) => !readsHeadline.test(withoutComments(source(path))));
    const unexplained = withoutLockCopy.filter(
      (path) => !Object.prototype.hasOwnProperty.call(HEADLINE_UNGATED_WITH_REASON, path) && !TRACK_A_PENDING.includes(path)
    );
    expect(unexplained, `머리말이 판정을 읽지 않고 이유도 없는 화면: ${unexplained.join(", ")}`).toEqual([]);

    // 라운드 71 리뷰 M-1: 이관 목록도 낡지 않게 본다. 종전에는 이 목록만 아무 검사 없이
    // 통과했고(어느 쪽이어도 좋다), 그래서 A가 머리말을 이어도 이 줄이 그대로 남을 수 있었다.
    for (const path of TRACK_A_PENDING) {
      // 이었으면 잠금 문구가 생겨 withoutLockCopy에서 빠진다 = 이 줄을 지우라는 신호다.
      expect(withoutLockCopy, `${path} — 머리말을 이었으니 TRACK_A_PENDING에서 지운다`).toContain(path);
      // 그 화면이 게이트를 읽는 머리말 화면이 아니게 되면(배선 이탈) 여기서 먼저 빨개진다.
      expect(headlineScreens, `${path} — 더는 게이트를 읽는 머리말 화면이 아니다`).toContain(path);
    }

    // 제외 목록이 낡지 않게 — 적어 둔 화면이 여전히 게이트를 읽는 머리말 화면이고, 여전히
    // 잠금 문구를 갖지 않는지 본다(트랙 A 이관분은 위에서 따로 본다).
    expect(Object.keys(HEADLINE_UNGATED_WITH_REASON).sort()).toEqual(
      withoutLockCopy.filter((path) => !TRACK_A_PENDING.includes(path)).sort()
    );
    for (const reason of Object.values(HEADLINE_UNGATED_WITH_REASON)) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  /**
   * 라운드 71 트랙 E — **여섯 화면 × (잠김 / 안 잠김).**
   *
   * 화면은 vitest에서 렌더할 수 없으므로 두 갈래를 소스로 고정한다: 잠긴 쪽의 값은 순수 모듈의
   * 표에서 오고(화면이 문장을 다시 적지 않는다), **안 잠긴 쪽은 종전 문장 그대로**여야 한다 —
   * 이번 변화의 절반은 "관리자 계정에서 한 글자도 달라지지 않는 것"이다.
   */
  it("라운드 71 E: 여섯 머리말이 잠김/안 잠김 두 갈래를 갖고, 안 잠긴 쪽은 종전 문장 그대로다", () => {
    const flat = (text: string) => text.replace(/\s+/g, " ");
    const HEADLINES = [
      {
        path: "app/budget.tsx",
        gate: "expenseGate.locked",
        key: "budget" as const,
        unlocked: "필요할 때 언제든 예산을 조정할 수 있어요."
      },
      {
        path: "app/expenses/[expenseId].tsx",
        gate: "expenseGate.locked",
        key: "expenseDetail" as const,
        unlocked: "품목과 금액을 확인하고 수정할 수 있어요."
      },
      {
        path: "app/expenses/recurring.tsx",
        gate: "expenseGate.locked",
        key: "recurring" as const,
        unlocked: "매월 반복되는 지출을 적어 두면 홈에서 확인할 수 있어요"
      },
      {
        path: "app/settings/children.tsx",
        gate: "childEditViewOnly",
        key: "children" as const,
        unlocked: "아이를 전환하거나 정보를 수정해요"
      },
      {
        path: "app/sync-status.tsx",
        gate: "expenseEntryLocked",
        key: "syncStatus" as const,
        unlocked: "아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요."
      },
      /**
       * 라운드 71 리뷰 M-1 — 여섯째. 트랙 E가 세운 문장을 트랙 A가 소유한 화면이 읽어 쓴다
       * (C→A 읽기 방향 그대로). 이 줄이 서면서 위 TRACK_A_PENDING은 비었다.
       */
      {
        path: "app/import/[importJobId].tsx",
        gate: "expenseGate.locked",
        key: "importReview" as const,
        unlocked: "분석 결과를 확인하고 가져올 항목을 골라요"
      }
    ];

    for (const { path, gate, key, unlocked } of HEADLINES) {
      const src = source(path);
      expect(flat(src), `${path}의 머리말 두 갈래`).toContain(
        `${gate} ? VIEW_ONLY_HEADLINES.${key} : "${unlocked}"`
      );
      // 문장은 화면이 짓지 않는다(단일 소스는 record-permissions.ts다).
      expect(src, `${path}가 다시 적은 잠금 문장`).not.toContain(`"${VIEW_ONLY_HEADLINES[key]}"`);
    }

    // 검수 화면이 읽는 그 문장은 지출 기록의 형제 문장 그대로다(확정이 만드는 것은 지출이다).
    expect(VIEW_ONLY_HEADLINES.importReview).toBe(EXPENSE_VIEW_ONLY_MESSAGE);
  });

  /**
   * 라운드 71 트랙 E — ⚠ **"모르면 잠그지 않는다"가 머리말에도 그대로다.**
   *
   * 다섯 화면 중 넷은 게이트의 `locked`를 그대로 읽으므로 이 규칙이 자동으로 따라온다. 남은
   * 하나(아이 관리)만 근거가 달라서 위험했다: 그 화면의 컨트롤 게이트(`canEditChildren`)는
   * **구성원 목록이 오는 중이거나 응답에서 나를 찾지 못했을 때도 false**로 떨어지도록 일부러
   * 그렇게 만든 값이라(뷰어가 못 쓸 컨트롤을 깜빡이는 것보다 낫다), 그 부정을 머리말에 쓰면
   * 모르는 상태의 정상 사용자에게 "당신은 보기 전용이에요"라고 말하는 **허위 표시**가 된다.
   */
  it("라운드 71 E: 아이 관리 머리말은 canEditChildren의 부정이 아니라 '알려진 보기 전용'을 읽는다", () => {
    const screen = source("app/settings/children.tsx");
    expect(screen, "머리말 판정의 근거").toContain(
      "const childEditViewOnly = isExpenseEntryLocked({ hasSession, role: myRole });"
    );
    // 컨트롤 게이트는 한 글자도 바뀌지 않는다(두 판정의 안전 방향이 다른 것이 의도다).
    expect(screen, "컨트롤 게이트 무변경").toContain('const canEditChildren = myRole === "owner" || myRole === "co_parent";');
    // 머리말이 그 부정을 읽지 않는다 — 로딩 중·역할 미상이 잠김으로 새지 않게.
    expect(screen, "머리말이 canEditChildren의 부정을 읽지 않는다").not.toContain("!canEditChildren ? VIEW_ONLY_HEADLINES");
    expect(screen).not.toContain("subtitle={!canEditChildren");

    // 그리고 그 판정 자체가 모름·비세션·데모를 잠그지 않는다(값으로 다시 확인한다).
    for (const role of [undefined, null, "", "grandparent"]) {
      expect(isExpenseEntryLocked({ hasSession: true, role }), `역할 ${String(role)}`).toBe(false);
    }
    for (const role of [...VIEW_ONLY_ROLES, ...EXPENSE_EDIT_ROLES, undefined]) {
      expect(isExpenseEntryLocked({ hasSession: false, role }), "비세션").toBe(false);
    }
    // 데모 세션은 역할 표가 null이라 역할이 undefined로 떨어진다 → 머리말도 종전 문장이다.
    expect(isExpenseEntryLocked({ hasSession: true, role: resolveHouseholdRole({ householdRoles: null }) })).toBe(false);
  });

  it("라운드 71 E: 머리말 문장 여섯이 형제 문장의 형식을 지킨다 (DNC-018)", () => {
    for (const message of Object.values(VIEW_ONLY_HEADLINES)) {
      expect(message).toMatch(/요\.$/);
      expect(message, "비난·재시도 권유 금지").not.toMatch(/하세요|해야|다시 시도|권한이 없|할 수 없어요/);
      // **누가 할 수 있는지**라는 사실을 준다(형제 문장 셋이 공유하는 그 형식).
      expect(message).toContain("보기 전용으로 참여하고 있어요.");
      expect(message).toContain("관리자·공동부모");
    }
    // 화면마다 막힌 것이 다르므로 문장도 갈린다(표를 좁혀 한 문장으로 만들지 않는다 —
    // 라운드 70의 "판정은 한 벌, 문구는 화면별"이 여기서도 답이다).
    //
    // 라운드 71 리뷰 M-5: 셋에서 **다섯**이 됐다. 정기 지출·동기화 상태 두 자리가 지출 기록의
    // 문장을 돌려 쓰면서 그 화면에서 여전히 **할 수 있는 일**까지 부정하고 있었다.
    expect(new Set(Object.values(VIEW_ONLY_HEADLINES)).size).toBe(5);
    expect(CHILD_EDIT_VIEW_ONLY_MESSAGE).toBe("보기 전용으로 참여하고 있어요. 아이 정보는 관리자·공동부모가 수정할 수 있어요.");
  });

  /**
   * 라운드 71 리뷰 M-5 — **없는 제약을 말하지 않는다.**
   *
   * 두 화면의 잠긴 머리말이 지출 기록의 문장("기록은 관리자·공동부모가 남길 수 있어요")을 그대로
   * 돌려 쓰고 있었는데, 그 문장은 이 화면들에서 **여전히 가능한 일**까지 부정했다:
   *  - 정기 지출 템플릿은 이 기기의 메모라 보기 전용도 적고 고칠 수 있고, 게이트가 막는 것은
   *    행의 "기록하기" 하나뿐이다;
   *  - 동기화 상태의 실패·대기 행은 이 기기의 큐라 확인·폐기가 전부 열려 있고, 막히는 것은
   *    "고쳐서 다시 보내기" 하나뿐이다.
   *
   * 허위 표시는 방향을 가리지 않는다 — 할 수 있는 일을 못 한다고 말하는 것도 같은 값이다.
   */
  it("라운드 71 M-5: 정기 지출·동기화 상태 문장은 그 화면에서 여전히 가능한 일을 부정하지 않는다", () => {
    expect(VIEW_ONLY_HEADLINES.recurring).toBe(RECURRING_VIEW_ONLY_MESSAGE);
    expect(RECURRING_VIEW_ONLY_MESSAGE).toBe(
      "보기 전용으로 참여하고 있어요. 정기 지출은 적어 둘 수 있고, 기록하기는 관리자·공동부모가 할 수 있어요."
    );
    expect(VIEW_ONLY_HEADLINES.syncStatus).toBe(SYNC_STATUS_VIEW_ONLY_MESSAGE);
    expect(SYNC_STATUS_VIEW_ONLY_MESSAGE).toBe(
      "보기 전용으로 참여하고 있어요. 남은 기록은 확인하고 정리할 수 있고, 다시 보내는 것은 관리자·공동부모가 할 수 있어요."
    );

    // 지출 기록의 문장을 더는 돌려 쓰지 않는다(그 문장이 두 화면에서 하던 과장이 이 자리였다).
    expect(VIEW_ONLY_HEADLINES.recurring).not.toBe(EXPENSE_VIEW_ONLY_MESSAGE);
    expect(VIEW_ONLY_HEADLINES.syncStatus).not.toBe(EXPENSE_VIEW_ONLY_MESSAGE);

    // 그리고 **할 수 있는 일**을 실제로 말한다(첫 절이 그 자리다).
    expect(RECURRING_VIEW_ONLY_MESSAGE).toContain("적어 둘 수 있고");
    // 동기화 상태는 종전 머리말의 약속("확인하고 정리할 수 있어요")을 잠긴 쪽에서도 거두지 않는다.
    expect(SYNC_STATUS_VIEW_ONLY_MESSAGE).toContain("확인하고 정리할 수 있");
    expect(source("app/sync-status.tsx")).toContain("아직 서버에 반영되지 않은 기록을 확인하고 정리할 수 있어요.");

    // 확정이 지출을 만드는 검수 화면은 그대로 지출 기록의 형제 문장이다(그 화면에서 막히는 것은
    // 체크·분류·확정 전부라, 좁혀 말할 것이 없다 — 표를 기계적으로 갈라 놓지 않는다).
    expect(VIEW_ONLY_HEADLINES.importReview).toBe(EXPENSE_VIEW_ONLY_MESSAGE);
    expect(VIEW_ONLY_HEADLINES.expenseDetail).toBe(EXPENSE_VIEW_ONLY_MESSAGE);
  });

  it("라운드 40 J-5 문구: 사실만 말하고 약속·재촉이 없다 (DNC-018)", () => {
    expect(EXPENSE_VIEW_ONLY_EMPTY_TITLE).toBe("가족이 기록하면 여기에 쌓여요");
    expect(EXPENSE_VIEW_ONLY_EMPTY_TITLE).toMatch(/요\.?$/);
    expect(EXPENSE_VIEW_ONLY_EMPTY_TITLE).not.toMatch(/하세요|해야|다시 시도|권한이 없/);
    // "첫 기록을 남기면 …"처럼 이 사람이 만족시킬 수 없는 조건을 걸지 않는다.
    expect(EXPENSE_VIEW_ONLY_EMPTY_TITLE).not.toContain("첫 기록을 남기면");
  });
});
