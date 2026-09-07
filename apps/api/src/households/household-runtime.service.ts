import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MemberRole } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";

type InviteChannel = "kakao" | "sms" | "link";
type InviteRole = Exclude<MemberRole, "owner">;

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// Fallback displayName for findOrCreateProviderUser callers (e.g. the real Kakao
// exchange flow) that don't have a nickname claim to store. Deliberately distinct
// from ensureDevUser's "개발 사용자" default, which stays specific to the dev
// oauth-login stub (see findOrCreateProviderUser's doc comment).
const DEFAULT_PROVIDER_DISPLAY_NAME = "우리아이 사용자";

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * True only for a P2002 unique-constraint violation on the users table's
 * (authProvider, providerUserId) key — the one findOrCreateProviderUser's
 * find-then-create can race on (see its doc comment).
 *
 * Prefers matching on `error.meta.target` (specific column/constraint names)
 * when the driver provides it, but this repo's Postgres setup has been
 * observed to return `meta.target: null` for this exact violation ("Unique
 * constraint failed on the (not available)") — no column info at all. In that
 * case, fall back to `meta.modelName === "User"`, which is still a safe,
 * specific match: `attemptFindOrCreateProviderUser`'s transaction only ever
 * calls `create` on User, Household, and HouseholdMember, and the latter two
 * are always freshly created alongside their own brand-new id in the same
 * call, so they can never themselves race into a P2002 here — only the users
 * table's (authProvider, providerUserId) key can.
 */
function isProviderUserUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object" || (error as { code?: string }).code !== "P2002") {
    return false;
  }
  const meta = (error as { meta?: { target?: unknown; modelName?: unknown } }).meta;
  const target = meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : typeof target === "string" ? target : "";
  if (targetText) {
    return (
      targetText.includes("authProvider_providerUserId") ||
      targetText.includes("uq_users_provider") ||
      (targetText.includes("provider_user_id") && targetText.includes("auth_provider"))
    );
  }
  return meta?.modelName === "User";
}

/**
 * 라운드 99 L-2 — true only for a P2002 unique-constraint violation on the
 * household_members table's (householdId, userId) key (`uq_household_members_user`),
 * the one acceptInvite's member `create` can race on.
 *
 * Matching strategy mirrors `isProviderUserUniqueViolation` above, and for the same
 * reason: this repo's Postgres setup has been observed to return `meta.target: null`
 * for unique violations, so we fall back to `meta.modelName === "HouseholdMember"`.
 * That fallback is still specific: acceptInvite's transaction only writes to
 * `householdInvite` (a CAS `updateMany` — no unique key can be newly violated) and
 * `householdMember`, and the member `update` branch keeps its (householdId, userId)
 * key unchanged — only the `create` branch can hit P2002 here.
 */
function isHouseholdMemberUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object" || (error as { code?: string }).code !== "P2002") {
    return false;
  }
  const meta = (error as { meta?: { target?: unknown; modelName?: unknown } }).meta;
  const target = meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : typeof target === "string" ? target : "";
  if (targetText) {
    return (
      targetText.includes("householdId_userId") ||
      targetText.includes("uq_household_members_user") ||
      (targetText.includes("household_id") && targetText.includes("user_id"))
    );
  }
  return meta?.modelName === "HouseholdMember";
}

/**
 * acceptInvite의 두 자리(사전 조회 · P2002 경합)가 같은 409 본문을 던진다 — 문구가 갈리지 않게
 * 본문만 한 벌로 둔다. `throw new ConflictException(...)`은 각 자리에 그대로 남는다(가족 여정
 * 오류 스윕이 이 서비스가 던지는 예외 클래스를 소스에서 전수로 세는 계약과 어긋나지 않게 —
 * apps/mobile/src/api/api-error.test.ts의 "던지는 예외가 전부 4xx다").
 */
const HOUSEHOLD_ALREADY_MEMBER_ERROR = {
  code: "HOUSEHOLD_ALREADY_MEMBER",
  message: "이미 가족 구성원이에요. 초대를 다시 수락할 필요가 없어요."
} as const;

