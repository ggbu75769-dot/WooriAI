import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBER_ROLES } from "@wooriai/domain";
import { INVITE_OWNER_ONLY_CAPTION, isInviteCreateLocked, isInviteEntryPointLocked } from "./invite-permissions";
import { isExpenseEntryLocked, VIEW_ONLY_HEADLINES } from "./record-permissions";

/**
 * 라운드 106 T8 — **가족 여정의 역할 경계를 한 표로 대조한다.**
 *
 * ## 왜 이 파일이 새로 생겼나
 *
 * 이 저장소에는 역할 판정이 이미 여러 벌 있고, 각자 자기 짝 테스트가 자기 판정을 잘 물고 있다
 * (`invite-permissions.test.ts` · `record-permissions.test.ts`). 없던 것은 **그 판정들이 한
 * 사람에게 어떻게 보이는가**였다: 같은 계정으로 화면을 옮겨 다닐 때 앱이 같은 답을 하는지는
 * 어느 단언도 묻지 않았고, 라운드 103 리뷰 M-1이 찾아낸 결함이 정확히 그 사각이었다(머리말은
 * 맞는 문장인데 탭하면 다른 문장). 그래서 이 파일은 새 판정을 만들지 않고 **기존 판정들을
 * 네 역할 × 모든 자리로 전개해 값으로 굳힌다.**
 *
 * ## 이 표가 보는 두 축
 *
 * 서버가 역할로 가르는 것은 오늘 **둘뿐**이다.
 *  - **관리자 축**(`assertOwner` — apps/api/src/households/household-runtime.service.ts):
 *    초대 생성·초대 목록·초대 취소·구성원 삭제. 공동부모도 막힌다.
 *  - **편집 축**(`canEdit` = owner·co_parent — apps/api/src/onboarding/store-shared.ts, 그리고
 *    `@RequireHouseholdRoles("owner","co_parent")`): 지출·예산·아이·분류의 쓰기.
 * 읽기에는 역할 스코프가 없다(구성원이면 전부 본다 — src/family/invite-flow.ts 머리말).
 *
 * 즉 **공동부모는 두 축이 갈리는 유일한 역할**이고, 그래서 이 표의 값은 그 한 줄에서 가장 많은
 * 것을 말한다: 기록·예산은 되고 초대는 안 된다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
/** 주석에 적어 둔 이름은 배선이 아니다(record-permissions.test.ts와 같은 규율). */
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/** 판정이 실제로 받는 값 — 도메인 열거 그대로다(새 역할이 생기면 이 표가 먼저 빨개진다). */
const ROLES = MEMBER_ROLES;

/**
 * 화면 × 역할 × 판정. `true`가 **잠김**이다.
 *
 * 손으로 적은 기대값이라는 점이 이 표의 요점이다: 아래 단언이 실제 판정 함수를 돌려 이 표와
 * 맞춰 보므로, 어느 자리의 판정이 조용히 바뀌면 값이 갈려 빨개진다.
 */
const ROLE_BOUNDARY_MATRIX: ReadonlyArray<{
  readonly surface: string;
  readonly axis: "owner" | "edit";
  readonly verdict: (role: string) => boolean;
  readonly locked: Readonly<Record<string, boolean>>;
}> = [
  {
    // FAM-001 아바타 줄의 `+` · "링크로 초대" 행 · 아래 [가족 초대하기]
    surface: "FAM-001 초대 진입점 셋",
    axis: "owner",
    verdict: (role) => isInviteEntryPointLocked({ hasSession: true, myRole: role }),
    locked: { owner: false, co_parent: true, viewer: true, gift_participant: true }
  },
  {
    // FAM-001 구성원 삭제 · 대기 중인 초대 목록/취소 (canManageMembers)
    surface: "FAM-001 구성원 관리",
    axis: "owner",
    verdict: (role) => !(role === "owner"),
    locked: { owner: false, co_parent: true, viewer: true, gift_participant: true }
  },
  {
    /**
     * FAM-001의 "이 가구에 아이 추가하기" 링크가 **데려가는 곳**이다.
     *
     * ⚠️ 이 줄이 재는 것은 목적지의 답이지 링크의 답이 아니다 — 오늘 그 링크 자체는 역할을
     * 묻지 않는다(아래 "관측" 단언이 그 사실을 값으로 든다). 보기 전용 참여자는 약속(링크)을
     * 먼저 읽고 거절(추가 폼이 없는 화면)을 나중에 만난다.
     */
    surface: "SET-005 아이 추가 폼(FAM-001 링크의 목적지)",
    axis: "edit",
    verdict: (role) => isExpenseEntryLocked({ hasSession: true, role }),
    locked: { owner: false, co_parent: false, viewer: true, gift_participant: true }
  },
  {
    /**
     * 라운드 106 T8이 세운 자리. 종전에는 이 화면에 역할 판정이 0건이라, 딥링크로 들어온
     * 비관리자가 머리말·역할 카드·눌리는 버튼을 받고 **누른 뒤에야** 403 문장을 읽었다.
     */
    surface: "FAM-002 초대 링크 만들기",
    axis: "owner",
    verdict: (role) => isInviteCreateLocked({ hasSession: true, myRole: role }),
    locked: { owner: false, co_parent: true, viewer: true, gift_participant: true }
  },
  {
    // 지출 기록·수정·삭제 / 예산 / 아이 정보 / 지출 분류 — 여섯 화면이 같은 한 벌을 지난다.
    surface: "편집 축 전체(기록·예산·아이·분류)",
    axis: "edit",
    verdict: (role) => isExpenseEntryLocked({ hasSession: true, role }),
    locked: { owner: false, co_parent: false, viewer: true, gift_participant: true }
  }
];

