import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as localBackend from "../api/local-backend";
import { LOCAL_HOUSEHOLD_ID } from "../api/local-fixtures";
import type { PendingInvite } from "../api/client";
import { formatInviteCreatedAt, formatInviteExpiry, memberBadge, memberRoleLabel } from "./memberLabels";

const mobileRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(mobileRoot, relativePath), "utf8");
}

describe("FAM-121B member role labels", () => {
  it("labels all four domain roles distinctly instead of collapsing them into 멤버", () => {
    const labels = ["owner", "co_parent", "viewer", "gift_participant"].map((role) => memberRoleLabel(role));

    expect(labels).toEqual(["관리자", "공동부모", "보기 전용", "선물 참여"]);
    expect(new Set(labels).size).toBe(4);
    // An unknown role must not be mislabeled as one of the real ones.
    expect(memberRoleLabel("future_role")).toBe("멤버");
  });

  it("marks a pending membership as 수락 대기 so it is never shown as already joined", () => {
    expect(memberBadge("co_parent", "active")).toEqual({ label: "공동부모", tone: "neutral" });
    expect(memberBadge("co_parent", "pending")).toEqual({ label: "공동부모 · 수락 대기", tone: "neutral" });
    expect(memberBadge("viewer", "pending").label).toBe("보기 전용 · 수락 대기");
    expect(memberBadge("owner", "active").tone).toBe("warning");
  });
});

describe("FAM-121B invite expiry formatting", () => {
  // Built from local-time components (then serialized) so the expectations hold in any
  // TZ the test runner happens to use — the formatter renders in the device's own zone,
  // which for this app's users is Asia/Seoul.
  const at = (year: number, monthIndex: number, day: number, hour: number) => new Date(year, monthIndex, day, hour, 0);
  const now = at(2026, 7, 27, 10);

  it("counts calendar days remaining and names the expiry date", () => {
    expect(formatInviteExpiry(at(2026, 7, 30, 10).toISOString(), now)).toBe("8월 30일까지 · 3일 남음");
    // Later the same calendar day is "오늘 만료", not "0일 남음".
    expect(formatInviteExpiry(at(2026, 7, 27, 23).toISOString(), now)).toBe("8월 27일까지 · 오늘 만료");
    // A few hours away but landing tomorrow reads 1일, not 0일.
    expect(formatInviteExpiry(at(2026, 7, 28, 2).toISOString(), now)).toBe("8월 28일까지 · 1일 남음");
  });

  it("never implies a lapsed invite is still usable", () => {
    expect(formatInviteExpiry(at(2026, 7, 26, 10).toISOString(), now)).toBe("만료됨");
    expect(formatInviteExpiry("not-a-date", now)).toBe("not-a-date");
  });
});

/**
 * 라운드 86 C — 같은 역할의 대기 초대 두 줄이 서로 다른 줄이 된다.
 *
 * 서버의 초대 생성에는 중복 방지가 없고 TTL은 7일 고정이라, 같은 날 같은 역할로 두 번 만든
 * 초대는 **역할 라벨도 만료 문구도 같은 글자**였다. 되돌릴 수 없는 [취소]가 어느 초대를
 * 지우는지 화면도 낭독도 말하지 않는다. 구별할 값(`createdAt`)은 이미 응답에 실려 온다.
 */