/**
 * Postgres-backed household/member/invite runtime, replacing the earlier in-memory
 * Maps. Authorization checks (assertOwner/assertMember) still read from the
 * already-DB-enriched `AuthenticatedUser.households` on the request (populated by
 * `enrichUser` below on every token verification), so they don't need their own
 * extra query.
 */
@Injectable()
export class HouseholdRuntimeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Dev-login entry point (see TokenService.createDevUser / AuthService.oauthLogin):
   * upserts the `users` row for this provider+providerUserId, and — only on a
   * user's very first login (no active membership anywhere yet) — creates their
   * default household and an `owner` membership for it. Delegates to
   * `findOrCreateProviderUser` (added for AUTH-101's real Kakao OIDC flow) so both
   * entry points share the exact same household-bootstrap logic; this method's
   * own signature/behavior is unchanged.
   */
  async ensureDevUser(provider: string, providerUserId: string, displayName = "개발 사용자"): Promise<AuthenticatedUser> {
    const { user } = await this.findOrCreateProviderUser({ provider, providerUserId, displayName });
    return user;
  }

  /**
   * General find-or-create by (authProvider, providerUserId) — the same unique
   * key `ensureDevUser` upserts on, generalized for AUTH-101's real Kakao OIDC
   * exchange flow (which also has an email/nickname claim to persist on first
   * creation). Only on a brand-new user (no active membership anywhere yet) does
   * this bootstrap their default household + `owner` membership, run in the same
   * transaction as the user write so a crash between the two can never leave a
   * user with no household.
   *
   * `email`/`displayName` are only written at creation time, never on a returning
   * user's login — matches round5a-sprint2-plan.md §2's "같은 이메일 자동 병합
   * 금지" principle: email is never used as a lookup key (the lookup is always
   * provider+providerUserId), and an existing user's stored email/displayName
   * isn't silently overwritten by whatever the provider claims on a later login.
   *
   * Race handling: the find-then-create below is not itself atomic, so two
   * concurrent first-time logins for the same (provider, providerUserId) can
   * both take the "not found" branch and both attempt `tx.user.create`. Postgres
   * aborts the whole transaction of whichever one loses that unique-constraint
   * race (P2002) — catching and retrying *inside* the same transaction doesn't
   * work once a transaction has been aborted by the database, so the retry here
   * re-runs the entire attempt (a fresh `$transaction` call) instead. On that
   * retry, `findUnique` now sees the winner's row and takes the update branch,
   * so the loser still gets a normal, consistent `isNewUser: false` result
   * instead of a 500.
   */
  async findOrCreateProviderUser(params: {
    provider: string;
    providerUserId: string;
    displayName?: string | null;
    email?: string | null;
  }): Promise<{ user: AuthenticatedUser; isNewUser: boolean }> {
    const normalizedProviderUserId = params.providerUserId.slice(0, 191);
    const displayName = params.displayName ?? DEFAULT_PROVIDER_DISPLAY_NAME;

    try {
      return await this.attemptFindOrCreateProviderUser(params.provider, normalizedProviderUserId, displayName, params.email);
    } catch (error) {
      if (!isProviderUserUniqueViolation(error)) {
        throw error;
      }
      return this.attemptFindOrCreateProviderUser(params.provider, normalizedProviderUserId, displayName, params.email);
    }
  }

  private async attemptFindOrCreateProviderUser(
    provider: string,
    normalizedProviderUserId: string,
    displayName: string,
    email: string | null | undefined
  ): Promise<{ user: AuthenticatedUser; isNewUser: boolean }> {
    let isNewUser = false;

    const userId = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: {
          authProvider_providerUserId: {
            authProvider: provider as never,
            providerUserId: normalizedProviderUserId
          }
        }
      });

      // GAP-075 A: a login that is about to be REJECTED must not write to the row.
      // The withdrawn/blocked decision is made *after* this call returns
      // (auth/kakao/kakao-auth.service.ts — USER_BLOCKED / USER_WITHDRAWN 403), so an
      // unconditional `lastLoginAt` write here bumped `users.updated_at` (Prisma
      // `@updatedAt`) for accounts that never actually got in. That column is the
      // retention clock phase 3 of the purge job reads for withdrawn users
      // (worker/jobs/data-retention-purge.job.ts), so every rejected attempt reset the
      // 30-day window the privacy policy promises without conditions — a withdrawn
      // account could be kept forever by merely trying to log in once a month. It also
      // made the admin CS screen's "마지막 활동" (lastLoginAt) report activity for
      // someone who was turned away at the door. So only an `active` row is touched;
      // any other status is returned as found, and the caller still reads that same row
      // and raises the byte-identical 403 it always did.
      const user = existing
        ? existing.status === "active"
          ? await tx.user.update({
              where: { id: existing.id },
              data: { lastLoginAt: new Date() }
            })
          : existing
        : await (async () => {
            isNewUser = true;
            return tx.user.create({
              data: {
                authProvider: provider as never,
                providerUserId: normalizedProviderUserId,
                displayName,
                email: email ?? undefined,
                status: "active",
                lastLoginAt: new Date()
              }
            });
          })();

      if (user.status === "active") {
        const existingMembership = await tx.householdMember.findFirst({
          where: { userId: user.id, status: "active" }
        });

        if (!existingMembership) {
          const household = await tx.household.create({
            data: { name: "우리 가족", ownerUserId: user.id }
          });
          await tx.householdMember.create({
            data: {
              householdId: household.id,
              userId: user.id,
              role: "owner",
              status: "active",
              joinedAt: new Date()
            }
          });
        }
      }

      return user.id;
    });

    const user = await this.enrichUser({
      id: userId,
      displayName,
      email: email ?? null,
      status: "active",
      households: []
    });
    return { user, isNewUser };
  }

  /**
   * Builds the whole `AuthenticatedUser` straight from the database rather than
   * trusting whatever a decoded JWT payload says — membership changes (removal,
   * leaving, withdrawal) must take effect immediately, not only once a token happens
   * to expire.
   *
   * SEC-131: the parameter is now just the user id. It used to take a full
   * `AuthenticatedUser` and fall back to the caller-supplied `displayName`/`email`
   * when the DB row was missing or inactive — those fallbacks only ever had a value
   * because `TokenService` copied the entire user object into the JWT payload, which
   * is exactly the PII exposure SEC-131 removes. Now that issued tokens carry no such
   * claims there is nothing to fall back *to*, so the row (or its absence) is the sole
   * source of truth. The `Partial<AuthenticatedUser>` intersection keeps existing
   * callers that still pass a full object compiling; anything beyond `id` is ignored.
   */
  async enrichUser(user: { id: string } & Partial<AuthenticatedUser>): Promise<AuthenticatedUser> {
    const row = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!row || row.status !== "active") {
      // 행이 없다 = 이 토큰이 가리키는 사용자가 더는 존재하지 않는다(하드 삭제/미존재
      // id). 탈퇴와 동일하게 취급하면 JwtAuthGuard가 status !== "active"로 401을
      // 내므로, 없는 사용자를 클레임에 남아 있던 이름/이메일로 되살리지 않는다.
      return {
        id: user.id,
        displayName: row?.displayName ?? "",
        email: row?.email ?? null,
        status: row?.status ?? "withdrawn",
        households: []
      };
    }

    return {
      id: row.id,
      displayName: row.displayName ?? "",
      email: row.email,
      status: row.status,
      households: await this.householdsForUser(row.id)
    };
  }

  async removeMember(user: AuthenticatedUser, householdId: string, memberId: string) {
    this.assertOwner(user, householdId);
    const household = await this.requireHousehold(householdId);
    const member = await this.prisma.householdMember.findFirst({
      where: { id: memberId, householdId }
    });

    if (!member || member.status === "removed" || member.status === "left") {
      throw new NotFoundException({ code: "HOUSEHOLD_MEMBER_NOT_FOUND", message: "Household member was not found." });
    }

    if (member.userId === household.ownerUserId) {
      throw new BadRequestException({
        code: "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN",
        message: "Owners cannot remove themselves. Use the leave or account deletion flow instead."
      });
    }

    // 라운드 108 트랙 B(정찰 S1-3) — **감사 봉투는 응답 DTO가 아니다.**
    // 종전: before/after 둘 다 `toMemberDto`였다(그때는 참 — 응답 DTO 하나로 화면과 봉투를
    // 같이 만들었고, 그래서 여기서 `memberDisplayNames`로 카카오 닉네임을 한 번 읽어 양쪽에
    // 넣었다). 이제: 봉투 전용 `toMemberAuditSnapshot`을 쓰고 닉네임 조회 자체를 하지 않는다.
    // 근거는 지출 봉투(`toExpenseAuditSnapshot`)가 그은 선 그대로다 — 개인을 지목하는 값
    // (`displayName`)과 계정 연결값(`userId`)은 730일 보존되는 감사 로그에 사본으로 남길 값이
    // 아니고, 특히 `userId` 사본은 파기 잡 phase 3이 `actor_user_id`만 null로 만드는 탓에
    // **탈퇴 뒤에도 살아남는다**(household_members 행은 phase 3이 실제로 지운다 — 즉 참조로
    // 두면 함께 사라지고, 사본으로 두면 남는다).
    // "누가 누구를 내보냈나"는 그대로 답한다: 행위자는 감사 행의 `actor_user_id`,
    // 대상은 `target_id`(= 이 memberId) → household_members 행이다.
    const before = toMemberAuditSnapshot(member);
    const updated = await this.prisma.householdMember.update({
      where: { id: member.id },
      data: { status: "removed" }
    });

    return { success: true, before, after: toMemberAuditSnapshot(updated), householdId };
  }

  async leaveHousehold(user: AuthenticatedUser, householdId: string) {
    this.assertMember(user, householdId);
    const member = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: user.id } }
    });
    if (!member) {
      throw new NotFoundException({ code: "HOUSEHOLD_MEMBER_NOT_FOUND", message: "Household member was not found." });
    }
    await this.prisma.householdMember.update({
      where: { id: member.id },
      data: { status: "left" }
    });
    return { success: true, flowId: "household_leave" };
  }

  /**
   * Withdraws the account: marks the user withdrawn and leaves every active/pending
   * household membership, in one transaction so a partial failure can never leave a
   * withdrawn user still listed as an active household member.
   */
  async withdrawUser(user: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { status: "withdrawn" } });
      await tx.householdMember.updateMany({
        where: { userId: user.id, status: { in: ["active", "pending"] } },
        data: { status: "left" }
      });
    });
    return { success: true, flowId: "account_delete" };
  }

  async listMembers(user: AuthenticatedUser, householdId: string) {
    this.assertMember(user, householdId);
    const members = await this.prisma.householdMember.findMany({
      where: { householdId, status: { in: ["active", "pending"] } }
    });
    const sorted = [...members].sort((left, right) => roleOrder(left.role) - roleOrder(right.role));
    const displayNames = await this.memberDisplayNames(sorted);
    return { members: sorted.map((member) => toMemberDto(member, displayNames)) };
  }

  async createInvite(user: AuthenticatedUser, householdId: string, role: InviteRole, channel: InviteChannel) {
    this.assertOwner(user, householdId);
    const household = await this.requireHousehold(householdId);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const token = randomBytes(24).toString("hex");

    await this.prisma.householdInvite.create({
      data: {
        householdId,
        invitedByUserId: user.id,
        role,
        channel,
        status: "pending",
        inviteTokenHash: hashInviteToken(token),
        expiresAt
      }
    });

    return {
      // REL-007: 초대 링크 도메인은 배포 환경에서 INVITE_LINK_BASE_URL로 주입한다
      // (미설정 시 dev 플레이스홀더 유지 — 프로덕션 배포 체크리스트 docs/5차/launch-72h-plan.md 참조).
      inviteUrl: `${(process.env.INVITE_LINK_BASE_URL ?? "https://wooriai.local").replace(/\/+$/, "")}/invite/${token}`,
      expiresAt: expiresAt.toISOString(),
      householdName: household.name
    };
  }

  /**
   * FAM-121B: owner-only list of invites that are still usable — `pending` and not
   * yet past `expiresAt`. Invites whose TTL has lapsed are flipped to `expired`
   * first, the same lazy expiry `requirePendingInvite` already performs on lookup,
   * so the list never shows a link that acceptInvite would reject.
   *
   * `canReshareLink` is always false and that is deliberate, not a stub: only the
   * sha256 hash of the invite token is stored (`inviteTokenHash`, see createInvite),
   * so the original link is unrecoverable once the create response is gone. Callers
   * must offer "취소 후 재생성" rather than pretending a re-share is possible.
   */
  async listInvites(user: AuthenticatedUser, householdId: string) {
    this.assertOwner(user, householdId);
    await this.requireHousehold(householdId);

    const now = new Date();
    await this.prisma.householdInvite.updateMany({
      where: { householdId, status: "pending", expiresAt: { lte: now } },
      data: { status: "expired" }
    });

    const invites = await this.prisma.householdInvite.findMany({
      where: { householdId, status: "pending", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" }
    });

    return { invites: invites.map((invite) => toInviteDto(invite)) };
  }

  /**
   * FAM-121B: owner cancels a still-pending invite (status -> `revoked`, one of the
   * four values the `household_invites.status` check constraint allows). The write
   * is a compare-and-swap on `status = pending` for the same reason acceptInvite
   * uses one: a cancel racing an accept must not "revoke" an invite that has already
   * created a membership — the loser gets INVITE_NOT_PENDING instead.
   */
  async cancelInvite(user: AuthenticatedUser, householdId: string, inviteId: string) {
    this.assertOwner(user, householdId);
    await this.requireHousehold(householdId);

    const invite = await this.prisma.householdInvite.findFirst({ where: { id: inviteId, householdId } });
    if (!invite) {
      throw new NotFoundException({ code: "INVITE_NOT_FOUND", message: "초대를 찾을 수 없어요." });
    }

    const now = new Date();
    if (invite.status === "pending" && invite.expiresAt.getTime() <= now.getTime()) {
      // FIX-121A(F5): lazy expiry도 아래 revoke와 같은 CAS여야 한다. 무조건
      // `update({ where: { id } })`면 이 읽기와 쓰기 사이에 acceptInvite의 CAS가
      // 커밋된 경우 이미 `accepted`가 된 행을 `expired`로 덮어써, 멤버십은
      // 생겼는데 초대는 만료로 남는 모순이 생긴다(만료 직전 수락 = 정확히 이
      // 분기가 도는 시점). 아래 revoke CAS가 0건이면 INVITE_NOT_PENDING을 주듯,
      // 여기서도 pending인 동안에만 만료 표시를 하고 진 쪽은 실제 상태를 따른다.
      const expired = await this.prisma.householdInvite.updateMany({
        where: { id: invite.id, status: "pending" },
        data: { status: "expired" }
      });
      if (expired.count > 0) {
        invite.status = "expired";
      } else {
        // 경합에서 졌다 — 다른 요청이 이미 상태를 바꿨으므로 DB 값을 다시 읽어
        // 그 상태로 판정한다(아래 pending 검사에서 INVITE_NOT_PENDING).
        const current = await this.prisma.householdInvite.findUnique({ where: { id: invite.id } });
        invite.status = current?.status ?? invite.status;
      }
    }

    if (invite.status !== "pending") {
      throw new BadRequestException({ code: "INVITE_NOT_PENDING", message: "이미 사용했거나 만료된 초대예요." });
    }

    // 라운드 108 트랙 B — 위 removeMember와 **같은 이유·같은 형식**. 종전 봉투는
    // `toInviteDto`(응답 DTO)였고 그때는 참이었다(자유 문자열이 없는 DTO라 위험이 낮아
    // 보였다). 이제는 봉투 전용 스냅샷을 쓴다: DTO가 싣던 `invitedByUserId`는 봉투 **안**의
    // 계정 연결값이라 지출 봉투에서 뺀 `createdByUserId`와 정확히 같은 축이다
    // (phase 3은 `actor_user_id`만 null로 만든다 → 사본은 탈퇴 파기를 비켜 간다).
    // 초대를 만든 사람이 필요하면 `target_id`가 가리키는 household_invites 행이 답하고,
    // 그 행은 phase 3(작성자 파기)·phase 10(만료 창)이 실제로 지운다.
    const before = toInviteAuditSnapshot(invite);
    const claimed = await this.prisma.householdInvite.updateMany({
      where: { id: invite.id, status: "pending" },
      data: { status: "revoked" }
    });
    if (claimed.count === 0) {
      throw new BadRequestException({ code: "INVITE_NOT_PENDING", message: "이미 사용했거나 만료된 초대예요." });
    }

    return { success: true, householdId, before, after: { ...before, status: "revoked" } };
  }

  async getInvite(token: string) {
    const invite = await this.requirePendingInvite(token);
    const household = await this.requireHousehold(invite.householdId);
    return {
      householdName: household.name,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString()
    };
  }

  /**
   * Creates the accepting member row and marks the invite accepted in one
   * transaction, so a crash between the two writes can never leave an invite
   * marked "accepted" without a corresponding membership (or vice versa).
   *
   * The first statement inside the transaction is a compare-and-swap
   * (`pending` -> `accepted`) `updateMany`. This closes a race where two different
   * users (or a double-submit from the same user) both pass the pre-transaction
   * `requirePendingInvite` check (both read the invite as still pending before
   * either has written to it) and would otherwise both create/activate a
   * membership from a single-use invite token. With the CAS, only the request that
   * wins the `updateMany` proceeds to touch membership rows; the loser gets the
   * same `INVITE_NOT_PENDING` error a sequential re-accept already produced.
   */
  async acceptInvite(user: AuthenticatedUser, token: string) {
    const invite = await this.requirePendingInvite(token);
    const household = await this.requireHousehold(invite.householdId);

    const existingMember = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: invite.householdId, userId: user.id } }
    });
    if (existingMember && existingMember.status === "active") {
      throw new ConflictException(HOUSEHOLD_ALREADY_MEMBER_ERROR);
    }

    const now = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.householdInvite.updateMany({
          where: { id: invite.id, status: "pending" },
          data: { status: "accepted", acceptedByUserId: user.id, acceptedAt: now }
        });
        if (claimed.count === 0) {
          throw new BadRequestException({ code: "INVITE_NOT_PENDING", message: "사용할 수 없는 초대 링크예요." });
        }

        if (existingMember) {
          await tx.householdMember.update({
            where: { id: existingMember.id },
            data: { role: invite.role, status: "active", invitedByUserId: invite.invitedByUserId, joinedAt: now }
          });
        } else {
          await tx.householdMember.create({
            data: {
              householdId: invite.householdId,
              userId: user.id,
              role: invite.role,
              status: "active",
              invitedByUserId: invite.invitedByUserId,
              joinedAt: now
            }
          });
        }
      });
    } catch (error) {
      // 라운드 99 L-2 — 같은 사용자가 서로 다른 초대 두 장을 동시에 수락하는 경합. 위의
      // existingMember 조회는 트랜잭션 밖이라 두 요청 모두 "구성원 아님"을 읽을 수 있고, 그
      // 경우 둘 다 create 분기로 들어가 진 쪽이 (householdId, userId) 유니크 P2002로 죽는다.
      // 초대 CAS는 초대별로 서로 다른 행이라 이 경합을 막지 못한다(단일 초대 이중 수락과 다른
      // 축이다 — 그쪽은 CAS가 INVITE_NOT_PENDING으로 거른다). 트랜잭션 전체가 롤백되므로 진
      // 쪽의 초대는 pending으로 남고 상태는 정합이다 — 틀린 것은 표면(500)뿐이라, 순차 재수락이
      // 받았을 기존 매핑(409 HOUSEHOLD_ALREADY_MEMBER)으로 돌려준다.
      if (isHouseholdMemberUniqueViolation(error)) {
        throw new ConflictException(HOUSEHOLD_ALREADY_MEMBER_ERROR);
      }
      throw error;
    }

    return {
      household: {
        id: household.id,
        name: household.name,
        role: invite.role
      }
    };
  }

  private async householdsForUser(userId: string) {
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId, status: "active" }
    });
    if (memberships.length === 0) return [];

    const households = await this.prisma.household.findMany({
      where: { id: { in: memberships.map((member) => member.householdId) }, deletedAt: null }
    });
    const householdById = new Map(households.map((household) => [household.id, household]));

    return memberships
      .map((member) => {
        const household = householdById.get(member.householdId);
        if (!household) return null;
        return { id: household.id, name: household.name, role: member.role };
      })
      .filter((entry): entry is { id: string; name: string; role: MemberRole } => Boolean(entry));
  }

  /**
   * PERF(E4): resolves every member's `displayName` in ONE `id IN (...)` query.
   *
   * This used to be a `user.findUnique` per member inside `toMemberDto`, i.e. a
   * classic N+1 on `listMembers` — a 6-person household issued 7 queries where 2
   * suffice, and the cost grew linearly with family size. The `users` rows are
   * fetched by primary key, so a single batched read is strictly cheaper.
   *
   * Members whose user row is missing (or whose `displayName` is null — the column
   * is nullable) are simply absent from the map, which `toMemberDto` renders as the
   * same `""` the per-member lookup produced. The response shape is unchanged.
   */
  private async memberDisplayNames(members: ReadonlyArray<{ userId: string }>): Promise<Map<string, string>> {
    const userIds = [...new Set(members.map((member) => member.userId))];
    if (userIds.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true }
    });
    return new Map(users.flatMap((row) => (row.displayName ? [[row.id, row.displayName] as const] : [])));
  }

  private assertMember(user: AuthenticatedUser, householdId: string) {
    const role = user.households.find((household) => household.id === householdId)?.role;
    if (!role) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "가족 접근 권한이 없어요." });
    }
  }

  private assertOwner(user: AuthenticatedUser, householdId: string) {
    const role = user.households.find((household) => household.id === householdId)?.role;
    if (role !== "owner") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "가족 초대는 관리자만 할 수 있어요." });
    }
  }

  private async requireHousehold(householdId: string) {
    const household = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!household || household.deletedAt || household.status !== "active") {
      throw new NotFoundException({ code: "HOUSEHOLD_NOT_FOUND", message: "가족을 찾을 수 없어요." });
    }
    return household;
  }

  private async requirePendingInvite(token: string) {
    const invite = await this.prisma.householdInvite.findUnique({
      where: { inviteTokenHash: hashInviteToken(token) }
    });
    if (!invite) {
      throw new NotFoundException({ code: "INVITE_NOT_FOUND", message: "초대 링크를 찾을 수 없어요." });
    }

    if (invite.expiresAt.getTime() <= Date.now() && invite.status === "pending") {
      // FIX-121A(F5): cancelInvite / listInvites와 동일한 CAS 형태로 통일한다 —
      // 무조건 update면 이 읽기 직후 acceptInvite의 CAS가 커밋된 행을 expired로
      // 덮어쓸 수 있다. pending일 때만 만료 표시하고, 졌으면 실제 상태를 다시 읽는다.
      const expired = await this.prisma.householdInvite.updateMany({
        where: { id: invite.id, status: "pending" },
        data: { status: "expired" }
      });
      if (expired.count > 0) {
        invite.status = "expired";
      } else {
        const current = await this.prisma.householdInvite.findUnique({ where: { id: invite.id } });
        invite.status = current?.status ?? invite.status;
      }
    }

    if (invite.status !== "pending") {
      throw new BadRequestException({ code: "INVITE_NOT_PENDING", message: "사용할 수 없는 초대 링크예요." });
    }
    return invite;
  }
}

