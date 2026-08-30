import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, type AdminRole } from "./lib/admin-api";
import { ADMIN_WRITE_ROLE_NOTICE } from "./lib/admin-role-copy";

/**
 * 라운드 77 트랙 D(GAP-077 #4) — **통하지 않는 저장 UI를 세우지 않는다.**
 *
 * 라운드 76 리뷰 M-1이 **문장**을 고치며 이유로 적어 둔 사실이 **화면**에는 그대로 남아
 * 있었다: 어드민 내비에 역할 제한이 없어 `analyst` 계정도 준비템·링크·고지 문구 화면까지 걸어
 * 들어오는데, 그 셋이 역할을 `isEditor` **하나로만** 읽어 갈래가 둘뿐이었다 — 편집자면
 * "검토 요청", **아니면 곧바로 저장**. `analyst`는 "아니면" 쪽에 떨어져 `admin`과 똑같은
 * 화면을 봤다([추가]·[저장] 버튼 · 성공 배너 문안까지). 서버에서 `analyst`에게 열린 쓰기
 * 경로는 **0건**이므로 그 버튼은 예외 없이 403으로 끝났다.
 *
 * 같은 저장소가 그 답을 이미 두 번 적어 두었다 — `app/categories/page.tsx`(`canEdit`)와
 * `app/reviews/page.tsx`(`isAdmin`)가 표는 남기고 **편집 컨트롤만** 감춘다. 이 트랙은 그 답을
 * 나머지 셋에 세우고, 그 판정을 여기 값으로 묶는다.
 *
 * 이 계약이 지키는 것은 넷이다.
 *  ⓐ **전수 단언** — 쓰기를 부르는 어드민 화면 전수에서 **제출 컨트롤이 역할 게이트를 지난다**
 *    (한 벌을 안 지나는 화면이 생기면 대장이 빨개진다 · 파생 단언 · 스윕 뿌리도 값이다).
 *  ⓑ **`canEdit`의 뜻이 서버와 같다** — `admin` 직접 저장 · `editor` 검토 요청 · `analyst` 없음
 *    (세 역할 전수 · 서버의 `RequireAdminRoles` 전수에서 파생).
 *  ⓒ **부정 단언** — 캡션 문자열의 사본이 저장소에 **하나뿐**이다.
 *  ⓓ **내비 게이트와 컨트롤 게이트는 서로 다른 축**이다(`NAV_ITEMS`의 `roles` 셋 무변경).
 *
 * ⚠️ 그리고 **바뀌지 않은 것**도 값으로 남는다: `isEditor` 갈래의 문안 전부와 쓰기 catch
 * 자리 수(2·2·2 — 라운드 76 B의 `WRITE_ERROR_COPY_SITES`가 세는 그 수).
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

/** 주석은 화면에 서지 않는다 — 사본을 셀 때도, 게이트를 찾을 때도 코드만 본다. */
function codeOnly(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

// ---------------------------------------------------------------------------
// 대장. 키는 어드민 루트 기준 경로다.
// ---------------------------------------------------------------------------

type GateKind =
  /** 폼·표는 남고 **제출 컨트롤만** 역할로 갈린다(이 트랙이 셋에 세운 모양 · 오늘 다섯). */
  | "control"
  /** 화면 전체가 역할 뒤에 있다(렌더 전에 early return — 안내 한 줄만 남는다). */
  | "screen";

type WriteScreen = {
  /** 그 화면이 세운 게이트 식별자(`const <gate> = …`). */
  gate: string;
  kind: GateKind;
  /** 게이트가 통과시키는 역할. 서버 기준과 같은 뜻이어야 한다(아래 ⓑ). */
  allows: AdminRole[];
  /** 그 게이트를 지나야 하는 **제출 컨트롤**의 onClick 바인딩 전수. */
  submits: string[];
  /** 내비에서의 자리(ⓓ가 두 축이 다르다는 것을 여기서 읽는다). */
  href: string;
  /** 서버 쪽 근거 — 그 쓰기를 지키는 데코레이터가 사는 파일. */
  server: string;
};

const ADMIN_WRITE_SCREENS: Readonly<Record<string, WriteScreen>> = {
  // 이 트랙이 연 셋. 편집자는 검토 요청 경로가 **실제로 통하므로** 게이트를 지난다.
  "app/items/page.tsx": {
    gate: "canEdit",
    kind: "control",
    allows: ["admin", "editor"],
    submits: ["onClick={handleCreate}", "onClick={handleEditSave}"],
    href: "/items",
    server: "apps/api/src/admin/admin.controller.ts"
  },
  "app/links/page.tsx": {
    gate: "canEdit",
    kind: "control",
    allows: ["admin", "editor"],
    submits: ["onClick={handleCreate}", "onClick={handleEditSave}"],
    href: "/links",
    server: "apps/api/src/admin/admin.controller.ts"
  },
  "app/disclosures/page.tsx": {
    gate: "canEdit",
    kind: "control",
    allows: ["admin", "editor"],
    submits: ["onClick={handleSave}", "onClick={handleAddKey}"],
    href: "/disclosures",
    server: "apps/api/src/admin/admin.controller.ts"
  },
  // 이미 정직하던 둘. 이 트랙이 한 글자도 바꾸지 않고 **같은 축임을 값으로** 적는다.
  "app/categories/page.tsx": {
    // 카테고리에는 검토 경로가 없다(콘텐츠 리비전의 entityType이 아니다) — 그래서 admin뿐이다.
    gate: "canEdit",
    kind: "control",
    allows: ["admin"],
    submits: ["onClick={() => saveEdit(category)}"],
    href: "/categories",
    server: "apps/api/src/admin/admin-categories.controller.ts"
  },
  "app/reviews/page.tsx": {
    gate: "isAdmin",
    kind: "control",
    allows: ["admin"],
    submits: [
      "onClick={handleApprove}",
      "onClick={handleReject}",
      "onClick={() => handleSchedule(scheduleAt || null)}",
      "onClick={() => handleSchedule(null)}",
      "onClick={() => handleRollback(revision.id)}"
    ],
    href: "/reviews",
    server: "apps/api/src/admin/content-revisions.controller.ts"
  },
  // 세 번째 모양: 화면 전체가 역할 뒤다. 컨트롤을 하나씩 감출 필요가 없다 —
  // 개인정보를 다루는 화면이라 **표 자체가** admin 전용이기 때문이다(내비도 함께 감춘다).
  "app/users/page.tsx": {
    gate: "isAdmin",
    kind: "screen",
    allows: ["admin"],
    submits: [],
    href: "/users",
    server: "apps/api/src/admin/admin-users.controller.ts"
  }
};

/**
 * 스윕이 걷는 뿌리와 **걷지 않는 뿌리·이유**(라운드 75 D가 조회 쪽에, 라운드 76 B가 쓰기 쪽에
 * 세운 그 형식).
 */
const GATE_SWEEP_ROOTS = ["app"] as const;

const NON_SWEPT_ROOTS: Readonly<Record<string, string>> = {
  "src/components":
    "쓰기를 부르는 자리가 하나 있는데(ProductLinkBulkReplace의 CSV 일괄 적용) 그 패널은 자기 " +
    "안에서 역할을 읽지 않는다 — **마운트 지점**인 app/links/page.tsx가 `session.admin.role === " +
    '"admin"`일 때만 세운다. 게이트가 화면 쪽에 있으므로 이 대장의 단위(화면)로 이미 세어진다. ' +
    "셸(AdminShell)의 쓰기 다섯은 계정 자신의 비밀번호·MFA라 역할과 무관하다.",
  "src/lib":
    "화면이 아니라 판정·API 래퍼·세션 컨텍스트 모듈이다. 버튼이 서는 자리가 아니고, 역할을 " +
    "읽는 유일한 모듈(admin-token-context)은 세션을 나르기만 한다."
};

/** 어드민 화면 소스 전수(테스트 파일 제외). */
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
  for (const root of GATE_SWEEP_ROOTS) walk(join(adminRoot, ...root.split("/")));
  return found.sort();
}

