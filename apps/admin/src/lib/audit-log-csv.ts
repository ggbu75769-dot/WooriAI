// ADM-117: 감사로그 CSV 내보내기의 순수 로직 (DOM/Blob 없음 — 다운로드 트리거는
// app/audit-logs/page.tsx가 담당). 셀 방어 규칙은 API 쪽 bulk CSV 파서
// (apps/api/src/admin/product-link-bulk-csv.util.ts)의 관례를 미러링한다:
// 수식 인젝션 중화(선행 =, +, -, @, 탭, CR 앞에 `'`) + RFC-4180 따옴표 이스케이프.
// 새 API 없이 기존 GET /admin/audit-logs를 limit=100으로 페이지 순회해
// 최대 AUDIT_LOG_EXPORT_MAX_ROWS(1,000)행까지만 모은다.

import type { AdminAuditLogEntry, AdminAuditLogsQuery, AdminAuditLogsResult } from "./admin-api";

export const AUDIT_LOG_EXPORT_MAX_ROWS = 1000;
/** 기존 API의 페이지 상한(limit=100)을 그대로 쓴다 — 새 엔드포인트 없음. */
export const AUDIT_LOG_EXPORT_PAGE_SIZE = 100;

/** 내보내기 CSV 헤더(열 순서 고정). before/after는 JSON 문자열로 직렬화된다. */
export const AUDIT_LOG_CSV_COLUMNS = [
  "id",
  "createdAt",
  "actorEmail",
  "actorUserId",
  "householdId",
  "action",
  "targetType",
  "targetId",
  "before",
  "after",
  "ipHash"
] as const;

/** Excel/Sheets가 수식으로 해석할 수 있는 선행 문자 (product-link-bulk-csv.util과 동일 정책). */
const DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * 한 셀을 CSV-안전하게 만든다: (1) 수식 인젝션 중화 — 위험 선행 문자 앞에 `'`를
 * 붙여 텍스트로 강제, (2) 따옴표/쉼표/개행이 있으면 RFC-4180 규칙으로 감싸고
 * 내부 `"`는 `""`로 이스케이프. 중화(1)를 먼저 해야 `'` 접두가 따옴표 안쪽에
 * 보존된다.
 */
export function escapeCsvCell(value: string): string {
  let text = value;
  if (text.length > 0 && DANGEROUS_LEADING_CHARS.has(text[0])) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** before/after 스냅샷 → CSV 셀 값: null/undefined는 빈 칸, 그 외엔 JSON 문자열. */
function snapshotToCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function entryToCells(entry: AdminAuditLogEntry): string[] {
  return [
    entry.id,
    entry.createdAt,
    entry.actorEmail ?? "",
    entry.actorUserId ?? "",
    entry.householdId ?? "",
    entry.action,
    entry.targetType,
    entry.targetId ?? "",
    snapshotToCell(entry.before),
    snapshotToCell(entry.after),
    entry.ipHash ?? ""
  ];
}

/**
 * 감사로그 목록 → CSV 문자열 (헤더 + 데이터 행, CRLF 종결). 방어적으로
 * AUDIT_LOG_EXPORT_MAX_ROWS 상한을 여기서도 한 번 더 적용한다 — 수집 단계
 * (collectAuditLogsForExport)가 이미 자르지만, 이 함수 단독 호출도 안전해야
 * 순수 함수 계약이 성립한다.
 */
export function buildAuditLogCsv(entries: AdminAuditLogEntry[]): string {
  const lines: string[] = [AUDIT_LOG_CSV_COLUMNS.join(",")];
  for (const entry of entries.slice(0, AUDIT_LOG_EXPORT_MAX_ROWS)) {
    lines.push(entryToCells(entry).map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** 파일명: audit-logs-YYYYMMDD.csv (로컬 날짜 기준). */
export function auditLogCsvFilename(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `audit-logs-${year}${month}${day}.csv`;
}

export type AuditLogExportCollection = {
  entries: AdminAuditLogEntry[];
  /** true면 서버에 기록이 더 있는데 AUDIT_LOG_EXPORT_MAX_ROWS에서 잘렸다는 뜻. */
  truncated: boolean;
};

/**
 * 기존 목록 API를 limit=100으로 offset 순회하며 최대 1,000행을 모은다.
 * `fetchPage`는 호출부가 현재 필터를 캡처해 넘기는 클로저(listAuditLogs 래핑)라
 * 이 함수 자체는 네트워크/필터 표현을 모른다 → 단위 테스트가 쉬워진다.
 * 무한 루프 방어: 서버가 hasMore=true인데 빈 페이지를 주면 중단한다.
 */
export async function collectAuditLogsForExport(
  fetchPage: (query: Pick<AdminAuditLogsQuery, "limit" | "offset">) => Promise<AdminAuditLogsResult>
): Promise<AuditLogExportCollection> {
  const entries: AdminAuditLogEntry[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage({ limit: AUDIT_LOG_EXPORT_PAGE_SIZE, offset });
    entries.push(...page.auditLogs);
    if (entries.length >= AUDIT_LOG_EXPORT_MAX_ROWS) {
      const truncated = entries.length > AUDIT_LOG_EXPORT_MAX_ROWS || page.pageInfo.hasMore;
      entries.length = AUDIT_LOG_EXPORT_MAX_ROWS;
      return { entries, truncated };
    }
    if (!page.pageInfo.hasMore || page.auditLogs.length === 0) {
      return { entries, truncated: false };
    }
    offset += page.auditLogs.length;
  }
}