describe("라운드 86 C 대기 초대의 만든 시각", () => {
  // 만료 문구 테스트와 같은 관례: 로컬 시각 부품으로 만들어 러너의 TZ와 무관하게 성립한다.
  const at = (year: number, monthIndex: number, day: number, hour: number, minute = 0) =>
    new Date(year, monthIndex, day, hour, minute);
  const now = at(2026, 7, 31, 9);

  const pendingInvite = (id: string, createdAt: Date, expiresAt: Date): PendingInvite => ({
    id,
    householdId: LOCAL_HOUSEHOLD_ID,
    role: "co_parent",
    channel: "link",
    status: "pending",
    expiresAt: expiresAt.toISOString(),
    createdAt: createdAt.toISOString(),
    invitedByUserId: "user-owner",
    canReshareLink: false
  });

  it("ⓐ 같은 역할·같은 만료일로 만든 초대 둘이 서로 다른 문자열이 된다", () => {
    // 실패 시나리오 그대로: 아침에 한 번, 저녁에 한 번 더 만든 공동부모 초대.
    const morning = pendingInvite("invite-morning", at(2026, 7, 29, 9, 10), at(2026, 8, 5, 9, 10));
    const evening = pendingInvite("invite-evening", at(2026, 7, 29, 20, 5), at(2026, 8, 5, 20, 5));

    // 오늘의 두 재료는 글자 하나 다르지 않다 — 이것이 이 트랙이 여는 갈래다.
    expect(memberRoleLabel(morning.role)).toBe(memberRoleLabel(evening.role));
    expect(formatInviteExpiry(morning.expiresAt, now)).toBe(formatInviteExpiry(evening.expiresAt, now));
    expect(formatInviteExpiry(morning.expiresAt, now)).toBe("9월 5일까지 · 5일 남음");

    // 만든 시각만이 둘을 가른다.
    expect(formatInviteCreatedAt(morning.createdAt)).toBe("8월 29일 오전 9시 10분");
    expect(formatInviteCreatedAt(evening.createdAt)).toBe("8월 29일 오후 8시 5분");
    expect(formatInviteCreatedAt(morning.createdAt)).not.toBe(formatInviteCreatedAt(evening.createdAt));
  });

  it("자정·정오·정각의 경계에서도 사람이 읽는 시각을 낸다", () => {
    expect(formatInviteCreatedAt(at(2026, 7, 29, 0, 0).toISOString())).toBe("8월 29일 오전 12시");
    expect(formatInviteCreatedAt(at(2026, 7, 29, 0, 7).toISOString())).toBe("8월 29일 오전 12시 7분");
    expect(formatInviteCreatedAt(at(2026, 7, 29, 12, 0).toISOString())).toBe("8월 29일 오후 12시");
    expect(formatInviteCreatedAt(at(2026, 7, 29, 15, 0).toISOString())).toBe("8월 29일 오후 3시");
  });

  it("ⓒ 값이 없거나 파싱되지 않으면 시각을 지어내지 않는다", () => {
    for (const broken of [undefined, null, "", "not-a-date", "2026-13-99T99:99:99Z"]) {
      expect(formatInviteCreatedAt(broken), String(broken)).toBeNull();
    }
  });

  it("ⓑ 행 한 줄·확인창 제목·낭독 라벨이 같은 파생값을 쓴다", () => {
    const source = readSource("app/family/index.tsx");

    // 한 행에서 한 번 파생하고, 세 자리가 그 값을 읽는다.
    expect(source).toContain("const createdAtLabel = formatInviteCreatedAt(invite.createdAt);");
    expect(source).toContain("<Text style={familyPendingInviteMetaStyle}>{createdAtLabel}에 만들었어요.</Text>");
    expect(source).toContain("accessibilityLabel={`${pendingInviteTarget(roleLabel, createdAtLabel)} 취소`}");
    expect(source).toContain("Alert.alert(`${pendingInviteTarget(roleLabel, createdAtLabel)}를 취소할까요?`");
    // 대상 문자열을 조립하는 자리는 하나뿐이다(두 문장이 갈릴 자리를 만들지 않는다).
    expect(source.match(/에 만든 \$\{roleLabel\} 초대/g) ?? []).toHaveLength(1);
    // 취소 호출의 인자는 종전 그대로 — 대상은 목록이 이미 들고 있는 초대에서 찾는다.
    expect(source).toContain("confirmCancelInvite(invite.id, roleLabel)");
    expect(source).toContain("pendingInvites.data?.invites.find((invite) => invite.id === inviteId)?.createdAt");
    // 새 조회·새 키 0건: 이 트랙이 여는 쿼리는 없다.
    expect(source.match(/useQuery\(/g) ?? []).toHaveLength(3);
  });

  it("ⓒ 만든 시각이 없으면 그 줄이 서지 않고 나머지는 종전과 같다", () => {
    const source = readSource("app/family/index.tsx");

    // 줄은 조건부다.
    expect(source).toContain("{createdAtLabel ? (");
    // 만료 문구와 역할 라벨과 배지는 바이트 그대로다.
    expect(source).toContain("<Text style={familyPendingInviteMetaStyle}>{formatInviteExpiry(invite.expiresAt)}</Text>");
    expect(source).toContain("<Text style={familyMemberNameStyle}>{roleLabel} 초대</Text>");
    expect(source).toContain('<StatusBadge label="수락 대기" tone="neutral" />');
    // null 갈래의 제목·낭독 라벨은 이 트랙 이전과 같은 문자열이다.
    expect(source).toContain("createdAtLabel ? `${createdAtLabel}에 만든 ${roleLabel} 초대` : `${roleLabel} 초대`");
    // 옆 필드들은 그리지 않는다 — 앱은 언제나 link 채널이고, 초대는 owner만, canReshareLink는 늘 false다.
    for (const field of ["invite.channel", "invite.invitedByUserId", "invite.canReshareLink"]) {
      expect(source, field).not.toContain(field);
    }
  });

  it("ⓓ 새로 서는 문장은 둘이고 해요체이며 만든 시각만 말한다", () => {
    const createdAtLabel = formatInviteCreatedAt(at(2026, 7, 29, 20, 5).toISOString())!;
    const rowLine = `${createdAtLabel}에 만들었어요.`;
    const confirmTitle = `${createdAtLabel}에 만든 ${memberRoleLabel("co_parent")} 초대를 취소할까요?`;

    expect(rowLine).toBe("8월 29일 오후 8시 5분에 만들었어요.");
    expect(confirmTitle).toBe("8월 29일 오후 8시 5분에 만든 공동부모 초대를 취소할까요?");
    expect(new Set([rowLine, confirmTitle]).size).toBe(2);

    for (const sentence of [rowLine, confirmTitle]) {
      expect(sentence, "해요체(DNC-018)").toMatch(/요\.$|요\?$/);
      expect(sentence, "지시형·격식체").not.toMatch(/합니다|입니다|하십시오|해주세요|해 주세요/);
      // 단정 금지: `createdAt`이 아는 것은 링크가 만들어진 시각뿐이고, 실제로 상대에게
      // 갔는지는 서버도 앱도 모른다.
      for (const claim of ["보냈", "전송", "전달", "확인했", "읽었"]) {
        expect(sentence, claim).not.toContain(claim);
      }
    }
  });

  it("ⓔ 새 문장이 링크 재노출·재발송을 암시하지 않는다", () => {
    const source = readSource("app/family/index.tsx");
    const createdAtLabel = formatInviteCreatedAt(at(2026, 7, 29, 20, 5).toISOString())!;
    const cancelLabel = `${createdAtLabel}에 만든 ${memberRoleLabel("co_parent")} 초대 취소`;

    for (const text of [`${createdAtLabel}에 만들었어요.`, `${createdAtLabel}에 만든 공동부모 초대를 취소할까요?`, cancelLabel]) {
      for (const word of ["링크", "다시", "새로", "재발송", "재전송", "다시 보내", "공유", "복사"]) {
        expect(text, word).not.toContain(word);
      }
    }

    // 토큰이 해시로만 저장된다는 사실을 말하는 그 한 줄은 바이트 그대로 남는다.
    expect(source).toContain(
      "보낸 링크는 보안을 위해 다시 볼 수 없어요. 링크를 잃어버렸다면 취소하고 새로 만들어 주세요."
    );
    // 이 화면에서 링크·토큰을 꺼내 보이거나 다시 보내는 길은 여전히 없다.
    for (const reshare of ["Share.share", "setStringAsync", "Clipboard", "resendInvite"]) {
      expect(source, reshare).not.toContain(reshare);
    }
  });
});

describe("FAM-121B pending invite listing and cancellation (local backend)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("lists a created invite as pending without ever exposing the link or token", () => {
    const created = localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "co_parent", "link");
    const { invites } = localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID);

    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({
      householdId: LOCAL_HOUSEHOLD_ID,
      role: "co_parent",
      status: "pending",
      canReshareLink: false
    });
    const serialized = JSON.stringify(invites[0]);
    expect(serialized).not.toContain(created.inviteUrl);
    expect(serialized).not.toContain("/invite/");
  });

  it("cancels a pending invite so it disappears from the list and stops being acceptable", () => {
    const created = localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "viewer", "link");
    const inviteToken = created.inviteUrl.split("/invite/")[1];
    const inviteId = localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID).invites[0].id;

    expect(localBackend.cancelHouseholdInvite(LOCAL_HOUSEHOLD_ID, inviteId)).toEqual({ success: true });
    expect(localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID).invites).toEqual([]);
    expect(() => localBackend.acceptInvite(inviteToken)).toThrowError();
    // Cancelling twice is rejected rather than silently succeeding.
    expect(() => localBackend.cancelHouseholdInvite(LOCAL_HOUSEHOLD_ID, inviteId)).toThrowError();
    expect(() => localBackend.cancelHouseholdInvite(LOCAL_HOUSEHOLD_ID, "missing-invite")).toThrowError();
  });

  it("drops an accepted invite out of the pending list", () => {
    const created = localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "co_parent", "link");
    localBackend.acceptInvite(created.inviteUrl.split("/invite/")[1]);

    expect(localBackend.listHouseholdInvites(LOCAL_HOUSEHOLD_ID).invites).toEqual([]);
  });
});

