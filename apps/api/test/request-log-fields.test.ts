import { EventEmitter } from "node:events";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MASKED_SECRET_PATHS,
  MAX_LOGGABLE_REQUEST_ID_LENGTH,
  SECRET_CANDIDATE_PARAM_NAME,
  UNMASKED_SECRET_CANDIDATE_PATHS,
  isSecretCandidateParamName,
  loggablePath,
  loggableRequestId
} from "../src/common/logging/loggable-path";
import { REQUEST_LOG_FIELDS, requestLoggerMiddleware } from "../src/common/logging/request-logger.middleware";

/**
 * 라운드 74 트랙 A(GAP-074 #1) — **서버가 남기는 줄을 세는 계약.** DB 불필요.
 *
 * 정찰 노트가 센 것: 가족 초대 토큰(48자 hex — DB에는 sha256 해시만 저장한다)이
 * `request-logger.middleware.ts`의 `path: req.path`를 타고 **평문으로** stdout에 쌓였고
 * (성공 200이라 level `info`, 기본 LOG_LEVEL에서 빠짐없이 남는다), 같은 모듈의 주석은
 * *"never includes … any auth material"*을 약속하고 있었으며, **그 줄을 세는 테스트는
 * 저장소 전체에서 0건**이었다. 약속이 주석에만 있으면 그것은 약속이 아니다.
 *
 * 이 파일이 세는 넷:
 *  ⓐ **필드 집합이 값이다** — 실제로 나간 줄의 키가 `REQUEST_LOG_FIELDS`와 **정확히** 일치할 것
 *    (부정 단언: 그 밖의 키 0건).
 *  ⓑ **전수 스윕** — `apps/api/src/**`의 라우트 데코레이터를 전량 긁어, 비밀값을 담을 수 있는
 *    경로 매개변수를 가진 라우트가 **예외 없이** 마스킹 목록이나 이유가 붙은 예외 목록에 있을 것.
 *  ⓒ **부정 단언** — 로그용 경로에 48자 hex가 **도달 불가**할 것(부분 마스킹도 없다).
 *  ⓓ 마스킹 뒤에도 운영자가 **경로 모양으로 라우트를 식별**할 수 있을 것.
 *
 * 그리고 이 트랙이 **바꾸지 않기로 한 것**도 함께 센다: `LOG_LEVEL` 판정 · `NODE_ENV=test`
 * 침묵 규칙 · `requestId`·`userId` 필드.
 */

const API_DIR = join(__dirname, "..");
const SRC_DIR = join(API_DIR, "src");

/**
 * 요청이 들고 오지만 **로그에는 절대 나가면 안 되는** 값들. 픽스처가 이 값들을 실제로 실어
 * 보내므로, 로거가 헤더·질의·본문 중 하나라도 직렬화하기 시작하면 줄 원문에서 잡힌다.
 */
const SENSITIVE_HEADER_VALUES = {
  authorization: "eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaaaa.bbbbbbbbbbbb",
  cookie: "sid-9c1f4e7a2b",
  userAgent: "WooriAI/1.0 (test-fixture-user-agent)",
  query: "검색어-원문",
  body: "hunter2-평문비밀번호"
} as const;

/** 초대 토큰과 **같은 방식으로** 만든 값(household-runtime.service.ts의 randomBytes(24)). */
function sampleInviteToken(): string {
  return randomBytes(24).toString("hex");
}

// ---------------------------------------------------------------------------
// ⓐ 로거가 직렬화하는 필드 집합
// ---------------------------------------------------------------------------

type CapturedRequest = {
  path: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  userId?: string;
  adminUserId?: string;
  logLevel?: string | null;
};

/** 요청 로거를 실제로 한 번 돌리고 stdout으로 나간 **줄 원문**을 돌려준다(안 나갔으면 null). */
function captureLogLine(options: CapturedRequest): string | null {
  const previousLevel = process.env.LOG_LEVEL;
  if (options.logLevel === null) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = options.logLevel ?? "debug";
  }

  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    lines.push(String(line));
  });

  try {
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = options.statusCode ?? 200;
    const req = {
      method: options.method ?? "GET",
      path: options.path,
      url: options.path,
      // 실제 요청이 들고 오는 것들을 그대로 채운다 — 이 값들이 로그 줄에 나타나는 순간이
      // "auth material 0건" 약속이 깨지는 순간이다.
      headers: {
        authorization: `Bearer ${SENSITIVE_HEADER_VALUES.authorization}`,
        cookie: `wooriai_admin_session=${SENSITIVE_HEADER_VALUES.cookie}`,
        "user-agent": SENSITIVE_HEADER_VALUES.userAgent,
        ...(options.requestId ? { "x-request-id": options.requestId } : {})
      },
      query: { q: SENSITIVE_HEADER_VALUES.query },
      body: { password: SENSITIVE_HEADER_VALUES.body },
      ...(options.userId ? { user: { id: options.userId } } : {}),
      ...(options.adminUserId ? { adminUser: { id: options.adminUserId } } : {})
    };

    const next = vi.fn();
    // 미들웨어의 실제 시그니처(express Request/Response)를 테스트 픽스처로 채운다.
    requestLoggerMiddleware()(req as never, res as never, next as never);
    expect(next).toHaveBeenCalledTimes(1);
    res.emit("finish");
  } finally {
    spy.mockRestore();
    if (previousLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previousLevel;
    }
  }

  expect(lines.length).toBeLessThanOrEqual(1);
  return lines[0] ?? null;
}

