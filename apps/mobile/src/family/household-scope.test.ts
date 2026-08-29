import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// 라운드 63 #2: 아이 이름 판정은 이 라운드에서 한 줄도 바뀌지 않았다 — 그 한 벌을 그대로 통과시킨다.
import { resolveChildScopeLabel } from "../children/child-switch";
import { resolveExpenseHouseholdId } from "../expenses/records-list-view";
// 라운드 61 #2: 탈퇴 뒤 세션 상태는 스토어의 **기존 API로만** 재현해 확인한다(스토어 무변경).
import { useSessionStore } from "../stores/session.store";
// 라운드 62 #4: 초대 화면과 탈퇴 화면이 **같은 파라미터 한 벌**을 지나는지 여기서 확인한다.
import { INVITE_HOUSEHOLD_PARAM, inviteScreenHref, parseInviteHouseholdParam } from "./invite-flow";
import { isExpenseEntryLocked } from "./record-permissions";
import {
  addChildScreenHref,
  ANDROID_ALERT_BUTTON_LIMIT,
  childScopeDeleteConfirmTitle,
  childScopeDeleteNotice,
  collectKnownHouseholdIds,
  describeHouseholdScope,
  HOUSEHOLD_SCOPE_ADD_CHILD_LABEL,
  HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE,
  HOUSEHOLD_SCOPE_EMPTY_LABEL,
  HOUSEHOLD_SCOPE_LEAVE_LABEL,
  HOUSEHOLD_SCOPE_PARAM,
  HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL,
  HOUSEHOLD_SCOPE_SWITCH_LABEL,
  HOUSEHOLD_SCOPE_SWITCH_MESSAGE,
  HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE,
  householdSwitchPrompt,
  householdScopeAddChildNotice,
  householdScopeInviteNotice,
  householdScopeLeaveNotice,
  householdScopeManageNotice,
  householdScopePhrase,
  isChildrenSettled,
  isMultiHouseholdAccount,
  leaveScreenHref,
  listHouseholdSwitchOptions,
  parseHouseholdScopeParam,
  resolveHouseholdChildrenLabel,
  resolveHouseholdName,
  resolveManagedHouseholdId,
  type HouseholdScopeChildRef
} from "./household-scope";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 60 트랙 A — 가구 스코프 단일화.
 *
 * 두 축을 고정한다:
 *  1. 순수 판정(이 파일이 곧 규칙): 대상 가구 · 다가구 여부 · 표기.
 *  2. 화면 배선(source contract — 화면은 react-native를 끌어와 vitest에서 렌더할 수 없다):
 *     여섯 화면이 세션 기본 가구를 **직접** 쓰지 않고 이 모듈의 판정을 통과한다.
 *
 * 가장 중요한 계약은 **1가구 계정 불변**이다 -- 아래 첫 describe가 그것만 따로 잡는다.
 */

const singleHousehold: HouseholdScopeChildRef[] = [
  { id: "child-daon", householdId: "household-1", nickname: "다온이" },
  { id: "child-sol", householdId: "household-1", nickname: "솔이" }
];

const multiHousehold: HouseholdScopeChildRef[] = [
  { id: "child-daon", householdId: "household-1", nickname: "다온이" },
  { id: "child-haneul", householdId: "household-2", nickname: "하늘이" }
];

describe("1가구 계정에서는 아무것도 달라지지 않는다", () => {
  it("대상 가구는 종전의 defaultHouseholdId와 같은 값이다", () => {
    for (const childId of ["child-daon", "child-sol"]) {
      expect(
        resolveManagedHouseholdId({
          children: singleHousehold,
          childId,
          fallbackHouseholdId: "household-1",
          childrenSettled: true
        })
      ).toBe("household-1");
    }
  });

  it("가구 표기는 전부 null이라 화면 문자열이 한 글자도 늘지 않는다", () => {
    const descriptor = describeHouseholdScope({
      householdId: "household-1",
      children: singleHousehold,
      knownHouseholdIds: ["household-1"],
      fallbackHouseholdId: "household-1"
    });
    expect(descriptor).toBeNull();

    const phrase = householdScopePhrase(descriptor);
    expect(phrase).toBeNull();
    expect(householdScopeAddChildNotice(phrase)).toBeNull();
    expect(householdScopeManageNotice(phrase)).toBeNull();
    expect(householdScopeInviteNotice(phrase)).toBeNull();
    expect(householdScopeLeaveNotice(phrase)).toBeNull();
  });

  it("가구가 몇인지 모르는 계정도 1가구와 같게 다룬다(모르면 붙이지 않는다)", () => {
    expect(isMultiHouseholdAccount({ children: null, knownHouseholdIds: null, fallbackHouseholdId: null })).toBe(false);
    expect(
      describeHouseholdScope({ householdId: "household-1", children: null, fallbackHouseholdId: "household-1" })
    ).toBeNull();
  });
});

describe("resolveManagedHouseholdId — 대상 가구 판정", () => {
  it("선택된 아이의 가구가 세션 기본 가구를 이긴다(초대 수락으로 기본 가구가 바뀐 계정)", () => {
    expect(
      resolveManagedHouseholdId({
        children: multiHousehold,
        childId: "child-daon",
        // 시가 가구 초대를 수락해 기본 가구가 household-2로 바뀐 상태.
        fallbackHouseholdId: "household-2",
        childrenSettled: true
      })
    ).toBe("household-1");
  });

  it("판정 규칙은 라운드 27 L-4(resolveExpenseHouseholdId)에 위임한다 — 규칙이 두 벌이 되지 않는다", () => {
    const cases = [
      { children: multiHousehold, childId: "child-haneul", fallbackHouseholdId: "household-1" },
      { children: multiHousehold, childId: "없는-아이", fallbackHouseholdId: "household-1" },
      // 아이는 찾았는데 householdId가 비어 있으면(구버전 캐시) 그때만 폴백을 쓴다.
      { children: [{ id: "child-x", householdId: null }], childId: "child-x", fallbackHouseholdId: "household-9" }
    ] as const;

    for (const input of cases) {
      const delegated = resolveExpenseHouseholdId(input);
      if (!delegated) continue;
      expect(resolveManagedHouseholdId({ ...input, childrenSettled: true })).toBe(delegated);
    }
  });

  it("아이 목록을 아직 기다리는 동안에는 기본 가구로 메우지 않는다(null = 모름)", () => {
    expect(
      resolveManagedHouseholdId({
        children: undefined,
        childId: "child-daon",
        fallbackHouseholdId: "household-2",
        childrenSettled: false
      })
    ).toBeNull();
  });

  it("조회가 끝났는데 아이 기준으로 좁힐 수 없으면 기본 가구다(첫 아이 · 미선택 · 목록에 없음)", () => {
    const settled = { fallbackHouseholdId: "household-1", childrenSettled: true } as const;
    // 아이가 0명인 첫 가입 계정: 기본 가구가 아는 유일한 사실이다.
    expect(resolveManagedHouseholdId({ children: [], childId: null, ...settled })).toBe("household-1");
    expect(resolveManagedHouseholdId({ children: singleHousehold, childId: null, ...settled })).toBe("household-1");
    expect(resolveManagedHouseholdId({ children: singleHousehold, childId: "없는-아이", ...settled })).toBe(
      "household-1"
    );
    // 조회가 끝났는데 계정에 가구 자체가 없으면 여전히 null이다(지어내지 않는다).
    expect(
      resolveManagedHouseholdId({ children: [], childId: null, fallbackHouseholdId: null, childrenSettled: true })
    ).toBeNull();
  });
});