describe("FAM-121B family surface contract", () => {
  it("wires the owner-only 대기 중인 초대 section into the family screen", () => {
    const source = readSource("app/family/index.tsx");

    expect(source).toContain("listHouseholdInvites");
    expect(source).toContain("cancelHouseholdInvite");
    expect(source).toContain("대기 중인 초대");
    expect(source).toContain("confirmCancelInvite");
    // Owner-only + session-only gating: the section renders under canManageMembers,
    // which is itself false whenever there is no session (see hasSession && myRole).
    expect(source).toContain("{canManageMembers ? (");
    expect(source).toContain('enabled: canManageMembers');
    expect(source).toContain('const canManageMembers = hasSession && myRole === "owner"');
    // Destructive action keeps the repo's confirm-Alert convention. 라운드 86 C: 제목의
    // 대상은 `pendingInviteTarget`이 만든다(만든 시각이 없으면 종전의 "역할 초대"로 돌아간다).
    expect(source).toContain("Alert.alert(`${pendingInviteTarget(roleLabel, createdAtLabel)}를 취소할까요?`");
  });

  it("keeps the FAM-001 pixel-lock preview badges at the reference image's 관리자/멤버 wording", () => {
    const source = readSource("app/family/index.tsx");

    // The non-session preview path is exactly what the FAM-001 capture renders.
    expect(source).toContain('previewMembers');
    expect(source).toContain('label={member.role === "owner" ? "관리자" : "멤버"}');
    // The four-role labels apply only to a real session.
    expect(source).toContain("{hasSession ? (");
    expect(source).toContain("memberBadge(member.role, member.status)");
  });

  it("offers a dependency-free copy path on the invite screen and tells the truth about link recovery", () => {
    const source = readSource("app/family/invite.tsx");
    const packageJson = readSource("package.json");

    expect(source).toContain("selectable");
    expect(source).toContain("길게 눌러");
    expect(source).toContain("지금 화면에서만 볼 수 있어요");
    // FAM-121B introduces no new dependency: expo-clipboard is not in apps/mobile's
    // dependencies, so the copy affordance must stay Share + selectable text.
    // (The screen may *mention* expo-clipboard in a comment explaining why; what must
    // not appear is an actual clipboard import or call.)
    expect(packageJson).not.toContain("expo-clipboard");
    expect(source).not.toMatch(/from\s+["'][^"']*clipboard["']/i);
    expect(source).not.toContain("setStringAsync");
    expect(source).not.toContain("Clipboard.setString");
  });
});
