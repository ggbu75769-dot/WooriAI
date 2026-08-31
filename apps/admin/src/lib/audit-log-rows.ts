// GAP-087 트랙 A — 감사 로그 표의 **행위자·대상 두 칸**과 **0건 문장 두 갈래**를 만드는 순수 모듈.
//
// ## 왜 이 모듈이 생겼나
//
// 종전에 이 표가 글자로 보여 준 식별자는 **UUID 앞 8자**뿐이었다 —
// 행위자 칸은 `사용자(3f2a91c4)`(`auditLogActorLabel`), 대상 칸은 `expense · 3f2a91c4…` —
// 그리고 **전체 값에 닿는 경로는 `<td title=…>` 하나**였다. `title`은 마우스 호버로만 뜨고
// `<td>`는 포커스를 받지 않으니, 마우스가 없는 운영자에게 이 표의 식별자는 **존재하지 않았다**.
// 화면이 그 사실을 문장으로 자백까지 하고 있었다(*"전체 ID는 칸에 마우스를 올리면 보여요"*).
//
// ⚠️ **그리고 그 값을 요구하는 필터가 같은 화면에 있다.** 행위자 필터는 **완전한 UUID**를
// 요구하고(`auditLogFilterError`가 앞 8자를 막는다), 그 안내가 가리키는 길은 **다른 화면**
// (사용자 조회)이다 — 즉 표에서 수상한 행을 발견한 운영자가 *"이 행위자의 다른 기록"* 으로
// 가는 걸음이 이 화면에서 끊겼다. **표가 보여 준 것으로 그 표의 필터를 채울 수 없었다.**
//
// 옳은 형식은 이미 같은 저장소에 있었다(라운드 86 D가 분석·클릭 두 화면에서 쓴 그 규율):
// 값은 **텍스트 노드로** 서고, 긴 값은 **같은 행의 `상세` 칸이 이미 쓰는 `<details>` 관례**로
// 펼치며, 되짚는 주소는 **이미 있는 `auditLogsHrefForActor` 한 함수**에서 온다.
//
// 화면과 분리해 두는 이유는 `analytics-trend-view.ts`·`revision-rows.ts`와 같다 —
// 문장이 갈리는 자리(행위자 종류 셋 · 대상 id 유무 · 필터 유무)를 렌더 없이 못 박기 위해서다.
//
// ## 이 모듈이 하지 않는 것 (값으로 적어 둔다)
//
//  · **서버 0건.** `actorUserId`·`targetId`는 목록 응답이 **이미** 싣고 오는 값이고
//    (`AdminAuditLogEntry`) CSV에도 이미 실린다. 새 파라미터·새 필터 축·새 요청 0건이다.
//  · **새 주소 0건.** 되짚기 href는 `auditLogsHrefForActor` 하나에서만 온다 —
//    이 모듈은 그 주소 문자열을 손으로 조립하지 않는다(두 곳에 살면 곧 갈린다).
//  · **개인정보 0건.** 이메일·닉네임을 새로 그리지 않는다. 어드민 행의 이메일은 종전
//    `auditLogActorLabel`이 이미 그리던 그 값이고, 이 모듈이 더하는 것은 **UUID뿐**이다
//    (`shortActorId` 머리말의 규율 — 앞 8자 라벨에는 오늘도 개인정보가 실리지 않는다).
//  · **`title` 제거 0건.** 호버 경로는 화면에 그대로 남는다 — 이 트랙이 하는 일은 도달 경로를
//    **더하는 것**이지 빼는 것이 아니다.
//  · **CSV 무접촉.** 열·순서·셀 방어는 `audit-log-csv.ts`가 그대로 진다.
//  · **표기 바이트 불변.** 두 칸의 `label`은 종전에 그 칸에 서 있던 글자와 **바이트 단위로 같다**
//    (행위자는 `auditLogActorLabel`, 대상은 종전 화면의 `formatTarget`) — 이 트랙이 바꾸는 것은
//    *무엇이 보이는가*이지 *이미 보이던 것*이 아니다.

import type { AdminAuditLogEntry } from "./admin-api";
import {
  auditLogActorKind,
  auditLogActorLabel,
  auditLogsHrefForActor,
  hasAnyAuditLogFilter,
  type AuditLogActor,
  type AuditLogFilters
} from "./audit-log-filters";

/**
 * 두 칸이 공유하는 펼침(`<summary>`) 라벨. 같은 행의 `상세` 칸(*"변경 내용 보기"*)과
 * 같은 관례이고, 문구가 두 칸에 손으로 두 번 적히지 않게 여기 한 벌로 둔다.
 */
export const AUDIT_LOG_FULL_ID_SUMMARY = "전체 ID 보기";

/** 상세 칸의 펼침 이름 — 같은 행의 두 칸과 **같은 함수**로 이름을 짓는다(아래 규율). */
export const AUDIT_LOG_SNAPSHOT_SUMMARY = "변경 내용 보기";