describe("다가구 판정", () => {
  it("아는 사실을 모두 모아 중복 없이 센다(아이 목록 · 서버가 말한 목록 · 기본 가구)", () => {
    expect(
      collectKnownHouseholdIds({
        children: multiHousehold,
        knownHouseholdIds: ["household-2", "  ", "household-3"],
        fallbackHouseholdId: "household-1"
      })
    ).toEqual(["household-1", "household-2", "household-3"]);
  });

  it("아이가 한 가구에만 있어도 서버가 말한 가구가 둘이면 다가구다", () => {
    expect(
      isMultiHouseholdAccount({
        children: singleHousehold,
        knownHouseholdIds: ["household-1", "household-2"],
        fallbackHouseholdId: "household-1"
      })
    ).toBe(true);
  });
});

describe("가구 이름은 아는 것만 말한다", () => {
  it("캐시 행이 householdName을 실제로 싣고 있을 때만 이름이 된다", () => {
    expect(
      resolveHouseholdName({
        householdId: "household-2",
        children: [{ id: "child-haneul", householdId: "household-2", householdName: "시가" }]
      })
    ).toBe("시가");
    expect(
      resolveHouseholdName({
        householdId: "household-2",
        members: [{ id: "member-1", householdId: "household-2", householdName: " 시가 " }]
      })
    ).toBe("시가");
  });

  it("서버가 이름을 싣지 않는 오늘의 응답에서는 null이다(지어내지 않는다)", () => {
    // 실제 GET /children · GET /households/:id/members 응답의 모양 그대로.
    expect(resolveHouseholdName({ householdId: "household-1", children: singleHousehold, members: [] })).toBeNull();
    expect(
      resolveHouseholdName({
        householdId: "household-1",
        members: [{ id: "m1", householdId: "household-1", displayName: "엄마", role: "owner" }]
      })
    ).toBeNull();
    // 다른 가구 행의 이름을 빌려 오지 않는다.
    expect(
      resolveHouseholdName({
        householdId: "household-1",
        children: [{ id: "child-haneul", householdId: "household-2", householdName: "시가" }]
      })
    ).toBeNull();
    // 빈 이름도 이름이 아니다.
    expect(
      resolveHouseholdName({
        householdId: "household-1",
        children: [{ id: "child-daon", householdId: "household-1", householdName: "   " }]
      })
    ).toBeNull();
  });

  it("그 가구의 아이들은 이름이 아니라 사실이다 — 이름을 모를 때 가구를 가리키는 근거", () => {
    expect(resolveHouseholdChildrenLabel({ householdId: "household-1", children: multiHousehold })).toBe("다온이");
    expect(resolveHouseholdChildrenLabel({ householdId: "household-1", children: singleHousehold })).toBe(
      "다온이 · 솔이"
    );
    expect(resolveHouseholdChildrenLabel({ householdId: "household-3", children: multiHousehold })).toBeNull();
    // 태명을 모르는 행만 있으면 가리킬 사실이 없다.
    expect(
      resolveHouseholdChildrenLabel({
        householdId: "household-1",
        children: [{ id: "child-daon", householdId: "household-1", nickname: "  " }]
      })
    ).toBeNull();
  });
});

describe("다가구 계정의 표기", () => {
  const scope = {
    householdId: "household-1",
    children: multiHousehold,
    knownHouseholdIds: ["household-1", "household-2"],
    fallbackHouseholdId: "household-2"
  } as const;

  it("이름을 모르면 그 가구의 아이로 가리킨다", () => {
    const descriptor = describeHouseholdScope(scope);
    expect(descriptor).toEqual({ kind: "children", text: "다온이" });
    expect(householdScopePhrase(descriptor)).toBe("다온이의 가구");
  });

  it("서버가 이름을 알려주면 이름이 이긴다", () => {
    const descriptor = describeHouseholdScope({
      ...scope,
      children: [{ id: "child-daon", householdId: "household-1", nickname: "다온이", householdName: "우리집" }, ...multiHousehold]
    });
    expect(descriptor).toEqual({ kind: "name", text: "우리집" });
    expect(householdScopePhrase(descriptor)).toBe("‘우리집’ 가구");
  });

  it("가리킬 사실이 하나도 없으면 아무것도 적지 않는다", () => {
    const descriptor = describeHouseholdScope({
      ...scope,
      householdId: "household-3",
      children: multiHousehold
    });
    expect(descriptor).toBeNull();
    expect(householdScopePhrase(descriptor)).toBeNull();
  });

  it("네 화면의 문장은 한 곳에서만 만들어진다", () => {
    const phrase = householdScopePhrase(describeHouseholdScope(scope));
    expect(householdScopeAddChildNotice(phrase)).toBe("다온이의 가구에 추가돼요.");
    expect(householdScopeManageNotice(phrase)).toBe("다온이의 가구를 관리하고 있어요.");
    expect(householdScopeInviteNotice(phrase)).toBe("다온이의 가구로 초대해요.");
    expect(householdScopeLeaveNotice(phrase)).toBe("다온이의 가구에서 나가요.");
  });

  it("DNC-018: 문구는 해요체를 유지한다", () => {
    const phrase = householdScopePhrase(describeHouseholdScope(scope));
    for (const notice of [
      householdScopeAddChildNotice(phrase),
      householdScopeManageNotice(phrase),
      householdScopeInviteNotice(phrase),
      householdScopeLeaveNotice(phrase)
    ]) {
      expect(notice).toMatch(/요\.$/);
    }
  });
});

