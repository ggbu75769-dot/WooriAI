import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITE_ROLE,
  INVITE_HOUSEHOLD_PARAM,
  INVITE_ROLE_CHOICES,
  INVITE_ROLE_EDIT_DESCRIPTION,
  INVITE_ROLE_PARAM,
  INVITE_ROLE_PROMPT_MESSAGE,
  INVITE_ROLE_PROMPT_TITLE,
  INVITE_ROLE_VIEW_ONLY_DESCRIPTION,
  INVITE_SCOPE_NOTICE,
  inviteRoleDescription,
  inviteRolePrompt,
  inviteScreenHref,
  isInviteRole,
  parseInviteHouseholdParam,
  parseInviteRoleParam
} from "./invite-flow";
import { memberRoleLabel } from "./memberLabels";
import { canRecordExpenses, EXPENSE_EDIT_ROLES } from "./record-permissions";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 주석을 걷어 낸 소스 — 화면이 **렌더하는 값**만 본다(설계 근거 주석의 원문 인용을 걸러 낸다). */
const withoutComments = (sourceText: string) =>
  sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("라운드 52 C-04/C-06 초대 역할 표", () => {
  it("서버가 아는 세 역할을 모두 담는다 — 선물 참여가 빠지지 않는다", () => {
    expect(INVITE_ROLE_CHOICES.map((choice) => choice.role)).toEqual(["co_parent", "viewer", "gift_participant"]);
    expect(new Set(INVITE_ROLE_CHOICES.map((choice) => choice.role)).size).toBe(INVITE_ROLE_CHOICES.length);
  });

  it("라벨은 memberLabels 단일 소스에서 온다(값 무변경 — 구성원 목록 배지와 갈리지 않는다)", () => {
    expect(INVITE_ROLE_CHOICES.map((choice) => choice.label)).toEqual(["공동부모", "보기 전용", "선물 참여"]);
    for (const choice of INVITE_ROLE_CHOICES) {
      expect(choice.label, choice.role).toBe(memberRoleLabel(choice.role));
    }
  });

  it("DNC-018: 설명문은 해요체를 유지한다", () => {
    for (const choice of INVITE_ROLE_CHOICES) {
      expect(choice.description, choice.label).toMatch(/요$/);
    }
    expect(INVITE_SCOPE_NOTICE).toMatch(/요\.$/);
  });

  it("Alert 본문이 라벨만이 아니라 설명까지 읽어 준다 — 고르는 순간에 차이를 알 수 있어야 한다", () => {
    for (const choice of INVITE_ROLE_CHOICES) {
      expect(INVITE_ROLE_PROMPT_MESSAGE).toContain(choice.label);
      expect(INVITE_ROLE_PROMPT_MESSAGE).toContain(choice.description);
    }
    expect(INVITE_ROLE_PROMPT_TITLE).toBe("어떤 역할로 초대할까요?");
  });
});

/**
 * 라운드 70 #3 — "선물 참여"가 약속하던 범위는 서버에 근거가 없었다.
 *
 * 종전 문장: viewer = "기록만 확인할 수 있어요"(절반만 참), gift_participant = "선물 준비 목록만
 * 함께 볼 수 있어요"(거짓). 서버에는 **읽기 스코프가 없다** — 역할이 판정에 들어가는 자리는 쓰기
 * 하나뿐이고(`canEdit` = owner|co_parent), 조회 경로는 구성원인지만 본다. 그래서 이 라운드는
 * 읽기 스코프를 만들지 않고(DNC-008 · PM 승인 선행) **문장을 사실로 되돌린다**.
 */