/**
 * `admin-api.ts`가 내보내는 **쓰기 함수 전수**(파생 — 손 목록이 아니다).
 *
 * 상태를 바꾸는 메서드를 실어 보내는 함수와, 그것을 부르는 한 겹 합성 함수
 * (`draftAndSubmitContentRevision` = create + submit)가 전부다.
 */
function adminApiWriteFunctions(): string[] {
  const api = readSource("src/lib/admin-api.ts");
  const bodies = new Map<string, string>();
  for (const chunk of api.split(/\nexport (?:async )?function /).slice(1)) {
    const name = /^([A-Za-z0-9_]+)/.exec(chunk)?.[1];
    if (name) bodies.set(name, chunk);
  }
  const writes = new Set<string>();
  for (const [name, body] of bodies) {
    if (/method: "(?:POST|PATCH|PUT|DELETE)"/.test(body)) writes.add(name);
  }
  for (const [name, body] of bodies) {
    if (writes.has(name)) continue;
    if ([...writes].some((write) => new RegExp(`\\b${write}\\(`).test(body))) writes.add(name);
  }
  return [...writes].sort();
}

/**
 * `index` 자리를 감싸는 JSX 표현식 블록들의 **머리말**(여는 `{` 바로 뒤 조각).
 *
 * 뒤에서 앞으로 걸으며 깊이를 세므로, 게이트가 어느 깊이에 있든(카드 안 · 표의 셀 안) 찾는다.
 * "게이트 문자열이 파일 어딘가에 있다"가 아니라 **그 컨트롤이 실제로 그 조건 안에 있다**를
 * 묻는 것이 이 함수의 요점이다.
 */
