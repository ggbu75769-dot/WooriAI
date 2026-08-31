import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ADM-113: audit log viewer. The API endpoint is admin-role-only (cookie
// session + CSRF + MFA, RequireAdminRoles("admin") in the API's
// audit-logs.controller.ts); the frontend hides the nav entry from
// editor/analyst sessions and shows an access notice instead of a broken page
// (same pattern as ADM-006 /users).
describe("Audit logs API client (ADM-113)", () => {
  it("exposes a typed list function against /admin/audit-logs with pagination and filters", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("listAuditLogs");
    expect(api).toContain("/admin/audit-logs");
    expect(api).toContain("AdminAuditLogEntry");
    expect(api).toContain("AdminAuditLogsPageInfo");
    // offset 페이지네이션 + 필터(액션/행위자/기간) 쿼리 파라미터.
    for (const param of ["limit", "offset", "action", "actorUserId", "from", "to"]) {
      expect(api).toContain(`params.set("${param}"`);
    }
    // 행위자 표시용 이메일과 마스킹된 before/after 스냅샷 필드.
    expect(api).toContain("actorEmail");
    expect(api).toContain("before: unknown");
    expect(api).toContain("after: unknown");
  });
});

describe("Audit logs page (ADM-113)", () => {
  // CS-101(라운드 56): 행위자 열은 어드민만 남는 자리가 아니라서 "관리자"에서
  // "행위자"로 이름을 바로잡았다 — 표에는 앱 사용자 행위(expense.update 등)도 함께 뜬다.
  it("lists audit entries with the 시각/행위자/액션/대상/상세 table columns", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("use client");
    expect(source).toContain("listAuditLogs");
    for (const column of ["<th>시각</th>", "<th>행위자</th>", "<th>액션</th>", "<th>대상</th>", "<th>상세</th>"]) {
      expect(source).toContain(column);
    }
    // 상세 칸은 before/after 스냅샷을 펼쳐 보여준다.
    // ⚠️ 라운드 87 리뷰 M-5: 그 문구의 정본이 `src/lib/audit-log-rows.ts`로 옮겨 갔다(이름 앞에
    // 행을 가르는 표기를 세우느라 한 벌이 됐다). 화면에서 리터럴을 찾으면 이 파일의 **주석**이
    // 그 문구를 인용하고 있어 앵커가 주석 덕에 초록이 된다(같은 리뷰 M-3이 짚은 그 형태) —
    // 그래서 화면에서는 **이름을 부르는지**를, 문구 자체는 **정본 파일에서** 본다.
    expect(source).toContain("AUDIT_LOG_SNAPSHOT_SUMMARY");
    expect(readSource("src/lib/audit-log-rows.ts")).toContain('AUDIT_LOG_SNAPSHOT_SUMMARY = "변경 내용 보기"');
  });

  it("has pagination UI driven by the API's pageInfo (이전/다음 + page indicator)", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("pageInfo");
    expect(source).toContain("hasMore");
    expect(source).toContain("이전");
    expect(source).toContain("다음");
    expect(source).toContain("페이지");
    expect(source).toContain("offset");
  });

  it("offers action and date-range filters", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("액션 타입");
    expect(source).toContain("시작일");
    expect(source).toContain("종료일");
    expect(source).toContain("필터 적용");
  });

  it("gates the page to admin role and shows an access notice to other roles", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain('session?.admin.role === "admin"');
    expect(source).toContain("관리자(admin) 권한에서만 사용할 수 있어요");
  });

  it("clears the session on auth errors like the other admin pages", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("isAuthError");
    expect(source).toContain("clearSession");
  });

  it("is reachable from the admin nav for admin sessions only", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect(shell).toContain("/audit-logs");
    expect(shell).toContain("감사 로그");
    expect(shell).toContain("item.roles.includes(session.admin.role)");
  });

  /**
   * 라운드 73 트랙 D: 판정도 문장도 그대로이고, **어디서 오는가**만 바뀌었다.
   * 종전에는 이 화면이 `isTimeoutError`로 직접 갈라 타임아웃 문장을 옮겨 적었다 —
   * 그래서 화면마다 그 문장이 조금씩 달랐다(카테고리·사용자 조회). 이제 조회 실패 한 벌
   * (src/lib/load-error-copy.ts)이 admin-api.ts의 그 문장을 읽어 온다.
   */
  it("surfaces the typed fetch timeout as Korean guidance instead of an endless loading state", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("load-error-copy");
    expect(source).toContain('loadErrorCopy(error, "감사 로그를 불러오지 못했어요.")');
    // 문장의 단일 소스는 admin-api.ts 한 곳이고, 화면은 그것을 옮겨 적지 않는다.
    expect(source).not.toContain("요청 시간이 초과됐어요(10초)");
    expect(readSource("src/lib/admin-api.ts")).toContain("요청 시간이 초과됐어요(10초)");
  });
});