describe("라운드 70 #3 초대 역할 설명은 실제 권한에서만 파생된다", () => {
  /** 이 앱이 역할로 실제 가르는 단 하나의 축(서버 `canEdit`의 거울). */
  const editRoles = EXPENSE_EDIT_ROLES as readonly string[];

  it("설명문의 갈림은 EXPENSE_EDIT_ROLES 하나뿐이다 — 권한이 바뀌면 문장이 따라 움직인다", () => {
    for (const choice of INVITE_ROLE_CHOICES) {
      const canEdit = editRoles.includes(choice.role);
      expect(canEdit, choice.role).toBe(canRecordExpenses(choice.role));
      expect(choice.description, choice.role).toBe(inviteRoleDescription(choice.role));
      expect(choice.description.startsWith(canEdit ? INVITE_ROLE_EDIT_DESCRIPTION : INVITE_ROLE_VIEW_ONLY_DESCRIPTION), choice.role).toBe(true);
    }
    // 오늘의 값 고정: 편집 역할은 공동부모 하나뿐이고 나머지 둘은 같은 판정에 선다.
    expect(INVITE_ROLE_CHOICES.filter((choice) => editRoles.includes(choice.role)).map((choice) => choice.role)).toEqual([
      "co_parent"
    ]);
    expect(inviteRoleDescription("co_parent")).toBe("지출 기록과 예산을 함께 관리할 수 있어요");
    expect(inviteRoleDescription("viewer")).toBe("지출 기록과 예산을 남기거나 고칠 수 없어요");
    // 선물 참여는 오늘 보기 전용과 같은 역할이다 — 그 사실을 그 자리에서 말한다(짐작을 남기지 않는다).
    expect(inviteRoleDescription("gift_participant")).toBe(
      "지출 기록과 예산을 남기거나 고칠 수 없어요. 지금은 보기 전용과 권한이 같고, 구성원 목록에 다르게 표시돼요"
    );
  });

  /**
   * 부정 단언 — **판정이 없는 제약을 말하지 않는다.**
   *
   * "…만 볼 수 있어요" 계열이 역할 줄에 다시 등장하면 그것은 앱에 존재하지 않는 읽기 스코프를
   * 약속하는 것이다. 보는 범위는 세 역할이 같으므로 그 이야기는 역할 줄이 아니라 목록 위의
   * 공통 고지 한 곳에만 산다.
   */
  it("세 역할 × 없는 제약을 말하지 않는다 (…만 / 보기 범위 한정 금지)", () => {
    const scopeLimit = /(?:만|뿐)\s*(?:함께\s*)?(?:볼|보이|확인|열람|조회)/;
    const readVerb = /볼|보기|확인|열람|조회/;
    /** 역할 이름("보기 전용")은 고유명사라 보기 범위를 말하는 동사가 아니다 — 대조 전에 걷어낸다. */
    const withoutRoleLabels = (text: string) =>
      INVITE_ROLE_CHOICES.reduce((acc, choice) => acc.split(choice.label).join(""), text);

    for (const choice of INVITE_ROLE_CHOICES) {
      // ⓐ "…만 볼 수 있어요" 형태의 범위 한정이 없다.
      expect(choice.description, choice.role).not.toMatch(scopeLimit);
      // ⓑ 애초에 역할 줄은 **보는 범위를 말하지 않는다**(그 문장은 공통 고지의 몫이다).
      expect(withoutRoleLabels(choice.description), choice.role).not.toMatch(readVerb);
      // ⓒ 거둬들인 두 문장이 어떤 형태로도 되살아나지 않는다.
      expect(choice.description, choice.role).not.toContain("선물 준비");
      expect(choice.description, choice.role).not.toContain("기록만");
    }

    // 역할 Alert 본문(= 같은 표를 읽는 두 번째 선택 자리)도 같은 규율을 지난다.
    expect(INVITE_ROLE_PROMPT_MESSAGE).not.toContain("선물 준비 목록만 함께 볼 수 있어요");
    expect(INVITE_ROLE_PROMPT_MESSAGE).not.toContain("기록만 확인할 수 있어요");
  });

  it("공통 고지는 세 역할 모두에 서고, 편집 역할 이름을 EXPENSE_EDIT_ROLES에서 가져온다", () => {
    // 한 줄이 목록 전체를 덮으므로 역할별 분기가 아예 없다 = 세 역할 모두에 서 있다.
    expect(INVITE_SCOPE_NOTICE).toContain("어떤 역할로 초대해도");
    expect(INVITE_SCOPE_NOTICE).toContain("모두 볼 수 있어요");
    // 누가 남길 수 있는지는 손으로 적은 목록이 아니라 편집 역할의 라벨이다.
    expect(INVITE_SCOPE_NOTICE).toContain(EXPENSE_EDIT_ROLES.map((role) => memberRoleLabel(role)).join("·"));
    expect(INVITE_SCOPE_NOTICE).toContain("관리자·공동부모");
    // 역할을 고르는 두 자리(초대 화면 · 가족 화면 Alert)가 같은 문장을 쓴다.
    expect(INVITE_ROLE_PROMPT_MESSAGE.startsWith(INVITE_SCOPE_NOTICE)).toBe(true);
  });

  it("초대 화면이 역할 목록 위에 그 고지를 그린다 (source contract)", () => {
    const inviteSource = source("app/family/invite.tsx");
    expect(inviteSource).toContain("INVITE_SCOPE_NOTICE");
    expect(inviteSource).toContain("<Text style={scopeNoticeStyle}>{INVITE_SCOPE_NOTICE}</Text>");
    // "위"의 의미: 고지 노드가 역할 행 렌더보다 앞에 있다.
    expect(inviteSource.indexOf("{INVITE_SCOPE_NOTICE}")).toBeLessThan(
      inviteSource.indexOf("INVITE_ROLE_CHOICES.map((option) => (")
    );
    // 화면이 자기 문장을 따로 들고 있으면 표가 두 벌이 된다(C-04가 고친 그 병) — 설명문은
    // 표에서만 나온다.
    expect(inviteSource).toContain("{option.description}");
    expect(inviteSource).not.toContain("const roleOptions");
    // 거둬들인 문장은 **렌더되는 값**으로 되살아나지 않는다. 주석은 걷어 내고 본다: 이 화면은
    // 무엇을 왜 거뒀는지를 주석에서 원문 그대로 인용하고(설계 근거를 값으로 남기는 이 저장소의
    // 관례 — a11y-contract.test.ts의 `withoutComments`가 같은 이유로 있다), 사용자가 읽는 것은
    // 주석이 아니라 렌더되는 값이다.
    expect(withoutComments(inviteSource)).not.toContain("선물 준비 목록");
  });

  it("DNC-008: 역할 값과 라벨은 이 라운드에서 한 글자도 바뀌지 않는다", () => {
    expect(INVITE_ROLE_CHOICES.map((choice) => choice.role)).toEqual(["co_parent", "viewer", "gift_participant"]);
    expect(INVITE_ROLE_CHOICES.map((choice) => choice.label)).toEqual(["공동부모", "보기 전용", "선물 참여"]);
    // 읽기 스코프를 앱이 지어내지 않는다: 두 보기 역할은 오늘 같은 판정에 서 있다.
    expect(canRecordExpenses("viewer")).toBe(canRecordExpenses("gift_participant"));
  });
});

