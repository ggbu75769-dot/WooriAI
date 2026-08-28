import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVITE_ROLE,
  INVITE_ROLE_CHOICES,
  INVITE_ROLE_PARAM,
  INVITE_ROLE_PROMPT_MESSAGE,
  INVITE_ROLE_PROMPT_TITLE,
  inviteRolePrompt,
  inviteScreenHref,
  isInviteRole,
  parseInviteRoleParam
} from "./invite-flow";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("라운드 52 C-04/C-06 초대 역할 표", () => {
  it("서버가 아는 세 역할을 모두 담는다 — 선물 참여가 빠지지 않는다", () => {
    expect(INVITE_ROLE_CHOICES.map((choice) => choice.role)).toEqual(["co_parent", "viewer", "gift_participant"]);
    expect(new Set(INVITE_ROLE_CHOICES.map((choice) => choice.role)).size).toBe(INVITE_ROLE_CHOICES.length);
  });

  it("초대 화면이 쓰던 라벨·설명문을 그대로 옮겼다(문구 변경 없음)", () => {
    expect(INVITE_ROLE_CHOICES).toEqual([
      { role: "co_parent", label: "공동부모", description: "지출 기록과 예산을 함께 관리할 수 있어요" },
      { role: "viewer", label: "보기 전용", description: "기록만 확인할 수 있어요" },
      { role: "gift_participant", label: "선물 참여", description: "선물 준비 목록만 함께 볼 수 있어요" }
    ]);
  });

  it("DNC-018: 설명문은 해요체를 유지한다", () => {
    for (const choice of INVITE_ROLE_CHOICES) {
      expect(choice.description, choice.label).toMatch(/요$/);
    }
  });

  it("Alert 본문이 라벨만이 아니라 설명까지 읽어 준다 — 고르는 순간에 차이를 알 수 있어야 한다", () => {
    for (const choice of INVITE_ROLE_CHOICES) {
      expect(INVITE_ROLE_PROMPT_MESSAGE).toContain(choice.label);
      expect(INVITE_ROLE_PROMPT_MESSAGE).toContain(choice.description);
    }
    expect(INVITE_ROLE_PROMPT_TITLE).toBe("어떤 역할로 초대할까요?");
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
    expect(familySource).toContain("onPress: () => router.push(inviteScreenHref(choice.role))");
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