describe("화면 배선 (source contract — 화면은 vitest에서 렌더할 수 없다)", () => {
  const scopedScreens = [
    "app/settings/children.tsx",
    "app/family/index.tsx",
    "app/family/invite.tsx",
    "app/settings/privacy.tsx",
    "app/(tabs)/more.tsx",
    "app/settings/index.tsx"
  ] as const;

  it("여섯 화면 모두 세션 기본 가구를 대상 가구로 **직접** 쓰지 않는다", () => {
    for (const path of scopedScreens) {
      const screenSource = source(path);
      expect(screenSource, path).toContain("resolveManagedHouseholdId({");
      // 종전 형태(= 기본 가구가 곧 대상 가구)가 되살아나면 초대 수락 뒤 오배치가 그대로 돌아온다.
      expect(screenSource, path).not.toContain(
        "const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);"
      );
      expect(screenSource, path).toContain(
        "const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);"
      );
      // 판정은 언제나 선택된 아이 기준이다(스토어에서 읽은 그 값).
      expect(screenSource, path).toMatch(/childId(: (selectedChildId|childId))?,\n\s+fallbackHouseholdId/);
    }
  });

  it("아이 추가는 선택된 아이의 가구에 만들고, 다가구면 어디에 만드는지 적는다", () => {
    const screenSource = source("app/settings/children.tsx");
    expect(screenSource).toContain("buildCreateChildBody(householdId!, input.stageMode, input.values)");
    expect(screenSource).toContain("const addHouseholdNotice = householdScopeAddChildNotice(");
    expect(screenSource).toContain(
      "{addHouseholdNotice ? <Text style={mutedTextStyle}>{addHouseholdNotice}</Text> : null}"
    );
    // 역할 게이트도 같은 가구를 묻는다(A 가구 owner가 B 가구 viewer로 잠기지 않도록).
    expect(screenSource).toContain('queryKey: ["household-members", householdId]');
  });

  it("가족 관리는 아이의 가구를 관리하고, 가구가 정해지기 전에는 미리보기를 그리지 않는다", () => {
    const screenSource = source("app/family/index.tsx");
    expect(screenSource).toContain('queryKey: ["household-members", householdId]');
    expect(screenSource).toContain('queryKey: ["household-invites", householdId]');
    expect(screenSource).toContain("removeHouseholdMember(authToken!, householdId!, memberId)");
    expect(screenSource).toContain("cancelHouseholdInvite(authToken!, householdId!, inviteId)");
    // 대기 창(아이 목록 조회 중)은 스켈레톤이 덮는다 -- 비로그인 픽스처도, 다른 가구의 삭제
    // 버튼도 그리지 않는다.
    expect(screenSource).toContain(
      "const householdScopePending = Boolean(authToken) && !householdId && childrenQuery.isPending;"
    );
    expect(screenSource).toContain('if (householdScopePending || (hasSession && membersPhase === "loading")) {');
    expect(screenSource).toContain(
      "{householdNotice ? <Text style={familyScopeNoticeStyle}>{householdNotice}</Text> : null}"
    );
  });

  it("초대 생성도 같은 가구로 가고, 대기 중에는 '가구 정보가 없다'고 단정하지 않는다", () => {
    const screenSource = source("app/family/invite.tsx");
    expect(screenSource).toContain("createInvite(authToken!, householdId!, role, \"link\")");
    expect(screenSource).toContain("{householdNotice ? <Text style={mutedTextStyle}>{householdNotice}</Text> : null}");
    expect(screenSource).toContain("{childrenSettled && !householdId ? (");
  });

  it("가구 탈퇴는 아이의 가구를 대상으로 하고 어느 가구인지 말한다(서버 무변경)", () => {
    const screenSource = source("app/settings/privacy.tsx");
    expect(screenSource).toContain("previewHouseholdLeave(authToken!, householdId!)");
    expect(screenSource).toContain(
      "confirmHouseholdLeave(authToken!, householdId!, householdPreview.data?.confirmationText ?? \"\")"
    );
    expect(screenSource).toContain("const householdLeaveNotice = householdScopeLeaveNotice(");
    expect(screenSource).toContain(
      "{householdLeaveNotice ? <Text style={mutedTextStyle}>{householdLeaveNotice}</Text> : null}"
    );
  });

  it("요약 두 줄이 같은 가구를 센다(더보기 가구 카드 · 설정 요약)", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    // 캡션 자체는 종전 그대로(센 수만 말한다) -- 바뀐 것은 **무엇을 세는가**다.
    expect(moreSource).toContain(
      "activeMemberCount !== null && childCount !== null ? `보호자 ${activeMemberCount}명 · 아이 ${childCount}명` : null"
    );
    expect(moreSource).toContain(
      "children.data?.children.filter((child) => child.householdId === householdId).length ?? null"
    );

    const settingsSource = source("app/settings/index.tsx");
    expect(settingsSource).toContain("`가족 ${members.data.members.length}명`");
    expect(settingsSource).toContain('queryKey: ["household-members", householdId]');
    // "연결된 가구가 없어요"는 계정에 가구가 없을 때만이다(아이 목록 대기 중이 아니라).
    expect(settingsSource).toContain("!fallbackHouseholdId && !householdId");
  });

  it("읽기 경로(라운드 27 L-4)는 이 모듈이 건드리지 않는다 — 판정은 위임이지 복제가 아니다", () => {
    // 규칙 본문은 여전히 records-list-view 한 곳에 있다.
    const moduleSource = source("src/family/household-scope.ts");
    expect(moduleSource).toContain('import { resolveExpenseHouseholdId, type ChildHouseholdRef } from "../expenses/records-list-view";');
    expect(moduleSource).toContain("const scoped = resolveExpenseHouseholdId({");
  });

  /**
   * 라운드 60 리뷰(P1-3): 트랙 A가 남겨 둔 "기본 가구를 영구히 바꾸는 자리"는 이제 **없다**.
   *
   * 종전 계약은 "그 자리는 그대로 남아 있다(트랙 C 소유)"였다. 트랙 C가 실제로 그 자리를
   * 고쳤으므로 계약도 사실을 따라간다: 초대 수락은 기본 가구를 **모를 때만** 채우고, 아는
   * 가구 목록에 더하기만 한다. 그래야 아이가 아직 없는 원래 가구가 목록에 남아 아래
   * `listHouseholdSwitchOptions`의 후보가 된다.
   */
  it("초대 수락은 기본 가구를 덮어쓰지 않는다 (라운드 60 리뷰 P1-3 — 트랙 C에서 이행됨)", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    expect(acceptSource).toContain("if (!useSessionStore.getState().defaultHouseholdId) {");
    expect(acceptSource.split("defaultHouseholdId: result.household.id").length - 1).toBe(1);
    expect(acceptSource).toContain(
      "useSessionStore.getState().setHouseholdRole(result.household.id, result.household.role);"
    );
  });

  /**
   * 라운드 60 리뷰(P2-4): `childrenSettled`는 여섯 화면이 각자 적던 식이었다. 규칙이 여섯 벌이면
   * 한 곳만 고쳐지는 날이 오고, 그 날의 증상이 곧 이 모듈이 존재하는 이유와 같은 문제다.
   */
  it("childrenSettled 규칙은 한 벌뿐이다 (여섯 화면 모두 헬퍼를 통과한다)", () => {
    for (const path of scopedScreens) {
      const screenSource = source(path);
      expect(screenSource, path).toContain("isChildrenSettled({");
      // 화면이 규칙을 다시 적는 형태(성공/실패 논리합)가 남아 있으면 안 된다.
      expect(screenSource, path).not.toMatch(/childrenSettled(:| =)\s*(!authToken \|\| )?[\w.]+\.isSuccess/);
    }
  });

  it("헬퍼 자체의 규칙 — 토큰이 없으면 기다릴 조회가 없다", () => {
    expect(isChildrenSettled({ authToken: null, isSuccess: false, isError: false })).toBe(true);
    expect(isChildrenSettled({ authToken: undefined })).toBe(true);
    expect(isChildrenSettled({ authToken: "token", isSuccess: false, isError: false })).toBe(false);
    expect(isChildrenSettled({ authToken: "token", isSuccess: true, isError: false })).toBe(true);
    expect(isChildrenSettled({ authToken: "token", isSuccess: false, isError: true })).toBe(true);
  });
});

/**
 * 라운드 60 리뷰(P1-3) — **아이 없는 가구도 관리 대상 후보다.**
 *
 * `resolveManagedHouseholdId`는 "보고 있는 아이의 가구"라 아이가 하나도 없는 가구를 영영
 * 가리킬 수 없다. 초대로 막 들어간 가구가 대개 그렇고, 그 가구의 구성원 관리·초대는 가족
 * 화면 말고는 어디에도 없다. 그래서 아는 가구 전부를 전환 후보로 세운다.
 */
