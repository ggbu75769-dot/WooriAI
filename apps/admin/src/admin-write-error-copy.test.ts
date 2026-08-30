import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { AdminApiError, AdminApiTimeoutError } from "./lib/admin-api";
import { LOAD_ERROR_COPY_SITES } from "./lib/load-error-copy";
import { writeErrorMessage } from "./lib/write-error-copy";

/**
 * 라운드 76 트랙 B(GAP-076 #2) — **어드민의 쓰기 실패가 이유를 말한다.**
 *
 * 정찰 노트가 어드민의 catch 자리를 전수로 세어 갈래를 냈다: 조회 열여섯은 라운드 73~75가
 * 한 판정으로 묶었는데(`load-error-copy.ts`), **쓰기에는 그 목록이 없었다** — 아홉 자리가
 * 서버가 보낸 한국어 사유를 통째로 버렸고, 그 아홉에는 `AdminApiError`·`isTimeoutError`
 * grep이 0건이라 **R19-F의 쓰기 타임아웃 두 문장까지** 함께 사라졌다. 그리고 그중 한 자리는
 * 있지도 않은 원인을 단정했다(`app/reviews/page.tsx`의 승인 게시 — 네트워크 끊김·500·60초
 * 타임아웃에도 *"본인이 작성한 초안은 승인할 수 없어요"*).
 *
 * 이 계약이 지키는 것은 다섯이다.
 *  ⓐ **소비 집합이 값이다** — `app/**` + `src/components/**`의 **쓰기 catch 전수**가 한 벌을
 *    부르거나 **이유가 적힌 면제 목록**에 있다(파생 단언 · 조회 쪽 스윕과 같은 형식).
 *  ⓑ **부정 단언** — 대장 밖에서 쓰기 실패 폴백을 손으로 적으면 이 파일이 빨개진다.
 *  ⓒ 서버가 사유를 주면 그 문장이, 아니면 **종전 폴백이 바이트 그대로** 선다.
 *  ⓓ **쓰기 타임아웃 두 문장이 화면까지 닿는다**(R19-F의 "재시도를 권하지 않는다"가 보인다).
 *  ⓔ **부정 단언** — 어떤 쓰기 폴백도 **실패 원인을 단정하지 않는다**.
 */