function captureLogEntry(options: CapturedRequest): Record<string, unknown> {
  const line = captureLogLine(options);
  expect(line, "요청 로그 한 줄이 나와야 해요").not.toBeNull();
  return JSON.parse(line as string) as Record<string, unknown>;
}

describe("요청 로그 필드 집합 (라운드 74 A 계약 ⓐ)", () => {
  it("무인증 요청의 키가 REQUEST_LOG_FIELDS(userId 제외)와 정확히 일치한다", () => {
    const entry = captureLogEntry({ path: "/api/v1/health", requestId: "req-1" });
    expect(Object.keys(entry).sort()).toEqual(
      ["ts", "level", "requestId", "method", "path", "status", "durationMs"].sort()
    );
  });

  it("인증 요청에만 userId가 붙고, 그때도 목록 밖의 키는 0건이다", () => {
    const entry = captureLogEntry({ path: "/api/v1/me", requestId: "req-2", userId: "user-1" });
    expect(Object.keys(entry).sort()).toEqual([...REQUEST_LOG_FIELDS].sort());
    expect(entry.userId).toBe("user-1");

    const adminEntry = captureLogEntry({
      path: "/api/v1/admin/users",
      requestId: "req-3",
      adminUserId: "admin-1"
    });
    expect(adminEntry.userId).toBe("admin-1");
    expect(Object.keys(adminEntry).sort()).toEqual([...REQUEST_LOG_FIELDS].sort());
  });

  it("목록 밖의 키가 단 하나도 나가지 않는다 (부정 단언)", () => {
    const allowed = new Set<string>(REQUEST_LOG_FIELDS);
    for (const options of [
      { path: "/api/v1/health", requestId: "r1" },
      { path: "/api/v1/expenses", method: "POST", statusCode: 201, requestId: "r2", userId: "u" },
      { path: "/api/v1/expenses", method: "POST", statusCode: 400, requestId: "r3", userId: "u" },
      { path: "/api/v1/expenses", method: "GET", statusCode: 500, requestId: "r4", userId: "u" }
    ]) {
      const entry = captureLogEntry(options);
      const extra = Object.keys(entry).filter((key) => !allowed.has(key));
      expect(extra, `요청 로그에 승인되지 않은 키가 나갔어요: ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("요청이 실어 온 헤더·질의·본문 값이 줄 원문 어디에도 없다 (auth material 0건)", () => {
    const line = captureLogLine({ path: "/api/v1/expenses", requestId: "r-sensitive", userId: "u" });
    expect(line).not.toBeNull();
    for (const [name, value] of Object.entries(SENSITIVE_HEADER_VALUES)) {
      expect(line as string, `요청 로그에 ${name} 값이 실려 나갔어요`).not.toContain(value);
    }
  });

  it("헤더·본문·질의 문자열·인증 자료를 뜻하는 키는 아예 존재하지 않는다", () => {
    const entry = captureLogEntry({ path: "/api/v1/health", requestId: "r5", userId: "u" });
    for (const forbidden of [
      "headers",
      "header",
      "body",
      "query",
      "params",
      "authorization",
      "cookie",
      "cookies",
      "token",
      "password",
      "ip",
      "userAgent",
      "user-agent"
    ]) {
      expect(entry).not.toHaveProperty(forbidden);
    }
  });

  it("REQUEST_LOG_FIELDS 자체에 중복이 없고 requestId·userId가 그대로 있다 (필드 불변)", () => {
    expect(new Set(REQUEST_LOG_FIELDS).size).toBe(REQUEST_LOG_FIELDS.length);
    // incident-response.md §초동 2가 이 둘로 추적하라고 적어 뒀다 — 사라지면 그 문장이 거짓이 된다.
    expect(REQUEST_LOG_FIELDS).toContain("requestId");
    expect(REQUEST_LOG_FIELDS).toContain("userId");
  });
});

describe("LOG_LEVEL 판정과 NODE_ENV=test 침묵 규칙 (라운드 74 A 무변경 대상)", () => {
  it("NODE_ENV=test에서 LOG_LEVEL이 없으면 한 줄도 나가지 않는다", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      expect(captureLogLine({ path: "/api/v1/health", requestId: "r6", logLevel: null })).toBeNull();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it("LOG_LEVEL=error에서 200은 걸러지고 500은 남는다", () => {
    expect(captureLogLine({ path: "/api/v1/health", logLevel: "error" })).toBeNull();
    const line = captureLogLine({ path: "/api/v1/health", statusCode: 500, logLevel: "error" });
    expect(line).not.toBeNull();
    expect(JSON.parse(line as string).level).toBe("error");
  });

  it("상태 코드별 level 판정이 그대로다 (200 info · 4xx warn · 5xx error)", () => {
    expect(captureLogEntry({ path: "/x", statusCode: 200 }).level).toBe("info");
    expect(captureLogEntry({ path: "/x", statusCode: 404 }).level).toBe("warn");
    expect(captureLogEntry({ path: "/x", statusCode: 500 }).level).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// ⓑ 라우트 데코레이터 전수 스윕
// ---------------------------------------------------------------------------

type SweptRoute = {
  /** 전역 프리픽스까지 붙인 라우트 모양(`/api/v1/invites/:token`). */
  readonly path: string;
  readonly method: string;
  readonly file: string;
};

/**
 * 데코레이터를 세기 전에 주석을 지운다. 산문 안에서 라우트를 **인용하는** 자리가 실제로 있고
 * (`onboarding/items-catalog.service.ts`가 `@Controller("r")`을 설명한다), 그것을 라우트로
 * 세면 이 스윕이 존재하지 않는 경로를 판정하게 된다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(fullPath));
      continue;
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts") || entry.name.endsWith(".test.ts")) continue;
    found.push(fullPath);
  }
  return found.sort();
}

/** 전역 프리픽스와 그 예외를 `bootstrap.ts`에서 **파생**한다(손으로 다시 적지 않는다). */
function globalPrefixConfig(): { prefix: string; excluded: Set<string> } {
  const source = readFileSync(join(SRC_DIR, "bootstrap.ts"), "utf8");
  const match = /setGlobalPrefix\(\s*"([^"]+)"\s*,\s*\{\s*exclude:\s*\[([^\]]*)\]/.exec(source);
  expect(match, "bootstrap.ts의 setGlobalPrefix 호출을 읽지 못했어요").not.toBeNull();
  const [, prefix, excludeList] = match as RegExpExecArray;
  const excluded = new Set([...excludeList.matchAll(/"([^"]*)"/g)].map((entry) => entry[1]));
  return { prefix, excluded };
}

/**
 * Nest가 라우트를 만드는 **HTTP 메서드 데코레이터 전부**.
 *
 * 라운드 74 적대적 리뷰 A-2: 종전 스윕은 다섯(`Get`·`Post`·`Put`·`Patch`·`Delete`)만 봤다.
 * `@All`·`@Head`·`@Options`·`@Search`는 Nest가 똑같이 라우트로 만드는데도 이 그물 밖이라,
 * 그중 하나로 `:token` 라우트를 하나 더 만들면 **판정 없이** 지나갔다 — "전수 스윕"이라는
 * 이름이 사실이 아니었던 셈이다. 목록을 여기 값으로 두고, 아래 패리티 단언이 이 목록과
 * 소스에서 센 원시 개수를 대조한다(정규식이 조용히 늙는 것을 그 단언이 잡는다).
 */
const ROUTE_METHOD_DECORATORS = [
  "Get",
  "Post",
  "Put",
  "Patch",
  "Delete",
  "All",
  "Head",
  "Options",
  "Search"
] as const;

/**
 * 하나의 데코레이터 인자에서 경로들을. 배열 인자(`@Get(["a", "b"])`)는 **라우트 둘**이고,
 * 인자가 없으면 컨트롤러 경로 자체다.
 */
function decoratorPaths(argument: string): string[] {
  const trimmed = argument.trim();
  if (trimmed.length === 0) return [""];
  const quoted = [...trimmed.matchAll(/"([^"]*)"|'([^']*)'/g)].map((match) => match[1] ?? match[2] ?? "");
  return quoted.length > 0 ? quoted : [""];
}

/** 스윕이 세는 것과 **같은 규칙**으로 소스에서 데코레이터 출현만 센다(패리티의 반대편). */
function rawDecoratorCount(): number {
  const pattern = new RegExp(`@(?:${ROUTE_METHOD_DECORATORS.join("|")})\\s*\\(`, "g");
  return sourceFiles(SRC_DIR).reduce(
    (total, file) => total + [...stripComments(readFileSync(file, "utf8")).matchAll(pattern)].length,
    0
  );
}

function sweepRoutes(): SweptRoute[] {
  const { prefix, excluded } = globalPrefixConfig();
  const found: SweptRoute[] = [];

  for (const file of sourceFiles(SRC_DIR)) {
    const source = stripComments(readFileSync(file, "utf8"));
    const relativePath = relative(API_DIR, file).split(sep).join("/");
    let controllerPrefix: string | null = null;
    // 인자 자리를 통째로 잡는다(문자열 하나 · 배열 · 빈 인자를 한 패턴으로 — 배열 인자는
    // `decoratorPaths`가 라우트 여럿으로 편다).
    const decorator = new RegExp(
      `@(Controller|${ROUTE_METHOD_DECORATORS.join("|")})\\s*\\(([^)]*)\\)`,
      "g"
    );
    let match: RegExpExecArray | null;

    while ((match = decorator.exec(source)) !== null) {
      const [, kind, rawArgument] = match;
      if (kind === "Controller") {
        controllerPrefix = decoratorPaths(rawArgument)[0];
        continue;
      }
      expect(
        controllerPrefix,
        `${relativePath}: @Controller 밖에서 @${kind} 데코레이터를 찾았어요 — 스윕이 이 라우트의 경로를 모릅니다`
      ).not.toBeNull();
      for (const argument of decoratorPaths(rawArgument)) {
        const joined = [controllerPrefix, argument].filter((part) => part && part.length > 0).join("/");
        const path = excluded.has(joined) ? `/${joined}` : `/${prefix}/${joined}`;
        found.push({ path, method: kind.toUpperCase(), file: relativePath });
      }
    }
  }

  return found;
}

/** 경로에서 매개변수 이름만(`/api/v1/invites/:token/accept` → `["token"]`). */
function pathParams(path: string): string[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => segment.slice(1));
}

let cachedRoutes: SweptRoute[] | null = null;

function routes(): SweptRoute[] {
  cachedRoutes ??= sweepRoutes();
  return cachedRoutes;
}

describe("라우트 전수 스윕 (라운드 74 A 계약 ⓑ)", () => {
  it("스윕이 실제로 라우트를 세고 있다 (0건 통과 방지)", () => {
    expect(routes().length).toBeGreaterThanOrEqual(90);
    const names = [...new Set(routes().flatMap((route) => pathParams(route.path)))];
    // 오늘의 매개변수 어휘에 이 넷이 있어야 스윕이 비밀값 후보를 실제로 훑고 있다는 뜻이다.
    for (const expected of ["token", "code", "key", "childId"]) {
      expect(names, `스윕이 :${expected}를 찾지 못했어요 — 파서가 깨졌을 수 있어요`).toContain(expected);
    }
  });

  it("비밀값을 담을 수 있는 경로 매개변수가 예외 없이 마스킹 목록이나 예외 목록에 있다", () => {
    const masked = new Set(MASKED_SECRET_PATHS.map((rule) => rule.routeShape));
    const exempt = new Set(Object.keys(UNMASKED_SECRET_CANDIDATE_PATHS));

    const unjudged = routes()
      .filter((route) => pathParams(route.path).some(isSecretCandidateParamName))
      .filter((route) => !masked.has(route.path) && !exempt.has(route.path))
      .map((route) => `${route.method} ${route.path} (${route.file})`);

    expect(
      unjudged,
      "비밀값을 담을 수 있는 경로 매개변수가 판정 없이 남아 있어요. " +
        "src/common/logging/loggable-path.ts의 MASKED_SECRET_PATHS에 넣어 가리거나, " +
        "가리지 않는다면 UNMASKED_SECRET_CANDIDATE_PATHS에 **이유와 함께** 적어 주세요: " +
        unjudged.join(" · ")
    ).toEqual([]);
  });

  it("오늘의 판정 수가 값과 일치한다 (마스킹 셋 · 예외 둘)", () => {
    const candidates = routes().filter((route) => pathParams(route.path).some(isSecretCandidateParamName));
    expect(candidates.map((route) => route.path).sort()).toEqual(
      [
        "/api/v1/admin/disclosures/:key",
        "/api/v1/invites/:token",
        "/api/v1/invites/:token/accept",
        "/api/v1/r/:code",
        "/invite/:token"
      ].sort()
    );
    expect(MASKED_SECRET_PATHS).toHaveLength(3);
    expect(Object.keys(UNMASKED_SECRET_CANDIDATE_PATHS)).toHaveLength(2);
  });

  it("마스킹 목록과 예외 목록에 실재하지 않는 라우트가 남아 있지 않다 (양방향)", () => {
    const swept = [...new Set(routes().map((route) => route.path))];
    for (const rule of MASKED_SECRET_PATHS) {
      expect(swept, `마스킹 목록의 ${rule.routeShape}에 해당하는 라우트가 없어요`).toContain(rule.routeShape);
    }
    for (const path of Object.keys(UNMASKED_SECRET_CANDIDATE_PATHS)) {
      expect(swept, `예외 목록의 ${path}에 해당하는 라우트가 없어요`).toContain(path);
    }
  });

  it("마스킹 목록의 매개변수 이름이 그 라우트의 실제 매개변수다", () => {
    for (const rule of MASKED_SECRET_PATHS) {
      expect(pathParams(rule.routeShape)).toContain(rule.paramName);
      expect(isSecretCandidateParamName(rule.paramName)).toBe(true);
    }
  });

  it("예외는 이유가 값으로 남아 있을 때만 예외다 (빈 문자열 금지)", () => {
    for (const [path, reason] of Object.entries(UNMASKED_SECRET_CANDIDATE_PATHS)) {
      expect(reason.trim().length, `${path}의 예외 사유가 비어 있어요`).toBeGreaterThan(40);
    }
    for (const rule of MASKED_SECRET_PATHS) {
      expect(rule.reason.trim().length, `${rule.routeShape}의 마스킹 사유가 비어 있어요`).toBeGreaterThan(20);
    }
  });

  /**
   * 라운드 74 적대적 리뷰 A-2 — **"전수"가 사실인지 값으로 센다.**
   *
   * 스윕의 정규식은 조용히 늙는다: 종전에는 다섯 메서드만 보고 `@All`·`@Head`·`@Options`·
   * `@Search`를 지나쳤고, 배열 인자(`@Get(["a", "b"])`)를 라우트 하나로 셌다. 그래서 이 절은
   * **같은 소스를 두 방식으로 센다** — 스윕이 모은 수와, 데코레이터 출현만 원시로 센 수.
   * 둘이 갈리는 순간은 파서가 뭔가를 놓치기 시작한 순간이다.
   */
  it("데코레이터 커버리지: 스윕 수집 수가 소스의 원시 데코레이터 수와 일치한다 (패리티)", () => {
    const raw = rawDecoratorCount();
    expect(raw, "라우트 데코레이터를 하나도 세지 못했어요 — 파서가 깨졌을 수 있어요").toBeGreaterThanOrEqual(90);

    // 배열 인자는 데코레이터 하나가 라우트 여럿이므로, 수집 수는 원시 수보다 작을 수 없다.
    expect(routes().length).toBeGreaterThanOrEqual(raw);
    const arrayArgumentExtras = routes().length - raw;
    // 오늘 이 저장소에는 배열 path 데코레이터가 0건이다 — 생기면 이 줄이 먼저 빨개지고,
    // 만든 사람이 "그 데코레이터가 만드는 라우트가 몇 개인가"에 답하게 된다.
    expect(arrayArgumentExtras).toBe(0);

    // 그리고 목록 자체가 Nest의 메서드 데코레이터 전부를 담는다(다섯에서 아홉으로).
    expect([...ROUTE_METHOD_DECORATORS].sort()).toEqual(
      ["All", "Delete", "Get", "Head", "Options", "Patch", "Post", "Put", "Search"].sort()
    );
    // 실제로 쓰이는 메서드는 그 목록의 부분집합이다(스윕이 목록 밖 낱말을 지어내지 않는다).
    const swept = new Set(routes().map((route) => route.method));
    for (const method of swept) {
      expect(
        ROUTE_METHOD_DECORATORS.map((name) => name.toUpperCase()),
        `${method}가 데코레이터 목록 밖이에요`
      ).toContain(method);
    }
  });

  it("배열 path·인자 없는 데코레이터를 파서가 실제로 편다 (파서 단위 확인)", () => {
    // 위 패리티는 오늘 배열 인자가 0건이라 그 갈래를 밟지 않는다 — 파서 쪽을 직접 센다.
    expect(decoratorPaths('["a", "b"]')).toEqual(["a", "b"]);
    expect(decoratorPaths("'single'")).toEqual(["single"]);
    expect(decoratorPaths('"double"')).toEqual(["double"]);
    expect(decoratorPaths("")).toEqual([""]);
    expect(decoratorPaths("   ")).toEqual([""]);
  });

  it("판정 규칙이 조용히 좁아지지 않는다", () => {
    // `test`를 반복 호출하므로 g 플래그가 붙으면 lastIndex 때문에 한 건 걸러 통과한다.
    expect(SECRET_CANDIDATE_PARAM_NAME.global).toBe(false);
    for (const name of ["token", "inviteToken", "code", "redirectCode", "key", "apiKey", "secret", "passwordHash"]) {
      expect(isSecretCandidateParamName(name), `${name}이 비밀값 후보에서 빠졌어요`).toBe(true);
    }
    // 반대로 식별자는 잡지 않는다 — 잡으면 예외 표가 id 목록이 되고 판정이 의미를 잃는다.
    for (const name of ["childId", "expenseId", "householdId", "memberId", "importJobId", "rowId", "id"]) {
      expect(isSecretCandidateParamName(name)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// ⓒ 로그용 경로에 48자 hex가 도달 불가 · ⓓ 라우트 식별 가능
// ---------------------------------------------------------------------------

/** 라우트 모양의 매개변수 자리에 실제 값을 끼운다. */
function fillParams(routeShape: string, value: string): string {
  return routeShape
    .split("/")
    .map((segment) => (segment.startsWith(":") ? value : segment))
    .join("/");
}

describe("로그용 경로 마스킹 (라운드 74 A 계약 ⓒ·ⓓ)", () => {
  it("초대 토큰이 어떤 모양으로 와도 로그용 경로에 도달하지 못한다", () => {
    for (const rule of MASKED_SECRET_PATHS) {
      const token = sampleInviteToken();
      expect(token).toMatch(/^[0-9a-f]{48}$/);
      const actualPath = fillParams(rule.routeShape, token);

      for (const variant of [
        actualPath,
        `${actualPath}/`,
        actualPath.toUpperCase(),
        `${actualPath}?utm=1`,
        `${actualPath}#fragment`
      ]) {
        const logged = loggablePath(variant);
        expect(logged, `${variant}가 가려지지 않았어요`).toBe(rule.routeShape);
        expect(logged).not.toContain(token);
        expect(logged).not.toContain(token.toUpperCase());
        // 부분 마스킹 금지: 앞자리 조각도 남기지 않는다(상관관계 추적을 열어 준다).
        expect(logged).not.toContain(token.slice(0, 4));
        expect(logged).not.toMatch(/[0-9a-f]{12,}/i);
      }
    }
  });

  it("라우트 표면 전체에서 48자 hex가 로그용 경로에 도달하는 자리는 예외 목록뿐이다", () => {
    const exempt = new Set(Object.keys(UNMASKED_SECRET_CANDIDATE_PATHS));
    const leaking: string[] = [];

    for (const route of routes()) {
      if (!pathParams(route.path).some(isSecretCandidateParamName)) continue;
      const token = sampleInviteToken();
      const logged = loggablePath(fillParams(route.path, token));
      if (logged.includes(token) && !exempt.has(route.path)) {
        leaking.push(`${route.method} ${route.path} (${route.file})`);
      }
    }

    expect(leaking, `48자 hex가 그대로 로그에 남는 라우트가 있어요: ${leaking.join(" · ")}`).toEqual([]);
  });

  it("가린 뒤에도 세 라우트가 서로 다른 줄로 식별된다", () => {
    const shapes = MASKED_SECRET_PATHS.map((rule) => loggablePath(fillParams(rule.routeShape, sampleInviteToken())));
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(shapes).toEqual(["/invite/:token", "/api/v1/invites/:token", "/api/v1/invites/:token/accept"]);
    // 조회와 수락이 한 줄로 뭉개지지 않는다 — 운영자가 초대 흐름의 어디에서 멈췄는지 안다.
    const token = sampleInviteToken();
    expect(loggablePath(`/api/v1/invites/${token}`)).not.toBe(
      loggablePath(`/api/v1/invites/${token}/accept`)
    );
  });

  it("공개 공유 코드(/r/:code)는 값 그대로 남는다 (예외가 실제로 예외다)", () => {
    const code = randomBytes(6).toString("hex");
    expect(loggablePath(`/api/v1/r/${code}`)).toBe(`/api/v1/r/${code}`);
  });

  it("가리는 자리 말고는 아무 경로도 바꾸지 않는다", () => {
    const householdId = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    for (const path of [
      "/api/v1/health",
      "/api/v1/invites",
      `/api/v1/households/${householdId}/invites`,
      `/api/v1/households/${householdId}/invites/abc-123`,
      "/api/v1/admin/disclosures/coupang",
      "/invite",
      "/invited/x"
    ]) {
      expect(loggablePath(path)).toBe(path);
    }
  });

  it("규칙이 서로 겹치지 않고, 상태를 들고 다니지 않는다", () => {
    for (const rule of MASKED_SECRET_PATHS) {
      // `g` 플래그가 붙으면 `test`가 lastIndex를 들고 다녀 두 번째 호출부터 어긋난다.
      expect(rule.pattern.global, `${rule.routeShape}의 패턴에 g 플래그가 붙었어요`).toBe(false);
      const sample = fillParams(rule.routeShape, sampleInviteToken());
      const matching = MASKED_SECRET_PATHS.filter((candidate) => candidate.pattern.test(sample));
      expect(matching, `${sample}에 규칙 둘 이상이 걸려요`).toHaveLength(1);
      // 같은 입력을 두 번 물어도 같은 답이다.
      expect(loggablePath(sample)).toBe(loggablePath(sample));
    }
  });

  it("빈 값·비정상 입력에도 터지지 않는다", () => {
    expect(loggablePath("")).toBe("");
    expect(loggablePath("/")).toBe("/");
    expect(loggablePath(undefined as unknown as string)).toBe("");
  });

  /**
   * 라운드 74 적대적 리뷰 A-1 — **슬래시 하나로 마스킹을 지나가지 못한다.**
   *
   * 규칙 셋은 정확한 모양(`^\/invite\/…`)을 보는데 Express의 라우팅은 이어진 슬래시에 관대하다.
   * 그래서 `//invite/<토큰>`·`/api/v1//invites/<토큰>`은 어느 패턴에도 걸리지 않아 **평문으로**
   * 남았다(404가 되는 조합도 있지만 404는 `warn`이라 기본 LOG_LEVEL에서 더 잘 남는다).
   */
  it("이어진 슬래시로 마스킹을 우회하지 못한다", () => {
    for (const rule of MASKED_SECRET_PATHS) {
      const token = sampleInviteToken();
      const actualPath = fillParams(rule.routeShape, token);
      for (const variant of [
        `/${actualPath}`,
        actualPath.replace("/", "//"),
        actualPath.replace(/\//g, "//"),
        `${actualPath}//`,
        `/${actualPath}?utm=1`
      ]) {
        const logged = loggablePath(variant);
        expect(logged, `${variant}가 가려지지 않았어요`).toBe(rule.routeShape);
        expect(logged).not.toContain(token);
        expect(logged).not.toContain(token.slice(0, 4));
      }
    }
  });

  it("가리지 않는 경로도 슬래시가 정규화된 한 모양으로 남는다 (줄이 흩어지지 않게)", () => {
    expect(loggablePath("//api/v1//health")).toBe("/api/v1/health");
    expect(loggablePath("/api/v1/health")).toBe("/api/v1/health");
    // 공개 공유 코드는 여전히 값 그대로다(예외가 예외로 남는다).
    const code = randomBytes(6).toString("hex");
    expect(loggablePath(`/api/v1//r/${code}`)).toBe(`/api/v1/r/${code}`);
  });
});