describe("가구 전환 후보 (라운드 60 리뷰 P1-3)", () => {
  it("1가구 계정에서는 후보가 없다 — 화면이 종전과 한 노드도 달라지지 않는다", () => {
    expect(
      listHouseholdSwitchOptions({
        currentHouseholdId: "household-1",
        children: singleHousehold,
        knownHouseholdIds: ["household-1"],
        fallbackHouseholdId: "household-1"
      })
    ).toEqual([]);
    // 몇 가구인지 모르는 계정도 같다(모르면 붙이지 않는다).
    expect(
      listHouseholdSwitchOptions({
        currentHouseholdId: "household-1",
        children: null,
        knownHouseholdIds: null,
        fallbackHouseholdId: "household-1"
      })
    ).toEqual([]);
  });

  it("아이가 하나도 없는 가구도 후보에 들어온다 (서버가 말한 목록이 그것을 안다)", () => {
    const options = listHouseholdSwitchOptions({
      currentHouseholdId: "household-1",
      children: singleHousehold,
      // household-2 = 방금 초대를 수락해 들어간 가구. 아이는 아직 없다.
      knownHouseholdIds: ["household-1", "household-2"],
      fallbackHouseholdId: "household-1"
    });
    expect(options.map((option) => option.householdId)).toEqual(["household-1", "household-2"]);
    expect(options[1]).toEqual({
      householdId: "household-2",
      label: HOUSEHOLD_SCOPE_EMPTY_LABEL,
      isCurrent: false
    });
    // 이름 대신 사실이다 -- 지어낸 이름이 아니다.
    expect(options[1].label).toBe("아이가 아직 없는 가구");
  });

  it("표기 규율은 한 벌이다 (이름 → 그 가구의 아이 → 사실)", () => {
    const options = listHouseholdSwitchOptions({
      currentHouseholdId: "household-2",
      children: [
        { id: "child-daon", householdId: "household-1", nickname: "다온이" },
        { id: "child-haneul", householdId: "household-2", nickname: "하늘이", householdName: "시가" }
      ],
      knownHouseholdIds: ["household-1", "household-2"],
      fallbackHouseholdId: "household-1"
    });
    expect(options).toEqual([
      { householdId: "household-1", label: "다온이의 가구", isCurrent: false },
      { householdId: "household-2", label: "‘시가’ 가구", isCurrent: true }
    ]);
  });

  it("가족 화면이 그 후보로 전환 입구를 그린다 (소스 계약 — 화면은 렌더할 수 없다)", () => {
    const screenSource = source("app/family/index.tsx");
    expect(screenSource).toContain("listHouseholdSwitchOptions({");
    expect(screenSource).toContain("{householdSwitchOptions.length >= 2 ? (");
    expect(screenSource).toContain("accessibilityLabel={HOUSEHOLD_SCOPE_SWITCH_LABEL}");
    // 전환은 **보는 대상**만 바꾼다 -- 세션의 기본 가구를 다시 갈아 끼우면 P1-3의 소실을
    // 이번엔 사용자 손으로 되풀이하게 된다.
    expect(screenSource).toContain("const [viewedHouseholdId, setViewedHouseholdId] = useState<string | null>(null);");
    expect(screenSource).not.toContain("setState({ defaultHouseholdId");
    // 판정은 여전히 아이 기준이 기본이고, 전환은 그 위에 얹힌다.
    expect(screenSource).toContain("const scopedHouseholdId = resolveManagedHouseholdId({");
    expect(screenSource).toContain(
      "viewedHouseholdId && knownHouseholdIdList.includes(viewedHouseholdId) ? viewedHouseholdId : scopedHouseholdId;"
    );
  });
});

/**
 * 라운드 61 #1 — **전환 Alert이 Android 3버튼 상한에서 살아남는다.**
 *
 * react-native의 Android Alert은 `buttons.slice(0, 3)`으로 네 번째부터를 조용히 버린다. 라운드
 * 60이 신설한 "다른 가구 보기"는 버튼이 `닫기 + 가구 수`였으므로 **3가구부터 마지막 후보가
 * 말없이 사라졌다** — 이 저장소가 이미 세 번 적어 둔 함정(record-row-actions ·
 * notification-row-actions · invite-flow)을 그 신설만 지나쳤다.
 */
describe("가구 전환 Alert의 버튼 수 계약 (라운드 61 #1)", () => {
  const optionsOf = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      householdId: `household-${index + 1}`,
      label: `가구 ${index + 1}`,
      isCurrent: index === 0
    }));

  /** 화면이 실제로 만드는 버튼 배열 그대로(닫기가 앞, 후보가 뒤) — Android는 여기서 잘라낸다. */
  const renderedButtons = (platform: string, count: number) => {
    const prompt = householdSwitchPrompt(platform, optionsOf(count));
    const buttons = [
      ...(prompt.showsCloseButton ? [HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL] : []),
      ...prompt.options.map((option) => option.label)
    ];
    return platform === "android" ? buttons.slice(0, ANDROID_ALERT_BUTTON_LIMIT) : buttons;
  };

  it("2가구(오늘의 대부분)에서는 종전 그대로다 — 닫기 + 두 후보", () => {
    const prompt = householdSwitchPrompt("android", optionsOf(2));
    expect(prompt.showsCloseButton).toBe(true);
    expect(prompt.cancelable).toBe(false);
    expect(prompt.exceedsButtonLimit).toBe(false);
    expect(prompt.message).toBe(HOUSEHOLD_SCOPE_SWITCH_MESSAGE);
    expect(prompt.title).toBe(HOUSEHOLD_SCOPE_SWITCH_LABEL);
    expect(renderedButtons("android", 2)).toEqual([HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL, "가구 1", "가구 2"]);
  });

  it("3가구: 잘리는 것은 후보가 아니라 닫기다 — 대신 바깥 탭으로 닫는다", () => {
    const prompt = householdSwitchPrompt("android", optionsOf(3));
    expect(prompt.showsCloseButton).toBe(false);
    // 닫기 버튼이 없으면 닫을 길이 반드시 있어야 한다(Android 다이얼로그 기본값은 cancelable=false).
    expect(prompt.cancelable).toBe(true);
    expect(prompt.exceedsButtonLimit).toBe(false);
    // 종전에는 여기서 세 번째 가구가 말없이 사라졌다.
    expect(renderedButtons("android", 3)).toEqual(["가구 1", "가구 2", "가구 3"]);
  });

  it("어떤 후보 수에서도 그려지는 버튼은 상한을 넘지 않는다", () => {
    for (let count = 2; count <= 6; count += 1) {
      expect(renderedButtons("android", count).length, `${count}가구`).toBeLessThanOrEqual(
        ANDROID_ALERT_BUTTON_LIMIT
      );
    }
  });

  it("후보 4+에서는 Alert이 맞지 않다는 사실을 판정 결과로 돌려준다 (자르지 않는다)", () => {
    const prompt = householdSwitchPrompt("android", optionsOf(4));
    // 후보는 한 줄도 잘리지 않는다 -- 자르는 일은 RN이 하고, 이 판정은 그 사실을 말한다.
    expect(prompt.options).toHaveLength(4);
    expect(prompt.exceedsButtonLimit).toBe(true);
    expect(prompt.reachableOptionCount).toBe(ANDROID_ALERT_BUTTON_LIMIT);
    expect(prompt.showsCloseButton).toBe(false);
    expect(prompt.cancelable).toBe(true);
    // 사용자에게도 같은 사실을 말한다 — 조용히 사라지던 종전과 다른 점이 이것이다.
    expect(prompt.message).toContain(HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE);
    // DNC-018: 해요체.
    expect(HOUSEHOLD_SCOPE_SWITCH_OVERFLOW_NOTICE).toMatch(/요\.$/);
    expect(HOUSEHOLD_SCOPE_SWITCH_MESSAGE).toMatch(/요\.$/);
  });

  it("상한이 없는 플랫폼에서는 닫기도 후보도 그대로다", () => {
    for (const platform of ["ios", "web"]) {
      const prompt = householdSwitchPrompt(platform, optionsOf(5));
      expect(prompt.showsCloseButton, platform).toBe(true);
      expect(prompt.cancelable, platform).toBe(false);
      expect(prompt.exceedsButtonLimit, platform).toBe(false);
      expect(prompt.reachableOptionCount, platform).toBe(5);
      expect(renderedButtons(platform, 5), platform).toHaveLength(6);
    }
  });

  it("1가구 계정은 이 Alert 자체가 없다(후보 0~1) — 판정은 그래도 안전하게 답한다", () => {
    for (const count of [0, 1]) {
      const prompt = householdSwitchPrompt("android", optionsOf(count));
      expect(prompt.showsCloseButton, `${count}`).toBe(true);
      expect(prompt.exceedsButtonLimit, `${count}`).toBe(false);
    }
    // 화면이 이 Alert을 여는 문턱은 후보 2 이상이다(1가구 계정 불변 · FAM-001 픽셀락).
    expect(source("app/family/index.tsx")).toContain("{householdSwitchOptions.length >= 2 ? (");
  });

  it("가족 화면은 버튼 구성을 스스로 정하지 않는다 (소스 계약)", () => {
    const screenSource = source("app/family/index.tsx");
    expect(screenSource).toContain("const prompt = householdSwitchPrompt(Platform.OS, householdSwitchOptions);");
    expect(screenSource).toContain(
      "...(prompt.showsCloseButton\n          ? [{ text: HOUSEHOLD_SCOPE_SWITCH_CLOSE_LABEL, style: \"cancel\" as const }]\n          : []),"
    );
    expect(screenSource).toContain("{ cancelable: prompt.cancelable }");
    // 종전의 하드코딩(늘 붙던 닫기 버튼 · 화면 안의 본문 문자열)이 되살아나면 상한이 다시 깨진다.
    expect(screenSource).not.toContain('{ text: "닫기", style: "cancel" as const },');
    expect(screenSource).not.toContain("관리할 가구를 골라 주세요");
  });
});