/**
 * 펼침(`<summary>`)의 이름 — **행·칸을 가르는 값을 앞에 세운다.**
 *
 * ⚠️ **라운드 87 리뷰 M-5.** 이 트랙이 세운 펼침 둘은 이름이 `전체 ID 보기` 하나뿐이라, 한 화면
 * (`PAGE_SIZE` 20 × 두 칸)에 **최대 마흔 개의 똑같은 이름**이 섰다. 키보드·스크린리더로 표를
 * 훑는 운영자에게는 *"전체 ID 보기"* 가 마흔 번 같은 소리로 들려 **어느 행의 무엇을 펼치는지**
 * 이름만으로 알 수 없다 — 이 표에 도달 경로를 더하려던 트랙이 정작 그 경로에 이름을 주지 않은 것이다.
 * 같은 결함을 `상세` 칸의 *"변경 내용 보기"* 도 지고 있어 같은 함수로 함께 고친다.
 *
 * 규율은 라운드 87 트랙 D가 알림 설정 기기 목록에서 닫은 그것과 같다: **행마다 갈리는 값을 낭독
 * 이름에 끼운다.** 새 문자열은 짓지 않는다 — 앞에 세우는 값은 그 칸이 **이미 글자로 보여 주고 있는**
 * 축약 표기(`auditLogActorCell`·`auditLogTargetCell`의 `label`)라, 화면에 없던 정보가 소리로만
 * 새로 나가지 않는다(개인정보 0건 — 어드민 행의 이메일은 그 칸에 이미 서 있던 그 값이다).
 */
export function auditLogExpandSummaryLabel(cellLabel: string, action: string): string {
  return `${cellLabel} ${action}`;
}

/** 대상 칸이 읽는 필드만. */
export type AuditLogTarget = Pick<AdminAuditLogEntry, "targetType" | "targetId">;

/** 행위자 칸 한 칸. */
export type AuditLogActorCell = {
  /** 칸에 그대로 서는 표기. 종전 `auditLogActorLabel`과 같은 글자다. */
  label: string;
  /** 펼치면 **글자로** 서는 전체 행위자 UUID. 행위자가 없는 행(시스템)은 null이다. */
  fullActorId: string | null;
  /** 이 행위자의 기록만 모아 보는 주소. 서지 않는 행은 null (아래 규칙). */
  traceHref: string | null;
};

/** 대상 칸 한 칸. */
export type AuditLogTargetCell = {
  /** 칸에 그대로 서는 표기(`target_type` 또는 `target_type · 앞8자…`). */
  label: string;
  /** 펼치면 **글자로** 서는 전체 대상 UUID. targetId가 없는 행은 null이다. */
  fullTargetId: string | null;
};

/**
 * 행위자 칸.
 *
 * ⚠️ **되짚기 링크는 어드민 계정이 아닌 행위자 행에만 선다**(`auditLogActorKind`가 가른다):
 *  · **시스템/알 수 없음** 행 — 되짚을 id 자체가 없다(`actorUserId`가 null이라 필터에 넣을
 *    값이 없고, `auditLogsHrefForActor("")`는 아무도 고르지 못하는 주소가 된다).
 *  · **어드민 계정** 행 — 칸의 라벨이 이미 그 사람의 이메일이라 *"누가"* 는 칸에서 끝나고,
 *    그 행의 UUID도 아래 펼침에 글자로 서 있어 필터 칸에 붙여 넣으면 같은 목록에 닿는다.
 *    즉 링크는 **라벨이 그 사람을 부르지 못하는 행**(`사용자(3f2a91c4)`)에만 세운다 —
 *    거기서만 걸음이 끊겼기 때문이다.
 */
export function auditLogActorCell(entry: AuditLogActor): AuditLogActorCell {
  const actorUserId = entry.actorUserId;
  return {
    label: auditLogActorLabel(entry),
    fullActorId: actorUserId,
    traceHref:
      actorUserId && auditLogActorKind(entry) === "non_admin" ? auditLogsHrefForActor(actorUserId) : null
  };
}

/**
 * 대상 칸. `label`은 종전 화면의 `formatTarget`과 **바이트 단위로 같다** —
 * 표를 좁게 유지하는 축약이고, 전체 값은 `fullTargetId`가 글자로 준다.
 * (`targetId`가 UUID가 아닌 액션은 서버가 아예 저장하지 않는다 — 그 행은 `targetType`만 선다.)
 */
export function auditLogTargetCell(entry: AuditLogTarget): AuditLogTargetCell {
  if (!entry.targetId) return { label: entry.targetType, fullTargetId: null };
  return { label: `${entry.targetType} · ${entry.targetId.slice(0, 8)}…`, fullTargetId: entry.targetId };
}

/**
 * 0건 문장 두 갈래.
 *
 * 종전에는 언제나 *"조건에 맞는 기록이 없어요."* 였다 — **필터를 하나도 걸지 않은** 운영자에게도
 * *"당신의 조건이 걸렀다"* 고 말한 셈이라, 없는 조건을 다시 지우러 가게 만든다.
 * 그 둘을 가르는 판정은 이미 있었고 호출부가 0건이었다(`hasAnyAuditLogFilter`) — 여기가 그 호출부다.
 *
 * ⚠️ **필터가 걸린 갈래의 문장은 바이트 불변**이다: `scripts/qa/admin-e2e.mjs`의 스텝 9·11이
 * 그 문장을 기다린다(존재하지 않는 액션 필터 · 행위자 딥링크). `admin-load-error-copy.test.ts`의
 * 18스텝 앵커는 같은 문장을 **화면 소스에서** 찾으므로, 문장이 이 모듈로 옮겨 온 뒤에도 그 자리를
 * 잃지 않게 화면의 주석이 앵커와 그 문장을 값으로 남긴다 — 그리고 이 문장의 정본이 여기라는 사실은
 * `admin-audit-logs.test.ts`(ⓒ)가 이 파일에서 다시 확인한다.
 */
export function auditLogEmptyStateMessage(filters: AuditLogFilters): string {
  if (hasAnyAuditLogFilter(filters)) return "조건에 맞는 기록이 없어요.";
  return "아직 기록이 없어요. 지금은 필터가 하나도 걸려 있지 않아요.";
}