/**
 * Member row -> API DTO. Pure: `displayNames` is the batch resolved by
 * `HouseholdRuntimeService.memberDisplayNames`, so building a DTO costs no query.
 */
function toMemberDto(
  member: {
    id: string;
    householdId: string;
    userId: string;
    role: MemberRole;
    status: string;
    joinedAt: Date | null;
  },
  displayNames: ReadonlyMap<string, string>
) {
  return {
    id: member.id,
    householdId: member.householdId,
    userId: member.userId,
    displayName: displayNames.get(member.userId) ?? "",
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt?.toISOString() ?? null
  };
}

/**
 * 라운드 108 트랙 B(정찰 S1-3) — **구성원 감사 봉투.** `household.member.remove`가 싣는
 * 값의 전부이고, 응답 DTO(`toMemberDto`)와 **일부러 다른 모양**이다(키 이름이 `memberId`라
 * 둘을 맞바꾸면 테스트가 먼저 깨진다).
 *
 * **뺀 축**
 *  · `displayName` — 카카오가 준 **닉네임 원문**. 사용자가 앱에서 적은 문자열은 아니지만
 *    개인을 그대로 지목하는 값이고, 730일 보존 + 어드민 감사 뷰어/CSV 노출 + 탈퇴 후 잔존이라는
 *    비용은 품목명·메모와 똑같다. 형제 `household.leave` 봉투가 이미 *"PII(닉네임·이메일) 금지"*
 *    로 그은 선(settings.controller.ts)과 같은 선이다.
 *  · `userId` — 계정 연결값. 파기 잡 phase 3은 `actor_user_id`만 null로 만들고 봉투 안은 손대지
 *    않으므로, 사본을 두면 **탈퇴한 사람의 계정 id가 감사 로그 안에 남는다**. 참조로 두면
 *    그렇지 않다: 같은 phase 3이 그 사람의 household_members 행을 물리 삭제한다.
 *  · `householdId` — 감사 행의 `household_id` 컬럼이 이미 같은 값을 든다(중복은 정보를 더하지
 *    않는다). 지출 봉투가 householdId를 싣지 않는 것과 같은 이유다.
 *
 * **남긴 축** — 감사가 답해야 하는 *"누가 누구를 언제 내보냈나"* 를 죽이지 않기 위해서다.
 *  · `memberId` — 대상 식별자. 감사 행의 `target_id`와 같은 값이지만, 봉투만 떼어 읽을 때
 *    무엇에 대한 기록인지 알 수 있어야 한다(파기 잡 phase 12가 옛 지출 봉투의 `id`를 지우지
 *    않기로 한 판단과 같다 — 식별성이 더해지지 않는다).
 *  · `role` · `status` — 값 공간이 고정된 열거형이다. `status`는 이 봉투의 본체다
 *    (`active` → `removed`가 before/after로 나란히 서는 유일한 축), `role`은 "무슨 권한이던
 *    사람을 내보냈나"에 답한다.
 *  · `joinedAt` — 고정 형식의 시각이다(자유 문자열도, 계정 연결값도 아니다). 지출 봉투가
 *    `spentOn`을 남긴 것과 같은 급이고, "가입 직후 내보냄" 같은 분쟁 맥락은 이 값에만 있다.
 */