function enclosingExpressionHeaders(source: string, index: number, headerLength = 200): string[] {
  const headers: string[] = [];
  let depth = 0;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const char = source[cursor];
    if (char === "}") depth += 1;
    else if (char === "{") {
      if (depth === 0) headers.push(source.slice(cursor + 1, cursor + 1 + headerLength));
      else depth -= 1;
    }
  }
  return headers;
}

/**
 * `const <gate> = <expr>;`의 **뜻**을 역할 집합으로 읽는다.
 *
 * 식은 `session.admin.role === "역할"`(옵셔널 체이닝 허용)을 `||`로 이은 모양만 허용한다 —
 * 부정이나 다른 값이 섞이면 여기서 실패한다(뜻을 읽지 못하는 게이트는 계약이 될 수 없다).
 */
function rolesAcceptedBy(source: string, gate: string, where: string): AdminRole[] {
  const expression = new RegExp(`const ${gate} = ([^;]+);`).exec(codeOnly(source))?.[1];
  expect(expression, `${where}에서 const ${gate} 선언을 찾지 못했어요`).toBeTruthy();
  const terms = expression!.split("||").map((term) => term.trim());
  const roles: AdminRole[] = [];
  for (const term of terms) {
    const match = /^session\??\.admin\.role === "([a-z_]+)"$/.exec(term);
    expect(match, `${where}의 ${gate}에 읽을 수 없는 갈래가 있어요: ${term}`).toBeTruthy();
    roles.push(match![1] as AdminRole);
  }
  return roles;
}

/** 서버가 `RequireAdminRoles`로 지키는 역할 전수(어드민 컨트롤러 전부에서 파싱). */
function serverGuardedRoles(): string[] {
  const dir = join(repoRoot, "apps", "api", "src", "admin");
  const roles = new Set<string>();
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".controller.ts")) continue;
    const source = readFileSync(join(dir, entry), "utf8");
    for (const match of source.matchAll(/@RequireAdminRoles\(([^)]*)\)/g)) {
      for (const literal of match[1].matchAll(/"([a-z_]+)"/g)) roles.add(literal[1]);
    }
  }
  expect(roles.size, "어드민 컨트롤러에서 RequireAdminRoles를 하나도 찾지 못했어요").toBeGreaterThan(0);
  return [...roles].sort();
}