const adminRoot = process.cwd();
const repoRoot = join(adminRoot, "..", "..");

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function readRepoSource(relativePath: string): string {
  const filePath = join(repoRoot, ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// ---------------------------------------------------------------------------
// 대장 둘. ⚠️ 이 표들이 `src/lib/write-error-copy.ts`가 아니라 **여기**에 사는 이유는 그
// 파일의 머리말에 값으로 적혀 있다: 라운드 75 E의 상수 표 전수 스크레이프
// (`admin-canonical-mirrors.test.ts`)가 `src/**`·`app/**`의 모든 상수 표를 물고, 새 표를
// 초록으로 만들려면 그 파일의 `NON_MIRROR_CONSTANT_TABLES`에 두 줄을 더해야 하는데 그 파일은
// 이 트랙의 **무접촉 대상**이다. 테스트 파일은 그 스크레이프의 **명시적 제외 뿌리**라
// (`NON_SCRAPED_SOURCE_ROOTS`의 첫 줄) 대장이 스윕 옆에 서는 것이 오늘의 최소 우회다.
// ---------------------------------------------------------------------------

/**
 * **쓰기 실패 판정을 소비하는 자리 집합**(라운드 76 트랙 B 계약 ⓐ).
 *
 * 키는 어드민 루트 기준 경로, 값은 그 파일의 **쓰기 catch** 중 한 벌을 지나는 자리 수다.
 * 아래 스윕이 이 표와 **정확히 일치**하는지 본다.
 *
 * ⚠️ **스윕 범위**: `app/**` + `src/components/**`(라운드 75 트랙 D가 조회 쪽에 정한 그 두
 * 뿌리 그대로). `src/lib/**`가 밖인 이유도 같은 값이다 — 화면이 아니라 판정·API 래퍼·세션
 * 컨텍스트 모듈이고, 쓰기 실패 문장이 서는 자리가 아니다.
 *
 * 오늘의 합은 **열넷**이다. 그중 아홉이 정찰 노트가 센 "사유를 통째로 버리던" 자리이고
 * (`reviews` 셋 · `items` 둘 · `links` 둘 · `disclosures` 둘), 넷은 "부분만 말하던" 자리이며
 * (`users` 셋 · `categories` 하나 — 그 화면들의 코드 매핑·403·타임아웃 갈래는 **그대로 남고**
 * 그 아래 폴백만 한 벌을 지난다), 하나는 ⚠️ **정찰의 열아홉에 없던 자리**다
 * (`ProductLinkBulkReplace`의 일괄 적용 — 이 스윕이 찾아냈고, 폴백 문장은 바이트 그대로다).
 */
const WRITE_ERROR_COPY_SITES: Readonly<Record<string, number>> = {
  // 승인 게시 · 반려 · 롤백. (예약 게시는 아래 면제 목록 — 이미 손 사본으로 사유를 말한다.)
  "app/reviews/page.tsx": 3,
  // 준비템 생성 · 수정.
  "app/items/page.tsx": 2,
  // 상품 링크 생성 · 수정.
  "app/links/page.tsx": 2,
  // 고지 문구 저장(카드) · 새 키 추가.
  "app/disclosures/page.tsx": 2,
  // 계정 생성 · 역할 변경 · 활성 토글(셋 다 지역 함수 mutationErrorMessage를 지난다).
  "app/users/page.tsx": 3,
  // 카테고리 수정(타임아웃·403 갈래는 화면의 판정으로 남는다).
  "app/categories/page.tsx": 1,
  // CSV 일괄 적용(멱등·비멱등 타임아웃 두 갈래는 패널의 판정으로 남는다).
  "src/components/ProductLinkBulkReplace.tsx": 1
};

/**
 * 지역 경유 함수와 그 이유(라운드 76 트랙 B ⓓ).
 *
 * catch가 한 벌을 **직접** 부르지 않고 화면의 지역 함수를 지나는 자리다. 그 함수는 자기
 * 판정을 먼저 내고 **폴백만** 한 벌에 넘겨야 한다(아래 스윕이 그 사실을 소스로 확인한다).
 */
const LOCAL_WRITE_FALLBACK_HELPERS: Readonly<Record<string, { name: string; reason: string }>> = {
  "app/users/page.tsx": {
    name: "mutationErrorMessage",
    reason:
      "코드 둘(ADMIN_SELF_UPDATE_FORBIDDEN·ADMIN_EMAIL_EXISTS)의 매핑은 이 화면의 판정으로 남는다 — " +
      "자기 계정 강등 안내는 다음 걸음까지 말하고(다른 관리자에게 요청), 중복 이메일 문장은 서버 " +
      "문장보다 짧다. 세 문장 바이트 불변이고, 그 아래 폴백만 공용 한 벌을 지난다."
  }
};

/**
 * 그리고 **한 벌을 부르지 않는 쓰기 catch와 그 이유**.
 *
 * `marker`는 그 블록을 알아보는 문자열이고, 목록의 값은 "이유가 어딘가에 적혀 있다"가 아니라
 * **다음 라운드가 이 자리를 다시 세지 않는다**는 것이다(조회 쪽 `LOAD_ERROR_COPY_EXEMPT_SITES`와
 * 같은 관례). 스윕은 이 표의 모든 항목이 **실제로 한 블록씩** 붙는지도 함께 본다 —
 * 자리가 사라지면 이유만 남아 거짓말을 하기 때문이다.
 */
const WRITE_ERROR_COPY_EXEMPT_SITES: Readonly<Record<string, { marker: string; reason: string }>> = {
  "app/reviews/page.tsx#worker-health": {
    marker: "setWorker(null);",
    reason:
      "쓰기가 아니라 무인증 조회(GET /health/worker)이고, 실패했을 때 화면에 세우는 문장이 " +
      "아예 없다. 그 판정과 이유는 조회 쪽 대장(LOAD_ERROR_COPY_EXEMPT_SITES)이 이미 진다."
  },
  "app/reviews/page.tsx#schedule": {
    marker: "예약 게시를 변경하지 못했어요.",
    reason:
      "형제 넷 중 **이 자리만** 종전부터 서버 사유를 말했다(error instanceof AdminApiError && " +
      "error.message). 이 트랙은 그 문장을 바꾸지 않는다. 손 사본을 한 벌로 옮기지 않은 이유는 " +
      "라운드 75 D가 이 화면의 admin-api import 전수를 값으로 고정해 두었기 때문이다 " +
      "(admin-load-error-copy.test.ts) — 옮기면 AdminApiError가 쓰이지 않는 import로 남는데, " +
      "그 목록을 고치는 일은 이 트랙의 무접촉 파일에 있다.",
  },
  "app/links/page.tsx#copy-share-link": {
    marker: "setShareCopyError(",
    reason:
      "클립보드 쓰기(navigator.clipboard)라 서버 응답 자체가 없다 — 나를 수 있는 서버 사유가 " +
      "존재하지 않고, 문장은 이미 다음 걸음(주소를 직접 복사)을 말한다."
  },
  "app/users/page.tsx#copy-temp-password": {
    marker: "Clipboard can be unavailable",
    reason:
      "임시 비밀번호 복사도 같은 클립보드 실패다. 화면에 문장을 세우지도 않는다 — 코드 블록이 " +
      "클릭 선택(user-select: all)으로 남아 있는 것이 그 자리의 답이다."
  },
  "src/components/AdminShell.tsx#change-password": {
    marker: "비밀번호를 변경하지 못했어요.",
    reason:
      "셸의 쓰기 다섯은 이미 서버 사유를 말한다(손 사본 다섯 벌). ⚠️ 그 다섯을 공용 한 벌로 " +
      "바꾸는 것이 정찰 노트의 P3였지만, 라운드 75 D가 그 형태의 출현 수를 값으로 고정해 두었다 " +
      "(admin-load-error-copy.test.ts의 HAND_COPIED_SHAPE_OCCURRENCES = 5 · '셸의 쓰기 실패 " +
      "다섯은 종전 모양 그대로다'). 그 파일은 이 트랙의 무접촉 대상이라 오늘은 문장을 잃지 않는 " +
      "쪽을 고르고, 사본 다섯 벌이 다음 드리프트의 씨앗이라는 사실을 여기 값으로 남긴다."
  },
  "src/components/AdminShell.tsx#mfa-disable": {
    marker: "2단계 인증을 해제하지 못했어요.",
    reason:
      "같은 다섯 중 하나(인증 앱 재등록). 코드 오류·MFA 잠금·미등록이 서로 다른 사실이라 " +
      "서버 문장을 그대로 보여 주는 종전 모양이 이미 옳다 — 위와 같은 이유로 형태만 남는다."
  },
  "src/components/AdminShell.tsx#login": {
    marker: "로그인하지 못했어요.",
    reason:
      "같은 다섯 중 하나(비밀번호 단계). 폼 자체가 재시도라 [다시 시도] 버튼이 없고, 서버 문장이 " +
      "이미 그대로 선다 — 위와 같은 이유로 형태만 남는다."
  },
  "src/components/AdminShell.tsx#mfa-login-verify": {
    marker: "인증하지 못했어요.",
    reason:
      "같은 다섯 중 하나(2단계 코드 확인). 서버가 코드 오류·잠금·만료를 갈라 말하고 화면은 그것을 " +
      "그대로 그린다 — 위와 같은 이유로 형태만 남는다."
  },
  "src/components/AdminShell.tsx#mfa-setup-verify": {
    marker: "인증 코드를 확인하지 못했어요.",
    reason:
      "같은 다섯 중 하나(등록 코드 확인). 이 관문의 **조회** 하나는 라운드 75 D가 이미 한 벌로 " +
      "옮겼고, 쓰기 다섯은 그때 명시적으로 종전 모양을 지키기로 한 자리다."
  },
  "src/components/AdminShell.tsx#switch-account-logout": {
    marker: "still clear client-side session state",
    reason:
      "로그아웃은 최선 노력(best-effort)이라 실패해도 화면에 문장을 세우지 않는다 — 세션을 " +
      "지우고 로그인 화면으로 가는 것이 그 자리의 답이고, 나를 문장이 없다."
  },
  "src/components/AdminShell.tsx#logout": {
    marker: "clear the client-side session state either way",
    reason: "헤더의 로그아웃도 같다. 실패해도 세션을 지우는 것이 답이라 실패 문장 자체가 없다."
  },
  "src/components/ProductLinkBulkReplace.tsx#copy-csv-header": {
    marker: "클립보드 권한이 없으면",
    reason: "CSV 헤더 복사의 클립보드 실패다. 서버 응답도 없고 화면에 세우는 문장도 없다."
  },
  "src/components/ProductLinkBulkReplace.tsx#bulk-preview": {
    marker: "미리보기에 실패했어요.",
    reason:
      "미리보기(POST /bulk-preview)는 서버가 **검증만 하고 아무것도 쓰지 않는** 요청이라 이 대장의 " +
      "단위(쓰기)가 아니다 — R19-F의 쓰기 타임아웃 판정도 이 자리에는 서지 않는다. 서버의 CSV " +
      "검증 사유를 이 자리까지 나르는 일은 다음 라운드의 값으로 남긴다."
  },
  "src/components/ProductLinkBulkReplace.tsx#recheck-current-state": {
    marker: "재조회까지 실패하면",
    reason:
      "적용 타임아웃 뒤의 재조회다(같은 bulk-preview). 실패하면 표를 비우고 앞선 안내 문구만 " +
      "남긴다 — 새 문장을 세우지 않으므로 나를 사유가 없다."
  }
};

/** 스윕이 걷는 뿌리(조회 쪽 SCREEN_SOURCE_ROOTS와 같은 값). */
const WRITE_SWEEP_ROOTS = ["app", "src/components"] as const;

/** 그리고 걷지 않는 뿌리와 그 이유(라운드 75 D가 조회 쪽에 세운 그 형식). */
const NON_SWEPT_ROOTS: Readonly<Record<string, string>> = {
  "src/lib":
    "화면이 아니라 판정·API 래퍼·세션 컨텍스트 모듈만 있는 뿌리다. 쓰기 실패 문장이 서는 자리가 " +
    "아니고(문장을 만드는 곳은 admin-api.ts, 소비 규칙은 write-error-copy.ts다), `.tsx` 하나는 " +
    "프로바이더라 그릴 화면이 없다. 조회 쪽 스윕이 이 뿌리를 뺀 이유와 같은 값이다."
};

/** 화면 소스 전수(어드민 루트 기준 POSIX 경로 · 테스트 파일 제외). */
function screenPaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      found.push(relative(adminRoot, fullPath).split(sep).join("/"));
    }
  };
  for (const root of WRITE_SWEEP_ROOTS) walk(join(adminRoot, ...root.split("/")));
  return found.sort();
}

