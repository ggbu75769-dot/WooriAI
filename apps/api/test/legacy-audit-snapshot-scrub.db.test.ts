import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toInviteAuditSnapshot, toMemberAuditSnapshot } from "../src/households/household-runtime.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { DataRetentionPurgeJob } from "../src/worker/jobs/data-retention-purge.job";
import { isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

/**
 * **파기 잡 phase 12가 옛 가구 감사 봉투까지 씻는가** — 라운드 108 트랙 B가 남긴 이월의 상환분.
 *
 * ## 왜 새 파일인가
 *
 * 종전(그때는 참): phase 12를 세는 자리는 `data-retention-purge.db.test.ts` 하나였고, 그 파일은
 * **배타 스위트**(`test/helpers/exclusive-suites.ts`)라 `job.run()`을 통째로 돌릴 수 있다 — 그
 * 호출은 탈퇴 사용자와 고아 가구를 **DB 전역에서 삭제**하므로 다른 스위트와 겹쳐 돌면 안 된다.
 *
 * → 이 파일은 그 목록에 들어가지 않는다(그 목록은 이 트랙의 소유 밖이고, 배타 스위트를 하나 더
 * 늘리면 그만큼 전체 실행이 직렬화된다). 대신 **phase 12만** 부른다. 그 phase가 하는 일은
 * `audit_logs` 중 *옛 키를 아직 들고 있는* 행의 `before_json`/`after_json`을 다시 쓰는 것뿐이라
 * 전역 삭제가 없고, 그런 옛 모양 행을 만드는 스위트는 저장소에 하나뿐인데(위의 배타 파일) 그
 * 파일은 정의상 이 파일과 겹치지 않는다. 그래서 공유 락으로 안전하다.
 *
 * private 메서드를 좁은 캐스트로 부르는 이유가 그것이다 — 접근 제어를 우회하려는 것이 아니라,
 * **이 파일이 절대 하면 안 되는 일(전역 삭제)을 부르지 않기 위해서**다.
 *
 * ## 세는 넷
 *  ① 옛 `household.member.remove`/`household.invite.cancel` 봉투의 닉네임 원문·계정 연결값이 사라진다
 *  ② 남기기로 한 축(`id`·`householdId`·열거형·시각)은 남고 표식(`snapshotScrubbedAt`)이 붙는다
 *  ③ **오늘의 봉투는 선택되지 않는다** — 쓰기 경로가 내놓는 키 집합과 씻는 키 집합이 서로소다
 *  ④ 두 번째 틱은 0건이다(키 부재가 곧 종료 조건이라 이미 씻은 행을 다시 씻지 않는다)
 */
describe.skipIf(!dbAvailable)("파기 잡 phase 12 — 옛 가구 감사 봉투", () => {
  const prisma = new PrismaService();
  let job: DataRetentionPurgeJob;

  /** 이 스위트가 만든 행만 지우기 위한 자기 식별자. */
  const ownAuditIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
    job = new DataRetentionPurgeJob(prisma);
  });

  afterAll(async () => {
    // 자기 접두(자기가 만든 id)만 지운다 — 다른 스위트의 감사 행은 건드리지 않는다.
    if (ownAuditIds.length > 0) {
      await (prisma as unknown as PrismaClient).auditLog.deleteMany({ where: { id: { in: ownAuditIds } } });
    }
    await prisma.$disconnect();
  });

  /**
   * phase 12만 끝까지 돌린다. 배치는 오래된 것부터라, 방금 만든 픽스처에 닿으려면 DB에 남아 있는
   * 옛 백로그를 먼저 비워야 한다(그러지 않으면 테스트가 코드가 아니라 DB 이력에 따라 갈린다 —
   * 배타 파일의 `drainExpenseSnapshotScrub`가 적어 둔 그 이유 그대로다).
   */
  async function drainPhase12(): Promise<number> {
    const phase = job as unknown as {
      scrubLegacySnapshots: (now: Date, batchSize: number, skip: number) => Promise<{ expenseSnapshotsScrubbed: number }>;
    };
    let total = 0;
    for (let tick = 0; tick < 50; tick += 1) {
      const { expenseSnapshotsScrubbed } = await phase.scrubLegacySnapshots(new Date(), 100, 0);
      total += expenseSnapshotsScrubbed;
      if (expenseSnapshotsScrubbed === 0) return total;
    }
    throw new Error("phase 12가 50틱 안에 끝나지 않았다 — 자기 종료 계약이 깨졌다");
  }

  async function createAudit(action: string, before: object, after: object) {
    const row = await (prisma as unknown as PrismaClient).auditLog.create({
      data: { actorUserId: null, action, targetType: "household_members", beforeJson: before, afterJson: after }
    });
    ownAuditIds.push(row.id);
    return row.id;
  }

  async function envelopesOf(id: string) {
    const row = await (prisma as unknown as PrismaClient).auditLog.findUniqueOrThrow({ where: { id } });
    return {
      before: row.beforeJson as Record<string, unknown>,
      after: row.afterJson as Record<string, unknown>
    };
  }

  it("옛 구성원 제거·초대 취소 봉투에서 닉네임 원문과 계정 연결값을 지우고, 남길 축은 남긴다", async () => {
    const nickname = `카카오닉네임-절대노출금지-${randomUUID()}`;
    const memberId = randomUUID();
    const inviteId = randomUUID();
    const householdId = randomUUID();

    // 라운드 108 이전 쓰기 경로가 남기던 그대로의 봉투(= 응답 DTO 그 자체).
    const memberAuditId = await createAudit(
      "household.member.remove",
      { id: memberId, householdId, userId: randomUUID(), displayName: nickname, role: "co_parent", status: "active", joinedAt: "2026-01-02T00:00:00.000Z" },
      { id: memberId, householdId, userId: randomUUID(), displayName: nickname, role: "co_parent", status: "removed", joinedAt: "2026-01-02T00:00:00.000Z" }
    );
    const inviteAuditId = await createAudit(
      "household.invite.cancel",
      { id: inviteId, householdId, invitedByUserId: randomUUID(), role: "viewer", channel: "kakao", status: "pending", expiresAt: "2026-02-01T00:00:00.000Z", canReshareLink: true },
      { id: inviteId, householdId, invitedByUserId: randomUUID(), role: "viewer", channel: "kakao", status: "revoked", expiresAt: "2026-02-01T00:00:00.000Z", canReshareLink: true }
    );

    await drainPhase12();

    const member = await envelopesOf(memberAuditId);
    for (const envelope of [member.before, member.after]) {
      // 닉네임은 키로도 값으로도 도달 불가여야 한다.
      expect(Object.keys(envelope)).not.toContain("displayName");
      expect(Object.keys(envelope)).not.toContain("userId");
      expect(JSON.stringify(envelope)).not.toContain(nickname);
      // 남기기로 한 축(감사 행의 target_id/household_id와 중복이라 식별성이 더해지지 않는다).
      expect(envelope).toMatchObject({ id: memberId, householdId, role: "co_parent" });
      expect(envelope.snapshotScrubbedAt).toEqual(expect.any(String));
    }
    expect(member.before.status).toBe("active");
    expect(member.after.status).toBe("removed");

    const invite = await envelopesOf(inviteAuditId);
    for (const envelope of [invite.before, invite.after]) {
      expect(Object.keys(envelope)).not.toContain("invitedByUserId");
      expect(envelope).toMatchObject({ id: inviteId, householdId, role: "viewer", channel: "kakao" });
      expect(envelope.snapshotScrubbedAt).toEqual(expect.any(String));
    }
    expect(invite.before.status).toBe("pending");
    expect(invite.after.status).toBe("revoked");
  });

  it("이미 씻은 행은 다시 씻지 않는다 — 표식이 덮어써지지 않고 둘째 틱은 0건이다", async () => {
    const auditId = await createAudit(
      "household.member.remove",
      { id: randomUUID(), householdId: randomUUID(), userId: randomUUID(), displayName: "닉네임", role: "owner", status: "active" },
      { id: randomUUID(), role: "owner", status: "removed" }
    );

    await drainPhase12();
    const firstMarker = (await envelopesOf(auditId)).before.snapshotScrubbedAt;
    expect(firstMarker).toEqual(expect.any(String));

    // 종료 조건은 표식이 아니라 **키의 부재**다(선택 술어가 jsonb_exists_any이다).
    // 그래서 이미 씻긴 행은 다음 틱의 후보 집합에 아예 들어오지 않는다.
    const second = await drainPhase12();
    expect(second).toBe(0);
    expect((await envelopesOf(auditId)).before.snapshotScrubbedAt).toBe(firstMarker);
  });

  it("오늘의 봉투는 후보가 되지 않는다 — 쓰기 경로가 내놓는 키와 씻는 키가 서로소다", async () => {
    // 실제 쓰기 경로 함수가 내놓는 그대로를 봉투로 넣는다(모양을 여기서 손으로 짓지 않는다).
    const member = toMemberAuditSnapshot({
      id: randomUUID(),
      role: "co_parent",
      status: "active",
      joinedAt: new Date("2026-01-02T00:00:00.000Z")
    });
    const invite = toInviteAuditSnapshot({
      id: randomUUID(),
      role: "viewer",
      channel: "kakao",
      status: "pending",
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    const memberAuditId = await createAudit("household.member.remove", member, member);
    const inviteAuditId = await createAudit("household.invite.cancel", invite, invite);

    await drainPhase12();

    // 손대지 않았다 = 표식이 붙지 않았고 키 집합이 그대로다.
    for (const [id, original] of [
      [memberAuditId, member],
      [inviteAuditId, invite]
    ] as const) {
      const { before, after } = await envelopesOf(id);
      expect(before).toEqual(original);
      expect(after).toEqual(original);
      expect(Object.keys(before)).not.toContain("snapshotScrubbedAt");
    }
  });
});