/**
 * 라운드 74 적대적 리뷰 A-3 — **`requestId`는 "헤더를 로그하지 않는다"의 명시적 예외다.**
 *
 * 그 한 필드만 클라이언트가 보낸 헤더에서 온다. 남기는 것 자체는 결정이고 문서가 그 값으로
 * 추적하라고 적어 두었지만(`incident-response.md` §초동 2), **아무나 보낼 수 있는 값**이라
 * 길이·문자셋을 지나야 한다: 줄바꿈·따옴표가 섞이면 줄 단위로 읽는 운영 절차가 흐려지고,
 * 긴 헤더 한 벌이면 회전하는 로그 창에서 조사에 필요한 옛 줄이 밀려난다.
 */
describe("requestId는 검증을 지나 남는다 (클라이언트 제어 값의 유일한 예외)", () => {
  it("정상적인 모양은 그대로 남는다 (UUID · nginx $request_id · traceparent)", () => {
    for (const value of [
      "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
      "9c1f4e7a2b3d4e5f6a7b8c9d0e1f2a3b",
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      "req-1"
    ]) {
      expect(loggableRequestId(value), value).toBe(value);
      expect(captureLogEntry({ path: "/api/v1/health", requestId: value }).requestId).toBe(value);
    }
    expect(MAX_LOGGABLE_REQUEST_ID_LENGTH).toBe(128);
  });

  it("상한을 넘거나 문자셋 밖이면 남기지 않는다 (자르지 않는다 — 잘린 id는 새 거짓말이다)", () => {
    const tooLong = "a".repeat(MAX_LOGGABLE_REQUEST_ID_LENGTH + 1);
    expect(loggableRequestId(tooLong)).toBeUndefined();
    expect(loggableRequestId("a".repeat(MAX_LOGGABLE_REQUEST_ID_LENGTH))).toHaveLength(
      MAX_LOGGABLE_REQUEST_ID_LENGTH
    );

    for (const bad of [
      'req"1',
      "req\n{\"level\":\"info\"}",
      "req 1",
      "req\t1",
      "req/1",
      "req ",
      "요청-1",
      "",
      undefined,
      null,
      42,
      {}
    ]) {
      expect(loggableRequestId(bad as unknown), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it("헤더가 배열로 와도 첫 값 하나만, 그것도 검증을 지나 남는다", () => {
    expect(loggableRequestId(["req-1", "req-2"])).toBe("req-1");
    expect(loggableRequestId(['req"1', "req-2"])).toBeUndefined();
  });

  it("거절된 값은 줄 원문 어디에도 나타나지 않고, 나머지 필드는 그대로다", () => {
    const injected = 'x"}\n{"level":"error","path":"/spoofed';
    const line = captureLogLine({ path: "/api/v1/health", requestId: injected });
    expect(line).not.toBeNull();
    expect(line as string).not.toContain("spoofed");
    // 한 줄이 여전히 **한 줄**이고 그대로 파싱된다(주입이 로그 형식을 흔들지 못한다).
    expect((line as string).split("\n")).toHaveLength(1);
    const entry = JSON.parse(line as string) as Record<string, unknown>;
    expect(entry.requestId).toBeUndefined();
    expect(entry.path).toBe("/api/v1/health");
    expect(Object.keys(entry).every((key) => (REQUEST_LOG_FIELDS as readonly string[]).includes(key))).toBe(true);
  });

  it("미들웨어가 헤더 값을 다시 그대로 옮겨 적기 시작하면 잡힌다 (소스 회귀 가드)", () => {
    const source = readFileSync(join(SRC_DIR, "common", "logging", "request-logger.middleware.ts"), "utf8");
    expect(source).toContain("loggableRequestId(req.headers[\"x-request-id\"])");
    // 종전의 손배선(`Array.isArray(requestIdHeader) ? … : …`)이 되살아나지 않는다.
    expect(source).not.toContain("Array.isArray(requestIdHeader)");
  });
});

// ---------------------------------------------------------------------------
// 미들웨어가 실제로 그 경로를 쓴다
// ---------------------------------------------------------------------------

describe("요청 로거가 마스킹된 경로를 쓴다", () => {
  it("초대 랜딩 요청의 로그 한 줄 어디에도 토큰이 없다", () => {
    const token = sampleInviteToken();
    const line = captureLogLine({ path: `/invite/${token}`, requestId: "req-invite" });
    expect(line).not.toBeNull();
    expect(line as string).not.toContain(token);
    expect(line as string).not.toContain(token.slice(0, 4));
    expect(JSON.parse(line as string).path).toBe("/invite/:token");
  });

  it("초대 수락(인증 요청)도 마찬가지이고 requestId·userId는 그대로다", () => {
    const token = sampleInviteToken();
    const entry = captureLogEntry({
      path: `/api/v1/invites/${token}/accept`,
      method: "POST",
      requestId: "req-accept",
      userId: "user-9"
    });
    expect(entry.path).toBe("/api/v1/invites/:token/accept");
    expect(entry.requestId).toBe("req-accept");
    expect(entry.userId).toBe("user-9");
  });

  it("미들웨어가 원시 경로를 다시 쓰기 시작하면 잡힌다 (소스 회귀 가드)", () => {
    const middlewarePath = join(SRC_DIR, "common", "logging", "request-logger.middleware.ts");
    expect(existsSync(middlewarePath)).toBe(true);
    const source = readFileSync(middlewarePath, "utf8");
    expect(source).toContain('from "./loggable-path"');
    expect(source).toContain("loggablePath(");
    // `path: req.path ?? req.url` — 이 라운드가 없앤 그 줄이 되살아나는 순간.
    expect(source).not.toMatch(/path:\s*req\.(path|url)/);
  });
});

// ---------------------------------------------------------------------------
// 침묵 규칙이 남긴 뒷정리
// ---------------------------------------------------------------------------

describe("테스트가 환경을 되돌린다", () => {
  let before: string | undefined;

  beforeEach(() => {
    before = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    expect(process.env.LOG_LEVEL).toBe(before);
  });

  it("captureLogLine이 LOG_LEVEL을 원래대로 되돌린다", () => {
    captureLogLine({ path: "/api/v1/health" });
  });
});