/**
 * 라운드 61 #2 — **가구를 나가면 세션에서도 나간다.**
 *
 * 탈퇴 성공 뒤 캐시만 무효화하던 자리. 이 계정이 아는 가구는 캐시가 아니라 세션 스토어에
 * 있으므로(persist), 나간 가구가 전환 후보·다가구 판정·다음 탈퇴 대상으로 계속 남아 있었다.
 */
describe("탈퇴 후 세션 잔재 정리 (라운드 61 #2 — source contract)", () => {
  const privacySource = () => source("app/settings/privacy.tsx");

  it("나간 가구가 기본 가구면 비운다 — 죽은 값을 붙들지 않는다", () => {
    const screenSource = privacySource();
    expect(screenSource).toContain(
      "if (leftHouseholdId && useSessionStore.getState().defaultHouseholdId === leftHouseholdId) {"
    );
    expect(screenSource).toContain("useSessionStore.setState({ defaultHouseholdId: null });");
    // 남은 가구 중 하나를 기본으로 **지어내지** 않는다(사용자가 고른 적 없는 선택이다).
    expect(screenSource).not.toMatch(/defaultHouseholdId: (?!null)/);
  });

  it("라운드 60 '덮어쓰기 금지' 계약과 구분되는 근거가 코드 옆에 적혀 있다", () => {
    // 수락 화면은 여전히 **살아 있는** 기본 가구를 덮어쓰지 않는다(그 계약은 그대로다).
    const acceptSource = source("app/family/accept/[token].tsx");
    expect(acceptSource).toContain("if (!useSessionStore.getState().defaultHouseholdId) {");
    // 탈퇴 쪽에는 왜 지우는 것이 그 계약과 충돌하지 않는지가 적혀 있어야 한다 -- 두 규칙이
    // 근거 없이 마주 보면 다음 라운드가 둘 중 하나를 되돌린다.
    const screenSource = privacySource();
    expect(screenSource).toContain("덮어쓰기 금지");
    expect(screenSource).toContain("죽은 값");
  });

  it("가구 목록·역할 표를 서버 기준으로 다시 받는다 (초대 수락과 같은 관례)", () => {
    const screenSource = privacySource();
    expect(screenSource).toContain(
      'import { revalidateHouseholdRoles } from "../../src/family/useExpenseEntryGate";'
    );
    expect(screenSource).toContain("revalidateHouseholdRoles({ force: true });");
    // 같은 한 줄이 초대 수락에도 있다 -- 재검증 경로는 한 벌뿐이다(새 모듈을 만들지 않는다).
    expect(source("app/family/accept/[token].tsx")).toContain("revalidateHouseholdRoles({ force: true });");
  });

  it("정리는 탈퇴가 **성공한 뒤**에만 일어난다", () => {
    const screenSource = privacySource();
    const mutationBlock = screenSource.slice(
      screenSource.indexOf("const householdLeave = useMutation({"),
      screenSource.indexOf("const accountPreview = useMutation({")
    );
    expect(mutationBlock).toContain("onSuccess: async () => {");
    expect(mutationBlock).toContain("revalidateHouseholdRoles({ force: true });");
    expect(mutationBlock).toContain("useSessionStore.setState({ defaultHouseholdId: null });");
    // 세션 자체는 건드리지 않는다 -- 가구를 나갔을 뿐 로그아웃이 아니다(계정 삭제 쪽만
    // clearSession을 부른다). 주석에서 그 함수를 **언급**하는 것은 호출이 아니므로, 줄 첫
    // 토큰이 호출인 형태만 잡는다.
    expect(mutationBlock).not.toMatch(/\n\s*clearSession\(/);
  });

  /**
   * 소스 계약 위에 **결과**를 한 번 확인한다: 화면이 하는 그 두 가지(기본 가구 비우기 ·
   * 서버 응답으로 표 갈아 끼우기)를 스토어의 **기존 API로만** 재현해, 나간 가구가 전환
   * 후보에서 실제로 사라지는지 본다. 스토어는 이 라운드에서 한 줄도 바뀌지 않았다.
   */
  it("나간 가구는 전환 후보에서 사라진다 (스토어 기존 API로 재현)", () => {
    useSessionStore.getState().setSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      userId: "user-1",
      defaultHouseholdId: "household-1",
      households: [
        { id: "household-1", role: "owner" },
        { id: "household-2", role: "co_parent" }
      ]
    });
    // household-1에서 나갔다: ① 기본 가구가 그 가구였으므로 비우고, ② 서버가 지금 말하는
    // 목록으로 표를 갈아 끼운다(revalidateHouseholdRoles → setHouseholdRoles).
    useSessionStore.setState({ defaultHouseholdId: null });
    useSessionStore.getState().setHouseholdRoles([{ id: "household-2", role: "co_parent" }]);

    const session = useSessionStore.getState();
    expect(session.defaultHouseholdId).toBeNull();
    expect(session.householdIds).toEqual(["household-2"]);
    expect(session.householdRoles).toEqual({ "household-2": "co_parent" });
    // 종전에는 여기서 household-1이 후보로 남아 있었다(고르면 403/404뿐인 가구).
    expect(
      listHouseholdSwitchOptions({
        currentHouseholdId: "household-2",
        children: [],
        knownHouseholdIds: session.householdIds,
        fallbackHouseholdId: session.defaultHouseholdId
      })
    ).toEqual([]);
    expect(
      collectKnownHouseholdIds({
        children: [],
        knownHouseholdIds: session.householdIds,
        fallbackHouseholdId: session.defaultHouseholdId
      })
    ).toEqual(["household-2"]);
  });

  it("마지막 가구에서 나오면 빈 목록이 표·목록을 둘 다 '모름'으로 만든다(잠그지 않는다)", () => {
    useSessionStore.getState().setSession({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      userId: "user-1",
      defaultHouseholdId: "household-1",
      households: [{ id: "household-1", role: "viewer" }]
    });
    useSessionStore.setState({ defaultHouseholdId: null });
    // 서버는 "가구가 하나도 없다"고 답한다 -- setHouseholdRoles의 빈 목록 경로.
    useSessionStore.getState().setHouseholdRoles([]);

    const session = useSessionStore.getState();
    expect(session.householdRoles).toBeNull();
    expect(session.householdIds).toBeNull();
    // 모름은 아무것도 잠그지 않는다(record-permissions의 계약) -- 가구 없는 계정이 자기
    // 화면에서 잠기는 일은 생기지 않는다.
    expect(isExpenseEntryLocked({ hasSession: true, role: null })).toBe(false);
    // 세션 자체는 살아 있다(탈퇴는 로그아웃이 아니다).
    expect(session.accessToken).toBe("access-token");
    expect(session.userId).toBe("user-1");
  });

  it("P3: 탈퇴 가구의 템플릿·알림 잔재는 근거만 남긴다(이번 범위 밖)", () => {
    const screenSource = privacySource();
    expect(screenSource).toContain("src/stores/recurring-expense.store.ts");
    expect(screenSource).toContain("src/notifications/notification.store.ts");
    // 근거가 사실과 어긋나면 안 된다: 두 저장소는 가구가 아니라 **아이 단위**로 쌓이고,
    // PRIV-104 teardown은 정체성 전환에만 걸린다(탈퇴는 같은 사람이 계속 로그인해 있다).
    expect(source("src/offline/session-teardown.ts")).toContain(
      "return next.userId !== previous.userId || next.isTestSession !== previous.isTestSession;"
    );
  });
});

