import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExpenseHouseholdId } from "../expenses/records-list-view";
import {
  collectKnownHouseholdIds,
  describeHouseholdScope,
  householdScopeAddChildNotice,
  householdScopeInviteNotice,
  householdScopeLeaveNotice,
  householdScopeManageNotice,
  householdScopePhrase,
  isMultiHouseholdAccount,
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

  it("읽기 경로(라운드 27 L-4)와 초대 수락 화면은 이 트랙이 건드리지 않는다", () => {
    // 판정은 위임이지 복제가 아니다 -- 규칙 본문은 여전히 records-list-view 한 곳에 있다.
    const moduleSource = source("src/family/household-scope.ts");
    expect(moduleSource).toContain('import { resolveExpenseHouseholdId, type ChildHouseholdRef } from "../expenses/records-list-view";');
    expect(moduleSource).toContain("const scoped = resolveExpenseHouseholdId({");

    // 기본 가구를 영구히 바꾸는 자리는 그대로 남아 있다(트랙 C 소유) -- 트랙 A는 그 뒤의
    // 화면들이 바뀐 값을 맹신하지 않게 했을 뿐이다.
    expect(source("app/family/accept/[token].tsx")).toContain(
      "useSessionStore.setState({ defaultHouseholdId: result.household.id });"
    );
  });
});
