import { Inject, Injectable, Logger } from "@nestjs/common";
// Value import (not `import type`): phase 9 needs Prisma.sql/Prisma.join at
// runtime to build its status IN (…) list — same usage as admin/*-summary
// services. The type-only uses below are unchanged.
import { Prisma } from "@prisma/client";
import { maskLookupQuery } from "../../admin/admin-users-lookup.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkerJob } from "../worker-job";

export const DEFAULT_PURGE_RETENTION_DAYS = 30;
// Per-entity cap per tick: each purge phase (expenses, children, withdrawn
// users, anonymized stubs) touches at most this many *driver* rows per run,
// bounding tick duration on a backlog. Dependent rows of a driver row (a
// child's expenses, a user's tokens) are not counted against the cap — a
// driver row is always purged whole so a crash/retry can never leave it
// half-purged.
export const DEFAULT_PURGE_BATCH_SIZE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SEC-130: telemetry retention. Unlike phases 1–4, these two tables hold no
 * tombstones — every row is live operational telemetry that simply grows
 * forever, so they need a time-based ceiling of their own rather than the
 * 30-day post-deletion grace period (PURGE_RETENTION_DAYS) the other phases
 * use.
 *
 * 400 days (≈13 months) is deliberately generous, for two independent
 * reasons:
 *  - 정산/통계: affiliate_clicks is the raw substrate of the admin click
 *    breakdown and of any commission reconciliation against a partner's own
 *    numbers; analytics_events backs the admin KPI/funnel aggregates. Both are
 *    routinely compared year-over-year ("작년 이맘때"), so anything under 12
 *    months would silently break a comparison an operator can no longer
 *    reconstruct — deletion here is irreversible and the aggregates are not
 *    pre-materialized anywhere.
 *  - 정산 주기: affiliate networks settle and can claw back/adjust commissions
 *    months after the click. 13 months leaves a full year plus a month of
 *    slack for a late dispute to still be checkable against click rows.
 * Erring long is the safe direction: these rows carry no raw identifiers
 * (analytics_events only stores HMAC anon ids; affiliate_clicks' user/
 * household/child ids are nulled by phases 2–3 when the referenced person is
 * purged, and ip_hash is a salted one-way hash), so keeping them longer is a
 * storage cost, not a privacy exposure — while deleting them too early
 * destroys settlement evidence.
 *
 * Overridable via ANALYTICS_EVENTS_RETENTION_DAYS /
 * AFFILIATE_CLICKS_RETENTION_DAYS. Shortening either is a data-destroying
 * change — confirm with whoever owns 정산/통계 first.
 */
export const DEFAULT_ANALYTICS_EVENTS_RETENTION_DAYS = 400;
export const DEFAULT_AFFILIATE_CLICKS_RETENTION_DAYS = 400;

/**
 * GAP-058 #10: audit_logs retention (phase 8).
 *
 * Until this constant existed, `audit_logs` was the one table with NO deletion
 * path at all: phase 3 nullifies its actorUserId, phase 5 rewrites one legacy
 * field, and nothing anywhere deletes a row. Every admin action, every expense
 * update (CS-101), every consent write appends forever, so the table grows
 * without bound and — more importantly — an operational record that nobody has
 * decided to keep is kept anyway, indefinitely.
 *
 * **730 days (2 years), deliberately LONGER than the 400-day telemetry
 * windows.** The two tables serve different purposes and that difference is
 * the whole reason the number differs:
 *  - analytics/clicks are 정산·통계 substrate — their value decays with the
 *    reporting window they feed (year-over-year + a settlement dispute
 *    margin), hence ~13 months.
 *  - audit_logs is the 책임 추적(accountability) record: "who changed this
 *    amount / who looked this user up / who removed this member". Those
 *    questions arrive LATE — a CS dispute, an internal review, a regulator's
 *    or a user's inquiry about something that happened last year — and the
 *    row is the only evidence that exists. 2 years covers a full year plus a
 *    year of lag, which is also the conventional floor for 이용자 문의·분쟁
 *    대응 기록.
 * Erring long is the safe direction here too: these rows carry no raw
 * identifiers by the time a person is purged (phase 3 nulls actorUserId,
 * ipHash is a salted one-way hash, phase 5 masks the one legacy free-text
 * field), so keeping them longer is a storage cost, not a privacy exposure —
 * while deleting them early destroys the only record of who did what.
 *
 * Overridable via AUDIT_LOGS_RETENTION_DAYS. ⚠️ **짧게 조정하는 것은 PM/법무
 * 확인 대상이다**: 보존 기간을 줄이는 순간 되돌릴 수 없는 삭제가 시작되고,
 * 그 기간은 개인정보처리방침("법적 근거에 따른 보관" — infra/legal/
 * privacy-policy.html)과 내부 감사 정책이 함께 정하는 값이다. 코드에서 혼자
 * 줄이지 말 것. 늘리는 방향은 안전하다.
 */
export const DEFAULT_AUDIT_LOGS_RETENTION_DAYS = 730;

/**
 * GAP-060 #5: import_rows retention (phase 9).
 *
 * `import_rows` is the parsed **preview** of an uploaded 엑셀/CSV file: one row
 * per line the parser found, holding the user's raw financial detail (날짜·품목
 * 명·금액·판매처). Until this constant existed nothing ever deleted them except
 * the child/household cascade (phase 2/3) — so every file a user ever imported
 * left its full contents in the database forever, including the lines the user
 * **did not** approve (`selected = false`). That is exactly what
 * infra/legal/privacy-policy.html §1 said we do not do ("미리보기에서 승인한
 * 내역만 저장").
 *
 * **90 days**, and the reasoning is the opposite direction of the audit window:
 *  - The rows stop being 사용자 자산 the moment the job leaves `preview_ready`.
 *    Once confirmed, the approved lines live on as real `expenses` rows (which
 *    the user owns, edits and exports); the preview copy is then a duplicate of
 *    personal data with no product surface that needs it — 검수 화면은 확정 후
 *    편집이 막히고(`IMPORT_NOT_EDITABLE`), 앱의 어떤 화면도 확정된 잡의 행을
 *    다시 보여 주지 않는다.
 *  - What still argues for keeping them a while is **CS 조회 가능성**: "가져
 *    오기 했는데 3건이 빠졌어요" 류 문의는 원본 파일이 아니라 이 행들(무엇이
 *    파싱됐고 무엇이 selected=false였는지)이 있어야 답할 수 있다. 그런 문의는
 *    보통 한두 달 안에 도착하므로 한 분기(90일)면 충분히 덮는다. `failed` 잡도
 *    같은 이유로 같은 창을 쓴다 — 실패 원인 추적이 늦게 요청될 수 있다.
 *  - 그보다 길게 둘 이유는 없다: 정산 근거도 책임 추적 기록도 아니고
 *    (그래서 400/730일 창과 나란히 두지 않는다), 남겨 둘수록 승인하지 않은
 *    금융 내역의 사본이 서버에 더 오래 남는다. 여기서는 **짧은 쪽이 안전한
 *    방향**이다.
 *
 * Overridable via IMPORT_ROWS_RETENTION_DAYS. ⚠️ **짧게 조정하는 것은 PM/법무
 * 확인 대상이다** — 위 CS 조회 가능성이 곧 문의 대응 품질이고, 방침 문서
 * (privacy-policy §3 "검수용 행은 90일 후 파기")가 이 숫자를 그대로 말하고
 * 있어 코드에서 혼자 줄이면 문서가 거짓이 된다. 늘리는 방향은 개인정보를 더
 * 오래 들고 있는 것이므로 이 역시 단독 결정 대상이 아니다.
 */
export const DEFAULT_IMPORT_ROWS_RETENTION_DAYS = 90;

/**
 * Import job statuses whose preview rows phase 9 may purge — the import is over
 * and the user has nothing left to review:
 *
 *  - `confirmed` — 승인분이 expenses로 넘어갔다. **오늘 실제로 쓰이는 유일한
 *    종료 상태이고, 문서(privacy-policy §3 · data-safety)가 말하는 "확정된
 *    가져오기"가 이것이다.**
 *  - `cancelled` — 라운드 60 리뷰(P2-3): 같은 아이에게 새 가져오기를 시작해
 *    이전 미리보기가 대체된 잡(import-pipeline.service.ts의 createImportJob).
 *    그 constant 주석이 예고한 "a future `cancelled` writer"가 바로 이것이고,
 *    사용자가 그 행들을 다 쓴 것이 맞다 — 그가 지금 검수하는 것은 새 잡이다.
 *  - `failed` — **오늘 이 상태를 쓰는 코드 경로는 없다.** 가져오기 실패는
 *    `createImportJob`이 `importJob.create` **전에** 던지므로(파일 없음·형식
 *    불일치·파싱 실패·행 0건) 잡 행 자체가 만들어지지 않는다. 즉 이 항목은
 *    지금은 죽은 값이고, 남겨 두는 이유는 하나뿐이다: 나중에 실패를 잡으로
 *    남기게 되는 날 그 행들도 같은 창에 들어와야 하기 때문이다. 문서가 이
 *    상태를 "일어나는 일"로 말하지 않도록 정정한 이유이기도 하다.
 *
 * `preview_ready` is deliberately absent — see the phase doc.
 * `uploaded`/`analyzing` exist in the enum but no code path writes them today;
 * leaving them out keeps this phase to statuses whose meaning is settled.
 */