export function toMemberAuditSnapshot(member: {
  id: string;
  role: MemberRole;
  status: string;
  joinedAt: Date | null;
}) {
  return {
    memberId: member.id,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt?.toISOString() ?? null
  };
}

/**
 * 라운드 108 트랙 B — **초대 감사 봉투**(`household.invite.cancel`). 위 구성원 봉투와 같은 규율.
 *
 * **뺀 축**: `invitedByUserId`(봉투 안의 계정 연결값 — phase 3의 파기를 비켜 간다) ·
 * `householdId`(감사 행의 컬럼과 중복) · `canReshareLink`(응답 화면용 상수 플래그라
 * 감사 사실이 아니다). 초대 **토큰**은 애초에 DTO에도 없다(sha256으로만 저장).
 *
 * **남긴 축**: `inviteId`(대상 식별자) · `role`·`channel`·`status`(열거형) ·
 * `expiresAt`·`createdAt`(고정 형식 시각 — 취소 시점(`created_at`)과 나란히 놓아야
 * "만료된 초대를 취소했나, 살아 있는 초대를 취소했나"에 답할 수 있다).
 */
export function toInviteAuditSnapshot(invite: {
  id: string;
  role: MemberRole;
  channel: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    inviteId: invite.id,
    role: invite.role,
    channel: invite.channel,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString()
  };
}

function toInviteDto(invite: {
  id: string;
  householdId: string;
  role: MemberRole;
  channel: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByUserId: string;
}) {
  return {
    id: invite.id,
    householdId: invite.householdId,
    role: invite.role,
    channel: invite.channel,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    invitedByUserId: invite.invitedByUserId,
    // Invite tokens are stored hashed (sha256), so the original link can never be
    // shown again — the honest recovery path is cancel + create a new invite.
    canReshareLink: false
  };
}

function roleOrder(role: MemberRole) {
  if (role === "owner") return 0;
  if (role === "co_parent") return 1;
  if (role === "viewer") return 2;
  return 3;
}