// ---------------------------------------------------------------------------

describe("제출 컨트롤은 예외 없이 역할 게이트를 지난다 (라운드 77 트랙 D ⓐ)", () => {
  it("쓰기를 부르는 화면 전수가 대장에 있다 (파생 단언 · 손 목록이 아니다)", () => {
    const writeFunctions = adminApiWriteFunctions();
    // 그물이 실제로 쳐졌다는 증거(정규식이 죽으면 이 하한이 먼저 빨개진다).
    expect(writeFunctions.length, "admin-api.ts의 쓰기 함수").toBeGreaterThan(10);
    expect(writeFunctions).toContain("createItemTemplate");
    expect(writeFunctions).toContain("updateDisclosure");
    expect(writeFunctions).toContain("updateAdminCategory");
    // 한 겹 합성도 쓰기로 읽힌다(편집자의 검토 요청 경로).
    expect(writeFunctions).toContain("draftAndSubmitContentRevision");
    // 조회는 쓰기가 아니다 — 그물이 아무거나 잡고 있지 않다는 반대 방향 증거.
    for (const read of ["listItemTemplates", "listAdminCategories", "listAuditLogs", "lookupAdminEndUsers"]) {
      expect(writeFunctions, `${read}는 조회다`).not.toContain(read);
    }

    const callsWrite = screenPaths().filter((path) => {
      const source = codeOnly(readSource(path));
      return writeFunctions.some((name) => new RegExp(`\\b${name}\\(`).test(source));
    });
    expect(
      callsWrite.sort(),
      "쓰기를 부르는 화면이 대장과 다릅니다 — 새 화면이면 게이트를 세우고 대장에 적으세요"
    ).toEqual(Object.keys(ADMIN_WRITE_SCREENS).sort());
  });

  it("대장의 모든 제출 컨트롤이 자기 화면의 역할 게이트 **안**에 있다", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const source = readSource(path);
      expect(source, `${path}에 ${screen.gate} 게이트가 있다`).toContain(`const ${screen.gate} =`);
      for (const submit of screen.submits) {
        const index = source.indexOf(submit);
        expect(index, `${path}: ${submit} 바인딩이 실재한다`).toBeGreaterThan(-1);
        expect(source.indexOf(submit, index + 1), `${path}: ${submit}가 한 자리다`).toBe(-1);
        const headers = enclosingExpressionHeaders(source, index);
        expect(
          headers.some((header) => header.includes(screen.gate)),
          `${path}: ${submit}가 역할 게이트(${screen.gate}) 밖에 서 있어요`
        ).toBe(true);
      }
    }
  });

  it("컨트롤 게이트는 다섯이고, 나머지 한 자리는 화면 전체가 역할 뒤다", () => {
    const byKind = (kind: GateKind) =>
      Object.entries(ADMIN_WRITE_SCREENS)
        .filter(([, screen]) => screen.kind === kind)
        .map(([path]) => path)
        .sort();
    expect(byKind("control")).toEqual([
      "app/categories/page.tsx",
      "app/disclosures/page.tsx",
      "app/items/page.tsx",
      "app/links/page.tsx",
      "app/reviews/page.tsx"
    ]);
    expect(byKind("screen")).toEqual(["app/users/page.tsx"]);

    // 화면 전체 게이트는 렌더 전에 돌아선다 — 감출 컨트롤이 남지 않는다.
    const users = readSource("app/users/page.tsx");
    expect(users).toContain("if (!isAdmin) {");
    expect(users).toContain("관리자 계정 관리는 관리자(admin) 권한에서만 사용할 수 있어요.");
    expect(ADMIN_WRITE_SCREENS["app/users/page.tsx"].submits).toEqual([]);
  });

  it("스윕 범위가 값이고, 걷지 않는 뿌리는 이유와 함께 적혀 있다", () => {
    expect([...GATE_SWEEP_ROOTS]).toEqual(["app"]);
    expect(screenPaths().length, "어드민 화면 소스 전수").toBeGreaterThan(10);
    for (const [root, reason] of Object.entries(NON_SWEPT_ROOTS)) {
      expect(existsSync(join(adminRoot, ...root.split("/"))), `${root}가 실재한다`).toBe(true);
      expect(reason.trim().length, `${root}의 제외 이유`).toBeGreaterThan(40);
      expect([...GATE_SWEEP_ROOTS], `${root}는 걷는 뿌리가 아니다`).not.toContain(root);
    }
    // 제외 이유가 오늘도 사실이다 — CSV 패널의 게이트는 **마운트 지점**에 있다.
    expect(readSource("app/links/page.tsx")).toContain('session.admin.role === "admin" ? <ProductLinkBulkReplace');
    expect(readSource("src/components/ProductLinkBulkReplace.tsx"), "패널은 자기 안에서 역할을 읽지 않는다").not.toContain(
      "admin.role"
    );
  });

  it("대장의 서버 근거 파일이 실재하고, 그 자리가 admin 전용이다", () => {
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const server = readRepoSource(screen.server);
      expect(server, `${path}의 근거 ${screen.server}에 역할 데코레이터가 있다`).toContain('@RequireAdminRoles("admin")');
    }
  });
});