describe("라운드 52 C-06 역할 Alert이 Android 3버튼 상한에서 살아남는다", () => {
  /**
   * react-native의 Android Alert은 `buttons.slice(0, 3)`으로 네 번째 버튼을 조용히 버린다.
   * "취소 + 세 역할"을 그대로 넘기면 역할 하나가 사라지고, 그게 바로 이 라운드가 고치려는
   * 문제(선물 참여에 도달할 수 없음)의 재발이다.
   */
  const ANDROID_ALERT_BUTTON_LIMIT = 3;

  it("Android에서는 역할 셋을 모두 남기고, 대신 바깥 탭으로 닫을 수 있게 한다", () => {
    const prompt = inviteRolePrompt("android");
    expect(prompt.roles).toHaveLength(3);
    expect(prompt.showsCancelButton).toBe(false);
    // 취소 버튼이 없으면 닫을 길이 반드시 있어야 한다(Android 다이얼로그 기본값은 cancelable=false).
    expect(prompt.cancelable).toBe(true);

    const buttonCount = prompt.roles.length + (prompt.showsCancelButton ? 1 : 0);
    expect(buttonCount).toBeLessThanOrEqual(ANDROID_ALERT_BUTTON_LIMIT);
  });

  it("상한이 없는 플랫폼에서는 취소 버튼을 그대로 둔다", () => {
    for (const platform of ["ios", "web"]) {
      const prompt = inviteRolePrompt(platform);
      expect(prompt.showsCancelButton, platform).toBe(true);
      expect(prompt.roles, platform).toHaveLength(3);
    }
  });

  it("어떤 플랫폼에서도 세 역할이 모두 눌린다", () => {
    for (const platform of ["android", "ios", "web"]) {
      const prompt = inviteRolePrompt(platform);
      // 화면이 실제로 만드는 버튼 배열 그대로다(취소가 앞, 역할이 뒤).
      const buttons = [
        ...(prompt.showsCancelButton ? ["취소"] : []),
        ...prompt.roles.map((choice) => choice.label)
      ];
      // Android는 여기서 네 번째부터를 조용히 버린다.
      const rendered = platform === "android" ? buttons.slice(0, ANDROID_ALERT_BUTTON_LIMIT) : buttons;
      for (const choice of INVITE_ROLE_CHOICES) {
        expect(rendered, `${platform}: ${choice.label}`).toContain(choice.label);
      }
    }
  });
});