describe("라운드 106 T8 — 역할 경계 전수 대조표 (화면 × 역할 × 판정)", () => {
  it("네 역할이 다섯 자리에서 표와 같은 답을 받는다", () => {
    for (const entry of ROLE_BOUNDARY_MATRIX) {
      // 표가 네 역할을 빠짐없이 덮는다(도메인에 역할이 하나 늘면 여기서 먼저 걸린다).
      expect(Object.keys(entry.locked).sort(), `${entry.surface}의 표`).toEqual([...ROLES].sort());
      for (const role of ROLES) {
        expect(entry.verdict(role), `${entry.surface} × ${role}`).toBe(entry.locked[role]);
      }
    }
  });

  it("한 자리의 답은 축이 같은 형제 자리와 언제나 같다 — 화면을 옮겨도 답이 바뀌지 않는다", () => {
    for (const axis of ["owner", "edit"] as const) {
      const siblings = ROLE_BOUNDARY_MATRIX.filter((entry) => entry.axis === axis);
      expect(siblings.length, `${axis} 축의 자리 수`).toBeGreaterThanOrEqual(2);
      for (const role of ROLES) {
        const answers = new Set(siblings.map((entry) => entry.verdict(role)));
        expect(answers.size, `${axis} 축 × ${role} — 자리마다 답이 갈린다`).toBe(1);
      }
    }
  });

  it("공동부모가 두 축이 갈리는 유일한 역할이다 (이 표가 지키는 사실)", () => {
    const ownerAxis = ROLE_BOUNDARY_MATRIX.filter((entry) => entry.axis === "owner");
    const editAxis = ROLE_BOUNDARY_MATRIX.filter((entry) => entry.axis === "edit");
    const split = ROLES.filter((role) => ownerAxis[0].verdict(role) !== editAxis[0].verdict(role));
    expect(split).toEqual(["co_parent"]);
    // 공동부모는 기록·예산은 남기고 초대만 못 한다 — 그래서 초대가 막힌 자리의 문장은
    // "보기 전용" 계열이면 안 된다(그 계정은 보기 전용이 아니다).
    expect(INVITE_OWNER_ONLY_CAPTION).not.toContain("보기 전용");
    for (const headline of Object.values(VIEW_ONLY_HEADLINES)) {
      expect(headline).not.toBe(INVITE_OWNER_ONLY_CAPTION);
    }
  });

  /**
   * ⚠️ 두 판정이 **의도적으로** 갈리는 축은 하나뿐이다: 역할 미상.
   *
   * 가족 화면은 구성원 목록 응답에서 역할을 찾으므로 모름이 곧 이상 상태이고, 잘못 열면 라운드
   * 52 이전의 403 무반응이 되살아난다 → 모르면 잠근다. 초대 만들기 화면은 세션 스토어의 표를
   * 읽으므로 모름이 정상적으로 발생하고(구세션·데모·부분 표), 잘못 잠그면 정상 관리자가 가족을
   * 부를 길을 잃는다 → 모르면 열어 둔다. 근거는 invite-permissions.ts의 두 머리말이다.
   */
  it("두 초대 판정은 네 역할 전부에서 같고, 역할 미상에서만 갈린다", () => {
    for (const role of ROLES) {
      expect(isInviteEntryPointLocked({ hasSession: true, myRole: role }), role).toBe(
        isInviteCreateLocked({ hasSession: true, myRole: role })
      );
    }
    for (const unknown of [undefined, null, "", "   "]) {
      expect(isInviteEntryPointLocked({ hasSession: true, myRole: unknown }), `진입점 × ${String(unknown)}`).toBe(true);
      expect(isInviteCreateLocked({ hasSession: true, myRole: unknown }), `목적지 × ${String(unknown)}`).toBe(false);
    }
    // ⚠ 픽셀락 FAM-001: 비로그인 미리보기는 어느 판정도 잠그지 않는다.
    for (const role of [...ROLES, undefined]) {
      expect(isInviteEntryPointLocked({ hasSession: false, myRole: role })).toBe(false);
      expect(isInviteCreateLocked({ hasSession: false, myRole: role })).toBe(false);
    }
  });

  /**
   * 서버가 이 표의 두 축을 실제로 그렇게 가르는지 — 앱이 서버보다 넓거나 좁게 말하지 않는지.
   * (읽기 전용 대조다. 서버는 이 라운드에서 한 바이트도 바뀌지 않는다.)
   */
  it("관측 — 서버의 두 관문이 이 표의 두 축과 같다", () => {
    const runtime = readFileSync(
      join(mobileRoot, "../../apps/api/src/households/household-runtime.service.ts"),
      "utf8"
    );
    // 관리자 축: 초대 생성·목록·취소 + 구성원 삭제가 모두 같은 관문을 지난다.
    expect(runtime).toContain('if (role !== "owner") {');
    expect(runtime.match(/this\.assertOwner\(user, householdId\);/g) ?? []).toHaveLength(4);
    // 편집 축: 앱이 거울로 삼는 목록 그대로다.
    const storeShared = readFileSync(join(mobileRoot, "../../apps/api/src/onboarding/store-shared.ts"), "utf8");
    expect(storeShared).toContain("export function canEdit(role: MemberRole | null)");
    expect(isExpenseEntryLocked({ hasSession: true, role: "co_parent" })).toBe(false);
    expect(isInviteCreateLocked({ hasSession: true, myRole: "co_parent" })).toBe(true);
  });
});