/**
 * `} catch (…) {` … 대응하는 `}` 까지의 블록 본문 전수.
 *
 * ⚠️ 앞의 `}`를 함께 요구하는 이유가 값이다 — 그것이 없으면 주석 안의 \`catch {}\` 같은 글자도
 * 블록으로 세어(오늘 `app/page.tsx`에 실제로 있다) 그물이 조용히 늘어난다. 바인딩이 없는
 * `} catch {`도 함께 잡는다: 이유를 **받지 않는** 자리야말로 사유를 나를 수 없는 자리라
 * 대장이 그 사실을 알아야 한다.
 */
function catchBlocks(source: string): { body: string; line: number }[] {
  const blocks: { body: string; line: number }[] = [];
  for (const match of source.matchAll(/\}\s*catch\s*(?:\((?:[A-Za-z_$][\w$]*)\)\s*)?\{/g)) {
    const start = match.index as number;
    const open = start + match[0].length - 1;
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ body: source.slice(open, index + 1), line: source.slice(0, start).split("\n").length });
          break;
        }
      }
    }
  }
  return blocks;
}

/** 조회 한 벌을 부르는 블록인가(그 자리는 라운드 75가 닫은 대장이 진다). */
function isLoadBlock(body: string): boolean {
  return /loadError(?:Copy|Message)\(/.test(body);
}

/** 이 블록이 쓰기 한 벌을 지나는가(직접 또는 값으로 적힌 지역 경유 함수를 통해). */
function reachesWriteCopy(body: string, path: string): boolean {
  if (/writeErrorMessage\(/.test(body)) return true;
  const local = LOCAL_WRITE_FALLBACK_HELPERS[path];
  return local ? new RegExp(`${local.name}\\(`).test(body) : false;
}

function timeoutError(method: string, idempotent = false): AdminApiTimeoutError {
  return new AdminApiTimeoutError(new Error("aborted"), method, idempotent);
}

// ---------------------------------------------------------------------------

describe("쓰기 실패 한 벌의 소비 규칙 (라운드 76 트랙 B ⓒ)", () => {
  it("서버가 이유를 주면 그 문장이 그대로 선다", () => {
    const error = new AdminApiError(409, "이미 게시된 초안이에요.", "CONTENT_REVISION_ALREADY_PUBLISHED");
    expect(writeErrorMessage(error, "승인 게시하지 못했어요.")).toBe("이미 게시된 초안이에요.");
  });

  it("이유를 못 받으면 종전 폴백이 바이트 그대로 선다", () => {
    // AdminApiError가 아닌 실패(직렬화 오류·예상 못 한 예외).
    expect(writeErrorMessage(new TypeError("boom"), "저장하지 못했어요. 다시 시도해 주세요.")).toBe(
      "저장하지 못했어요. 다시 시도해 주세요."
    );
    // 서버가 상태 코드만 주고 문장을 비워 보낸 경우도 "그 밖"과 같다.
    expect(writeErrorMessage(new AdminApiError(500, "   "), "저장하지 못했어요. 다시 시도해 주세요.")).toBe(
      "저장하지 못했어요. 다시 시도해 주세요."
    );
  });

  it("판정을 새로 만들지 않는다 — 이 모듈에 새 한국어 문구가 0건이다 (부정 단언)", () => {
    const source = readSource("src/lib/write-error-copy.ts");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    // 코드에는 한국어 리터럴이 한 글자도 없다(문장은 전부 서버 것이거나 호출부의 종전 폴백이다).
    // ⚠️ 한글 판정의 문자 범위도 유니코드 이스케이프로 적혀 있어 이 단언과 부딪히지 않는다 —
    // 범위는 **문구가 아니라 판정의 재료**이고, 리터럴로 적으면 이 부정 단언이 둘을 구별하지 못한다.
    expect(codeOnly, "write-error-copy.ts의 코드에 한국어 리터럴이 있다").not.toMatch(/[가-힣]/);
    expect(codeOnly, "한글 범위는 이스케이프로 적는다").toContain("\\uAC00-\\uD7A3");
    // 조회 한 벌과 합치지 않는다(경계가 정반대라는 것이 그 파일의 머리말이다).
    expect(codeOnly).not.toContain("load-error-copy");
    // 타임아웃·재시도 판정은 admin-api.ts가 이미 낸다 — 여기서 다시 적지 않는다.
    expect(codeOnly).not.toContain("isTimeoutError");
    expect(codeOnly).not.toContain("status === 0");
  });
});

describe("쓰기 타임아웃 두 문장이 화면까지 닿는다 (라운드 76 트랙 B ⓓ)", () => {
  it("멱등키 없는 쓰기 타임아웃은 재시도를 권하지 않는 그 문장으로 선다", () => {
    const error = timeoutError("POST");
    const message = writeErrorMessage(error, "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.");
    // 문장은 admin-api.ts의 WRITE_TIMEOUT_MESSAGE 그대로다(이 파일이 다시 적지 않는다).
    expect(message).toBe(error.message);
    expect(message).toContain("반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요.");
    // ⚠️ 종전 폴백이 이 자리에서 하던 두 가지가 사라진다: 틀린 원인(입력값)과 금지된 행동(재시도).
    expect(message).not.toContain("입력값을 확인하고");
  });

  it("멱등키를 실어 보낸 쓰기 타임아웃은 '중복 없이 처리돼요'가 화면에 닿는다", () => {
    const error = timeoutError("POST", true);
    const message = writeErrorMessage(error, "승인 게시하지 못했어요.");
    expect(message).toBe(error.message);
    expect(message).toContain("같은 요청을 다시 보내면 중복 없이 처리돼요");
  });

  it("연결 실패도 admin-api.ts가 만든 문장 그대로 닿는다", () => {
    const error = new AdminApiError(0, "서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    expect(writeErrorMessage(error, "저장하지 못했어요. 다시 시도해 주세요.")).toBe(error.message);
  });
});

/**
 * 라운드 76 적대적 리뷰 M-1 — **한국어 화면에 영문 서버 문장을 세우지 않는다.**
 *
 * 서버 사유를 그대로 나르는 이 한 벌에는 갈래가 하나 빠져 있었다: 어드민 API의 역할 게이트가
 * 내는 `ADMIN_FORBIDDEN`의 문장은 **영문**이다(`"Admin access is required."` —
 * `admin-auth.guard.ts` · `admin-token.guard.ts`). 그리고 그 403은 도달 불가능한 자리가 아니다:
 * 어드민 내비에 역할 제한이 없어 `analyst` 계정도 준비템·링크·고지 문구 저장 UI까지 걸어
 * 들어오고(쓰기 버튼만 `isEditor`로 갈린다), 저장을 누르면 그 영문 문장이 한국어 화면에 섰다.
 *
 * ⚠️ **고치는 자리는 소비 쪽 한 겹이다** — 서버 문장 자체는 응답 계약이라 바꾸지 않는다.
 */
describe("읽을 수 없는 서버 문장은 화면에 서지 않는다 (라운드 76 리뷰 M-1)", () => {
  const ADMIN_FORBIDDEN_MESSAGE = "Admin access is required.";

  it("한글이 한 자도 없는 서버 문장은 종전 폴백으로 되돌아간다", () => {
    const error = new AdminApiError(403, ADMIN_FORBIDDEN_MESSAGE, "ADMIN_FORBIDDEN");
    for (const fallback of [
      "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.",
      "저장하지 못했어요. 다시 시도해 주세요.",
      "승인 게시하지 못했어요."
    ]) {
      expect(writeErrorMessage(error, fallback), `${fallback} 자리에 영문이 섰다`).toBe(fallback);
    }
    // 다른 영문 사유(프록시·게이트웨이가 낸 문장 등)도 같은 갈래로 간다.
    expect(writeErrorMessage(new AdminApiError(502, "Bad Gateway"), "저장하지 못했어요. 다시 시도해 주세요.")).toBe(
      "저장하지 못했어요. 다시 시도해 주세요."
    );
  });

  it("한국어 서버 문장은 종전 그대로 선다 — 영문 갈래가 사유를 삼키지 않는다", () => {
    // 한글이 한 자라도 있으면 그 문장이 그대로다(코드·상태를 보지 않는 것이 이 한 벌의 계약이다).
    expect(
      writeErrorMessage(
        new AdminApiError(403, "카테고리 수정은 관리자(admin) 권한에서만 할 수 있어요.", "ADMIN_FORBIDDEN"),
        "저장하지 못했어요. 다시 시도해 주세요."
      )
    ).toBe("카테고리 수정은 관리자(admin) 권한에서만 할 수 있어요.");
    // 라틴 문자·숫자가 섞인 한국어 문장도 그대로다.
    expect(
      writeErrorMessage(
        new AdminApiError(400, '준비 시기 "12~24개월"은 12~24개월를 말하는데, 선택한 시기가 덮는 구간은 6~12개월예요.'),
        "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."
      )
    ).toContain("12~24개월");
    // 쓰기 타임아웃 두 문장도 한국어라 이 갈래에 걸리지 않는다(위 ⓓ가 무는 그 문장들).
    expect(writeErrorMessage(timeoutError("POST"), "저장하지 못했어요. 다시 시도해 주세요.")).toContain(
      "반영 여부가 확실하지 않으니"
    );
  });

  it("서버 문장 자체는 바뀌지 않았다 — 고친 자리는 소비 쪽 한 겹뿐이다 (응답 계약 불변)", () => {
    for (const guard of ["apps/api/src/admin/admin-auth.guard.ts", "apps/api/src/admin/admin-token.guard.ts"]) {
      expect(readRepoSource(guard), `${guard}의 403 문장`).toContain(
        `code: "ADMIN_FORBIDDEN", message: "${ADMIN_FORBIDDEN_MESSAGE}"`
      );
    }
  });
});

describe("쓰기 실패 판정의 소비 집합 (라운드 76 트랙 B ⓐ·ⓑ)", () => {
  /**
   * 파생 단언: 목록을 손으로 적어 두는 것이 아니라 두 뿌리의 **catch 전수**를 훑어
   * 갈래를 낸다. 잡는 것이 조회 쪽 스윕보다 하나 더 많다 — 조회 쪽은 "부르는데 목록에 없다 ·
   * 목록에 있는데 안 부른다"만 봤고(known-limitations N-3), 여기서는 **한 벌을 아예 부르지
   * 않는 catch**도 면제 목록을 요구하므로 새 화면이 자기 문장을 손으로 적으면 빨개진다.
   */
  it("두 뿌리의 쓰기 catch 전수가 대장이거나, 이유가 적힌 면제 목록이다", () => {
    const wired: Record<string, number> = {};
    const unnamed: string[] = [];
    const matchedExemptions = new Set<string>();
    let sweptBlocks = 0;

    for (const path of screenPaths()) {
      const source = readSource(path);
      for (const block of catchBlocks(source)) {
        sweptBlocks += 1;
        if (isLoadBlock(block.body)) continue; // 조회 자리는 라운드 75가 닫은 대장이 진다.
        if (reachesWriteCopy(block.body, path)) {
          wired[path] = (wired[path] ?? 0) + 1;
          continue;
        }
        const hits = Object.entries(WRITE_ERROR_COPY_EXEMPT_SITES).filter(
          ([site, entry]) => site.startsWith(`${path}#`) && block.body.includes(entry.marker)
        );
        expect(hits.length, `${path}:${block.line}의 면제 항목이 하나여야 한다`).toBeLessThanOrEqual(1);
        if (hits.length === 1) {
          matchedExemptions.add(hits[0][0]);
          continue;
        }
        unnamed.push(`${path}:${block.line}`);
      }
    }

    // 그물이 실제로 두 뿌리를 훑었다는 증거(정규식이 죽으면 이 하한이 먼저 빨개진다).
    expect(screenPaths().length, "화면 소스 전수").toBeGreaterThan(10);
    expect(sweptBlocks, "훑은 catch 자리").toBeGreaterThanOrEqual(40);

    expect(
      unnamed,
      `쓰기 catch ${unnamed.join(", ")}이(가) 대장에도 면제 목록에도 없어요 — ` +
        "writeErrorMessage를 지나게 하거나, 지나지 않는 이유를 값으로 적으세요"
    ).toEqual([]);
    expect(wired).toEqual({ ...WRITE_ERROR_COPY_SITES });

    // 반대 방향: 면제 목록에만 있고 소스에는 없는 자리(자리가 옮겨졌거나 지워졌다).
    const stale = Object.keys(WRITE_ERROR_COPY_EXEMPT_SITES)
      .filter((site) => !matchedExemptions.has(site))
      .sort();
    expect(stale, `면제 목록에만 있고 소스에는 없는 자리: ${stale.join(", ")}`).toEqual([]);
  });

  it("오늘의 자리는 열넷이다 (아홉 + 부분 넷 + 스윕이 찾은 하나)", () => {
    const total = Object.values(WRITE_ERROR_COPY_SITES).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(14);
    // 정찰 노트가 "사유를 통째로 버린다"고 센 아홉이 네 화면에 있다.
    const discardingScreens = ["app/reviews/page.tsx", "app/items/page.tsx", "app/links/page.tsx", "app/disclosures/page.tsx"];
    expect(discardingScreens.reduce((sum, path) => sum + WRITE_ERROR_COPY_SITES[path], 0)).toBe(9);
  });

  it("면제 이유는 빈 문자열일 수 없고, 대장과 겹치지 않는다", () => {
    expect(Object.keys(WRITE_ERROR_COPY_EXEMPT_SITES).length).toBeGreaterThan(0);
    for (const [site, entry] of Object.entries(WRITE_ERROR_COPY_EXEMPT_SITES)) {
      expect(entry.reason.trim().length, `${site}의 이유가 값으로 남아 있다`).toBeGreaterThan(30);
      expect(entry.marker.trim().length, `${site}를 알아보는 표식`).toBeGreaterThan(3);
    }
  });

  it("스윕 범위가 값이고, 걷지 않는 뿌리는 이유와 함께 적혀 있다", () => {
    expect([...WRITE_SWEEP_ROOTS]).toEqual(["app", "src/components"]);
    for (const [root, reason] of Object.entries(NON_SWEPT_ROOTS)) {
      expect(existsSync(join(adminRoot, ...root.split("/"))), `${root}가 실재한다`).toBe(true);
      expect(reason.length, `${root}의 제외 이유`).toBeGreaterThan(40);
      expect([...WRITE_SWEEP_ROOTS], `${root}는 걷는 뿌리가 아니다`).not.toContain(root);
    }
    // 한 벌 자신은 화면이 아니라 판정 모듈이라 스윕 밖이다(그래서 자기 자신을 세지 않는다).
    expect(screenPaths()).not.toContain("src/lib/write-error-copy.ts");
  });

  it("한 벌은 catch 안에서만 불린다 — 밖에서 부르는 것은 값으로 적힌 지역 경유 함수뿐 (ⓑ)", () => {
    for (const path of screenPaths()) {
      const source = readSource(path);
      const withoutImports = source
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("import "))
        .join("\n");
      const total = (withoutImports.match(/writeErrorMessage\(/g) ?? []).length;
      const inCatch = catchBlocks(source).reduce(
        (sum, block) => sum + (block.body.match(/writeErrorMessage\(/g) ?? []).length,
        0
      );
      const local = LOCAL_WRITE_FALLBACK_HELPERS[path];
      expect(total - inCatch, `${path}: catch 밖의 한 벌 호출`).toBe(local ? 1 : 0);
      if (local) {
        // 지역 함수는 자기 판정을 먼저 내고 **폴백만** 한 벌에 넘긴다.
        expect(source, `${path}의 ${local.name}`).toContain(`return writeErrorMessage(error, fallback);`);
        expect(local.reason.trim().length).toBeGreaterThan(30);
      }
    }
  });
});

describe("종전 폴백은 바이트 그대로다 (라운드 76 트랙 B ⓒ)", () => {
  /**
   * 정찰 노트가 센 아홉 중 **여덟**이 문장 그대로 남는다. 바뀌는 것은 승인 게시 한 자리뿐이고
   * (아래 ⓔ), 그 한 문장이 오늘 거짓을 말하던 자리다.
   */
  const BYTE_INVARIANT_FALLBACKS: [string, string][] = [
    ["app/reviews/page.tsx", "반려하지 못했어요. 다시 시도해 주세요."],
    ["app/reviews/page.tsx", "롤백하지 못했어요. 다시 시도해 주세요."],
    ["app/items/page.tsx", "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."],
    ["app/links/page.tsx", "저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요."],
    ["app/disclosures/page.tsx", "저장하지 못했어요. 다시 시도해 주세요."],
    ["src/components/ProductLinkBulkReplace.tsx", "적용하지 못했어요. 다시 미리보기 후 시도해 주세요."]
  ];

  it("여덟 자리의 폴백 문장이 한 벌의 마지막 갈래로만 쓰인다", () => {
    for (const [path, fallback] of BYTE_INVARIANT_FALLBACKS) {
      const source = readSource(path);
      expect(source, `${path}: 종전 문장이 그대로 남는다`).toContain(fallback);
      expect(source, `${path}: 그 문장은 한 벌을 지나서만 쓰인다`).toMatch(
        new RegExp(`writeErrorMessage\\((?:error|err), "${fallback}"\\)`)
      );
    }
    // items·links는 같은 문장을 두 자리(생성·수정)에서 쓴다 — 둘 다 한 벌을 지난다.
    for (const path of ["app/items/page.tsx", "app/links/page.tsx"]) {
      expect((readSource(path).match(/writeErrorMessage\(error, "저장하지 못했어요/g) ?? []).length, path).toBe(2);
    }
    expect((readSource("app/disclosures/page.tsx").match(/writeErrorMessage\((?:error|err), "저장하지 못했어요/g) ?? []).length).toBe(2);
  });

  it("부분만 말하던 넷의 화면 판정이 그대로 남는다 (문장 넷 바이트 불변)", () => {
    const users = readSource("app/users/page.tsx");
    // 지역 함수가 지는 판정 둘 + 그 화면이 R19-F에서 얻은 멱등 타임아웃 갈래.
    expect(users).toContain("본인 계정의 권한을 낮추거나 비활성화할 수 없어요. 다른 관리자에게 요청해 주세요.");
    expect(users).toContain("이미 등록된 관리자 이메일이에요.");
    expect(users).toContain("isIdempotentTimeoutError(error)");
    for (const fallback of [
      "계정을 만들지 못했어요. 입력값을 확인하고 다시 시도해 주세요.",
      "역할을 바꾸지 못했어요. 다시 시도해 주세요.",
      "계정 상태를 바꾸지 못했어요. 다시 시도해 주세요."
    ]) {
      expect(users, `users의 폴백: ${fallback}`).toContain(`mutationErrorMessage(error, "${fallback}")`);
    }

    const categories = readSource("app/categories/page.tsx");
    // 라운드 73이 세운 타임아웃 갈래와 403 갈래는 화면의 판정으로 남는다.
    expect(categories).toContain("저장 결과를 확인하지 못했어요. 목록을 새로고침해 반영 여부를 확인해 주세요.");
    expect(categories).toContain("카테고리 수정은 관리자(admin) 권한에서만 할 수 있어요.");
    expect(categories).toContain(
      'writeErrorMessage(error, "카테고리를 수정하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.")'
    );
  });

  it("성공 문구·멱등키 회전·목록 새로고침은 한 글자도 바뀌지 않았다 (무변경)", () => {
    const reviews = readSource("app/reviews/page.tsx");
    for (const success of ["게시했어요.", "반려했어요.", "이전 게시 이력으로 롤백했어요."]) {
      expect(reviews, `성공 문구: ${success}`).toContain(success);
    }
    expect(reviews).toContain("approvePublishContentRevision(detail.id, approveKey.current(detail.id))");
    expect(reviews).toContain("rollbackContentRevision(revisionId, rollbackKey.current(revisionId))");
    // 네 쓰기(승인·반려·예약·롤백) 전부 성공 뒤 목록·상세를 다시 읽는다.
    expect((reviews.match(/await refreshAfterAction\(\);/g) ?? []).length).toBe(4);
  });
});

describe("어떤 쓰기 폴백도 원인을 단정하지 않는다 (라운드 76 트랙 B ⓔ)", () => {
  /**
   * 오늘의 결함이 이것이었다: `handleApprove`의 폴백이 **모든 실패**에 서면서
   * *"본인이 작성한 초안은 승인할 수 없어요"* 라고 원인을 단정했다. 운영자는 남이 쓴 초안을
   * 승인하다 서버가 잠깐 죽어도 그 문장을 읽고, 자기 계정 권한이 잘못됐다고 판단한다.
   *
   * 판정의 모양: 쓰기 폴백은 **무엇이 실패했는가**(첫 문장)와 **다음에 무엇을 하는가**(꼬리)만
   * 말한다. 원인은 서버만 알고, 알면 서버가 말한다.
   */
  const ACTION_TAILS = [
    "다시 시도해 주세요.",
    "입력값을 확인하고 다시 시도해 주세요.",
    "다시 미리보기 후 시도해 주세요."
  ] as const;

  /** 두 뿌리에서 한 벌(또는 지역 경유 함수)에 넘기는 폴백 문장 전수. */
  function everyWriteFallback(): { path: string; fallback: string }[] {
    const found: { path: string; fallback: string }[] = [];
    for (const path of screenPaths()) {
      const source = readSource(path);
      const local = LOCAL_WRITE_FALLBACK_HELPERS[path]?.name;
      const names = ["writeErrorMessage", ...(local ? [local] : [])];
      for (const name of names) {
        for (const match of source.matchAll(new RegExp(`${name}\\((?:error|err), "([^"]+)"\\)`, "g"))) {
          found.push({ path, fallback: match[1] });
        }
      }
    }
    return found;
  }

  it("폴백은 실패한 일과 다음 걸음만 말한다 (파생 단언 · 꼬리 전수)", () => {
    const fallbacks = everyWriteFallback();
    // 대장의 자리 수와 같아야 한다 — 문장 없이 지나는 자리가 생기면 여기서 갈린다.
    expect(fallbacks.length).toBe(Object.values(WRITE_ERROR_COPY_SITES).reduce((sum, count) => sum + count, 0));
    for (const { path, fallback } of fallbacks) {
      const [head, ...rest] = fallback.split(/(?<=\.)\s+/);
      expect(head, `${path}: "${fallback}"의 첫 문장은 무엇이 실패했는지다`).toMatch(/못했어요\.$/);
      const tail = rest.join(" ");
      if (tail !== "") {
        expect(
          [...ACTION_TAILS],
          `${path}: "${fallback}"의 꼬리가 다음 걸음이 아니라 원인처럼 보여요`
        ).toContain(tail);
      }
    }
  });

  it("승인 게시의 원인 단정 한 절이 사라졌고, 그 문장은 서버가 조건일 때만 말한다", () => {
    const reviews = readSource("app/reviews/page.tsx");
    expect(reviews).toContain('writeErrorMessage(error, "승인 게시하지 못했어요.")');
    // ⚠️ 이 단언은 고치기 **전에** 빨갛다.
    for (const path of screenPaths()) {
      expect(readSource(path), `${path}에 원인 단정이 남아 있다`).not.toContain("본인이 작성한 초안은 승인할 수 없어요");
    }
    // 그 문장은 서버가 그 조건(CONTENT_REVISION_SELF_APPROVAL)일 때만 하는 말이고, 오늘도 그렇다.
    const service = readRepoSource("apps/api/src/admin/content-revisions.service.ts");
    expect(service).toContain('code: "CONTENT_REVISION_SELF_APPROVAL", message: "본인이 작성한 초안은 승인할 수 없어요."');
  });
});

describe("트랙 B의 무접촉 계약", () => {
  it("조회 쪽 대장은 열여섯 그대로다 (라운드 75가 닫은 자리 · 늘지도 줄지도 않는다)", () => {
    expect(Object.values(LOAD_ERROR_COPY_SITES).reduce((sum, count) => sum + count, 0)).toBe(16);
    const load = readSource("src/lib/load-error-copy.ts");
    // 그 파일의 경계 문장이 오늘도 옳다 — 이 트랙이 그 문장을 지우지 않고 **옆에** 대장을 세웠다.
    expect(load).toContain("쓰기 실패는 이 모듈이 다루지 않는다");
    expect(load).not.toContain("write-error-copy");
  });

  it("admin-api.ts는 읽기만 했다 (쓰기 타임아웃 두 문장·상한·멱등 판정 그대로)", () => {
    const api = readSource("src/lib/admin-api.ts");
    expect(api).toContain("WRITE_FETCH_TIMEOUT_MS = 60_000");
    expect(api).toContain("반영 여부가 확실하지 않으니 목록을 새로고침해 확인한 뒤 다시 시도하세요.");
    expect(api).toContain("같은 요청을 다시 보내면 중복 없이 처리돼요 — 다시 시도해 주세요.");
    expect(api).toContain("isRetryUnsafeTimeoutError");
    // 한 벌은 admin-api.ts를 부르기만 하고, 반대 방향 의존은 없다.
    expect(api).not.toContain("write-error-copy");
  });

  /**
   * ⚠️ **오늘 닫지 못한 자리를 값으로 남긴다.**
   *
   * 정찰 노트 P3는 셸의 쓰기 다섯을 공용 한 벌로 바꾸되 문장은 바이트 불변으로 두라고 적었다
   * (사본이 다섯 벌인 것이 다음 드리프트의 씨앗이다 — 라운드 75 P-4의 교훈). 그런데 라운드 75
   * 트랙 D가 **그 형태의 출현 수 다섯**을 계약으로 고정해 두었고(`admin-load-error-copy.test.ts`),
   * 그 파일은 이 트랙의 무접촉 대상이다. 그래서 오늘은 다섯을 그대로 두고 — 그 자리는 이미
   * 서버 사유를 말하므로 **잃는 문장이 없다** — 이 충돌을 여기 적어 둔다.
   */
  it("셸의 쓰기 다섯은 종전 모양 그대로다 (라운드 75 D의 계약과의 충돌을 값으로)", () => {
    const shell = readSource("src/components/AdminShell.tsx");
    expect((shell.match(/error instanceof AdminApiError \? error\.message/g) ?? []).length).toBe(5);
    expect(shell, "셸은 이 트랙에서 한 글자도 바뀌지 않았다").not.toContain("write-error-copy");
    // 그 다섯은 전부 면제 목록에 이유와 함께 있다.
    const shellExemptions = Object.keys(WRITE_ERROR_COPY_EXEMPT_SITES).filter((site) =>
      site.startsWith("src/components/AdminShell.tsx#")
    );
    expect(shellExemptions).toHaveLength(7); // 쓰기 다섯 + 문장 없는 로그아웃 둘.
    // 그리고 조회 한 자리는 라운드 75가 옮긴 그대로다.
    expect(shell).toContain('loadErrorCopy(error, "MFA 등록 정보를 불러오지 못했어요.")');
  });

  it("서버·마이그레이션 0건 — 이 트랙은 사유를 나르기만 한다", () => {
    // 새 코드·새 메시지를 만들지 않는다(사유는 서버가 이미 내려보내는 것이다).
    for (const path of screenPaths()) {
      const source = readSource(path);
      expect(source, `${path}: 화면이 쓰기 타임아웃 문장을 옮겨 적었다`).not.toContain("요청이 오래 걸리고 있어요(60초)");
    }
  });
});