export const IMPORT_ROWS_PURGEABLE_JOB_STATUSES = ["confirmed", "cancelled", "failed"] as const;

/**
 * GAP-062 #8: household_invites retention (phase 10).
 *
 * `household_invites` was the last table with **no retention period at all**:
 * rows were only ever deleted as a side effect of purging their author (phase
 * 3) or their household (the orphan cascade), so every invite a family ever
 * sent — expired, accepted or cancelled — stayed forever, and the growth is
 * proportional to the user count. 개인정보 밀도는 낮지만(원문 토큰이 아니라
 * sha256 해시 · 역할 · 채널 · 가구/사용자 id), "보존 기간이 정해지지 않은
 * 테이블"이 하나 남아 있는 것 자체가 privacy-policy 정합의 구멍이다.
 *
 * **90 days**, the same quarter window as import_rows and for the same kind of
 * reason rather than by imitation:
 *  - 이 행이 파기된 뒤에도 사라지는 사실은 없다. 수락된 초대는 `household_members`
 *    행(role·invited_by_user_id·joined_at)으로, 취소는 감사 로그
 *    `household.invite.cancel`(before/after 봉투, 730일 창)로 각각 남는다 —
 *    즉 삭제는 **중복 보존의 해소**이지 기록의 상실이 아니다.
 *  - 그래도 한 분기를 두는 이유는 CS 조회다: "초대 링크를 보냈는데 왜 안 되나요"에
 *    답하려면 그 링크가 만료됐는지·취소됐는지·이미 수락됐는지를 이 행에서 읽어야
 *    하고, 그런 문의는 대개 몇 주 안에 도착한다. 초대 자체의 수명은 7일
 *    (households/household-runtime.service.ts의 INVITE_TTL_MS)이므로 90일은 그
 *    13배의 사후 조회 창이다.
 *  - 그보다 길게 둘 이유는 없다: 정산 근거(400일)도 책임 추적 기록(730일)도 아니다.
 *
 * Overridable via HOUSEHOLD_INVITES_RETENTION_DAYS. ⚠️ **짧게 조정하는 것은 PM
 * 확인 대상이다** — 되돌릴 수 없는 삭제이고, 짧아질수록 위 CS 조회 창이 그대로
 * 줄어든다(라운드 58 #10 · 60 #5와 같은 관례). 늘리는 방향은 저장 비용이다.
 */
export const DEFAULT_HOUSEHOLD_INVITES_RETENTION_DAYS = 90;

/**
 * Invite statuses phase 10 may purge — the invite's outcome is settled and the
 * link can never be redeemed again. `household_invites.status`가 가질 수 있는
 * 값은 이 셋과 `pending`뿐이다(household-runtime.service.ts: 생성은 `pending`,
 * 만료 표시 UPDATE는 `expired`, 취소 CAS는 `revoked`, 수락 CAS는 `accepted`).
 *
 * **`pending`은 일부러 빠져 있다.** 아직 살아 있는 링크이고, 그 행을 지우면
 * 사용자가 방금 카카오톡으로 보낸 초대가 조용히 죽는다.
 *
 * 남는 사각을 정직하게 적어 둔다: 만료 표시는 **게으르다**(누군가 그 가구의 초대
 * 목록을 열거나 그 토큰을 조회할 때만 UPDATE가 돈다 — 같은 파일 349·386·570).
 * 그래서 아무도 다시 들여다보지 않은 가구의 초대는 유효기간이 한참 지나도
 * `pending`으로 남고, 이 단계의 대상이 아니다. 그 행은 어차피 사용될 수 없지만
 * (모든 조회 경로가 만료 표시를 먼저 한다) 파기되지도 않는다 — 상태가 정해진 행만
 * 지운다는 이 단계의 규칙을 지키기 위해 남겨 둔 격차이고, 닫으려면 "pending이지만
 * expires_at이 창 밖" 조건을 별도 판단으로 추가해야 한다.
 */
export const HOUSEHOLD_INVITES_PURGEABLE_STATUSES = ["expired", "accepted", "revoked"] as const;

// Poison-row escalation (review M1): after this many CONSECUTIVE ticks in
// which a phase failed terminally (first attempt AND halved retry), the phase
// starts skipping head rows of its deterministic ordering — see runPhase.
export const POISON_FAILURE_THRESHOLD = 3;

/**
 * Audit action whose after_json used to carry the raw admin users-lookup search
 * term (= an end user's email, in practice). Phase 5 scrubs those legacy rows —
 * see the class doc, item 5.
 */
export const LOOKUP_SEARCH_ACTION = "admin.user_lookup.search";

// Per-phase in-memory escalation state (job instance field — resets on
// restart, which is fine: a genuinely poisoned row keeps failing and the
// counter re-accumulates within POISON_FAILURE_THRESHOLD ticks).
type PhasePoisonState = {
  /** Ticks in a row this phase failed terminally (both attempts). */
  consecutiveFailures: number;
  /** How many head rows the phase's NEXT selection skips (0 = none). */
  poisonSkip: number;
};

// Explicit interactive-transaction options: the Prisma default of 5s aborts
// (P2028) on an oversized cascade batch, and because batch selection is
// deterministic oldest-first, a timed-out batch would be re-selected
// identically on every tick and stall that phase forever. 30s gives a full
// batch of deep cascades room to finish; maxWait stays at the 5s default.
const PURGE_TX_OPTIONS = { timeout: 30_000, maxWait: 5_000 } as const;