/**
 * 라운드 62 #4 — **아이 없는 가구에서 나가는 길.**
 *
 * 탈퇴 대상은 `resolveManagedHouseholdId`가 정하는데, 그 판정은 아이가 하나도 없는 가구를
 * 구조적으로 가리킬 수 없다(1단계는 선택 아이의 가구, 3단계는 기본 가구). 그래서 초대를 수락해
 * 들어간 빈 가구는 "다른 가구 보기"로 볼 수만 있고 앱 안에서 나갈 방법이 없었다 -- 계정에 영구히
 * 붙어 있는 가구가 생긴다. 라운드 61 #3이 초대 화면까지 만들어 둔 그 파라미터 관례를 탈퇴
 * 화면으로 넓혀 그 막다른 길을 연다.
 */
describe("라운드 62 #4 가구 전환을 탈퇴 화면까지 (파라미터 관례)", () => {
  const known = ["household-1", "household-2"];

  it("아이가 없는 가구는 종전 판정으로 영영 가리켜지지 않는다 (이 라운드가 여는 그 막다른 길)", () => {
    // 시가에서 만든 빈 가구(household-2)의 초대를 수락한 계정: 아이는 household-1에만 있다.
    const children: HouseholdScopeChildRef[] = [
      { id: "child-daon", householdId: "household-1", nickname: "다온이" }
    ];
    for (const childId of ["child-daon", null]) {
      expect(
        resolveManagedHouseholdId({
          children,
          childId,
          fallbackHouseholdId: "household-1",
          childrenSettled: true
        })
      ).toBe("household-1");
    }
    // 그런데 전환 후보에는 그 빈 가구가 서 있다(서버가 말한 목록이 그것을 안다).
    expect(
      listHouseholdSwitchOptions({
        currentHouseholdId: "household-1",
        children,
        knownHouseholdIds: known,
        fallbackHouseholdId: "household-1"
      }).map((option) => option.householdId)
    ).toEqual(known);
  });

  it("목적지는 초대와 **같은 관례**다 — 전환 중일 때만 싣는다", () => {
    expect(HOUSEHOLD_SCOPE_PARAM).toBe("householdId");
    expect(leaveScreenHref("household-2")).toEqual({
      pathname: "/settings/privacy",
      params: { householdId: "household-2" }
    });
    // 전환하지 않았으면 **파라미터 자체가 생기지 않는다** -- 1가구 계정의 탈퇴 화면은 종전과
    // 한 글자도 달라지지 않는다(SET-003의 1가구 문자열 불변 계약 -- 캡처 아님. 라운드 66 F
    // 정정: 설정 계열 캡처 라우트는 SET-001뿐이다. 그 불변을 잠그는 것이 바로 이 단언이다).
    for (const value of [undefined, null, "", "   "]) {
      expect(leaveScreenHref(value)).toEqual({ pathname: "/settings/privacy", params: {} });
    }
    // 라벨도 전환 입구와 같은 형태의 짧은 동작 이름이다(문장이 아니므로 종결어미를 붙이지 않는다).
    expect(HOUSEHOLD_SCOPE_LEAVE_LABEL).toMatch(/기$/);
    expect(HOUSEHOLD_SCOPE_SWITCH_LABEL).toMatch(/기$/);
  });

  it("아는 가구만 통과하고, 검증 실패는 **차단이 아니라 종전 판정**이다", () => {
    expect(parseHouseholdScopeParam("household-2", known)).toBe("household-2");
    // 딥링크·수동 URL이 남의 가구 id를 들이밀면 없던 일이 된다 -- 그때 화면은 잠기는 것이
    // 아니라 아이 기준 판정으로 떨어진다(모르면 말하지 않는다).
    const fallback = resolveManagedHouseholdId({
      children: [{ id: "child-daon", householdId: "household-1", nickname: "다온이" }],
      childId: "child-daon",
      fallbackHouseholdId: "household-1",
      childrenSettled: true
    });
    expect(parseHouseholdScopeParam("household-9", known) ?? fallback).toBe("household-1");
    expect(parseHouseholdScopeParam("household-2", null)).toBeNull();
    expect(parseHouseholdScopeParam(["household-2", "household-1"], known)).toBe("household-2");
    for (const value of ["", "   ", undefined, null, 7, {}, ["nope"]]) {
      expect(parseHouseholdScopeParam(value, known)).toBeNull();
    }
  });

  it("탈퇴 카드의 대상 라벨은 파라미터로 온 그 가구를 가리킨다", () => {
    const children: HouseholdScopeChildRef[] = [
      { id: "child-daon", householdId: "household-1", nickname: "다온이" }
    ];
    // 전환해서 들어간 빈 가구: 이름도 아이도 모르므로 아무것도 지어내지 않는다.
    expect(
      describeHouseholdScope({
        householdId: "household-2",
        children,
        knownHouseholdIds: known,
        fallbackHouseholdId: "household-1"
      })
    ).toBeNull();
    // 이름을 아는 가구라면 그 이름으로 말한다 -- 종전 대상(다온이의 가구)과 다른 문장이다.
    const namedChildren: HouseholdScopeChildRef[] = [
      ...children,
      { id: "child-haneul", householdId: "household-2", nickname: "하늘이", householdName: "시가" }
    ];
    const phraseFor = (householdId: string) =>
      householdScopeLeaveNotice(
        householdScopePhrase(
          describeHouseholdScope({
            householdId,
            children: namedChildren,
            knownHouseholdIds: known,
            fallbackHouseholdId: "household-1"
          })
        )
      );
    expect(phraseFor("household-2")).toBe("‘시가’ 가구에서 나가요.");
    expect(phraseFor("household-1")).toBe("다온이의 가구에서 나가요.");
  });

  it("가족 화면은 **전환 중일 때만** 탈퇴 진입점을 그린다 (소스 계약)", () => {
    const screenSource = source("app/family/index.tsx");
    expect(screenSource).toContain("{switchedHouseholdId ? (");
    expect(screenSource).toContain("onPress={() => router.push(leaveScreenHref(switchedHouseholdId))}");
    expect(screenSource).toContain("accessibilityLabel={HOUSEHOLD_SCOPE_LEAVE_LABEL}");
    // 진입점은 **가지 않는 길을 여는 것**뿐이다 -- 이 화면에서 탈퇴가 일어나면 미리보기도
    // 두 번 확인도 없이 되돌릴 수 없는 일이 벌어진다.
    expect(screenSource).not.toContain("confirmHouseholdLeave");
    expect(screenSource).not.toContain("previewHouseholdLeave");
    // 전환 입구(후보 2 이상)와 **다른 문턱**이다: 전환하지 않은 다가구 계정에서도 이 진입점은
    // 그려지지 않는다(대상이 이미 아이 기준 판정과 같으므로 종전 경로로 충분하다).
    expect(screenSource).toContain(
      "const switchedHouseholdId = householdId && householdId !== scopedHouseholdId ? householdId : null;"
    );
  });

  it("탈퇴 화면은 같은 화이트리스트로 받고, 그 하나의 값이 대상·라벨의 근거다 (소스 계약)", () => {
    const screenSource = source("app/settings/privacy.tsx");
    expect(screenSource).toContain("const requestedHouseholdId = parseHouseholdScopeParam(");
    expect(screenSource).toContain("collectKnownHouseholdIds({");
    expect(screenSource).toContain("const householdId = requestedHouseholdId ?? scopedHouseholdId;");
    // 대상·미리보기·확인·라벨이 전부 그 하나의 값을 읽는다(갈리면 라벨이 곧 거짓말이 된다).
    expect(screenSource).toContain("previewHouseholdLeave(authToken!, householdId!)");
    expect(screenSource).toContain(
      "confirmHouseholdLeave(authToken!, householdId!, householdPreview.data?.confirmationText ?? \"\")"
    );
    expect(screenSource).toContain("describeHouseholdScope({\n        householdId,");
    // 검증 실패는 차단이 아니다 -- 버튼의 비활성 조건은 종전 그대로(요청 가구를 보지 않는다).
    expect(screenSource).toContain(
      "disabled={!authToken || !householdId || householdPreview.isPending}"
    );
    expect(screenSource).not.toContain("!requestedHouseholdId");
  });

  it("초대 화면과 탈퇴 화면이 **같은 파라미터 한 벌**을 지난다 (규칙을 두 벌로 만들지 않는다)", () => {
    // 초대 흐름은 종전 이름을 그대로 쓰지만 값은 이 모듈의 것이다.
    expect(INVITE_HOUSEHOLD_PARAM).toBe(HOUSEHOLD_SCOPE_PARAM);
    expect(parseInviteHouseholdParam).toBe(parseHouseholdScopeParam);
    // 두 목적지는 형태까지 같다: 전환 중일 때만 싣고, 아니면 파라미터가 없다.
    expect(inviteScreenHref("co_parent", "household-2").params[HOUSEHOLD_SCOPE_PARAM]).toBe("household-2");
    expect(leaveScreenHref("household-2").params[HOUSEHOLD_SCOPE_PARAM]).toBe("household-2");
    expect(inviteScreenHref("co_parent", null).params[HOUSEHOLD_SCOPE_PARAM]).toBeUndefined();
    expect(leaveScreenHref(null).params[HOUSEHOLD_SCOPE_PARAM]).toBeUndefined();
  });
});