describe("라운드 52 C-04 역할 파라미터 방어 파싱", () => {
  it("아는 역할만 통과시킨다", () => {
    expect(parseInviteRoleParam("co_parent")).toBe("co_parent");
    expect(parseInviteRoleParam("viewer")).toBe("viewer");
    expect(parseInviteRoleParam("gift_participant")).toBe("gift_participant");
  });

  it("expo-router가 같은 이름을 배열로 줄 때는 첫 값을 본다", () => {
    expect(parseInviteRoleParam(["gift_participant", "viewer"])).toBe("gift_participant");
    expect(parseInviteRoleParam([])).toBeNull();
  });

  it("모르는 값은 null — 고르지도 않은 역할로 400을 맞게 두지 않는다", () => {
    for (const value of ["owner", "", "OWNER", undefined, null, 3, {}, ["nope"]]) {
      expect(parseInviteRoleParam(value)).toBeNull();
    }
    expect(isInviteRole("owner")).toBe(false);
    // DNC-008: 역할 집합 자체는 이 라운드에서 바뀌지 않는다 — owner는 초대 대상이 아니다.
    expect(INVITE_ROLE_CHOICES.map((choice) => choice.role)).not.toContain("owner");
  });

  it("아무것도 못 받으면 초대 화면은 종전 기본값으로 선다", () => {
    expect(DEFAULT_INVITE_ROLE).toBe("co_parent");
    expect(parseInviteRoleParam(undefined) ?? DEFAULT_INVITE_ROLE).toBe("co_parent");
  });

  it("목적지는 역할을 쿼리로 실어 보낸다", () => {
    expect(inviteScreenHref("gift_participant")).toEqual({
      pathname: "/family/invite",
      params: { role: "gift_participant" }
    });
    expect(INVITE_ROLE_PARAM).toBe("role");
  });
});

/**
 * 라운드 61 #3 — 가족 화면의 **가구 전환**을 초대 화면까지 들고 간다.
 *
 * 전환은 가족 화면의 지역 상태라 초대 화면에서는 보이지 않았고, 거기서 아이 기준으로 다시
 * 판정해 다른 가구의 초대를 만들었다. 그 초대는 돌아간 가족 화면의 대기 목록에도 없다
 * (C-04 재발 — 링크를 잃었을 때의 유일한 복구 경로가 그 목록이다).
 */