type Tx = Prisma.TransactionClient;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * PRIV-105: physical purge of soft-deleted / withdrawn data after a retention
 * window (PURGE_RETENTION_DAYS, default 30 days). Until this job existed,
 * "deleted" rows were only ever tombstoned (Expense.deletedAt,
 * Child.deletedAt, User.status=withdrawn) and never left the database, which
 * is why infra/legal/privacy-policy.html could not state a 파기(destruction)
 * period. The privacy policy / account-deletion page / data-safety answers now
 * promise "삭제 처리 후 30일이 경과하면 지체 없이(통상 수 분 이내) 완전 파기"
 * — keep those documents in sync with this job's semantics (the purge runs
 * strictly AFTER the retention window elapses, plus up to one worker tick of
 * latency).
 *
 * NOTE on referential integrity: prisma/schema.prisma declares no relations,
 * but migration 000001 creates real SQL FK constraints on most domain tables
 * (audit_logs' user/household FKs were dropped in 000002; refresh_tokens and
 * idempotency_keys never had one). Deletion order below is therefore not just
 * hygiene — Postgres enforces it.
 *
 * Ten phases, each capped at PURGE_BATCH_SIZE driver rows per tick. Phases
 * run INDEPENDENTLY: each is wrapped in its own try/catch so one poisoned
 * phase can never block the others; a phase's terminal error is reported in
 * the summary (`<phase>Error`) and the later phases still run. A phase whose
 * transaction fails is retried once within the same tick with half the batch
 * size (floor, min 1) — a cheap self-degrading step so an oversized batch
 * (e.g. deep phase-3 orphan cascades) eventually drains instead of being
 * re-selected identically forever; the degradation is logged. Every batch
 * selection orders by its age column WITH the primary key as tiebreaker
 * (deletedAt asc, id asc / updatedAt asc, id asc), so the ordering is a
 * strict total order and the halved retry re-selects a genuine strict prefix
 * of the failed batch even when many rows share the same timestamp.
 *
 * Poison-row escalation (review M1a): halving bottoms out at batch size 1,
 * and because selection is deterministic the same head row is re-selected
 * every tick — a single row whose cascade exceeds the 30s transaction
 * timeout would otherwise stall its phase forever. So each phase tracks its
 * consecutive terminal failures in memory; once POISON_FAILURE_THRESHOLD (3)
 * ticks in a row have failed, the next selection skips the head row
 * (poisonSkip=1), and keeps skipping one more per further failed tick, so
 * the rows behind the poisoned one drain. The skipped rows' ids are logged
 * at ERROR with a 수동 조치 필요 marker — skipping is deferral, not loss: on
 * the first successful tick the state resets, the head row is re-selected,
 * and the cycle repeats (rows behind it still draining at a reduced duty
 * cycle) until an operator fixes or removes the poisoned row. A transient
 * outage that trips the threshold merely defers a healthy head row by a few
 * ticks for the same reason. No schema changes — state is per-process.
 *
 * Monitoring visibility (review M1b): run() executes ALL phases first
 * (isolation above is unchanged), but if any phase failed terminally it then
 * throws DataRetentionPurgePhaseFailureError, whose message embeds the full
 * summary. SchedulerService's per-job catch logs it (status=failed, summary
 * included via the message) and records lastStatus:"failed" in
 * WorkerStatusService — so GET /health/worker shows the purge job as failed
 * while the tick still finishes (stale stays false) and the other jobs keep
 * running. Previously a stalled phase was invisible: run() swallowed the
 * error and the scheduler logged status=ok forever.
 *
 * 1. Soft-deleted expenses (Expense.deletedAt < cutoff) are hard-deleted,
 *    after nullifying the nullable FKs that point at them
 *    (ChildItemStatus.expenseId, ImportRow.duplicateCandidateExpenseId,
 *    Attachment.expenseId).
 *    Tombstone/delta-sync consideration: GET /v1/sync/changes
 *    (src/sync/sync.service.ts) serves soft-deleted expenses as `delete`
 *    tombstones so offline clients converge. Purging a tombstone removes that
 *    signal, but only 30+ days after the delete — far beyond any realistic
 *    offline gap. NOTE (verified against sync.service.ts + the mobile
 *    delta-sync client in apps/mobile/src/offline): the server does NOT expire
 *    old cursors — a merely-old cursor is still valid, and the mobile client
 *    only re-pulls from scratch on a 400 SYNC_CURSOR_INVALID (malformed
 *    cursor) or on session teardown (logout/account switch), never on age. So
 *    a device offline for more than the retention window does NOT
 *    automatically fall back to a full re-pull; it would keep a stale local
 *    copy of the purged expense until its next from-scratch pull. This is an
 *    accepted trade-off at 30 days (stale display-only data on an abandoned
 *    device vs. indefinite server-side retention of deleted personal data);
 *    shortening PURGE_RETENTION_DAYS widens that staleness window.
 *
 * 2. Soft-deleted children (Child.deletedAt < cutoff) are hard-deleted with
 *    their dependents in one transaction, FK-dependents first: import rows,
 *    item check statuses, attachments, expenses (regardless of their own
 *    deletedAt — the child-delete flow tombstones them together, and any
 *    straggler must not outlive the child), import jobs (after the expenses
 *    that FK them), and budgets. AffiliateClick.childId is deliberately NOT
 *    deleted but nullified: click rows are historical revenue/analytics
 *    aggregates (per-product counts) and, with userId/householdId/childId
 *    nulled and the referenced rows gone, they no longer point at any stored
 *    personal data. Household.defaultChildId references are nulled as well.
 *
 * 3. Withdrawn users (User.status=withdrawn, User.deletedAt IS NULL,
 *    updatedAt < cutoff). Timestamp choice: withdrawUser
 *    (households/household-runtime.service.ts) only flips status — it does not
 *    stamp User.deletedAt — so the status flip's own updatedAt bump is the
 *    withdrawal time. A later login *attempt* by a withdrawn user bumps
 *    updatedAt again (lastLoginAt write), which merely extends retention —
 *    conservative, never premature.
 *
 *    Their satellite personal data is hard-deleted: refresh tokens (normally
 *    already gone via revokeAllForUser + refresh_token_cleanup), devices,
 *    consents, idempotency keys, memberships, and invites they authored
 *    (HouseholdInvite.invitedByUserId is a NOT NULL FK, and a stale invite is
 *    worthless). AnalyticsEvent rows are left untouched: they only carry HMAC
 *    anon hashes (userAnonId/householdAnonId), no raw ids. AuditLog rows are
 *    KEPT as the legal/ops record, but actorUserId (the only raw user
 *    identifier on them; ipHash is already a salted one-way hash) is
 *    nullified. AffiliateClick.userId is nullified for the same reason as
 *    childId above.
 *
 *    Orphaned households: after deleting the purged users' membership rows, a
 *    household with zero remaining HouseholdMember rows of ANY status (rows
 *    are only ever removed by this purge, so zero rows means every member has
 *    been physically purged) is deleted too, cascading its children (via the
 *    same child cascade, regardless of Child.deletedAt) and pending invites.
 *
 *    Hard delete vs anonymize: the users row itself is hard-deleted when
 *    nothing references it any more. But a withdrawn user may have authored
 *    data in a household that SURVIVES with other members (the account-delete
 *    flow deliberately leaves shared household data behind), and those rows
 *    carry NOT NULL FKs to users (Expense.createdByUserId,
 *    Budget.createdByUserId, ChildItemStatus.updatedByUserId,
 *    Attachment.uploadedByUserId, ImportJob.userId, Household.ownerUserId).
 *    Such a user's row is instead anonymized in place: email/phone/
 *    displayName/profileImageUrl/lastLoginAt nulled and providerUserId
 *    replaced with "purged:<internal uuid>" so the row can never be linked
 *    back to the Kakao/Apple/Google account. deletedAt is stamped to mark the
 *    row as purged (nothing else ever sets User.deletedAt), which both
 *    excludes it from future purge batches and records the destruction time.
 *    The stub that remains holds no personal data — it exists purely to keep
 *    the surviving household's referential integrity.
 *
 * 4. Anonymized user stubs (User.deletedAt IS NOT NULL, status=withdrawn)
 *    whose blocking references have since disappeared (e.g. the surviving
 *    household was itself purged later, or the stub's authored rows aged out)
 *    are hard-deleted. Without this phase a stub whose reason to exist is
 *    gone would survive forever. The same reference check as phase 3
 *    (findReferenceBlockedUserIds) decides deletability; still-referenced
 *    stubs are left alone. No cutoff applies — a stub was already past the
 *    retention window when it was anonymized.
 *
 * 5. Legacy admin users-lookup search terms (라운드 28 리뷰 F1). Audit rows are
 *    kept forever as the legal/ops record and phase 3 only nullifies their
 *    actorUserId — their after_json is never touched. That was a personal-data
 *    leak for one action: `admin.user_lookup.search` used to store the raw
 *    search term (`after_json.query`), which in practice IS an end user's
 *    email, so a withdrawn user's email survived the purge inside the audit
 *    trail (and flowed out through the audit viewer + its CSV export).
 *
 *    The write path now stores only `queryMasked` (앞 2자 + 길이, see
 *    admin-users-lookup.controller.ts / maskLookupQuery), so NEW rows need no
 *    scrubbing. Rows written before that change still hold the raw term, and
 *    they cannot be reached from the withdrawn user: the audit row's actor is
 *    the ADMIN, and the searched user is identified nowhere but inside that
 *    very string — so no per-user purge scope can find it. Hence this phase:
 *    a one-time, self-terminating sweep that rewrites `query` into the same
 *    masked form (plus `queryScrubbedAt`, so the row is honest about having
 *    been rewritten). Chosen over a SQL migration because it is batched and
 *    restartable like every other phase (a single UPDATE over an unbounded
 *    audit table is exactly the kind of long lock this job exists to avoid),
 *    and because it also catches rows an older deployment writes while a
 *    rollout is in flight. Once every legacy row is masked the selection
 *    (`after_json ->> 'query' IS NOT NULL`, served by
 *    idx_audit_logs_action_created) matches nothing and the phase is a
 *    no-op — leaving it in place costs one indexed empty read per tick and
 *    keeps the upgrade path working for any DB restored from an old backup.
 *
 *    Caveat, same as every other phase: this only runs where the worker runs
 *    (WORKER_ENABLED). A deployment that never starts the worker keeps its
 *    legacy raw terms — there, the one-shot equivalent is
 *    `UPDATE audit_logs SET after_json = (after_json - 'query') || …` by hand.
 *    That is not a new exposure (the rows are already there); it is the same
 *    "파기 경로가 워커 하나뿐" trade-off documented in
 *    docs/operations/known-limitations.md.
 *
 * 6. Aged-out analytics events (AnalyticsEvent.occurredAt < now −
 *    ANALYTICS_EVENTS_RETENTION_DAYS, default 400 — see the constant's doc for
 *    why the default is deliberately long). SEC-130: this table only ever
 *    grows (one row per collected client event, up to 50 per request), and
 *    nothing else deletes from it. Selection uses occurred_at, served by
 *    idx_analytics_events_occurred_at (PERF-101/000011). Chosen over
 *    received_at because occurred_at is the event's own semantic time — the
 *    same column every admin KPI window filters on, so "purged" and "outside
 *    every queryable window" mean exactly the same thing, and a batch that
 *    arrived late can never be deleted while still inside a reporting window.
 *    Rows have no dependents (nothing FKs analytics_events), so the delete is
 *    a plain batched deleteMany.
 *
 * 7. Aged-out affiliate clicks (AffiliateClick.clickedAt < now −
 *    AFFILIATE_CLICKS_RETENTION_DAYS, default 400). Same shape as phase 6:
 *    an append-only table (one row per redirect/click, and the public /r/:code
 *    redirect is unauthenticated) that phases 2–3 only ever anonymize, never
 *    delete. Selection uses clicked_at, served by
 *    idx_affiliate_clicks_clicked_at (PERF-101/000011). Nothing FKs
 *    affiliate_clicks either, so this too is a plain batched deleteMany —
 *    but note it destroys settlement/analytics evidence, hence the long
 *    default window.
 *
 * 8. Aged-out audit logs (AuditLog.createdAt < now −
 *    AUDIT_LOGS_RETENTION_DAYS, default 730 — see the constant's doc for why
 *    the accountability record is kept LONGER than the 400-day telemetry
 *    windows, and why shortening it is a PM/법무 decision rather than a code
 *    one). GAP-058 #10: audit_logs had no age-based deletion path at all —
 *    phase 3 only nullifies its actorUserId and phase 5 only masks one legacy
 *    field, so it grew forever and the retention question was never actually
 *    answered anywhere. (This item used to call audit_logs "the LAST table
 *    with no deletion path". That was false when written — GAP-060 #5 found
 *    `import_rows` in exactly the same state, reachable only through the
 *    child/household cascade — so phase 9 below now answers that one too.
 *    Neither claim should be restated as "the last one" without walking the
 *    schema again.) Same shape as phases 6-7: selection is
 *    a plain range on created_at ordered (created_at, id), which is exactly
 *    idx_audit_logs_created_at (ADM-113/000012) — no new index needed — and
 *    nothing FKs audit_logs (its user/household FKs were dropped in 000002),
 *    so the delete is a plain batched deleteMany.
 *
 *    Ordering note: this phase runs AFTER phase 5, so a legacy row inside the
 *    window is still scrubbed on the tick it would be deleted; a row past the
 *    window is deleted outright, which subsumes the scrub. Both orders are
 *    correct — this one just never leaves a raw term behind if the delete
 *    fails.
 *
 * 9. Aged-out import preview rows (GAP-060 #5). `import_rows` holds the parsed
 *    contents of an uploaded 엑셀/CSV file — the user's raw financial lines,
 *    including the ones they never approved — and until this phase nothing
 *    deleted them by age: only the phase-2/3 cascade (아이/가구가 통째로
 *    파기될 때) reached the table at all. So every import a user ever ran kept
 *    its full preview on the server forever, which contradicted
 *    privacy-policy §1 ("미리보기에서 승인한 내역만 저장").
 *
 *    Driver row = the **import job**, not the row: a job's preview is deleted
 *    whole (the same "driver row is always purged whole" rule phases 1–4
 *    follow), so a crash/retry can never leave half a preview behind and a CS
 *    reader never sees a partial one. Selection is
 *    `status IN (confirmed, cancelled, failed) AND updated_at < cutoff AND
 *    EXISTS(rows)`, ordered (updated_at, id) — the EXISTS clause is what makes the phase
 *    self-terminating and prevents head-of-line blocking: a job whose rows are
 *    already gone stays `confirmed` forever and would otherwise occupy the
 *    oldest-first window every tick (same reasoning as phase 4's NOT EXISTS
 *    selection). Timestamp choice: `updated_at` is bumped by the confirm CAS
 *    (`preview_ready` -> `confirmed`) and by any later job write, so it is the
 *    "import finished" time and can only ever be later than createdAt —
 *    conservative, never premature.
 *
 *    **`preview_ready` jobs are deliberately NOT purged.** Those rows are the
 *    user's own in-flight work: the review screen is still editable, the
 *    mobile re-entry card points at that job (import-resume.store.ts), and
 *    deleting them would silently empty a preview the user is in the middle
 *    of. An abandoned preview therefore still lives until its child/household
 *    is purged.
 *
 *    라운드 60 리뷰(P2-3): 이 문장은 예전에 "미확정 잡 **하나**"라고 적혀
 *    있었는데 사실이 아니었다 — 검수를 마치지 않은 잡을 끝내는 경로가 없어
 *    한 아이에게 시도한 횟수만큼 **여러 벌**이 쌓였다. 이제 새 미리보기를
 *    만들 때 같은 아이의 이전 `preview_ready` 잡을 `cancelled`로 넘긴다
 *    (import-pipeline.service.ts의 createImportJob — 아이당 상한 1). 그래서
 *    파기되지 않고 남는 미확정 미리보기는 **아이당 하나**(지금 검수 중인
 *    그것)이고, 취소된 이전 미리보기들은 위 90일 창의 대상이 된다. 남는 격차는
 *    이 phase가 닫은 것보다 확실히 좁다(진행 중인 잡 하나 vs. 모든 가져오기
 *    이력).
 *
 *    The import_jobs row itself survives: it is the user-visible history of
 *    the import (파일명·건수·시각) and it carries no line-level detail. Only
 *    the preview rows go. One consequence to keep in mind when reading CS
 *    tickets: `GET /import-jobs/:id/rows` on a job older than the window
 *    returns an empty list — the job is not broken, its preview has simply
 *    been destroyed on schedule.
 *
 * 10. Aged-out family invites (GAP-062 #8). `household_invites` had no
 *    age-based deletion path either: rows disappeared only when their author
 *    was purged (phase 3) or their household was orphaned, so an expired /
 *    accepted / cancelled invite otherwise lived forever. Selection is
 *    `status IN (expired, accepted, revoked) AND expires_at < now −
 *    HOUSEHOLD_INVITES_RETENTION_DAYS` ordered (expires_at, id).
 *
 *    Timestamp choice — `expires_at`, not `created_at`: the table has no
 *    updated_at column, so neither "when it was accepted" nor "when it was
 *    cancelled" is available for every settled row (accepted_at exists only
 *    for the accepted ones). `expires_at` is the one column that (a) exists on
 *    every row, (b) is ALWAYS later than the settlement it stands for — all
 *    three purgeable states can only be reached from `pending`, i.e. before
 *    the TTL lapses, so the row is destroyed at least a full window after the
 *    invite actually ended — and (c) is already indexed
 *    (idx_household_invites_expires_at, until now used only by the lazy
 *    expiry UPDATE), so this phase needs no new index and no migration.
 *
 *    **`pending` rows are never selected** — see
 *    HOUSEHOLD_INVITES_PURGEABLE_STATUSES for that rule and for the residual
 *    gap it deliberately leaves (a never-re-read invite stays `pending` past
 *    its TTL because expiry marking is lazy).
 *
 *    Nothing FKs household_invites, so the delete is a plain batched
 *    deleteMany. Nor does it destroy the only record of anything: an accepted
 *    invite survives as the `household_members` row it created, and a
 *    cancelled one as the `household.invite.cancel` audit row (kept under the
 *    730-day window) — the constant's doc spells out why this is duplicate
 *    retention rather than evidence.
 *
 *    Batch note: unlike phases 6-8 the cap counts jobs, and one job holds up
 *    to 2,000 rows (importMaxRows), so a full batch can delete ~400k rows in
 *    one transaction. That is the same shape as the phase-2 child cascade and
 *    is handled the same way — the halved retry and then poison-skip drain it
 *    if the 30s transaction proves too small.
 */
/**
 * Terminal wrapper thrown by run() AFTER all phases have executed, when at
 * least one phase failed terminally (review M1b). The scheduler's per-job
 * catch turns it into status=failed in the log and lastStatus:"failed" on
 * /health/worker; the message embeds the summary so the partial counts still
 * reach the ops log. `summary`/`failedPhaseKeys` are exposed for tests.
 */
export class DataRetentionPurgePhaseFailureError extends Error {
  constructor(
    readonly failedPhaseKeys: string[],
    readonly summary: Record<string, unknown>
  ) {
    super(
      `data_retention_purge finished with failed phase(s) [${failedPhaseKeys.join(", ")}] summary=${JSON.stringify(summary)}`
    );
    this.name = "DataRetentionPurgePhaseFailureError";
  }
}

@Injectable()
export class DataRetentionPurgeJob implements WorkerJob {
  readonly name = "data_retention_purge";
  private readonly logger = new Logger(DataRetentionPurgeJob.name);

  // Review M1a: per-phase poison-row escalation state, keyed by phase label.
  // Absent entry = healthy (no consecutive failures, no skip).
  private readonly poisonState = new Map<string, PhasePoisonState>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async run(now: Date): Promise<Record<string, unknown>> {
    const retentionDays = this.retentionDays();
    const batchSize = this.batchSize();
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    // SEC-130: telemetry tables get their own (much longer) windows — they
    // hold live rows, not tombstones, so PURGE_RETENTION_DAYS does not apply.
    const analyticsEventsRetentionDays = this.analyticsEventsRetentionDays();
    const affiliateClicksRetentionDays = this.affiliateClicksRetentionDays();
    const analyticsEventsCutoff = new Date(now.getTime() - analyticsEventsRetentionDays * DAY_MS);
    const affiliateClicksCutoff = new Date(now.getTime() - affiliateClicksRetentionDays * DAY_MS);
    // GAP-058 #10: 감사 로그도 자기 창(기본 730일)을 쓴다 — 텔레메트리보다 길다(상수 주석).
    const auditLogsRetentionDays = this.auditLogsRetentionDays();
    const auditLogsCutoff = new Date(now.getTime() - auditLogsRetentionDays * DAY_MS);
    // GAP-060 #5: 검수용 가져오기 행도 자기 창(기본 90일)을 쓴다 — 이쪽은 반대로
    // 가장 짧다(상수 주석: 승인하지 않은 금융 내역의 사본이라 오래 둘 이유가 없다).
    const importRowsRetentionDays = this.importRowsRetentionDays();
    const importRowsCutoff = new Date(now.getTime() - importRowsRetentionDays * DAY_MS);
    // GAP-062 #8: 상태가 정해진 가족 초대도 자기 창(기본 90일)을 쓴다 — 창의 기준점은
    // 초대의 유효기간(expires_at)이다(상수·phase 10 주석).
    const householdInvitesRetentionDays = this.householdInvitesRetentionDays();
    const householdInvitesCutoff = new Date(now.getTime() - householdInvitesRetentionDays * DAY_MS);

    // Phases run independently (see class doc): a failure in one is captured
    // in the summary and never prevents the later phases from running.
    const expenses = await this.runPhase("expensePurge", batchSize, (size, skip) => this.purgeExpenses(cutoff, size, skip), {
      expensesPurged: 0
    });
    const children = await this.runPhase("childPurge", batchSize, (size, skip) => this.purgeChildren(cutoff, size, skip), {
      childrenPurged: 0,
      childExpensesPurged: 0,
      childClicksAnonymized: 0
    });
    const users = await this.runPhase(
      "userPurge",
      batchSize,
      (size, skip) => this.purgeWithdrawnUsers(now, cutoff, size, skip),
      {
        usersPurged: 0,
        usersAnonymized: 0,
        householdsPurged: 0,
        auditLogsAnonymized: 0,
        userClicksAnonymized: 0
      }
    );
    const stubs = await this.runPhase("stubPurge", batchSize, (size, skip) => this.purgeAnonymizedStubs(size, skip), {
      userStubsPurged: 0
    });
    // Phase 5 (class doc, item 5): legacy raw search terms inside audit rows.
    const lookupQueries = await this.runPhase(
      "lookupQueryScrub",
      batchSize,
      (size, skip) => this.scrubLegacyLookupQueries(now, size, skip),
      { lookupQueriesScrubbed: 0 }
    );
    // Phases 6-7 (SEC-130): time-based telemetry retention.
    const analyticsEvents = await this.runPhase(
      "analyticsEventPurge",
      batchSize,
      (size, skip) => this.purgeAnalyticsEvents(analyticsEventsCutoff, size, skip),
      { analyticsEventsPurged: 0 }
    );
    const affiliateClicks = await this.runPhase(
      "affiliateClickPurge",
      batchSize,
      (size, skip) => this.purgeAffiliateClicks(affiliateClicksCutoff, size, skip),
      { affiliateClicksPurged: 0 }
    );
    // Phase 8 (GAP-058 #10): accountability-record retention. Runs after the
    // phase-5 scrub on purpose (class doc, item 8).
    const auditLogs = await this.runPhase(
      "auditLogPurge",
      batchSize,
      (size, skip) => this.purgeAuditLogs(auditLogsCutoff, size, skip),
      { auditLogsPurged: 0 }
    );
    // Phase 9 (GAP-060 #5): 검수용 가져오기 행 보존 창.
    const importRows = await this.runPhase(
      "importRowPurge",
      batchSize,
      (size, skip) => this.purgeImportRows(importRowsCutoff, size, skip),
      { importRowsPurged: 0, importJobPreviewsDrained: 0 }
    );
    // Phase 10 (GAP-062 #8): 상태가 정해진 가족 초대 보존 창.
    const householdInvites = await this.runPhase(
      "householdInvitePurge",
      batchSize,
      (size, skip) => this.purgeHouseholdInvites(householdInvitesCutoff, size, skip),
      { householdInvitesPurged: 0 }
    );

    const summary = {
      retentionDays,
      batchSize,
      analyticsEventsRetentionDays,
      affiliateClicksRetentionDays,
      auditLogsRetentionDays,
      importRowsRetentionDays,
      householdInvitesRetentionDays,
      ...expenses,
      ...children,
      ...users,
      ...stubs,
      ...lookupQueries,
      ...analyticsEvents,
      ...affiliateClicks,
      ...auditLogs,
      ...importRows,
      ...householdInvites
    };

    // Review M1b: all phases have run; if any of them failed terminally,
    // surface that to the scheduler as a job failure (class doc, monitoring
    // visibility). `<phase>Error` keys are only ever written by runPhase.
    const failedPhaseKeys = Object.keys(summary).filter((key) => key.endsWith("Error"));
    if (failedPhaseKeys.length > 0) {
      throw new DataRetentionPurgePhaseFailureError(failedPhaseKeys, summary);
    }
    return summary;
  }

  /**
   * Runs one phase with isolation + self-degrading retry: a first failure is
   * retried once within the same tick at half the batch size (floor, min 1) —
   * batch selection is deterministic (oldest first, primary key as
   * tiebreaker, i.e. a strict total order), so the halved retry works on a
   * strict prefix of the failed batch and oversized batches eventually drain
   * across ticks. A second failure is captured as `<label>Error` in the
   * summary (merged over the phase's zero-counts) instead of thrown, so the
   * remaining phases still run; run() converts any `<label>Error` into a
   * terminal DataRetentionPurgePhaseFailureError after all phases finished.
   *
   * Poison-row escalation (class doc, review M1a): each terminal failure
   * increments the phase's consecutive-failure counter; from
   * POISON_FAILURE_THRESHOLD failures onward, every further failed tick
   * increments `poisonSkip`, and the phase's NEXT selection skips that many
   * head rows (the phase methods log the skipped ids at ERROR). Any
   * successful tick resets the state, so a skipped row is deferred — never
   * permanently exempted.
   */
  private async runPhase<T extends Record<string, unknown>>(
    label: string,
    batchSize: number,
    phase: (size: number, skip: number) => Promise<T>,
    emptyResult: T
  ): Promise<Record<string, unknown>> {
    const state = this.poisonState.get(label) ?? { consecutiveFailures: 0, poisonSkip: 0 };
    const skip = state.poisonSkip;
    // Surfaced in the summary whenever a tick ran in degraded skip mode.
    const skipMarker = skip > 0 ? { [`${label}PoisonSkip`]: skip } : {};
    try {
      const result = await phase(batchSize, skip);
      this.poisonState.delete(label);
      return { ...result, ...skipMarker };
    } catch (error) {
      const halvedBatchSize = Math.max(1, Math.floor(batchSize / 2));
      this.logger.warn(
        `phase=${label} failed at batchSize=${batchSize}, retrying once with batchSize=${halvedBatchSize}: ${errorMessage(error)}`
      );
      try {
        const result = await phase(halvedBatchSize, skip);
        this.poisonState.delete(label);
        return { ...result, [`${label}RetriedWithBatchSize`]: halvedBatchSize, ...skipMarker };
      } catch (retryError) {
        state.consecutiveFailures += 1;
        if (state.consecutiveFailures >= POISON_FAILURE_THRESHOLD) {
          state.poisonSkip += 1;
          this.logger.error(
            `phase=${label} failed ${state.consecutiveFailures} ticks in a row — suspecting a poisoned head row; next tick skips the first ${state.poisonSkip} row(s) of the batch ordering so the backlog behind it can drain`
          );
        }
        this.poisonState.set(label, state);
        this.logger.error(
          `phase=${label} failed again at batchSize=${halvedBatchSize}, giving up until next tick: ${errorMessage(retryError)}`
        );
        return { ...emptyResult, [`${label}Error`]: errorMessage(retryError), ...skipMarker };
      }
    }
  }

  /**
   * ERROR-level operator alert for rows a phase is skipping in poison-skip
   * mode (review M1a): these rows repeatedly failed to purge even at reduced
   * batch sizes (most likely their delete cascade exceeds the 30s transaction
   * timeout) and now need a human. They stay selected-and-skipped every
   * degraded tick, so this fires until the row is fixed or removed.
   */
  private logPoisonSkippedRows(label: string, table: string, ids: string[]): void {
    if (ids.length === 0) return;
    this.logger.error(
      `phase=${label} 수동 조치 필요: ${table} row(s) [${ids.join(", ")}] repeatedly fail to purge (transaction keeps failing, likely a cascade exceeding the tx timeout) and are being skipped so the rest of the backlog can drain — 해당 행을 직접 확인/정리해 주세요`
    );
  }

  /** Phase 1: expired expense tombstones (see class doc, item 1). */
  private async purgeExpenses(cutoff: Date, batchSize: number, skip: number) {
    // id tiebreaker (review L1): deletedAt alone is not unique, so without it
    // the order between equal timestamps would be unspecified and the halved
    // retry / skip window would not be a strict prefix of the same sequence.
    const orderBy = [{ deletedAt: "asc" }, { id: "asc" }] satisfies Prisma.ExpenseOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.expense.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        orderBy,
        take: skip
      });
      this.logPoisonSkippedRows("expensePurge", "expenses", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.expense.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return { expensesPurged: 0 };
    }
    const ids = rows.map((row) => row.id);
    await this.prisma.$transaction(async (tx) => {
      await this.deleteExpensesHard(tx, ids);
    }, PURGE_TX_OPTIONS);
    return { expensesPurged: ids.length };
  }

  /**
   * Hard-deletes the given expenses after nullifying every nullable FK that
   * points at an expense, in the caller's transaction.
   */
  private async deleteExpensesHard(tx: Tx, expenseIds: string[]) {
    if (expenseIds.length === 0) return;
    await tx.childItemStatus.updateMany({ where: { expenseId: { in: expenseIds } }, data: { expenseId: null } });
    await tx.importRow.updateMany({
      where: { duplicateCandidateExpenseId: { in: expenseIds } },
      data: { duplicateCandidateExpenseId: null }
    });
    await tx.attachment.updateMany({ where: { expenseId: { in: expenseIds } }, data: { expenseId: null } });
    await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
  }

  /** Phase 2: expired child tombstones + their dependents (class doc, item 2). */
  private async purgeChildren(cutoff: Date, batchSize: number, skip: number) {
    // id tiebreaker: strict total order (see purgeExpenses / review L1).
    const orderBy = [{ deletedAt: "asc" }, { id: "asc" }] satisfies Prisma.ChildOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.child.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        orderBy,
        take: skip
      });
      this.logPoisonSkippedRows("childPurge", "children", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.child.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return { childrenPurged: 0, childExpensesPurged: 0, childClicksAnonymized: 0 };
    }
    const cascade = await this.prisma.$transaction(
      (tx) =>
        this.purgeChildRows(
          tx,
          rows.map((row) => row.id)
        ),
      PURGE_TX_OPTIONS
    );
    return {
      childrenPurged: cascade.children,
      childExpensesPurged: cascade.expenses,
      childClicksAnonymized: cascade.clicksAnonymized
    };
  }

  /**
   * Hard-deletes the given children and every dependent row, inside the
   * caller's transaction, in FK-safe order; AffiliateClick.childId is
   * nullified instead of deleted (anonymized aggregate counts survive — class
   * doc, item 2).
   */
  private async purgeChildRows(tx: Tx, childIds: string[]) {
    const expenseRows = await tx.expense.findMany({ where: { childId: { in: childIds } }, select: { id: true } });
    const expenseIds = expenseRows.map((row) => row.id);
    const importJobs = await tx.importJob.findMany({ where: { childId: { in: childIds } }, select: { id: true } });
    const importJobIds = importJobs.map((job) => job.id);

    if (importJobIds.length > 0) {
      await tx.importRow.deleteMany({ where: { importJobId: { in: importJobIds } } });
    }
    await tx.childItemStatus.deleteMany({ where: { childId: { in: childIds } } });
    await tx.attachment.deleteMany({ where: { childId: { in: childIds } } });
    // All expenses of the child, regardless of their own deletedAt: a purged
    // child must not leave live expense rows behind, and their tombstones are
    // at least as old as the child's own (child delete tombstones both at once).
    await this.deleteExpensesHard(tx, expenseIds);
    if (importJobIds.length > 0) {
      // After the expenses: Expense.importJobId FKs import_jobs.
      await tx.importJob.deleteMany({ where: { id: { in: importJobIds } } });
    }
    await tx.budget.deleteMany({ where: { childId: { in: childIds } } });
    const clicks = await tx.affiliateClick.updateMany({
      where: { childId: { in: childIds } },
      data: { childId: null }
    });
    await tx.household.updateMany({
      where: { defaultChildId: { in: childIds } },
      data: { defaultChildId: null }
    });
    const children = await tx.child.deleteMany({ where: { id: { in: childIds } } });
    return { children: children.count, expenses: expenseIds.length, clicksAnonymized: clicks.count };
  }

  /** Phase 3: withdrawn users + orphaned households (class doc, item 3). */
  private async purgeWithdrawnUsers(now: Date, cutoff: Date, batchSize: number, skip: number) {
    // deletedAt null = not yet purged; the anonymize path below stamps it.
    const where = { status: "withdrawn", deletedAt: null, updatedAt: { lt: cutoff } } satisfies Prisma.UserWhereInput;
    // id tiebreaker: strict total order (see purgeExpenses / review L1).
    const orderBy = [{ updatedAt: "asc" }, { id: "asc" }] satisfies Prisma.UserOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.user.findMany({ where, select: { id: true }, orderBy, take: skip });
      this.logPoisonSkippedRows("userPurge", "users", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.user.findMany({
      where,
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return {
        usersPurged: 0,
        usersAnonymized: 0,
        householdsPurged: 0,
        auditLogsAnonymized: 0,
        userClicksAnonymized: 0
      };
    }
    const userIds = rows.map((row) => row.id);

    return this.prisma.$transaction(async (tx) => {
      // Remember which households these users belonged to (any membership
      // status) BEFORE deleting the membership rows, for the orphan check below.
      const memberships = await tx.householdMember.findMany({
        where: { userId: { in: userIds } },
        select: { householdId: true }
      });
      const affectedHouseholdIds = [...new Set(memberships.map((member) => member.householdId))];

      await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await tx.userDevice.deleteMany({ where: { userId: { in: userIds } } });
      await tx.consent.deleteMany({ where: { userId: { in: userIds } } });
      await tx.idempotencyKey.deleteMany({ where: { userId: { in: userIds } } });
      await tx.householdMember.updateMany({
        where: { invitedByUserId: { in: userIds } },
        data: { invitedByUserId: null }
      });
      await tx.householdMember.deleteMany({ where: { userId: { in: userIds } } });
      // Invites they authored are deleted (NOT NULL FK, and a stale invite
      // from a purged account must not be redeemable); invites they merely
      // accepted lose the nullable back-reference.
      await tx.householdInvite.deleteMany({ where: { invitedByUserId: { in: userIds } } });
      await tx.householdInvite.updateMany({
        where: { acceptedByUserId: { in: userIds } },
        data: { acceptedByUserId: null }
      });
      await tx.expense.updateMany({
        where: { deletedByUserId: { in: userIds } },
        data: { deletedByUserId: null }
      });
      // Audit logs stay (legal/ops record) minus their raw actor identifier.
      const auditLogs = await tx.auditLog.updateMany({
        where: { actorUserId: { in: userIds } },
        data: { actorUserId: null }
      });
      const clicks = await tx.affiliateClick.updateMany({
        where: { userId: { in: userIds } },
        data: { userId: null }
      });

      // Orphaned households: zero remaining membership rows of any status
      // means every member has been physically purged (membership rows are
      // only ever removed here), so the household and all its child data go
      // too. Runs BEFORE the delete-vs-anonymize classification so that data
      // a user authored inside their own now-orphaned household no longer
      // blocks the hard delete of their users row.
      const orphanedHouseholdIds: string[] = [];
      for (const householdId of affectedHouseholdIds) {
        const remaining = await tx.householdMember.count({ where: { householdId } });
        if (remaining === 0) {
          orphanedHouseholdIds.push(householdId);
        }
      }
      let householdsPurged = 0;
      if (orphanedHouseholdIds.length > 0) {
        const children = await tx.child.findMany({
          where: { householdId: { in: orphanedHouseholdIds } },
          select: { id: true }
        });
        if (children.length > 0) {
          await this.purgeChildRows(
            tx,
            children.map((child) => child.id)
          );
        }
        await tx.householdInvite.deleteMany({ where: { householdId: { in: orphanedHouseholdIds } } });
        await tx.affiliateClick.updateMany({
          where: { householdId: { in: orphanedHouseholdIds } },
          data: { householdId: null }
        });
        const households = await tx.household.deleteMany({ where: { id: { in: orphanedHouseholdIds } } });
        householdsPurged = households.count;
      }

      // Classify: users still referenced by surviving shared-household rows
      // (NOT NULL FKs — see class doc) are anonymized in place; the rest are
      // hard-deleted.
      const blocked = await this.findReferenceBlockedUserIds(tx, userIds);
      const deletableIds = userIds.filter((id) => !blocked.has(id));
      let usersPurged = 0;
      if (deletableIds.length > 0) {
        const deleted = await tx.user.deleteMany({ where: { id: { in: deletableIds } } });
        usersPurged = deleted.count;
      }
      let usersAnonymized = 0;
      for (const userId of blocked) {
        await tx.user.update({
          where: { id: userId },
          data: {
            // providerUserId is unique — the internal uuid keeps it unique
            // while severing the link to the OAuth provider account.
            providerUserId: `purged:${userId}`,
            email: null,
            phone: null,
            displayName: null,
            profileImageUrl: null,
            lastLoginAt: null,
            deletedAt: now
          }
        });
        usersAnonymized += 1;
      }

      return {
        usersPurged,
        usersAnonymized,
        householdsPurged,
        auditLogsAnonymized: auditLogs.count,
        userClicksAnonymized: clicks.count
      };
    }, PURGE_TX_OPTIONS);
  }

  /**
   * Phase-4 candidate selection: anonymized stubs with no blocking NOT NULL
   * user FK reference left, in deterministic (deleted_at, id) order —
   * id tiebreaker per review L1, same strict-total-order rationale as
   * purgeExpenses. `offset` implements the poison-skip window (review M1a).
   */
  private selectPurgeableStubs(limit: number, offset: number): Promise<{ id: string }[]> {
    // The NOT EXISTS list mirrors findReferenceBlockedUserIds exactly (one
    // subquery per NOT NULL user FK) — keep both in sync; see that helper for
    // why the satellite tables (user_devices etc.) are included even though
    // phase 3 normally deletes those rows.
    return this.prisma.$queryRaw<{ id: string }[]>`
      SELECT u.id
      FROM users u
      WHERE u.status = 'withdrawn'
        AND u.deleted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM households h WHERE h.owner_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.created_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.created_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM child_item_statuses s WHERE s.updated_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.uploaded_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM import_jobs j WHERE j.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM household_members m WHERE m.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM household_invites i WHERE i.invited_by_user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM consents c WHERE c.user_id = u.id)
      ORDER BY u.deleted_at ASC, u.id ASC
      LIMIT ${limit} OFFSET ${offset}`;
  }

  /** Phase 4: anonymized user stubs whose blockers are gone (class doc, item 4). */
  private async purgeAnonymizedStubs(batchSize: number, skip: number) {
    // deleted_at non-null = a stub phase 3 anonymized earlier; nothing else
    // ever sets User.deletedAt. No cutoff: the stub was already past the
    // retention window when it was stamped. Candidate selection embeds the
    // reference check as NOT EXISTS subqueries (one per NOT NULL user FK —
    // the same references findReferenceBlockedUserIds inspects) so that
    // still-blocked stubs, which are the steady-state majority, never occupy
    // the oldest-first batch window and starve newly-unblocked stubs behind
    // them (head-of-line blocking under a small PURGE_BATCH_SIZE).
    if (skip > 0) {
      const skipped = await this.selectPurgeableStubs(skip, 0);
      this.logPoisonSkippedRows("stubPurge", "users(stub)", skipped.map((row) => row.id));
    }
    const rows = await this.selectPurgeableStubs(batchSize, skip);
    if (rows.length === 0) {
      return { userStubsPurged: 0 };
    }
    const stubIds = rows.map((row) => row.id);
    return this.prisma.$transaction(async (tx) => {
      // Authoritative re-check inside the transaction (reference-check helper
      // shared with phase 3): a candidate could have picked up a blocking
      // reference between selection and this transaction.
      const blocked = await this.findReferenceBlockedUserIds(tx, stubIds);
      const deletableIds = stubIds.filter((id) => !blocked.has(id));
      if (deletableIds.length === 0) {
        return { userStubsPurged: 0 };
      }
      const deleted = await tx.user.deleteMany({ where: { id: { in: deletableIds } } });
      return { userStubsPurged: deleted.count };
    }, PURGE_TX_OPTIONS);
  }

  /**
   * Phase 5: rewrite the raw `after_json.query` of legacy
   * `admin.user_lookup.search` audit rows into the masked form the write path
   * now produces (class doc, item 5 — 라운드 28 리뷰 F1).
   *
   * Selection is by `after_json ->> 'query' IS NOT NULL`, i.e. exactly "this
   * row still holds a raw term": rows already carrying only `queryMasked` are
   * invisible to it, which makes the phase idempotent and self-terminating.
   * The ordering (created_at, id) is the same strict total order every other
   * phase uses, so the halved retry / poison-skip machinery works unchanged.
   * No cutoff — a raw email inside an audit row is not something to keep for
   * another retention window.
   */
  private async scrubLegacyLookupQueries(now: Date, batchSize: number, skip: number) {
    if (skip > 0) {
      const skipped = await this.selectLegacyLookupQueryRows(skip, 0);
      this.logPoisonSkippedRows("lookupQueryScrub", "audit_logs", skipped.map((row) => row.id));
    }
    const rows = await this.selectLegacyLookupQueryRows(batchSize, skip);
    if (rows.length === 0) {
      return { lookupQueriesScrubbed: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      let lookupQueriesScrubbed = 0;
      for (const row of rows) {
        const after: Record<string, unknown> = { ...(row.after_json ?? {}) };
        const raw = typeof after.query === "string" ? after.query : "";
        delete after.query;
        after.queryMasked = maskLookupQuery(raw);
        // Honest marker: this value was DERIVED from a raw term that used to
        // sit here, it was not what the request originally recorded.
        after.queryScrubbedAt = now.toISOString();
        await tx.auditLog.update({
          where: { id: row.id },
          data: { afterJson: after as Prisma.InputJsonValue }
        });
        lookupQueriesScrubbed += 1;
      }
      return { lookupQueriesScrubbed };
    }, PURGE_TX_OPTIONS);
  }

  /**
   * Phase-5 candidate selection: audit rows of the users-lookup action that
   * still carry a raw `query` string, oldest first with the id tiebreaker.
   * `offset` implements the poison-skip window, same as the other phases.
   */
  private selectLegacyLookupQueryRows(
    limit: number,
    offset: number
  ): Promise<{ id: string; after_json: Record<string, unknown> | null }[]> {
    return this.prisma.$queryRaw`
      SELECT id, after_json
      FROM audit_logs
      WHERE action = ${LOOKUP_SEARCH_ACTION}
        AND after_json ->> 'query' IS NOT NULL
      ORDER BY created_at ASC, id ASC
      LIMIT ${limit} OFFSET ${offset}`;
  }

  /**
   * Phase 6 (SEC-130): analytics events past their retention window.
   *
   * Same shape as every other phase — deterministic (occurred_at, id) ordering
   * so the halved retry and the poison-skip window are strict prefixes of the
   * same sequence, one batch per tick, deletion inside a transaction. The
   * selection predicate is a plain range on occurred_at, served by
   * idx_analytics_events_occurred_at.
   */
  private async purgeAnalyticsEvents(cutoff: Date, batchSize: number, skip: number) {
    const where = { occurredAt: { lt: cutoff } } satisfies Prisma.AnalyticsEventWhereInput;
    // id tiebreaker: strict total order (see purgeExpenses / review L1).
    const orderBy = [{ occurredAt: "asc" }, { id: "asc" }] satisfies Prisma.AnalyticsEventOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.analyticsEvent.findMany({ where, select: { id: true }, orderBy, take: skip });
      this.logPoisonSkippedRows("analyticsEventPurge", "analytics_events", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.analyticsEvent.findMany({
      where,
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return { analyticsEventsPurged: 0 };
    }
    const ids = rows.map((row) => row.id);
    // Nothing FKs analytics_events, so there is no cascade to order — the
    // transaction exists only to keep the batch all-or-nothing with the rest
    // of the phase machinery (a partial delete would still be safe, but a
    // failed batch must not leave the summary count lying).
    const deleted = await this.prisma.$transaction(
      (tx) => tx.analyticsEvent.deleteMany({ where: { id: { in: ids } } }),
      PURGE_TX_OPTIONS
    );
    return { analyticsEventsPurged: deleted.count };
  }

  /**
   * Phase 7 (SEC-130): affiliate clicks past their retention window.
   *
   * Identical machinery to phase 6 on clicked_at (idx_affiliate_clicks_clicked_at).
   * Note this is the one phase that destroys 정산 근거 rather than personal
   * data, which is why its default window is ~13 months — see
   * DEFAULT_AFFILIATE_CLICKS_RETENTION_DAYS.
   */
  private async purgeAffiliateClicks(cutoff: Date, batchSize: number, skip: number) {
    const where = { clickedAt: { lt: cutoff } } satisfies Prisma.AffiliateClickWhereInput;
    // id tiebreaker: strict total order (see purgeExpenses / review L1).
    const orderBy = [{ clickedAt: "asc" }, { id: "asc" }] satisfies Prisma.AffiliateClickOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.affiliateClick.findMany({ where, select: { id: true }, orderBy, take: skip });
      this.logPoisonSkippedRows("affiliateClickPurge", "affiliate_clicks", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.affiliateClick.findMany({
      where,
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return { affiliateClicksPurged: 0 };
    }
    const ids = rows.map((row) => row.id);
    const deleted = await this.prisma.$transaction(
      (tx) => tx.affiliateClick.deleteMany({ where: { id: { in: ids } } }),
      PURGE_TX_OPTIONS
    );
    return { affiliateClicksPurged: deleted.count };
  }

  /**
   * Phase 8 (GAP-058 #10): audit logs past their retention window.
   *
   * Identical machinery to phases 6-7, on created_at: the (created_at, id)
   * ordering is served by idx_audit_logs_created_at (ADM-113/000012), the same
   * index the admin audit viewer's list query uses, so no new index is needed.
   * Nothing FKs audit_logs (its user/household FKs were dropped in migration
   * 000002), so this is a plain batched deleteMany inside the usual
   * transaction.
   *
   * Note what this destroys: the 책임 추적 기록 itself, not personal data —
   * which is why the default window is the longest of all phases and why
   * shortening it is a PM/법무 결정 (see DEFAULT_AUDIT_LOGS_RETENTION_DAYS).
   */
  private async purgeAuditLogs(cutoff: Date, batchSize: number, skip: number) {
    const where = { createdAt: { lt: cutoff } } satisfies Prisma.AuditLogWhereInput;
    // id tiebreaker: strict total order (see purgeExpenses / review L1).
    const orderBy = [{ createdAt: "asc" }, { id: "asc" }] satisfies Prisma.AuditLogOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.auditLog.findMany({ where, select: { id: true }, orderBy, take: skip });
      this.logPoisonSkippedRows("auditLogPurge", "audit_logs", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return { auditLogsPurged: 0 };
    }
    const ids = rows.map((row) => row.id);
    const deleted = await this.prisma.$transaction(
      (tx) => tx.auditLog.deleteMany({ where: { id: { in: ids } } }),
      PURGE_TX_OPTIONS
    );
    return { auditLogsPurged: deleted.count };
  }

  /**
   * Phase-9 candidate selection: import jobs that are FINISHED (confirmed or
   * failed), aged past the window, and still hold preview rows — oldest first
   * with the id tiebreaker, `offset` implementing the poison-skip window
   * exactly like the other phases.
   *
   * The `EXISTS (import_rows)` clause is load-bearing twice over: it makes the
   * phase self-terminating (an already-drained job is invisible to it, so the
   * phase becomes a cheap no-op once the backlog is gone) and it stops drained
   * jobs — which stay `confirmed` forever — from filling the oldest-first
   * window every tick and starving the jobs behind them (the head-of-line
   * problem phase 4's NOT EXISTS selection solves the same way).
   *
   * Raw SQL because prisma/schema.prisma declares no relations, so `EXISTS`
   * over import_rows has no Prisma expression (same reason as phases 4-5).
   * The `::import_status` casts are required, not decoration: Prisma binds
   * every parameter as text and `import_status = text` has no operator
   * (42883), so an uncast placeholder fails the whole phase at runtime.
   */
  private selectDrainableImportJobs(cutoff: Date, limit: number, offset: number): Promise<{ id: string }[]> {
    const statuses = Prisma.join(
      IMPORT_ROWS_PURGEABLE_JOB_STATUSES.map((status) => Prisma.sql`${status}::import_status`)
    );
    return this.prisma.$queryRaw<{ id: string }[]>`
      SELECT j.id
      FROM import_jobs j
      WHERE j.status IN (${statuses})
        AND j.updated_at < ${cutoff}
        AND EXISTS (SELECT 1 FROM import_rows r WHERE r.import_job_id = j.id)
      ORDER BY j.updated_at ASC, j.id ASC
      LIMIT ${limit} OFFSET ${offset}`;
  }

  /**
   * Phase 9 (GAP-060 #5): preview rows of finished imports past their window
   * (class doc, item 9).
   *
   * Driver row is the import JOB, so a preview is always destroyed whole; the
   * job row itself is kept as the user's import history. `preview_ready` jobs
   * are never selected — those rows are the user's own in-flight work.
   */
  private async purgeImportRows(cutoff: Date, batchSize: number, skip: number) {
    if (skip > 0) {
      const skipped = await this.selectDrainableImportJobs(cutoff, skip, 0);
      this.logPoisonSkippedRows("importRowPurge", "import_jobs(preview)", skipped.map((row) => row.id));
    }
    const jobs = await this.selectDrainableImportJobs(cutoff, batchSize, skip);
    if (jobs.length === 0) {
      return { importRowsPurged: 0, importJobPreviewsDrained: 0 };
    }
    const importJobIds = jobs.map((row) => row.id);
    const deleted = await this.prisma.$transaction(
      (tx) => tx.importRow.deleteMany({ where: { importJobId: { in: importJobIds } } }),
      PURGE_TX_OPTIONS
    );
    return { importRowsPurged: deleted.count, importJobPreviewsDrained: importJobIds.length };
  }

  /**
   * Phase 10 (GAP-062 #8): family invites whose outcome is settled and whose
   * TTL lapsed more than HOUSEHOLD_INVITES_RETENTION_DAYS ago (class doc,
   * item 10).
   *
   * Same machinery as phases 6-8 — a plain range predicate, deterministic
   * (expires_at, id) ordering so the halved retry and the poison-skip window
   * are strict prefixes of the same sequence, and a batched deleteMany inside
   * the usual transaction (nothing FKs household_invites). The status filter
   * is what keeps a live link (`pending`) out of the batch; the range is on
   * expires_at because it is the only settlement-independent age column the
   * table has, and it is the indexed one.
   */
  private async purgeHouseholdInvites(cutoff: Date, batchSize: number, skip: number) {
    const where = {
      status: { in: [...HOUSEHOLD_INVITES_PURGEABLE_STATUSES] },
      expiresAt: { lt: cutoff }
    } satisfies Prisma.HouseholdInviteWhereInput;
    // id tiebreaker: strict total order (see purgeExpenses / review L1).
    const orderBy = [{ expiresAt: "asc" }, { id: "asc" }] satisfies Prisma.HouseholdInviteOrderByWithRelationInput[];
    if (skip > 0) {
      const skipped = await this.prisma.householdInvite.findMany({ where, select: { id: true }, orderBy, take: skip });
      this.logPoisonSkippedRows("householdInvitePurge", "household_invites", skipped.map((row) => row.id));
    }
    const rows = await this.prisma.householdInvite.findMany({
      where,
      select: { id: true },
      orderBy,
      skip,
      take: batchSize
    });
    if (rows.length === 0) {
      return { householdInvitesPurged: 0 };
    }
    const ids = rows.map((row) => row.id);
    const deleted = await this.prisma.$transaction(
      (tx) => tx.householdInvite.deleteMany({ where: { id: { in: ids } } }),
      PURGE_TX_OPTIONS
    );
    return { householdInvitesPurged: deleted.count };
  }

  /**
   * Returns the subset of userIds still referenced by a NOT NULL FK column on
   * a surviving row — the references that make a hard DELETE of the users row
   * impossible without destroying another member's shared household data.
   *
   * Covers EVERY NOT NULL user FK in the schema (review L2), including the
   * satellite tables user_devices / household_members /
   * household_invites.invited_by_user_id / consents — phase 3 deletes those
   * rows itself before calling this helper, so they are normally already
   * gone, but the check is defense-in-depth: a lingering row (partial manual
   * cleanup, future code path that recreates one) must block the hard delete
   * instead of aborting the whole batch transaction with an FK violation.
   * Keep this list in sync with selectPurgeableStubs' NOT EXISTS subqueries.
   */
  private async findReferenceBlockedUserIds(tx: Tx, userIds: string[]): Promise<Set<string>> {
    const blocked = new Set<string>();
    const collect = (rows: { userId: string | null }[]) => {
      for (const row of rows) {
        if (row.userId) blocked.add(row.userId);
      }
    };
    collect(
      (
        await tx.household.findMany({
          where: { ownerUserId: { in: userIds } },
          select: { ownerUserId: true },
          distinct: ["ownerUserId"]
        })
      ).map((row) => ({ userId: row.ownerUserId }))
    );
    collect(
      (
        await tx.expense.findMany({
          where: { createdByUserId: { in: userIds } },
          select: { createdByUserId: true },
          distinct: ["createdByUserId"]
        })
      ).map((row) => ({ userId: row.createdByUserId }))
    );
    collect(
      (
        await tx.budget.findMany({
          where: { createdByUserId: { in: userIds } },
          select: { createdByUserId: true },
          distinct: ["createdByUserId"]
        })
      ).map((row) => ({ userId: row.createdByUserId }))
    );
    collect(
      (
        await tx.childItemStatus.findMany({
          where: { updatedByUserId: { in: userIds } },
          select: { updatedByUserId: true },
          distinct: ["updatedByUserId"]
        })
      ).map((row) => ({ userId: row.updatedByUserId }))
    );
    collect(
      (
        await tx.attachment.findMany({
          where: { uploadedByUserId: { in: userIds } },
          select: { uploadedByUserId: true },
          distinct: ["uploadedByUserId"]
        })
      ).map((row) => ({ userId: row.uploadedByUserId }))
    );
    collect(
      (
        await tx.importJob.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true },
          distinct: ["userId"]
        })
      ).map((row) => ({ userId: row.userId }))
    );
    // Satellite tables (see doc comment): normally emptied by phase 3 before
    // this runs, checked anyway so a lingering row blocks instead of breaking
    // the delete with an FK violation.
    collect(
      (
        await tx.userDevice.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true },
          distinct: ["userId"]
        })
      ).map((row) => ({ userId: row.userId }))
    );
    collect(
      (
        await tx.householdMember.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true },
          distinct: ["userId"]
        })
      ).map((row) => ({ userId: row.userId }))
    );
    collect(
      (
        await tx.householdInvite.findMany({
          where: { invitedByUserId: { in: userIds } },
          select: { invitedByUserId: true },
          distinct: ["invitedByUserId"]
        })
      ).map((row) => ({ userId: row.invitedByUserId }))
    );
    collect(
      (
        await tx.consent.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true },
          distinct: ["userId"]
        })
      ).map((row) => ({ userId: row.userId }))
    );
    return blocked;
  }

  private retentionDays(): number {
    const raw = Number(process.env.PURGE_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PURGE_RETENTION_DAYS;
  }

  private batchSize(): number {
    const raw = Number(process.env.PURGE_BATCH_SIZE);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PURGE_BATCH_SIZE;
  }

  private analyticsEventsRetentionDays(): number {
    const raw = Number(process.env.ANALYTICS_EVENTS_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ANALYTICS_EVENTS_RETENTION_DAYS;
  }

  private affiliateClicksRetentionDays(): number {
    const raw = Number(process.env.AFFILIATE_CLICKS_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AFFILIATE_CLICKS_RETENTION_DAYS;
  }

  private auditLogsRetentionDays(): number {
    const raw = Number(process.env.AUDIT_LOGS_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AUDIT_LOGS_RETENTION_DAYS;
  }

  private importRowsRetentionDays(): number {
    const raw = Number(process.env.IMPORT_ROWS_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IMPORT_ROWS_RETENTION_DAYS;
  }

  private householdInvitesRetentionDays(): number {
    const raw = Number(process.env.HOUSEHOLD_INVITES_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HOUSEHOLD_INVITES_RETENTION_DAYS;
  }
}