/**
 * 라운드 63 #2 — **아이 프로필 삭제가 어느 아이를 지우는지.**
 *
 * 같은 화면의 파괴적 카드 셋 중 아이 카드만 대상 표기 규율 밖에 있었다: 카드 본문은 "이 아이의 …"
 * (그 "이 아이"가 누구인지 화면에 없다), 서버 미리보기는 이름도 건수도 없는 고정 문자열 목록,
 * 확인 Alert은 "정말 삭제할까요?"뿐. 대상은 전역 선택 아이인데 라운드 62 #2가 알림함에도 전환
 * 입구를 열면서 **선택 아이가 조용히 바뀌는 순간**이 늘었고, 결과는 아이 + 그 아이의 지출 전량
 * soft delete이며 앱 안에 복구 경로가 없다.
 */
describe("라운드 63 #2 아이 삭제 카드의 대상 표기", () => {
  const twoChildren = [
    { id: "child-daon", nickname: "다온이" },
    { id: "child-sol", nickname: "솔이" }
  ];

  it("1아이 계정에서는 두 문장 모두 null이라 카드도 Alert도 한 글자도 달라지지 않는다", () => {
    // 판정은 라운드 48 T4의 한 벌 그대로다(2명 이상일 때만 값을 낸다) — 새 규칙을 만들지 않는다.
    const label = resolveChildScopeLabel("child-daon", [{ id: "child-daon", nickname: "다온이" }]);
    expect(label).toBeNull();
    expect(childScopeDeleteNotice(label)).toBeNull();
    expect(childScopeDeleteConfirmTitle(label)).toBeNull();
  });

  it("다자녀 계정에서는 세 단계가 같은 이름을 말한다(카드 · 확인 Alert)", () => {
    const label = resolveChildScopeLabel("child-sol", twoChildren);
    expect(label).toBe("솔이");
    expect(childScopeDeleteNotice(label)).toBe("솔이 프로필을 삭제해요.");
    expect(childScopeDeleteConfirmTitle(label)).toBe("솔이 프로필을 삭제할까요?");
  });

  it("이름을 못 풀면 아무것도 적지 않는다 — 지어내지 않는다", () => {
    // 캐시 미도착 · 목록에 없는 childId · 빈 태명 · 아이 미선택.
    for (const label of [
      resolveChildScopeLabel("child-daon", undefined),
      resolveChildScopeLabel("없는-아이", twoChildren),
      resolveChildScopeLabel("child-x", [{ id: "child-x", nickname: "   " }, ...twoChildren]),
      resolveChildScopeLabel(null, twoChildren)
    ]) {
      expect(childScopeDeleteNotice(label)).toBeNull();
      expect(childScopeDeleteConfirmTitle(label)).toBeNull();
    }
    for (const value of [null, undefined, "", "   "]) {
      expect(childScopeDeleteNotice(value)).toBeNull();
      expect(childScopeDeleteConfirmTitle(value)).toBeNull();
    }
  });

  it("DNC-018: 해요체를 유지하고, 가구 쪽 짝과 같은 자리에 산다", () => {
    const label = resolveChildScopeLabel("child-daon", twoChildren);
    expect(childScopeDeleteNotice(label)).toMatch(/요\.$/);
    expect(childScopeDeleteConfirmTitle(label)).toMatch(/요\?$/);
    // 한 화면의 파괴적 카드 셋이 같은 규율로 대상을 말한다(규칙을 두 벌로 만들지 않는다).
    expect(householdScopeLeaveNotice("다온이의 가구")).toMatch(/요\.$/);
  });

  it("화면 배선: 카드·확인 Alert이 같은 라벨을 읽고, 서버는 건드리지 않는다 (소스 계약)", () => {
    const screenSource = source("app/settings/privacy.tsx");
    expect(screenSource).toContain(
      'import { resolveChildScopeLabel } from "../../src/children/child-switch";'
    );
    expect(screenSource).toContain(
      "const childDeleteLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);"
    );
    expect(screenSource).toContain("const childDeleteNotice = childScopeDeleteNotice(childDeleteLabel);");
    expect(screenSource).toContain(
      "{childDeleteNotice ? <Text style={mutedTextStyle}>{childDeleteNotice}</Text> : null}"
    );
    // 마지막 확인도 같은 라벨을 싣고, 모르면 **종전 제목 그대로**다(차단도 자리 채움도 아니다).
    // 라운드 66 트랙 B(#6): 본문은 flowCopy가 갈래별로 정하는 문장이 됐다(제목 규칙은 그대로).
    expect(screenSource).toContain(
      'childScopeDeleteConfirmTitle(childDeleteLabel) ?? "정말 삭제할까요?",\n      destructiveAlertMessage(flowCopy.child_profile_delete.exportNotice),'
    );
    // 삭제 대상은 여전히 전역 선택 아이 하나이고, 서버 호출은 한 글자도 바뀌지 않았다.
    expect(screenSource).toContain("previewChildProfileDeletion(authToken!, childId!)");
    expect(screenSource).toContain(
      'confirmChildProfileDeletion(authToken!, childId!, childPreview.data?.confirmationText ?? "")'
    );
    // 새 요청을 만들지 않는다 — 이름은 이 화면이 이미 물고 있는 ["children"] 캐시에서 온다.
    expect(screenSource.match(/queryKey: \["children"\]/g) ?? []).toHaveLength(1);
    // 계정 삭제 카드의 종전 제목은 그대로 남는다(이름이 붙는 카드는 아이 쪽 하나뿐이다).
    expect(screenSource).toContain(
      'Alert.alert("정말 삭제할까요?", destructiveAlertMessage(flowCopy.account_delete.exportNotice), ['
    );
  });
});