describe("라운드 61 #3 가구 파라미터 관례", () => {
  const known = ["household-1", "household-2"];

  it("역할과 같은 관례로 실어 보낸다 — 전환 중일 때만", () => {
    expect(INVITE_HOUSEHOLD_PARAM).toBe("householdId");
    expect(inviteScreenHref("co_parent", "household-2")).toEqual({
      pathname: "/family/invite",
      params: { role: "co_parent", householdId: "household-2" }
    });
    // 전환하지 않았으면 파라미터 자체가 없다 -- 1가구 계정의 링크는 종전과 한 글자도 같다.
    for (const value of [undefined, null, "", "   "]) {
      expect(inviteScreenHref("co_parent", value)).toEqual({
        pathname: "/family/invite",
        params: { role: "co_parent" }
      });
    }
  });

  it("아는 가구만 통과한다 (화이트리스트 — 모르는 값은 조용히 무시)", () => {
    expect(parseInviteHouseholdParam("household-2", known)).toBe("household-2");
    // 남의 가구 id를 들이민 딥링크·수동 URL은 없던 일이 된다(화면은 종전 판정으로 떨어진다).
    expect(parseInviteHouseholdParam("household-9", known)).toBeNull();
    expect(parseInviteHouseholdParam("household-2", [])).toBeNull();
    expect(parseInviteHouseholdParam("household-2", null)).toBeNull();
  });

  it("expo-router가 배열로 줄 때는 첫 값을 보고, 값이 아니면 null이다", () => {
    expect(parseInviteHouseholdParam(["household-2", "household-1"], known)).toBe("household-2");
    expect(parseInviteHouseholdParam([], known)).toBeNull();
    for (const value of ["", "   ", undefined, null, 3, {}, ["nope"]]) {
      expect(parseInviteHouseholdParam(value, known)).toBeNull();
    }
    // 공백은 다듬어서 비교한다(파라미터가 인코딩을 거쳐 오는 자리다).
    expect(parseInviteHouseholdParam(" household-1 ", known)).toBe("household-1");
  });

  it("초대 생성·대기 목록·표기가 모두 같은 가구를 본다 (소스 계약 — C-04 재발 방지)", () => {
    const inviteSource = source("app/family/invite.tsx");
    // 수신 측 검증은 화이트리스트를 지난다.
    expect(inviteSource).toContain("const requestedHouseholdId = parseInviteHouseholdParam(");
    expect(inviteSource).toContain("collectKnownHouseholdIds({");
    expect(inviteSource).toContain("const householdId = requestedHouseholdId ?? scopedHouseholdId;");
    // 그 하나의 값이 생성·표기 양쪽의 근거다(둘이 갈리면 "이 가구로 초대해요"가 거짓말이 된다).
    expect(inviteSource).toContain('createInvite(authToken!, householdId!, role, "link")');
    expect(inviteSource).toContain("describeHouseholdScope({\n        householdId,");
    // 대기 목록 무효화는 접두 하나라 전환된 가구의 목록도 함께 갱신된다(가족 화면의 키는
    // ["household-invites", householdId]다 -- 접두가 그것을 덮는다).
    expect(inviteSource).toContain('await queryClient.invalidateQueries({ queryKey: ["household-invites"] });');
    expect(source("app/family/index.tsx")).toContain('queryKey: ["household-invites", householdId]');
  });

  it("가족 화면은 전환 중일 때만 가구를 싣는다", () => {
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain(
      "const switchedHouseholdId = householdId && householdId !== scopedHouseholdId ? householdId : null;"
    );
  });
});

/**
 * 화면은 이 repo의 vitest에서 렌더할 수 없으므로 배선은 소스 grep 계약으로 고정한다
 * (invite-permissions.test.ts와 같은 관례).
 */