/**
 * 화면 배선 — 화면은 이 repo의 vitest에서 렌더할 수 없으므로 소스 계약으로 양쪽 끝을 잡는다
 * (판정은 위 describe가, 배선은 여기가).
 */
describe("라운드 106 T8 — 새로 세운 자리의 배선과, 남긴 자리의 이유 (source contract)", () => {
  it("FAM-002가 진입점과 같은 판정을 지나고, 잠긴 머리말·안내를 순수 모듈에서 읽는다", () => {
    const screen = source("app/family/invite.tsx");
    const wired = withoutComments(screen);

    // 판정은 이 화면이 짓지 않는다 — 모듈 하나를 부르고, 역할은 세션 스토어의 표에서 온다.
    expect(wired).toContain("const inviteCreateLocked = isInviteCreateLocked({");
    expect(wired).toContain("myRole: resolveHouseholdRole({ householdRoles, householdId, knownHouseholdIds })");
    // ⚠ 새 조회 0건: 이 화면은 구성원 목록을 부르지 않는다(부르는 순간 요청 하나가 는다).
    expect(wired).not.toContain("listHouseholdMembers");
    // 잠금이 묻는 가구는 초대가 실제로 갈 그 가구다(다가구 계정에서 A의 owner가 B로 잠기지 않는다).
    expect(wired).toContain("const householdId = requestedHouseholdId ?? scopedHouseholdId;");

    // 머리말 두 갈래 — 잠긴 쪽은 가족 화면이 쓰는 그 상수 그대로다(두 화면이 같은 말을 한다).
    expect(screen.replace(/\s+/g, " ")).toContain(
      'subtitle={inviteCreateLocked ? INVITE_OWNER_ONLY_CAPTION : "함께할 역할을 선택하고 초대 링크를 만들어요"}'
    );
    // 안내 문장도 화면이 다시 적지 않는다(단일 소스는 invite-permissions.ts다).
    expect(wired).toContain("{inviteCreateLocked ? <Text style={mutedTextStyle}>{INVITE_FORBIDDEN_MESSAGE}</Text> : null}");
    expect(wired).not.toContain('"가족 초대는 관리자만');

    // 그리고 버튼이 실제로 막힌다 — 종전 셋에 넷째 칸이 붙었다(앞 셋은 바이트 그대로).
    expect(wired).toContain("disabled={!authToken || !householdId || invite.isPending || inviteCreateLocked}");

    // ⚠ 실패 줄은 여전히 하나다(잠금 안내는 실패가 아니라 지금의 사실이라 danger 색이 아니다).
    expect(screen.match(/\{inviteCreateErrorText\}/g) ?? []).toHaveLength(1);
    expect(screen.match(/color: theme\.colors\.danger/g) ?? []).toHaveLength(1);
  });

  /**
   * ⚠️ **관측 · 이월 — FAM-001의 "이 가구에 아이 추가하기"는 아직 역할을 묻지 않는다.**
   *
   * 같은 화면 안에서 두 진입점이 서로 다른 예의를 지킨다: 초대 진입점 셋은 눌리기 **전에**
   * 이유를 말하고(`inviteLocked` + `INVITE_OWNER_ONLY_CAPTION`), 아이 추가 링크는 보기 전용
   * 참여자에게도 그대로 서서 목적지에 가서야 추가 폼이 없는 것으로 답한다. 위 표의
   * "SET-005 아이 추가 폼" 줄이 그 목적지의 답이고, 링크 쪽에는 아직 그 답이 없다.
   *
   * ⚠️ **이 라운드가 고치지 않은 이유는 결함 판정이 아니라 소유 경계다.** 이 자리는
   * `src/a11y-contract.test.ts`(대장)가 **바이트로** 못 박고 있다 — 그 파일의
   * *"이 가구에 아이 추가하기"가 라벨 있는 버튼이고…* 계약이 `accessibilityHint={householdNotice
   * ?? undefined}`와 `onPress={() => router.push(addChildScreenHref(switchedHouseholdId))}`를
   * 각각 그대로 요구하므로, 게이트를 붙이려면 두 바이트가 함께 움직여야 한다. 대장은 이 트랙의
   * 소유가 아니고 움직이면 보고하는 자리라, 여기서는 **사실을 값으로 남기고 넘긴다.**
   *
   * 아래 단언은 그래서 "고쳐졌는가"가 아니라 **"아직 그대로인가"**를 묻는다. 다음 라운드가
   * 대장의 두 핀을 모양 핀으로 풀며 이 자리를 이으면 이 단언이 빨개지고, 그때 이 줄을 지우는
   * 것이 그 트랙의 몫이다(라운드 71 리뷰 M-1의 `TRACK_A_PENDING`이 지나간 그 형식).
   */
  it("관측 — 아이 추가 링크는 아직 게이트 밖이고, 그 자리를 대장이 바이트로 붙들고 있다", () => {
    const wired = withoutComments(source("app/family/index.tsx"));
    // 링크는 종전 그대로다(전환 중이면 역할과 무관하게 눌린다).
    expect(wired).toContain("onPress={() => router.push(addChildScreenHref(switchedHouseholdId))}");
    expect(wired).toContain("accessibilityHint={householdNotice ?? undefined}");
    expect(wired).not.toContain("addChildLocked");

    // 그 두 바이트를 대장이 요구한다 — 완화되는 날 이 단언이 먼저 빨개진다.
    const ledger = source("src/a11y-contract.test.ts");
    expect(ledger).toContain('expect(entry.slice(0, 400)).toContain("accessibilityHint={householdNotice ?? undefined}");');
    expect(ledger).toContain(
      'expect(entry.slice(0, 400)).toContain("onPress={() => router.push(addChildScreenHref(switchedHouseholdId))}");'
    );

    // ⚠ 초대 진입점 셋은 이 라운드에서 한 글자도 바뀌지 않았다.
    expect(source("app/family/index.tsx").match(/onPress=\{inviteLocked \? undefined : openInvite\}/g) ?? []).toHaveLength(3);
    expect(wired).toContain("const inviteLocked = isInviteEntryPointLocked({ hasSession, myRole });");
  });

  /**
   * ⚠️ **낡음 방지** — `app/family/**`에서 역할을 묻는 자리가 늘면 위 표에 자리를 만들어야 한다.
   *
   * 세는 것은 판정 **호출**뿐이다(주석에 적힌 이름은 배선이 아니다). 오늘 셋이고, 그 셋이
   * FAM-001 둘(초대 진입점 · 구성원 관리)과 FAM-002 하나다. 아이 추가 링크가 넷째가 아닌
   * 이유는 바로 위 "관측" 단언이 든다. 초대 수락(FAM-003)에 0건인 것도 사실이다 — 그 화면의
   * 요청자에게는 아직 이 가구의 역할이 없다.
   */
  it("가족 화면 셋의 역할 판정 호출 수가 표와 맞는다", () => {
    const judgments = /isInviteEntryPointLocked\s*\(|isInviteCreateLocked\s*\(|isExpenseEntryLocked\s*\(|myRole === "owner"/g;
    const countIn = (path: string) => (withoutComments(source(path)).match(judgments) ?? []).length;

    expect(countIn("app/family/index.tsx"), "FAM-001 — 초대 진입점 · 구성원 관리").toBe(2);
    expect(countIn("app/family/invite.tsx"), "FAM-002 — 초대 생성 하나").toBe(1);
    expect(countIn("app/family/accept/[token].tsx"), "FAM-003 — 아직 역할이 없는 사람의 화면").toBe(0);
  });
});