// ADM-117: fetch timeout hardening on the shared admin API client -- mirrors
// the mobile precedent (apps/mobile/src/api/client.ts DEFAULT_FETCH_TIMEOUT_MS
// + AbortController + typed timeout error). Behavior is unit-tested in
// src/lib/admin-api.test.ts; this pins the structural contract.
describe("Admin API client fetch timeout (ADM-117)", () => {
  it("bounds every request with a 10s AbortController timeout and a typed error", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("DEFAULT_FETCH_TIMEOUT_MS = 10_000");
    expect(api).toContain("AbortController");
    expect(api).toContain("AdminApiTimeoutError");
    expect(api).toContain("fetchWithTimeout");
    // request()가 맨 fetch 대신 타임아웃 래퍼를 쓴다.
    expect(api).toContain("response = await fetchWithTimeout(");
    // 타임아웃 에러는 한국어 안내 메시지를 그대로 실어 나른다.
    expect(api).toContain("요청 시간이 초과됐어요(10초)");
    expect(api).toContain("isTimeoutError");
  });

  // FIX-118C: admin 쓰기에는 서버 멱등키가 없어 10초 상한이 이중 반영 위험을
  // 만든다. 쓰기만 60초로 완화하고, 재시도 위험을 타입으로 실어 나른다.
  it("uses a separate 60s bound for non-GET writes with a retry-unsafe flag (FIX-118C)", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("WRITE_FETCH_TIMEOUT_MS = 60_000");
    expect(api).toContain("timeoutMsForMethod");
    expect(api).toContain("retryUnsafe");
    expect(api).toContain("isRetryUnsafeTimeoutError");
    // 쓰기 타임아웃 문구는 재시도를 권하지 않고 확인을 요구한다.
    expect(api).toContain("반영 여부가 확실하지 않으니");
    // 서버 멱등키 미적용 현황이 후속 과제로 남아 있다.
    expect(api).toContain("IdempotencyInterceptor");
  });
});

// ADM-117: 감사로그 CSV 내보내기. 새 API 없이 기존 GET /admin/audit-logs를
// limit=100으로 페이지 순회해 최대 1,000행을 모아 클라이언트에서 CSV를
// 만들어 Blob 다운로드한다. 순수 로직(이스케이프/인젝션 중화/상한/파일명)은
// src/lib/audit-log-csv.test.ts에서 단위 테스트한다.
describe("Audit logs CSV export (ADM-117)", () => {
  it("has a CSV export module with escaping, formula-injection neutralization, and the 1,000-row cap", () => {
    const util = readSource("src/lib/audit-log-csv.ts");
    expect(util).toContain("AUDIT_LOG_EXPORT_MAX_ROWS = 1000");
    expect(util).toContain("AUDIT_LOG_EXPORT_PAGE_SIZE = 100");
    expect(util).toContain("escapeCsvCell");
    expect(util).toContain("buildAuditLogCsv");
    expect(util).toContain("collectAuditLogsForExport");
    // product-link-bulk-csv.util(API)과 동일한 수식 인젝션 방어 정책.
    expect(util).toContain('DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@", "\\t", "\\r"])');
    // 파일명 audit-logs-YYYYMMDD.csv.
    expect(util).toContain("audit-logs-${year}${month}${day}.csv");
  });

  it("offers a CSV export button that pages the existing list endpoint with the applied filters", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("CSV 내보내기");
    expect(source).toContain("collectAuditLogsForExport");
    expect(source).toContain("buildAuditLogCsv");
    expect(source).toContain("auditLogCsvFilename");
    // 현재 적용된 필터를 목록 조회와 공유한다 (내보내기 전용 API 없음).
    expect(source).toContain("auditLogFiltersToQuery(appliedFilters)");
    expect(source).toContain("listAuditLogs({ ...query, ...page })");
  });

  it("downloads via a client-side Blob and disables the button with progress text while exporting", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("new Blob(");
    expect(source).toContain("URL.createObjectURL");
    expect(source).toContain("URL.revokeObjectURL");
    expect(source).toContain("disabled={exporting}");
    expect(source).toContain("내보내는 중...");
  });

  it("announces the 1,000-row truncation when the server has more rows", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("truncated");
    expect(source).toContain("상위 1,000건만 내보냈어요");
  });
});