describe("canEdit의 뜻이 서버와 같다 (라운드 77 트랙 D ⓑ)", () => {
  it("게이트가 통과시키는 역할이 대장의 값과 같다 (세 역할 전수)", () => {
    expect([...ADMIN_ROLES].sort()).toEqual(["admin", "analyst", "editor"]);
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      const accepted = rolesAcceptedBy(readSource(path), screen.gate, path);
      expect([...accepted].sort(), `${path}의 ${screen.gate}가 통과시키는 역할`).toEqual([...screen.allows].sort());
      // 세 역할 전수 — 대장에 없는 역할은 예외 없이 막힌다.
      for (const role of ADMIN_ROLES) {
        expect(accepted.includes(role), `${path}: ${role}`).toBe(screen.allows.includes(role));
      }
    }
  });

  it("analyst에게 열린 쓰기 경로는 서버에도 화면에도 0건이다 (부정 단언)", () => {
    // 서버: 어드민 컨트롤러 전수의 RequireAdminRoles에 analyst가 없다.
    expect(serverGuardedRoles()).toEqual(["admin", "editor"]);
    // 화면: 어떤 게이트도 analyst를 통과시키지 않는다.
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      expect(rolesAcceptedBy(readSource(path), screen.gate, path), `${path}`).not.toContain("analyst");
    }
  });

  it("editor가 지나는 문은 검토 요청이다 — 직접 쓰기가 아니다", () => {
    // 편집자를 통과시키는 화면 셋은 전부 그 갈래에서 draft -> submit을 부른다.
    for (const [path, screen] of Object.entries(ADMIN_WRITE_SCREENS)) {
      if (!screen.allows.includes("editor")) continue;
      const source = readSource(path);
      expect(source, `${path}: 편집자 갈래`).toContain('session.admin.role === "editor"');
      expect(source, `${path}: 편집자는 검토 요청으로 간다`).toContain("draftAndSubmitContentRevision");
    }
    // 그 문이 서버에도 열려 있다(검토 경로만 admin, editor다).
    const revisions = readRepoSource("apps/api/src/admin/content-revisions.controller.ts");
    expect(revisions).toContain('@RequireAdminRoles("admin", "editor")');
    // 직접 쓰기 쪽은 admin뿐이다.
    expect(readRepoSource("apps/api/src/admin/admin.controller.ts")).not.toContain('@RequireAdminRoles("admin", "editor")');
  });

  it("isEditor 갈래의 문안은 한 글자도 바뀌지 않았다 (바이트 불변)", () => {
    const editorCopy = [
      "편집자 계정은 바로 저장하지 않고, 검토 요청을 관리자에게 보내요.",
      '{creating ? "저장 중..." : isEditor ? "검토 요청" : "추가"}',
      '{isEditor ? "검토 요청을 보냈어요." : "저장했어요."}'
    ];
    for (const path of ["app/items/page.tsx", "app/links/page.tsx", "app/disclosures/page.tsx"]) {
      const source = readSource(path);
      for (const copy of editorCopy) expect(source, `${path}: ${copy}`).toContain(copy);
    }
    for (const path of ["app/items/page.tsx", "app/links/page.tsx"]) {
      expect(readSource(path)).toContain("저장하면 관리자에게 검토 요청이 전달돼요.");
      expect(readSource(path)).toContain('{editSubmitting ? "저장 중..." : isEditor ? "검토 요청" : "저장"}');
    }
    expect(readSource("app/disclosures/page.tsx")).toContain('{saving ? "저장 중..." : isEditor ? "검토 요청" : "저장"}');
  });

  it("쓰기 catch 자리 수가 그대로다 — 컨트롤을 감출 뿐 catch를 지우지 않는다 (2·2·2)", () => {
    // 라운드 76 B의 WRITE_ERROR_COPY_SITES가 세 화면에서 세는 값 그대로다.
    for (const path of ["app/items/page.tsx", "app/links/page.tsx", "app/disclosures/page.tsx"]) {
      const source = readSource(path);
      expect((source.match(/writeErrorMessage\((?:error|err), "/g) ?? []).length, `${path}의 쓰기 폴백`).toBe(2);
    }
  });
});

describe("캡션의 사본은 하나뿐이다 (라운드 77 트랙 D ⓒ)", () => {
  /** 사본을 세는 뿌리 — 테스트 파일은 대조하는 쪽이지 사본이 아니다(미러 대장과 같은 관례). */
  function repoCopyPaths(): string[] {
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
    for (const root of ["app", "src"]) walk(join(adminRoot, root));
    return found.sort();
  }

  it("문장이 사는 자리는 admin-role-copy.ts 하나다 (부정 단언)", () => {
    const holders = repoCopyPaths().filter((path) => codeOnly(readSource(path)).includes(ADMIN_WRITE_ROLE_NOTICE));
    expect(holders, "화면이 캡션을 손으로 되쓰고 있어요 — ADMIN_WRITE_ROLE_NOTICE를 import하세요").toEqual([
      "src/lib/admin-role-copy.ts"
    ]);
    // 종전에 인라인이 있던 자리도 이제 상수를 부른다(문자열은 바이트 불변).
    expect(ADMIN_WRITE_ROLE_NOTICE).toBe("지금 계정은 조회만 할 수 있어요. 수정은 관리자(admin) 권한이 필요해요.");
    for (const path of [
      "app/categories/page.tsx",
      "app/items/page.tsx",
      "app/links/page.tsx",
      "app/disclosures/page.tsx"
    ]) {
      expect(readSource(path), `${path}가 한 자리를 부른다`).toContain("{ADMIN_WRITE_ROLE_NOTICE}");
      expect(readSource(path)).toContain('from "../../src/lib/admin-role-copy"');
    }
  });

  it("신설 모듈은 상수 표가 아니다 — 미러 스크레이프의 단위가 아닌 이유가 적혀 있다", () => {
    const module = readSource("src/lib/admin-role-copy.ts");
    // 문자열 상수 하나다(배열도 Record도 없다 — 있으면 admin-canonical-mirrors의 대장이 필요하다).
    expect((module.match(/^export /gm) ?? []).length, "내보내는 값은 하나다").toBe(1);
    expect(codeOnly(module)).not.toMatch(/=\s*[[{]/);
    expect(module, "스크레이프 단위가 아닌 이유가 값으로 적혀 있다").toContain("scrapeConstantTables");
  });

  /**
   * ⚠️ **인접 계약과의 충돌을 값으로 남긴다.**
   *
   * ADM-127의 계약(`src/admin-categories-users-lookup.test.ts` — *"hides the edit controls from
   * non-admin roles"*)이 **그 화면의 소스에서** 캡션 문장을 찾는다. 그 파일은 이 트랙의 무접촉
   * 대상이라, 캡션이 상수로 올라간 뒤에도 문장을 잃지 않도록 카테고리 화면에 **주석 인용**을
   * 남겼다. 인용은 화면에 서지 않으므로(위 사본 단언이 코드만 센다) 사본이 아니고, 아래 단언이
   * 인용과 상수가 갈리는 순간을 잡는다.
   */
  it("카테고리 화면의 주석 인용이 상수와 한 글자도 다르지 않다", () => {
    const page = readSource("app/categories/page.tsx");
    // 주석만 긁는다(코드는 위 사본 단언이 이미 비어 있음을 보장한다). 줄바꿈·들여쓰기는
    // 한 칸으로 접어 비교한다 — 인용이 두 줄에 걸쳐 있어도 문장은 같아야 한다.
    const comments = [...page.matchAll(/\/\*([\s\S]*?)\*\//g), ...page.matchAll(/\/\/([^\n]*)/g)]
      .map((match) => match[1])
      .join("\n")
      .replace(/\s+/g, " ");
    expect(comments, "카테고리 화면의 주석에 캡션 인용이 남아 있다").toContain(ADMIN_WRITE_ROLE_NOTICE);
    // 그리고 그 인용은 화면에 서는 사본이 아니다(코드에는 상수 호출만 있다).
    expect(codeOnly(page)).not.toContain(ADMIN_WRITE_ROLE_NOTICE);
    // 그리고 ADM-127의 계약이 찾는 조각이 그 인용 안에 그대로 있다.
    expect(page).toContain("수정은 관리자(admin) 권한이 필요해요");
  });
});

describe("내비 게이트와 컨트롤 게이트는 서로 다른 축이다 (라운드 77 트랙 D ⓓ)", () => {
  /** `NAV_ITEMS`에서 `roles`가 붙은 href 전수(소스 파싱 — 셸은 무접촉이다). */
  function navRoleGatedHrefs(): string[] {
    const shell = readSource("src/components/AdminShell.tsx");
    const block = /const NAV_ITEMS: Array<\{[^}]*\}> = \[([\s\S]*?)\n\];/.exec(shell)?.[1];
    expect(block, "AdminShell.tsx에서 NAV_ITEMS를 찾지 못했어요").toBeTruthy();
    return [...block!.matchAll(/\{ href: "([^"]+)"[^}]*roles: \[[^\]]*\][^}]*\}/g)].map((match) => match[1]).sort();
  }

  it("내비가 감추는 화면은 셋 그대로다 (NAV_ITEMS의 roles 무변경)", () => {
    expect(navRoleGatedHrefs()).toEqual(["/audit-logs", "/users", "/users-lookup"]);
  });

  it("컨트롤을 감추는 다섯은 내비에서 감추지 않는다 — 읽는 것이 분석가의 일이다", () => {
    const navGated = navRoleGatedHrefs();
    const controlGated = Object.values(ADMIN_WRITE_SCREENS).filter((screen) => screen.kind === "control");
    expect(controlGated).toHaveLength(5);
    for (const screen of controlGated) {
      expect(navGated, `${screen.href}는 내비에서 감추지 않는다`).not.toContain(screen.href);
      expect(readSource("src/components/AdminShell.tsx"), `${screen.href}가 내비에 있다`).toContain(
        `href: "${screen.href}"`
      );
    }
    // 반대 방향: 내비가 감추는 셋은 컨트롤 게이트의 축이 아니다(화면 전체가 admin 전용이거나
    // 쓰기가 아예 없다).
    const controlHrefs = controlGated.map((screen) => screen.href);
    for (const href of navGated) expect(controlHrefs, `${href}`).not.toContain(href);
  });
});
