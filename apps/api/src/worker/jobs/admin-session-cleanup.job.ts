import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

/**
 * 라운드 61 #7 기본 보존 기간(일). 만료(또는 폐기) **이후** 이만큼 지난 행을 지운다.
 *
 * 왜 30일인가 — 그리고 왜 이 삭제가 추적을 잃지 않는가:
 *  - `admin_sessions` 행의 수명은 원래 12시간이다(admin-session.service.ts의
 *    ADMIN_SESSION_TTL_MS — 갱신 없는 절대 만료). 즉 만료 후 30일은 세션 수명의 60배로,
 *    "방금 끝난 세션"을 들여다볼 창으로는 넉넉하다.
 *  - **로그인 이력은 이 테이블이 아니라 감사 로그가 보존한다.** 로그인/실패/MFA 실패는
 *    각각 `admin.login` / `admin.login_failed` / `admin.mfa_login_failed`로
 *    audit_logs에 남고(admin-auth.service.ts), 그 테이블의 보존 창은 730일이다
 *    (data-retention-purge.job.ts의 DEFAULT_AUDIT_LOGS_RETENTION_DAYS — 책임 추적
 *    기록이라 텔레메트리보다 길게 잡은 값). 그러므로 세션 행을 지워도 "누가 언제
 *    로그인했는가"는 그대로 남는다 — 여기서 사라지는 것은 그 세션의 **운영 세부**
 *    (token_hash·last_seen_at·ip·user_agent)뿐이다.
 *  - 그 세부를 곧바로 지우지 않고 30일 두는 이유는 사고 조사다: 침해 의심 시 "그 시각
 *    어떤 세션이 어느 IP/UA로 살아 있었나"를 되짚는 창이 필요하고, 어드민 사고는 보통
 *    수 주 안에 인지된다.
 *  - 반대로 무기한 보존은 그 자체가 위험이다: 다른 세션 테이블(refresh_tokens ·
 *    oauth_transactions · idempotency_keys)에는 전부 정리 잡이 있는데 여기만 없어서,
 *    **원문 IP와 User-Agent가 실린 행이 영구히** 쌓이고 있었다(감사 로그의 ip_hash는
 *    소금친 단방향 해시지만 이 컬럼은 원문이다). 그래서 이 창을 **늘리는 쪽이 위험한
 *    방향**이고, 그 점에서 audit_logs(730일)나 텔레메트리(400일)와 반대다.
 *
 * `ADMIN_SESSIONS_RETENTION_DAYS`로 덮어쓸 수 있다(check-env optional 카탈로그 등재).
 */
export const DEFAULT_ADMIN_SESSION_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 라운드 61 #7: 만료·폐기된 어드민 세션 행 정리.
 *
 * 어드민 세션은 12시간 절대 만료지만(admin-session.service.ts), 만료된 행을 지우는 코드가
 * 어디에도 없었다 — `validateSession`은 만료를 **판정**만 하고, 로그아웃/전체 폐기
 * (`revokeSessionByToken`/`revokeAllForAdmin`)는 `revoked_at`을 찍을 뿐 행을 남긴다.
 * 그래서 ip·user_agent가 실린 행이 무기한 누적됐다.
 *
 * refresh-token-cleanup.job.ts와 같은 형태·같은 판단이다: 만료 시점이 아니라 **만료(또는
 * 폐기) 후 유예 기간**이 지난 행만 지운다. 아직 유효하거나 최근에 끝난 세션은 건드리지
 * 않으므로, 로그인 상태의 관리자가 이 잡 때문에 튕기는 일은 구조적으로 불가능하다
 * (`expires_at`/`revoked_at`이 과거 30일보다 더 과거인 행만 후보다).
 *
 * ## 인덱스 (라운드 61 S-1 정정)
 *
 * 이 자리에는 "선택은 expires_at/revoked_at 위에서만 이뤄지고, 전자는
 * idx_admin_sessions_expires_at이 그대로 서빙한다 — 새 인덱스는 필요 없다"고 적혀 있었다.
 * **틀린 문장이었다.** 아래 술어는 OR 둘이고(`expires_at < c OR revoked_at < c`), Postgres가
 * 그 모양을 인덱스로 푸는 방법은 **두 분기 모두** 인덱스로 뽑아 BitmapOr로 합치는 것뿐이다.
 * revoked_at 쪽에 인덱스가 없으면 BitmapOr가 성립하지 않아 플래너는 테이블 전체 seq scan으로
 * 되돌아간다 — 즉 있던 expires_at 인덱스도 이 쿼리에서는 쓰이지 않았다.
 *
 * 그래서 000021이 `idx_admin_sessions_revoked_at (revoked_at) WHERE revoked_at IS NOT NULL`을
 * 추가한다. 모양·근거는 refresh-token-cleanup.job.ts가 쓰는 000011 §4의 부분 인덱스와 같고
 * (술어가 글자까지 같다), 부분 인덱스라 schema.prisma에는 주석으로만 남는다.
 */
@Injectable()
export class AdminSessionCleanupJob implements WorkerJob {
  readonly name = "admin_session_cleanup";

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const retentionDays = this.retentionDays();
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    // OR인 이유: 폐기된 세션은 만료 전에 폐기될 수 있고(로그아웃·MFA 해제 시 일괄 폐기),
    // 만료된 세션은 폐기 표시 없이 만료만 지날 수 있다. 둘 중 하나라도 유예를 넘겼으면
    // 그 세션은 이미 끝난 세션이다.
    const result = await this.prisma.adminSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] }
    });
    return { deleted: result.count, retentionDays };
  }

  private retentionDays(): number {
    const raw = Number(process.env.ADMIN_SESSIONS_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ADMIN_SESSION_RETENTION_DAYS;
  }
}