// CS-101(라운드 56 트랙 C): "어드민 CS 도달 경로". 서버는 행위자 필터
// (audit-logs.dto.ts의 actorUserId)와 사용자 행위 기록(expense.update/delete 등)을
// 이미 갖추고 있었는데, 어드민 화면에는 그 값을 넣을 칸도, 사용자 조회에서
// 감사 로그로 넘어갈 링크도 없었다. 순수 로직은
// src/lib/audit-log-filters.test.ts에서 단위 테스트하고, 여기서는 배선을 고정한다.
describe("Audit logs CS reachability (CS-101)", () => {
  it("has an actorUserId filter input wired to the shared query builder", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("행위자 ID");
    expect(source).toContain("filterForm.actorUserId");
    expect(source).toContain("auditLogFiltersToQuery");
    // 서버가 400으로 되돌려보낼 값은 보내기 전에 막고 이유를 보여준다.
    expect(source).toContain("auditLogFilterError");
    expect(source).toContain("filterError");
  });

  it("offers a datalist of frequently used action codes", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("<datalist");
    expect(source).toContain("AUDIT_LOG_ACTION_PRESETS");
    const presets = readSource("src/lib/audit-log-filters.ts");
    // 프리셋은 API가 실제로 기록하는 액션 문자열이어야 한다.
    for (const action of ["expense.update", "expense.delete", "admin.admin_user.update"]) {
      expect(presets).toContain(`action: "${action}"`);
    }
  });

  it("prefills the filter from ?actorUserId= inside a Suspense boundary", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("<Suspense");
    expect(source).toContain("auditLogFiltersFromSearchParams(searchParams)");
  });

  it("describes the page truthfully: user actions are recorded here too", () => {
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("관리자 행위와 앱 사용자 행위를 함께");
    // 종전의 "관리자 행위 기록을"만 말하던 문구는 남아 있으면 안 된다.
    expect(source).not.toContain("관리자 행위 기록을 시간순으로");
  });

  it("labels non-admin actors distinctly without leaking personal data", () => {
    // GAP-087 트랙 A: 라벨은 그대로이고 **어디서 오는가**만 바뀌었다 — 화면이 라벨 함수를
    // 직접 부르는 대신, 행위자 칸 한 벌(auditLogActorCell)이 라벨·전체 ID·되짚기 주소를
    // 한 자리에서 만든다(라운드 86 D가 두 화면의 추이 카드에서 쓴 그 규율).
    const source = readSource("app/audit-logs/page.tsx");
    expect(source).toContain("auditLogActorCell");
    expect(readSource("src/lib/audit-log-rows.ts")).toContain("auditLogActorLabel");
    const filters = readSource("src/lib/audit-log-filters.ts");
    expect(filters).toContain("사용자(${shortActorId(entry.actorUserId!)})");
    // 라벨에 실리는 건 UUID 앞 8자뿐 — 이메일/닉네임은 등장하지 않는다.
    expect(filters).toContain("actorUserId.slice(0, 8)");
  });

  it("links from a users-lookup result card into the audit log filtered by that user", () => {
    const source = readSource("app/users-lookup/page.tsx");
    expect(source).toContain("이 사용자 감사 로그 보기");
    expect(source).toContain("auditLogsHrefForActor(user.id)");
    const filters = readSource("src/lib/audit-log-filters.ts");
    expect(filters).toContain("/audit-logs?actorUserId=");
  });
});

/**
 * GAP-087 트랙 A(라운드 87) — **표가 값을 글자로 남기고, 그 행위자로 되짚는 길을 준다.**
 *
 * 종전 이 표에서 전체 UUID에 닿는 경로는 `<td title=…>` **하나**였다. `title`은 마우스 호버로만
 * 뜨고 `<td>`는 포커스를 받지 않으니, 마우스가 없는 운영자에게 이 표의 식별자는 존재하지
 * 않았다 — 그리고 화면이 그 사실을 문장으로 **자백**하고 있었다
 * (*"전체 ID는 칸에 마우스를 올리면 보여요"*). ⚠️ 한 칸 더 나쁜 것은, **그 값을 요구하는
 * 필터가 같은 화면에 있었다**는 점이다(행위자 ID는 완전한 UUID여야 한다).
 *
 * 순수 판정은 `src/lib/audit-log-rows.test.ts`가 지고, 여기서는 **배선**을 고정한다.
 */