/**
 * 라운드 63 #7 — **아이 추가가 전환한 가구로 전달된다.**
 *
 * 라운드 62 #4가 연 문의 나머지 절반이다. 그 뒤로 빈 가구는 볼 수도 나갈 수도 있게 됐지만, 정작
 * 그 가구를 만든 목적("여기에 우리 아이를 등록한다")은 불가능했다 — 아이 추가의 대상 가구는
 * `resolveManagedHouseholdId`가 정하고, 그 판정은 아이가 없는 가구를 구조적으로 가리킬 수 없다.
 */
describe("라운드 63 #7 아이 추가를 전환한 가구로 (파라미터 관례)", () => {
  it("목적지는 탈퇴·초대와 **같은 관례**다 — 전환 중일 때만 싣는다", () => {
    expect(addChildScreenHref("household-2")).toEqual({
      pathname: "/settings/children",
      params: { householdId: "household-2" }
    });
    // 전환하지 않았으면 파라미터 자체가 생기지 않는다 -- 1가구 계정의 아이 관리 화면은 종전
    // 그대로다(SET-005).
    for (const value of [undefined, null, "", "   "]) {
      expect(addChildScreenHref(value)).toEqual({ pathname: "/settings/children", params: {} });
    }
    // 세 목적지가 같은 파라미터 한 벌을 쓴다(규칙을 두 벌로 만들지 않는다).
    expect(addChildScreenHref("household-2").params[HOUSEHOLD_SCOPE_PARAM]).toBe("household-2");
    expect(leaveScreenHref("household-2").params[HOUSEHOLD_SCOPE_PARAM]).toBe("household-2");
    expect(inviteScreenHref("co_parent", "household-2").params[HOUSEHOLD_SCOPE_PARAM]).toBe("household-2");
  });

  it("라벨은 전환·탈퇴 입구와 같은 형태의 짧은 동작 이름이고, 안내는 해요체다", () => {
    expect(HOUSEHOLD_SCOPE_ADD_CHILD_LABEL).toMatch(/기$/);
    expect(HOUSEHOLD_SCOPE_LEAVE_LABEL).toMatch(/기$/);
    // "이 가구"라고 쓴다 -- 어느 가구인지는 householdScopeManageNotice 한 줄이 이미 말한다.
    expect(HOUSEHOLD_SCOPE_ADD_CHILD_LABEL).toContain("이 가구");
    expect(HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE).toMatch(/요\.$/);
  });

  it("가족 화면은 전환 중일 때만 진입점을 그리고, 여기서 아이를 만들지 않는다 (소스 계약)", () => {
    const screenSource = source("app/family/index.tsx");
    expect(screenSource).toContain("accessibilityLabel={HOUSEHOLD_SCOPE_ADD_CHILD_LABEL}");
    expect(screenSource).toContain("onPress={() => router.push(addChildScreenHref(switchedHouseholdId))}");
    // 탈퇴 진입점과 **같은 게이트**다(전환 중일 때만) -- 1가구 계정과 비로그인 미리보기
    // (FAM-001 픽셀락)에서는 두 노드 모두 그려지지 않는다.
    expect(screenSource.match(/\{switchedHouseholdId \? \(/g) ?? []).toHaveLength(2);
    expect(screenSource).toContain(
      "const switchedHouseholdId = householdId && householdId !== scopedHouseholdId ? householdId : null;"
    );
    // 생성은 목적지 화면 한 곳에서만 일어난다(초대가 라운드 52 C-04에서 세운 그 규율 그대로).
    expect(screenSource).not.toContain("createChild");
  });

  it("아이 관리 화면은 같은 화이트리스트로 받고, 그 하나의 값이 추가 폼 셋(생성·역할·표기)의 근거다 (소스 계약)", () => {
    const screenSource = source("app/settings/children.tsx");
    expect(screenSource).toContain("const requestedHouseholdId = parseHouseholdScopeParam(");
    expect(screenSource).toContain("collectKnownHouseholdIds({");
    expect(screenSource).toContain("const householdId = requestedHouseholdId ?? scopedHouseholdId;");
    expect(screenSource).toContain("const scopedHouseholdId = resolveManagedHouseholdId({");
    // 셋이 갈리면 라벨이 곧 거짓말이 된다.
    expect(screenSource).toContain("buildCreateChildBody(householdId!, input.stageMode, input.values)");
    expect(screenSource).toContain('queryKey: ["household-members", householdId]');
    expect(screenSource).toContain("const addHouseholdNotice = householdScopeAddChildNotice(");
    /**
     * 라운드 63 리뷰 #1 — 그 근거는 **추가 폼까지**다. 목록은 파라미터 가구의 아이가 아니라 전
     * 가구의 아이라(`children.data.children` 그대로), 편집·출생 전환·보기 전용 안내까지 파라미터가
     * 지배하면 빈 가구 B의 owner가 A(viewer)의 아이에 [편집]을 얻는다(403 · 라운드 40 회귀).
     * 자세한 고정은 src/children/manage-children-flow.test.ts.
     */
    expect(screenSource).toContain('queryKey: ["household-members", scopedHouseholdId]');
    expect(screenSource).toContain('const canAddChild = myAddRole === "owner" || myAddRole === "co_parent"');
    expect(screenSource).toContain("hasSession && !canEditChildren && scopedMembers.isSuccess");
    // 이 흐름의 주인공(아이가 없는 가구)은 이름도 가리킬 아이도 없어 표기 판정이 언제나 null이다 --
    // 전환해 들어왔을 때만 전환 목록과 **같은 사실 표기**로 내려간다(지어낸 이름이 아니다).
    expect(screenSource).toContain(") ?? (requestedHouseholdId ? HOUSEHOLD_SCOPE_EMPTY_LABEL : null)");
    expect(householdScopeAddChildNotice(HOUSEHOLD_SCOPE_EMPTY_LABEL)).toBe("아이가 아직 없는 가구에 추가돼요.");
    // 검증 실패는 차단이 아니라 종전 판정이다 -- 제출 가드는 요청 가구를 보지 않는다.
    expect(screenSource).toContain(
      "if (!isChildFormValid(errors) || addChild.isPending || !householdId || isDemoSession) return;"
    );
    expect(screenSource).not.toContain("!requestedHouseholdId");
    // 추가 성공은 그 아이를 곧바로 선택하므로(가구 전환 → 아이 전환), 전환해 들어온 흐름에서는
    // 그 사실을 함께 말한다. 파라미터가 없는 계정에서는 종전 문구 그대로다.
    expect(screenSource).toContain("setSelectedChildId(created.id);");
    expect(screenSource).toContain(
      'const switchNotice = requestedHouseholdId ? ` ${HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE}` : "";'
    );
  });

  it("서버는 무변경이다 — POST /children이 이미 본문의 householdId와 그 가구의 역할을 본다", () => {
    const controllerSource = readFileSync(
      join(mobileRoot, "../../apps/api/src/onboarding/children.controller.ts"),
      "utf8"
    );
    expect(controllerSource).toContain('@RequireHouseholdRoles("owner", "co_parent")');
    expect(controllerSource).toContain("createChild(request.user!, body)");
    // 클라이언트가 싣는 그 필드를 서버 DTO가 받는다(계약 미러가 아니라 실제 서버 파일).
    expect(readFileSync(join(mobileRoot, "../../apps/api/src/onboarding/dto/child.dto.ts"), "utf8")).toContain(
      "householdId"
    );
  });
});