describe("라운드 52 C-04 초대 생성 배선 계약 (source contract)", () => {
  it("결과를 보여 줄 수 있는 화면 한 곳에서만 초대를 만든다", () => {
    // 서버는 초대 토큰을 해시로만 보관한다 -- inviteUrl은 생성 응답 말고는 어디에도 없다.
    // 그래서 "만드는 곳"과 "보여 주는 곳"이 다르면 그 초대는 만들어지는 순간 유실된다.
    const appRoot = join(mobileRoot, "app");
    const creators: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        if (!readFileSync(fullPath, "utf8").includes("createInvite(")) continue;
        creators.push(relative(mobileRoot, fullPath).split(sep).join("/"));
      }
    };
    walk(appRoot);

    expect(creators).toEqual(["app/family/invite.tsx"]);

    const inviteSource = source("app/family/invite.tsx");
    // 그 화면은 응답 링크를 실제로 그리고, 공유·복사 경로까지 같은 자리에서 내준다.
    expect(inviteSource).toContain("{invite.data.inviteUrl}");
    expect(inviteSource).toContain("Share.share(");
  });

  it("가족 화면은 초대를 만들지 않고 역할만 골라 초대 화면으로 넘긴다", () => {
    const familySource = source("app/family/index.tsx");

    expect(familySource).toContain('src/family/invite-flow"');
    expect(familySource).toContain("const prompt = inviteRolePrompt(Platform.OS);");
    // 라운드 61 #3: 목적지에 전환 중인 가구가 함께 실린다(전환하지 않았으면 null = 종전 링크).
    expect(familySource).toContain("onPress: () => router.push(inviteScreenHref(choice.role, switchedHouseholdId))");
    // 역할 선택은 생성 전이고, 생성은 여기서 일어나지 않는다.
    expect(familySource).not.toContain("createInvite");
    expect(familySource).not.toContain("quickInvite");
    // 종전의 2역할 하드코딩이 되살아나면 선물 참여가 다시 사라진다.
    expect(familySource).not.toContain('{ text: "공동부모"');
    expect(familySource).not.toContain('{ text: "보기 전용"');
  });

  /**
   * 라운드 52 QA P2-2 — 만든 초대가 대기 목록에 뜨지 않던 자리.
   *
   * 대기 목록(app/family/index.tsx의 `["household-invites", householdId]`)은 이 화면이 초대를
   * 만들어도 갱신되지 않아, 뒤로 가면 초대 전 상태 그대로였다. 링크를 잃어버렸을 때의 유일한
   * 복구 경로가 바로 그 목록이므로(취소 후 재발급), 목록이 사실과 어긋나면 복구 자체가 막힌다.
   */
  it("초대를 만드는 자리는 대기 목록 무효화를 동반한다", () => {
    const inviteSource = source("app/family/invite.tsx");

    expect(inviteSource).toContain("const queryClient = useQueryClient();");
    expect(inviteSource).toContain('await queryClient.invalidateQueries({ queryKey: ["household-invites"] });');
    // 무효화는 생성이 **성공한** 뒤에만 일어난다(실패한 초대는 목록을 바꾸지 않는다).
    const mutationBlock = inviteSource.slice(
      inviteSource.indexOf("const invite = useMutation({"),
      inviteSource.indexOf("const handleShare")
    );
    expect(mutationBlock).toContain("onSuccess: async () => {");
    expect(mutationBlock).toContain('queryKey: ["household-invites"]');

    // 목록을 읽는 쪽과 **같은 키**여야 한다 -- 접두가 어긋나면 무효화가 아무것도 하지 않는다.
    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain('queryKey: ["household-invites", householdId]');
    // 초대 생성은 구성원 목록을 바꾸지 않는다(수락해야 구성원이 된다) -- 넓게 날리지 않는다.
    expect(mutationBlock).not.toContain("household-members");
    expect(mutationBlock).not.toContain("invalidateQueries()");
  });

  it("초대 화면이 넘겨받은 역할로 서고, 역할 표는 한 벌만 남는다", () => {
    const inviteSource = source("app/family/invite.tsx");

    expect(inviteSource).toContain('src/family/invite-flow"');
    expect(inviteSource).toContain("parseInviteRoleParam(params[INVITE_ROLE_PARAM]) ?? DEFAULT_INVITE_ROLE");
    expect(inviteSource).toContain("INVITE_ROLE_CHOICES.map((option) => (");
    // 화면 안의 복제 표는 남기지 않는다 -- 두 벌이던 것이 "Alert에는 선물 참여가 없다"의 원인이었다.
    expect(inviteSource).not.toContain("const roleOptions");
  });
});