describe("Audit logs 표의 도달 경로 (GAP-087)", () => {
  const pageSource = () => readSource("app/audit-logs/page.tsx");

  it("ⓐ 행위자·대상의 전체 식별자가 텍스트 노드로 선다 (title이 유일 경로가 아니다)", () => {
    const source = pageSource();
    // 두 칸이 같은 모듈을 지난다.
    expect(source).toContain("auditLogActorCell(entry)");
    expect(source).toContain("auditLogTargetCell(entry)");
    // 전체 값이 속성이 아니라 **자식 노드**로 그려진다.
    // ⚠️ 라운드 87 리뷰 M-5: 같은 펼침이 **자기 칸의 표기**를 낭독 이름으로 함께 받는다
    // (`cellLabel` — 같은 이름 마흔 개가 서던 자리). 전체 값이 자식 노드라는 사실은 그대로다.
    expect(source).toContain("<FullIdDetails cellLabel={target.label} fullId={target.fullTargetId} />");
    expect(source).toContain("<FullIdDetails cellLabel={actor.label} fullId={actor.fullActorId}>");
    expect(source).toContain("<code className={styles.calloutCode}>{fullId}</code>");
    // ⓐ 부정 단언: 두 칸의 전체 값이 title 속성에만 남아 있지 않다.
    expect(source).toMatch(/\{actor\.fullActorId \? \(/);
    expect(source).toMatch(/\{target\.fullTargetId \? \(/);
  });

  it("ⓐ title 속성은 지우지 않았다 (도달 경로를 더하는 것이지 빼는 것이 아니다)", () => {
    const source = pageSource();
    expect(source).toContain("<td title={entry.actorUserId ?? undefined}>");
    expect(source).toContain("<td title={entry.targetId ?? undefined}>");
  });

  it("ⓑ 되짚기 링크가 행위자 칸에 서고 주소는 기존 한 함수에서 온다 (새 주소 0건)", () => {
    const source = pageSource();
    expect(source).toContain("<a href={actor.traceHref}>이 행위자의 기록만 보기</a>");
    // 화면은 주소를 조립하지 않는다 — 모든 href가 식(모듈이 만든 값)에서 온다.
    expect(source, "화면에 손으로 적은 주소 리터럴이 없다").not.toMatch(/href=\{[`"]/);
    expect(readSource("src/lib/audit-log-rows.ts")).toContain("auditLogsHrefForActor(actorUserId)");
    // 링크가 서는 조건도 화면이 다시 짓지 않는다(모듈의 traceHref 하나가 판정한다).
    expect(source).not.toContain("auditLogActorKind");
  });

  it("ⓒ 0건 문장이 두 갈래이고 그 판정이 hasAnyAuditLogFilter에서 온다", () => {
    const source = pageSource();
    // 화면은 **적용된** 필터로 묻는다(폼 입력값이 아니라 — 표는 적용된 조건의 결과다).
    expect(source).toContain("auditLogEmptyStateMessage(appliedFilters)");
    // ⚠️ 라운드 88 트랙 C: 이 블록은 **주석을 걷은** 소스에서 두 문장을 찾는다. 그 파일의
    // 머리말이 "조건에 맞는 기록이 없어요."를 인용하고 있어서, 원문을 그대로 읽으면 정본
    // (auditLogEmptyStateMessage의 return)이 사라져도 이 앵커가 초록이었다 — 인용은 근거이므로
    // 지우지 않고, **앵커가 무엇을 보는가**를 바꾼다(옆의 admin-load-error-copy.test.ts가 같은
    // 파일에 세운 형식 그대로이고, 그 규율의 모집단은
    // packages/test-utils/src/comment-tolerant-anchor-ledger.ts가 진다).
    const rows = readSource("src/lib/audit-log-rows.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    expect(rows).toContain("hasAnyAuditLogFilter(filters)");
    expect(rows).toContain("조건에 맞는 기록이 없어요.");
    // 두 문장이 실제로 다르다(같은 문장 두 갈래는 갈래가 아니다).
    expect(rows).toContain("아직 기록이 없어요.");
  });

  it("ⓓ 힌트에서 '마우스를 올리면' 자백이 사라지고 그 자리를 가리킨다 (부정 단언)", () => {
    const source = pageSource();
    expect(source).not.toContain("마우스를 올리면");
    expect(source).not.toContain("전체 ID는 칸에");
    // 각주가 새로 가리키는 곳은 두 칸의 펼침이다(문구는 모듈 한 벌에서 온다).
    expect(source).toContain("{AUDIT_LOG_FULL_ID_SUMMARY}&rdquo;를 펼치면 전체 ID가 글자로 나와요.");
    // 종전 문장의 앞부분(행위자 종류 안내)은 그대로다.
    expect(source).toContain("행위자가 &ldquo;사용자(...)&rdquo;로 보이는 행은 어드민 계정이 아닌 행위자예요");
  });

  it("ⓔ 긴 값을 펼치는 모양이 같은 행의 상세 칸 관례다 (새 형식·새 클래스 0건)", () => {
    const source = pageSource();
    // 상세 칸의 <details>/<summary>/calloutCode — 새 클래스를 만들지 않았다.
    // ⚠️ 라운드 87 리뷰 M-5: 세 펼침의 **이름**은 이제 행·칸마다 갈린다(같은 표에 같은 이름이
    // 마흔 개 서던 자리다 — `auditLogExpandSummaryLabel`). 여기서 무는 것은 그 이름이 아니라
    // **모양**이므로, 셋 다 같은 `<summary>` 관례를 쓰는지만 본다(이름의 계약은 audit-log-rows.test.ts).
    expect(source).toContain("<summary>{auditLogExpandSummaryLabel(rowLabel, AUDIT_LOG_SNAPSHOT_SUMMARY)}</summary>");
    expect(source).toContain("<summary>{auditLogExpandSummaryLabel(cellLabel, AUDIT_LOG_FULL_ID_SUMMARY)}</summary>");
    const classNames = new Set([...source.matchAll(/styles\.([A-Za-z0-9_]+)/g)].map((match) => match[1]));
    const css = readSource("src/components/admin-page.module.css");
    for (const className of classNames) {
      expect(css, `admin-page.module.css에 .${className}가 있다`).toContain(`.${className} `);
    }
  });

  it("ⓕ 열 이름 다섯·페이지 표시·CSV 문구·역할 안내가 바이트 불변이다", () => {
    const source = pageSource();
    for (const column of ["<th>시각</th>", "<th>행위자</th>", "<th>액션</th>", "<th>대상</th>", "<th>상세</th>"]) {
      expect(source).toContain(column);
    }
    expect(source).toContain("{currentPage} / {totalPages} 페이지");
    expect(source).toContain("현재 필터 조건으로 최대 1,000건까지 CSV 파일로 저장해요.");
    expect(source).toContain("상위 1,000건만 내보냈어요. 기간 필터로 범위를 좁히면 나머지도 내보낼 수 있어요.");
    expect(source).toContain("감사 로그는 관리자(admin) 권한에서만 사용할 수 있어요.");
    // 필터 폼·프리셋·검증 문구도 이 트랙의 손이 닿지 않았다.
    expect(source).toContain("정확히 일치하는 액션만 조회해요.");
    expect(source).toContain("한 사람의 행위만 모아 봐요.");
  });

  it("서버 0건 — 새 요청도 새 파라미터도 생기지 않았다", () => {
    const source = pageSource();
    // 이 화면이 부르는 API는 종전 하나 그대로다.
    expect((source.match(/listAuditLogs\(/g) ?? []).length).toBe(2); // 목록 조회 + CSV 순회
    expect(source).toContain("limit: PAGE_SIZE");
    // 새 모듈은 응답 **모양**만 읽는다(타입 전용 import) — 스스로 요청하지 않는다.
    const rows = readSource("src/lib/audit-log-rows.ts");
    expect(rows).toContain('import type { AdminAuditLogEntry } from "./admin-api";');
    expect(rows).not.toContain("listAuditLogs");
  });

  it("CSV 열·순서와 필터 모듈은 이 트랙이 만지지 않는다", () => {
    const csv = readSource("src/lib/audit-log-csv.ts");
    expect(csv).toContain("AUDIT_LOG_CSV_COLUMNS");
    // 표가 새로 그리는 두 값은 CSV에 이미 실려 있던 열이다(그래서 새 열이 필요 없다).
    for (const column of ["actorUserId", "targetId"]) {
      expect(csv, `${column} 열이 종전 그대로다`).toContain(column);
    }
    // 새 export 0건: 미러 스윕의 면제 둘이 audit-log-filters.ts를 가리킨다.
    const filters = readSource("src/lib/audit-log-filters.ts");
    const exported = [...filters.matchAll(/^export (?:function|const|type) ([A-Za-z0-9_]+)/gm)].map(
      (match) => match[1]
    );
    expect(exported.sort()).toEqual([
      "AUDIT_LOG_ACTION_MAX_LENGTH",
      "AUDIT_LOG_ACTION_PRESETS",
      "AuditLogActionPreset",
      "AuditLogActor",
      "AuditLogActorKind",
      "AuditLogFilters",
      "auditLogActorKind",
      "auditLogActorLabel",
      "auditLogFilterError",
      "auditLogFiltersFromSearchParams",
      "auditLogFiltersToQuery",
      "auditLogsHrefForActor",
      "emptyAuditLogFilters",
      "hasAnyAuditLogFilter",
      "isAuditLogActorId",
      "shortActorId"
    ]);
  });
});
