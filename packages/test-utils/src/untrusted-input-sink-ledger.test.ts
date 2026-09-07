// 라운드 110 — **클라이언트가 통제하는 무한 길이 값이 폭 있는 DB 칸으로 흐르는 자리**의 대장.
//
// ## 왜 이 그물인가 — 라운드 109가 닫은 구멍의 성질
//
// 라운드 109는 `admin_sessions.ip`(`@db.VarChar(64)`)에 `@Ip()`가 그대로 흘러
// **운영(TRUST_PROXY=1)에서 로그인 성공 직후 500 → 어드민 콘솔 영구 잠금**이 되던 결함을 닫았다
// (비밀번호는 맞았는데 세션 행만 없고 `lastLoginAt`·감사 로그는 이미 커밋된 뒤).
// 그 트랙이 남긴 제안은 *"원문 IP를 담는 칸은 폭 ≥ 45(IPv6) + 여유, 또는 해시"* 라는 **폭 그물**이었다.
//
// ## ⚠️⚠️ 그 제안(폭 그물)은 이 파일이 세우지 않는다 — 실측으로 거부한다
//
// 세 가지를 재고 거부했다. 셋 다 오늘 소스에서 확인되는 값이다.
//
//  1. **폭 그물은 그 결함에 초록이었다.** 라운드 109는 컬럼을 넓혀서 고치지 않았다 —
//     `admin_sessions.ip`는 **오늘도 `@db.VarChar(64)`** 이고(아래 ⓒ가 스키마에서 다시 읽는다),
//     고친 자리는 write 경로(`sessionIpOrNull`)다. 즉 `64 ≥ 45`이므로 폭 그물은 **결함이 살아
//     있던 그 코드에서도 통과**한다. 자기가 태어난 이유인 결함을 못 무는 그물은 그물이 아니다.
//  2. **폭으로는 애초에 막을 수 없는 입력이다.** 값의 출처는 `X-Forwarded-For`의 마지막 항목이고,
//     Express는 `trust proxy` 아래에서 그것이 IP인지 **검사하지 않는다**(bootstrap.ts). 길이 상한이
//     프로토콜에 없으므로 45든 64든 4096이든 넘길 수 있다 — 폭을 넓히는 것은 절벽을 옮길 뿐이다.
//  3. **폭 대조는 이미 한 번 전수로 끝났고, 되풀이하면 소음이다.** 같은 라운드의 다른 트랙이
//     `@db.VarChar` **일흔세 칸을 전부** 대조해 오늘 빈 칸 0건을 확인했다. 이 파일은 그 대조를
//     다시 하지 않는다 — 일흔세 칸에 다시 자를 대면 라운드 108·109가 이미 지키는 DTO 상한과
//     겹쳐 거짓 빨강만 늘고, 다음 사람이 습관적으로 맞추는 대장이 된다.
//     (그 일흔세라는 수는 아래 사각 `body-field-ingress`가 **값으로만** 들고 있다.)
//
// ## 그래서 이 그물이 무는 것 — 축은 폭이 아니라 **유입의 성질**이다
//
// 결함이 성립하려면 **두 가지가 동시에** 참이어야 했다:
//   (가) 값이 **클라이언트가 통제**하고 프로토콜이 길이를 묶지 않으며,
//   (나) 그 값이 **폭 있는 칸**(`@db.VarChar`)에 방어 없이 앉는다.
// 폭 그물은 (나)만 본다. 이 대장은 **(가)를 모집단으로 삼고 (나)를 스키마에서 다시 읽는다.**
//
// ⚠️ **새 칼럼을 사람 손 없이 잡는 기전은 두 끝이다** — 어느 한쪽만으로는 못 잡는다.
//   · **유입 끝(ⓐ)** — 새 코드가 클라이언트 입력을 읽기 시작하면(새 헤더·새 `req.ip`) 그 자리가
//     모집단에 없으므로 빨개진다. *새 칼럼은 그 칼럼에 값을 넣는 코드 없이는 위험하지 않으므로*,
//     새 유입을 통해 들어오는 새 칼럼은 여기서 걸린다.
//   · **칸 끝(ⓓ)** — 이미 선언된 유입이 **새 칼럼**에 값을 흘리는 경우(예: 기존 `@Ip()` 변수를
//     새로 생긴 `client_ip varchar(45)`에 대입)는 ⓐ가 못 본다. 그래서 ⓓ는 스키마에서
//     **주소 모양의 이름을 가진 `@db.VarChar` 칸을 전수 파생**해, 대장에 없는 칸이 생기면 빨개진다.
//     손 목록에 사람이 더해야만 잡히는 그물이 아니다 — 목록은 `schema.prisma`에서 나온다.
//
// ## 이 대장이 오늘 초록인 이유와, 깨질 때 하는 말
//
// 오늘 실측으로 **잡히는 것은 0건**이다 — 원문 주소 칸 **하나**(`admin_sessions.ip` · 방어 살아 있음) ·
// Text 싱크 **둘**(`admin_sessions.user_agent` · `affiliate_clicks.user_agent`) · 해시 주소 칸 **셋**
// (그중 오늘 쓰는 곳이 있는 것은 `affiliate_clicks.ip_hash` 하나 — 사각 `zero-writer-hash-columns`).
// 초록인 대장이 값을 하려면 *깨질 때 무엇을 말하는가*가 분명해야 하므로, 아래 모든 실패 메시지는
// **다음 사람이 할 일**을 적는다("대장에 적으세요 / 폭을 맞추세요 / 해시로 바꾸세요").
//
// ⚠️ **줄 번호를 싣지 않는다.** 모든 좌표는 `파일 경로 + 바늘 이름 + 개수`다. 줄 번호를 실으면
//     무관한 편집마다 빨개지고, 다음 사람이 습관적으로 숫자를 맞춘다(대장 전체의 규율).
//
// ⚠️ **이 파일은 `CONTRACT_NETS_BEFORE_THIS_ONE`·`CONTRACT_NET_COUNT_WITH_THIS_ONE`을 export하지
//     않는다.** `contract-net-ledger.test.ts`의 모집단은 그 이름을 export하는 파일이고, 그 계약의
//     수는 **하한 래칫**이라 새 그물이 목록을 고칠 의무가 없다(그 파일이 명시적으로 그렇게 지었다).
//     여기에 목록을 하나 더 들면 그 계약이 지키는 *"손 목록"* 을 한 벌 더 만드는 것이 된다.
//
// 이 파일이 묻는 것은 다섯이다.
//  ⓐ **유입 전수** — `apps/api/src/**`에서 클라이언트 통제 입력을 읽는 자리를 전수로 세고,
//     대장에 선언된 (파일 · 바늘 · 개수)와 정확히 맞는가.
//  ⓑ **방어 바늘의 생존** — 선언된 자리마다 그 값을 묶는 코드(클램프 · 해시 · 길이 거절)가
//     **오늘도 소스에 있는가**.
//  ⓒ **싱크 칸의 타입** — 선언된 싱크를 `schema.prisma`에서 **다시 읽어**, Text는 Text이고
//     해시 칸은 sha256 hex를 담을 폭이며 **방어 상수의 숫자가 컬럼 폭과 같은가**.
//  ⓓ **원문 주소 칸 전수** — 스키마에서 주소 모양 `@db.VarChar` 칸을 파생해, 대장 밖의 칸이 없는가.
//  ⓔ **사각** — 이 그물이 못 보는 것을 값과 하한, 그리고 재개 조건으로 적는다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// ⚠️ 세 번째 주석 스캐너 사본을 만들지 않는다 — `dnc-scope-guard.test.ts`가
// `dnc-guard-ledger`에서 상수를 가져오는 것과 같은 관례(대장끼리의 **읽기 전용** 참조).
// 이 import는 저 파일을 한 바이트도 바꾸지 않는다.
import { splitCodeAndComments } from "./comment-tolerant-anchor-ledger";

const repoRoot = join(process.cwd(), "..", "..");

/** 유입을 걷는 뿌리 — DB에 쓰는 코드는 오늘 이 아래에만 있다(사각 `scope-apps-api-src`). */
const INGRESS_ROOT = "apps/api/src";
/** 싱크의 단일 진실 — 컬럼 타입·폭은 여기서만 읽는다(대장에 숫자를 옮겨 적지 않는다). */
const SCHEMA_PATH = "apps/api/prisma/schema.prisma";
/** sha256 16진 표현의 길이. 해시 싱크의 폭 하한이다. */
const SHA256_HEX_LENGTH = 64;

// ---------------------------------------------------------------------------
// schema.prisma — 컬럼 전수 파생
// ---------------------------------------------------------------------------

type ColumnKind = "varchar" | "text" | "other";

type SchemaColumn = {
  readonly model: string;
  readonly table: string;
  /** Prisma 필드 이름(코드가 대입할 때 쓰는 이름). */
  readonly field: string;
  /** 실제 컬럼 이름(snake_case). 주소 모양 판정은 이 이름으로 한다. */
  readonly column: string;
  readonly kind: ColumnKind;
  /** `@db.VarChar(n)`의 n. varchar가 아니면 null. */
  readonly width: number | null;
};

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/**
 * `model … { … }` 블록을 걸어 컬럼을 전수로 뽑는다.
 *
 * ⚠️ 스칼라 필드만 센다 — 관계 필드는 `@db.…`가 없으므로 `other`로 떨어지고, ⓒ·ⓓ는
 * `varchar`/`text`만 본다. 파서가 통째로 깨지면 아래 유령 방지 하한이 먼저 빨개진다.
 */
function parseSchemaColumns(source: string): SchemaColumn[] {
  const columns: SchemaColumn[] = [];
  const lines = source.split(/\r?\n/);
  let model: string | null = null;
  let block: string[] = [];

  const flush = () => {
    if (model === null) return;
    const joined = block.join("\n");
    const tableMatch = joined.match(/@@map\("([^"]+)"\)/);
    const table = tableMatch ? tableMatch[1] : model;
    for (const line of block) {
      const field = line.match(/^\s{2}(\w+)\s+\w+\??\s/);
      if (!field) continue;
      const mapped = line.match(/@map\("([^"]+)"\)/);
      const varchar = line.match(/@db\.VarChar\((\d+)\)/);
      const kind: ColumnKind = varchar ? "varchar" : /@db\.Text\b/.test(line) ? "text" : "other";
      columns.push({
        model,
        table,
        field: field[1],
        column: mapped ? mapped[1] : field[1],
        kind,
        width: varchar ? Number(varchar[1]) : null
      });
    }
    model = null;
    block = [];
  };

  for (const line of lines) {
    const start = line.match(/^model\s+(\w+)\s*\{/);
    if (start) {
      flush();
      model = start[1];
      block = [];
      continue;
    }
    if (model !== null && /^\}/.test(line)) {
      flush();
      continue;
    }
    if (model !== null) block.push(line);
  }
  flush();
  return columns;
}

const schemaSource = readRepoFile(SCHEMA_PATH);
const schemaColumns = parseSchemaColumns(schemaSource);
const varcharColumns = schemaColumns.filter((column) => column.kind === "varchar");

function columnOf(table: string, column: string): SchemaColumn | undefined {
  return schemaColumns.find((candidate) => candidate.table === table && candidate.column === column);
}

// ---------------------------------------------------------------------------
// ⓐ 유입 전수 — 클라이언트가 통제하는 입력을 읽는 자리
// ---------------------------------------------------------------------------

/**
 * 바늘은 **읽는 행위**를 문다(값의 이름이 아니라). 이름을 물면 다음 사람이 변수 이름만 바꿔도
 * 그물이 조용히 비고, 그것이 라운드 109의 구멍이 뚫린 방식이다.
 */
const INGRESS_NEEDLES = [
  /** Nest의 `@Ip()` — TRUST_PROXY가 켜지면 `X-Forwarded-For`의 마지막 항목이 그대로 온다. */
  { id: "ip-decorator", pattern: /@Ip\(\)/g },
  /** Express의 `req.ip` / `request.ip` — 같은 값의 다른 이름. */
  { id: "request-ip", pattern: /\b(?:req|request)\??\.ip\b/g },
  /** 요청 헤더 읽기 전부(`headers["x"]` · `headers?.cookie` 두 모양 다). */
  { id: "request-headers", pattern: /\b(?:req|request)\??\.headers\b/g },
  /** Nest의 `@Headers()` 데코레이터 — 오늘 0건이지만 0도 값이다. */
  { id: "headers-decorator", pattern: /@Headers\(/g }
] as const;

type NeedleId = (typeof INGRESS_NEEDLES)[number]["id"];

const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", "generated", ".turbo"]);

type ScannedSource = { readonly path: string; readonly code: string };

function walkTypeScript(absDir: string, relDir: string, out: ScannedSource[]): void {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = join(absDir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walkTypeScript(abs, rel, out);
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    // ⚠️ **주석은 유입이 아니다.** admin-session.service.ts는 `@Ip()`·`req.ip`·`X-Forwarded-For`를
    // 머리말에서 여러 번 부르지만 그 파일은 값을 *읽지* 않고 *묶는다*(ⓑ의 방어 바늘 자리다).
    // 주석을 세면 그 파일이 유입으로 잘못 서고, 대장은 자기가 무는 것을 잃는다.
    out.push({ path: `${INGRESS_ROOT}/${rel}`, code: splitCodeAndComments(readFileSync(abs, "utf8")).code });
  }
}

const scannedSources: ScannedSource[] = [];
walkTypeScript(join(repoRoot, INGRESS_ROOT), "", scannedSources);
scannedSources.sort((left, right) => left.path.localeCompare(right.path));

type IngressHit = { readonly path: string; readonly needle: NeedleId; readonly count: number };

const ingressHits: IngressHit[] = [];
for (const source of scannedSources) {
  for (const needle of INGRESS_NEEDLES) {
    const matches = source.code.match(needle.pattern);
    if (matches) ingressHits.push({ path: source.path, needle: needle.id, count: matches.length });
  }
}

/** 걷은 소스 수의 하한 — 걷기가 통째로 깨지면 유입 0건이 되어 대장이 조용히 초록이 된다. */
const SCANNED_FLOOR = 168;

// ---------------------------------------------------------------------------
// 대장 — 유입마다 (읽는 것 · 싱크 · 규율 · 방어 바늘)
// ---------------------------------------------------------------------------

/**
 * 규율 넷. 저장소가 오늘 실제로 쓰는 것만 있고, 새 갈래를 발명하지 않았다.
 *  · `db-text`        — 싱크가 `@db.Text`다. 폭이 없으므로 넘칠 수 없다.
 *  · `db-hashed`      — 원문이 아니라 sha256 hex가 앉는다. 길이가 고정이라 넘칠 수 없다.
 *  · `db-varchar-bounded` — 폭 있는 칸이지만 write 경로가 값을 묶는다(클램프 또는 400 거절).
 *                       ⚠️ 이 갈래만 **방어 상수 = 컬럼 폭**을 ⓒ가 등호로 확인한다.
 *  · `no-db-sink`     — 그 값이 DB로 가지 않는다(로그 · 인증 · 레이트리밋 · 콘텐츠 협상).
 */
type Discipline = "db-text" | "db-hashed" | "db-varchar-bounded" | "no-db-sink";

type Sink = {
  readonly table: string;
  readonly column: string;
  readonly discipline: Exclude<Discipline, "no-db-sink">;
  /**
   * `db-varchar-bounded`에서만 쓴다 — write 경로가 상한으로 쓰는 `const <이름> = <숫자>`.
   * ⓒ가 그 숫자를 소스에서 읽어 **컬럼 폭과 등호로** 맞춘다.
   */
  readonly boundConstant?: { readonly file: string; readonly name: string };
};

type IngressSite = {
  readonly path: string;
  readonly needle: NeedleId;
  /** ⚠️ 오늘의 실측 개수. 늘어나면 **새 유입**이므로 분류를 강제한다(ⓐ). */
  readonly count: number;
  /** 무엇을 읽는가 — 사람이 읽는 값. */
  readonly reads: string;
  readonly discipline: Discipline;
  /** 이 자리에서 흘러 나가는 DB 싱크(없으면 빈 배열). */
  readonly sinks: readonly Sink[];
  /**
   * 값을 묶는 코드가 오늘도 사는 자리 — `{ 파일, 그 파일에 있어야 하는 글자 }`.
   * `no-db-sink`에는 없다(묶을 것이 없다).
   */
  readonly guard?: { readonly file: string; readonly needle: string };
  /** `no-db-sink`일 때 **왜** DB로 가지 않는지 — 빈 문자열일 수 없다(ⓐ가 확인한다). */
  readonly whyNoSink?: string;
};

const ADMIN_SESSION_SERVICE = "apps/api/src/admin/admin-session.service.ts";
const AFFILIATE_LINK_GUARD = "apps/api/src/items-commerce/affiliate-link-guard.util.ts";
const IDEMPOTENCY_INTERCEPTOR = "apps/api/src/common/idempotency/idempotency.interceptor.ts";

/**
 * ⚠️ 이것은 **모집단이 아니다.** 모집단은 ⓐ가 소스에서 전수로 뽑고, 이 배열은 그 전수에 대한
 * *판정*이다. 그래서 여기에 없는 자리가 생기면 ⓐ가 빨개지지, 이 배열이 조용히 이기지 않는다.
 */
const INGRESS_SITES: readonly IngressSite[] = [
  {
    path: "apps/api/src/admin/admin-auth.controller.ts",
    needle: "ip-decorator",
    count: 2,
    reads: "로그인·MFA 확인의 `@Ip()` — TRUST_PROXY=1이면 X-Forwarded-For의 마지막 항목 원문.",
    discipline: "db-varchar-bounded",
    sinks: [
      {
        table: "admin_sessions",
        column: "ip",
        discipline: "db-varchar-bounded",
        boundConstant: { file: ADMIN_SESSION_SERVICE, name: "ADMIN_SESSION_IP_MAX_LENGTH" }
      }
    ],
    // 라운드 109가 세운 클램프. 종전에는 이 함수가 없어 `@Ip()`가 컬럼에 곧장 들어갔고(그때는
    // TRUST_PROXY가 꺼져 있어 참이었다 — req.ip는 소켓 주소뿐이라 언제나 IP였다) → 이제는
    // 폭을 넘는 값이 null로 떨어진다, 근거: 64자를 넘는 문자열은 정의상 IP가 아니다.
    guard: { file: ADMIN_SESSION_SERVICE, needle: "function sessionIpOrNull" }
  },
  {
    path: "apps/api/src/admin/admin-auth.controller.ts",
    needle: "request-headers",
    count: 2,
    reads: "`user-agent` 원문과 `cookie`. 앞의 것만 DB로 간다.",
    discipline: "db-text",
    sinks: [{ table: "admin_sessions", column: "user_agent", discipline: "db-text" }],
    guard: { file: "apps/api/prisma/schema.prisma", needle: '@map("user_agent") @db.Text' }
  },
  {
    path: "apps/api/src/admin/admin-auth.guard.ts",
    needle: "request-headers",
    count: 2,
    reads: "어드민 세션 쿠키와 CSRF 헤더 — 인증 판정에만 쓴다.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "둘 다 토큰 대조에만 쓰이고 어떤 컬럼에도 앉지 않는다. 세션 행에 남는 것은 " +
      "`sha256(token)`(`admin_sessions.token_hash`)이지 쿠키 원문이 아니다."
  },
  {
    path: "apps/api/src/admin/admin-token.guard.ts",
    needle: "request-headers",
    count: 1,
    reads: "`x-admin-token` — 정적 토큰 대조.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "환경변수의 토큰과 상수시간 비교만 하고 어떤 컬럼에도 앉지 않는다. 값이 틀리면 401로 끝나므로 " +
      "DB까지 가는 경로 자체가 없다."
  },
  {
    path: "apps/api/src/common/filters/global-exception.filter.ts",
    needle: "request-headers",
    count: 1,
    reads: "`x-request-id` — 오류 봉투에 실어 응답으로 되돌린다.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "오류 봉투와 응답 헤더로만 나가고 DB를 지나지 않는다. 되돌려 주는 값이라 길이가 문제되는 자리는 " +
      "컬럼이 아니라 응답 크기이고, 그것은 이 그물의 축이 아니다."
  },
  {
    path: "apps/api/src/common/guards/auth.guard.ts",
    needle: "request-headers",
    count: 1,
    reads: "`authorization` — Bearer JWT 검증.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "Bearer 토큰은 서명 검증 뒤 버려지고, 요청에 남는 것은 payload에서 푼 uuid(`users.id`)뿐이다. " +
      "헤더 원문이 앉는 컬럼은 없다."
  },
  {
    path: IDEMPOTENCY_INTERCEPTOR,
    needle: "request-headers",
    count: 1,
    reads: "`Idempotency-Key` 원문 — 길이 상한이 프로토콜에 없다.",
    discipline: "db-varchar-bounded",
    sinks: [
      {
        table: "idempotency_keys",
        column: "idem_key",
        discipline: "db-varchar-bounded",
        boundConstant: { file: IDEMPOTENCY_INTERCEPTOR, name: "IDEMPOTENCY_KEY_MAX_LENGTH" }
      }
    ],
    // 종전에는 상한이 어디에도 없어 121자 헤더가 P2000 → 500이었다(그때도 우리 클라이언트는
    // 36자 uuid만 보냈으므로 실무상 참이었다) → 이제는 인터셉터가 먼저 400으로 거절한다.
    guard: { file: IDEMPOTENCY_INTERCEPTOR, needle: "if (idemKey.length > IDEMPOTENCY_KEY_MAX_LENGTH)" }
  },
  {
    path: "apps/api/src/common/logging/request-id.middleware.ts",
    needle: "request-headers",
    count: 2,
    reads: "`x-request-id` — 없으면 만들어 붙인다.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "요청 객체(`req.headers[\"x-request-id\"]`)와 로그 줄에만 산다. 없으면 서버가 만들어 붙이므로 " +
      "이 값이 DB로 가는 경로는 오늘 0건이다."
  },
  {
    path: "apps/api/src/common/logging/request-logger.middleware.ts",
    needle: "request-headers",
    count: 1,
    reads: "`x-request-id` — 로그 줄의 상관 키.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "요청 로그 한 줄의 상관 키로만 쓰인다. 로그는 파일·표준출력으로 나가고 어떤 테이블에도 앉지 않는다."
  },
  {
    path: "apps/api/src/common/security/body-size-error.middleware.ts",
    needle: "request-headers",
    count: 1,
    reads: "`x-request-id` — 413 응답의 상관 키.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "413 응답 봉투와 로그 줄로만 나간다. 본문이 상한을 넘어 끊긴 요청이라 DB에 닿는 핸들러 자체가 돌지 않는다."
  },
  {
    path: "apps/api/src/common/security/rate-limit.middleware.ts",
    needle: "request-ip",
    count: 1,
    reads: "`req.ip ?? req.socket.remoteAddress` — 레이트리밋 버킷 키.",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "버킷은 프로세스 안의 Map이고 대응하는 테이블이 없다. 키가 아무리 길어도 늘어나는 것은 힙이지 " +
      "컬럼이 아니다(그 축은 이 그물이 아니라 레이트리밋 자신의 계약이 진다)."
  },
  {
    path: "apps/api/src/common/security/rate-limit.middleware.ts",
    needle: "request-headers",
    count: 2,
    reads: "`authorization`(주체별 버킷)과 `x-request-id`(로그).",
    discipline: "no-db-sink",
    sinks: [],
    whyNoSink:
      "`authorization`은 주체별 버킷 키를 만드는 데만, `x-request-id`는 로그에만 쓰인다. 둘 다 " +
      "in-memory이고 어떤 컬럼에도 앉지 않는다."
  },
  {
    path: "apps/api/src/items-commerce/commerce.controller.ts",
    needle: "request-ip",
    count: 1,
    reads: "인증 클릭의 `request.ip` — 서비스에 `requestMeta.ip`로 넘어간다.",
    discipline: "db-hashed",
    sinks: [{ table: "affiliate_clicks", column: "ip_hash", discipline: "db-hashed" }],
    // ⚠️ 여기서 읽고 다른 파일(onboarding/items-catalog.service.ts)에서 쓴다 — 사각
    // `cross-function-dataflow`가 그 사실을 값으로 든다. 방어 바늘은 해시 함수 쪽에 건다.
    guard: { file: AFFILIATE_LINK_GUARD, needle: "export function hashClickIp" }
  },
  {
    path: "apps/api/src/items-commerce/commerce.controller.ts",
    needle: "request-headers",
    count: 1,
    reads: "`user-agent` 원문 — `requestMeta.userAgent`로 넘어간다.",
    discipline: "db-text",
    sinks: [{ table: "affiliate_clicks", column: "user_agent", discipline: "db-text" }],
    guard: { file: "apps/api/prisma/schema.prisma", needle: '@map("user_agent") @db.Text' }
  },
  {
    path: "apps/api/src/items-commerce/redirect.controller.ts",
    needle: "ip-decorator",
    count: 1,
    reads: "공개 리다이렉트의 `@Ip()` — 비인증이라 아무나 보낼 수 있다.",
    discipline: "db-hashed",
    sinks: [{ table: "affiliate_clicks", column: "ip_hash", discipline: "db-hashed" }],
    guard: { file: AFFILIATE_LINK_GUARD, needle: "export function hashClickIp" }
  },
  {
    path: "apps/api/src/items-commerce/redirect.controller.ts",
    needle: "request-headers",
    count: 2,
    reads: "`user-agent`(DB로 감)와 `accept`(HTML/JSON 협상).",
    discipline: "db-text",
    sinks: [{ table: "affiliate_clicks", column: "user_agent", discipline: "db-text" }],
    guard: { file: "apps/api/prisma/schema.prisma", needle: '@map("user_agent") @db.Text' }
  }
] as const;

// ---------------------------------------------------------------------------
// ⓓ 원문 주소 칸 전수 — 스키마에서 파생한다(손 목록이 아니다)
// ---------------------------------------------------------------------------

/**
 * 컬럼 이름을 `_`로 끊은 조각 중 하나라도 여기 있으면 **주소 모양**으로 본다.
 *
 * ⚠️ 이름 모양은 **발견법**이고, 그 한계는 사각 `name-shaped-address-census`가 값으로 든다.
 * 그래도 손 목록보다 낫다: 목록은 스키마에서 나오므로 **새 칼럼이 사람의 기억 없이 들어온다.**
 */
const ADDRESS_TOKENS = new Set([
  "ip",
  "ips",
  "ipaddr",
  "ipaddress",
  "addr",
  "address",
  "remoteaddr",
  "clientip",
  "peerip",
  "xff",
  "forwarded"
]);

function isAddressShaped(column: string): boolean {
  return column.split("_").some((token) => ADDRESS_TOKENS.has(token));
}

/** 이름에 `hash` 조각이 있으면 원문이 아니라 해시가 앉는 칸이다. */
function isHashShaped(column: string): boolean {
  return column.split("_").includes("hash");
}

const addressShapedVarchars = varcharColumns.filter((column) => isAddressShaped(column.column));
const rawAddressColumns = addressShapedVarchars.filter((column) => !isHashShaped(column.column));
const hashedAddressColumns = addressShapedVarchars.filter((column) => isHashShaped(column.column));

/**
 * **원문(해시가 아닌) 주소를 담는 폭 있는 칸** — 오늘 하나뿐이고, 그 하나는 라운드 109가 묶었다.
 * ⓓ는 이 목록과 위 파생을 등호로 맞춘다. 새 칼럼이 생기면 파생 쪽이 커져 빨개진다.
 */
const DECLARED_RAW_ADDRESS_COLUMNS = [
  {
    table: "admin_sessions",
    column: "ip",
    bound: { file: ADMIN_SESSION_SERVICE, name: "ADMIN_SESSION_IP_MAX_LENGTH" },
    why:
      "라운드 109: write 경로(`sessionIpOrNull`)가 컬럼 폭을 넘는 값을 null로 떨어뜨린다. " +
      "폭을 넓히는 대신 묶은 이유는 X-Forwarded-For에 길이 상한이 없기 때문이다."
  }
] as const;

/**
 * ⚠️ **주소 모양이지만 네트워크 주소가 아닌 칸**의 면제. 오늘 **0건**이고, 0이 정답이다.
 * 면제는 *이유가 값으로 있을 때만* 선다 — 우편 주소 컬럼(`address`) 같은 것이 생기는 날
 * 여기에 이유와 함께 적고, 그 전에는 비어 있어야 한다.
 */
const NOT_A_NETWORK_ADDRESS: readonly { readonly table: string; readonly column: string; readonly why: string }[] =
  [];

// ---------------------------------------------------------------------------
// ⓒ-2 해시 칸에 원문이 앉지 않는다
// ---------------------------------------------------------------------------

/**
 * 해시 주소 칸의 Prisma 필드 이름(오늘 `ipHash`)을 **스키마에서 파생**해, 그 이름에 대입하는
 * 자리마다 오른쪽에 `hash` 낱말이 있는지 본다. `ipHash: ip`(원문 대입)가 바로 라운드 109의
 * 부류이고, 그때는 varchar(128)이라 200자 XFF가 다시 500을 낸다.
 *
 * ⚠️ 타입 선언 자리(`ipHash: string | null;`)는 대입이 아니다 — **파생 규칙으로** 걸러낸다
 * (손 면제 목록을 만들지 않는다).
 */
const TYPE_ANNOTATION_RHS = /^(?:string|number|boolean|Date|unknown|null)\b/;

type HashAssignment = { readonly path: string; readonly field: string; readonly rhs: string };

function collectHashAssignments(fields: readonly string[]): HashAssignment[] {
  const found: HashAssignment[] = [];
  for (const source of scannedSources) {
    for (const field of fields) {
      const pattern = new RegExp(`\\b${field}\\s*:\\s*([^,;\\n]+)`, "g");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.code)) !== null) {
        const rhs = match[1].trim();
        if (TYPE_ANNOTATION_RHS.test(rhs)) continue;
        found.push({ path: source.path, field, rhs });
      }
    }
  }
  return found;
}

const hashedAddressFields = [...new Set(hashedAddressColumns.map((column) => column.field))];
const hashAssignments = collectHashAssignments(hashedAddressFields);

// ---------------------------------------------------------------------------
// ⓐ 유입 전수
// ---------------------------------------------------------------------------

describe("ⓐ 유입 전수 — 클라이언트 통제 입력을 읽는 자리는 전부 대장에 선다", () => {
  it("유령 방지: 걷기가 살아 있다 (하한)", () => {
    expect(
      scannedSources.length,
      `${INGRESS_ROOT} 걷기가 하한(${SCANNED_FLOOR}) 아래예요 — 걷기가 깨지면 유입 0건이 되어 ` +
        "이 대장이 아무것도 지키지 않은 채 초록이 됩니다. 뿌리 경로와 SKIP_DIRS를 먼저 보세요"
    ).toBeGreaterThanOrEqual(SCANNED_FLOOR);
    expect(ingressHits.length).toBeGreaterThan(0);
  });

  it("소스에서 뽑은 (파일 · 바늘)이 대장의 것과 정확히 같다 — 새 자리는 분류를 강제한다", () => {
    const derived = ingressHits.map((hit) => `${hit.path}\t${hit.needle}`).sort();
    const declared = INGRESS_SITES.map((site) => `${site.path}\t${site.needle}`).sort();
    expect(
      derived,
      "클라이언트 입력을 읽는 자리가 대장과 달라요.\n" +
        "· 새로 생긴 자리라면: 그 값이 어느 컬럼에 앉는지 확인하고 INGRESS_SITES에 " +
        "(읽는 것 · 규율 · 싱크 · 방어 바늘)을 적으세요. **DB로 가지 않는다면 " +
        '`discipline: "no-db-sink"` + `whyNoSink`가 정답입니다.*\n' +
        "· 사라진 자리라면: 그 줄을 지우세요."
    ).toEqual(declared);
  });

  it("자리마다 읽는 횟수가 오늘의 실측과 같다 — 한 자리가 헤더를 하나 더 읽으면 빨개진다", () => {
    for (const site of INGRESS_SITES) {
      const hit = ingressHits.find((candidate) => candidate.path === site.path && candidate.needle === site.needle);
      expect(hit, `${site.path}에서 ${site.needle}이 사라졌어요 — 대장의 줄도 지우세요`).toBeDefined();
      expect(
        hit!.count,
        `${site.path}의 ${site.needle} 개수가 대장(${site.count})과 달라요 — ` +
          "읽는 자리가 늘었다면 **그 값이 어느 컬럼으로 가는지** 먼저 보고 " +
          "reads/sinks를 갱신한 뒤 이 수를 맞추세요"
      ).toBe(site.count);
    }
  });

  it("`no-db-sink`에는 이유가 값으로 있고, 싱크가 있는 자리에는 싱크가 있다", () => {
    for (const site of INGRESS_SITES) {
      if (site.discipline === "no-db-sink") {
        expect(site.sinks, `${site.path}(${site.needle})은 no-db-sink인데 싱크가 적혀 있어요`).toEqual([]);
        expect(
          (site.whyNoSink ?? "").trim().length,
          `${site.path}(${site.needle})의 whyNoSink가 비었어요 — 이유 없는 면제는 서지 않습니다`
        ).toBeGreaterThan(20);
      } else {
        expect(site.sinks.length, `${site.path}(${site.needle})에 싱크가 없어요`).toBeGreaterThan(0);
        expect(site.guard, `${site.path}(${site.needle})에 방어 바늘이 없어요`).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ⓑ 방어 바늘의 생존
// ---------------------------------------------------------------------------

describe("ⓑ 방어 바늘 — 값을 묶는 코드가 오늘도 소스에 있다", () => {
  for (const site of INGRESS_SITES) {
    if (!site.guard) continue;
    it(`${site.path} (${site.needle}) — ${site.guard.file}의 방어가 살아 있다`, () => {
      const source = readRepoFile(site.guard!.file);
      expect(
        source.includes(site.guard!.needle),
        `${site.guard!.file}에서 \`${site.guard!.needle}\`이 사라졌어요 — ` +
          `${site.path}가 읽는 값(${site.reads})을 묶는 코드입니다. ` +
          "지운 것이 의도라면 그 값이 이제 어떻게 묶이는지 대장의 guard를 바꿔 적으세요"
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// ⓒ 싱크 칸의 타입 — schema.prisma에서 다시 읽는다
// ---------------------------------------------------------------------------

describe("ⓒ 싱크 — 컬럼 타입과 폭을 스키마에서 다시 읽는다", () => {
  it("유령 방지: 스키마 파싱이 살아 있다 (varchar 칸이 있다)", () => {
    expect(schemaColumns.length).toBeGreaterThan(100);
    expect(varcharColumns.length).toBeGreaterThan(0);
  });

  const declaredSinks = INGRESS_SITES.flatMap((site) => site.sinks.map((sink) => ({ site, sink })));

  for (const { site, sink } of declaredSinks) {
    it(`${sink.table}.${sink.column} — 규율 ${sink.discipline}이 스키마에서 확인된다`, () => {
      const column = columnOf(sink.table, sink.column);
      expect(column, `${sink.table}.${sink.column}이 스키마에 없어요 — 대장의 싱크를 갱신하세요`).toBeDefined();

      if (sink.discipline === "db-text") {
        expect(
          column!.kind,
          `${sink.table}.${sink.column}이 더는 @db.Text가 아니에요(${column!.kind}). ` +
            `${site.path}가 여기에 **원문 헤더**를 그대로 넣습니다 — 폭을 주려면 write 경로에 ` +
            "먼저 클램프를 세우고 규율을 db-varchar-bounded로 바꾸세요"
        ).toBe("text");
        return;
      }

      expect(column!.kind, `${sink.table}.${sink.column}이 varchar가 아니에요`).toBe("varchar");

      if (sink.discipline === "db-hashed") {
        expect(
          column!.width,
          `${sink.table}.${sink.column}의 폭(${column!.width})이 sha256 hex ${SHA256_HEX_LENGTH}자보다 좁아요 — ` +
            "해시가 잘려 들어가면 그 칸은 더는 같은 주소를 가리키지 않습니다"
        ).toBeGreaterThanOrEqual(SHA256_HEX_LENGTH);
        return;
      }

      // db-varchar-bounded — ⚠️ 이 대장의 가장 날카로운 자리다.
      // write 경로의 상한 상수와 컬럼 폭이 **등호**여야 한다. 종전(라운드 109 이전)에는 상수 자체가
      // 없어 이 자리를 물 것이 없었다 → 이제는 상수가 있으므로, 컬럼만 좁아지는 편집이 잡힌다.
      const bound = sink.boundConstant!;
      const guardSource = readRepoFile(bound.file);
      const declaration = guardSource.match(new RegExp(`\\bconst\\s+${bound.name}\\s*=\\s*(\\d+)\\s*;`));
      expect(
        declaration,
        `${bound.file}에서 \`const ${bound.name} = <숫자>\`를 찾지 못했어요 — ` +
          "상한이 상수 리터럴이 아니게 됐다면 이 대장이 폭을 대조할 수 없습니다"
      ).not.toBeNull();
      expect(
        Number(declaration![1]),
        `${bound.name}(${declaration![1]})과 ${sink.table}.${sink.column}의 폭(${column!.width})이 달라요 — ` +
          "둘 중 좁은 쪽이 진실이 되어, 그 사이 길이의 값은 방어를 지나 DB에서 22001로 터집니다. " +
          "컬럼 폭을 바꿨다면 상수도 같이 바꾸세요"
      ).toBe(column!.width);
    });
  }
});

describe("ⓒ-2 해시 칸에 원문이 앉지 않는다", () => {
  it("유령 방지: 해시 주소 칸의 필드 이름이 스키마에서 파생됐다", () => {
    expect(hashedAddressFields.length, "해시 주소 칸이 스키마에서 하나도 파생되지 않았어요").toBeGreaterThan(0);
    expect(hashAssignments.length, "그 이름에 대입하는 자리가 소스에 하나도 없어요").toBeGreaterThan(0);
  });

  it("대입의 오른쪽에 hash 낱말이 있다", () => {
    const rawLooking = hashAssignments.filter((assignment) => !/hash/i.test(assignment.rhs));
    expect(
      rawLooking.map((assignment) => `${assignment.path}: ${assignment.field}: ${assignment.rhs}`),
      "해시 칸에 해시가 아닌 값을 넣는 자리가 생겼어요 — 원문 주소를 넣으면 " +
        "라운드 109와 같은 부류(폭 있는 칸 + 무한 길이 입력)가 됩니다. hashClickIp 같은 해시를 지나게 하세요"
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ⓓ 원문 주소 칸 전수 — 새 칼럼이 사람 손 없이 걸리는 자리
// ---------------------------------------------------------------------------

describe("ⓓ 원문 주소 칸 — 스키마 파생 목록이 대장과 같다", () => {
  it("유령 방지: 주소 모양 파생이 오늘도 무언가를 찾는다", () => {
    expect(
      addressShapedVarchars.length,
      "주소 모양 varchar 칸이 0건이에요 — 파생이 깨졌거나 ADDRESS_TOKENS가 비었습니다"
    ).toBeGreaterThan(0);
  });

  it("⚠️ 대장 밖의 원문 주소 칸이 없다 — 새 칼럼은 여기서 걸린다", () => {
    const derived = rawAddressColumns
      .filter(
        (column) =>
          !NOT_A_NETWORK_ADDRESS.some(
            (exempt) => exempt.table === column.table && exempt.column === column.column
          )
      )
      .map((column) => `${column.table}.${column.column}`)
      .sort();
    const declared = DECLARED_RAW_ADDRESS_COLUMNS.map((entry) => `${entry.table}.${entry.column}`).sort();
    expect(
      derived,
      "원문(해시가 아닌) 네트워크 주소를 담는 폭 있는 칸이 대장과 달라요.\n" +
        "· 새 칼럼이라면 셋 중 하나를 고르세요: (1) 값을 해시해 `*_hash`로 두거나, " +
        "(2) `@db.Text`로 두거나, (3) write 경로에 상한 상수를 세우고 " +
        "DECLARED_RAW_ADDRESS_COLUMNS에 그 상수와 이유를 적으세요.\n" +
        "  ⚠️ 폭만 넓히는 것은 답이 아닙니다 — X-Forwarded-For에는 길이 상한이 없어 " +
        "절벽이 옮겨질 뿐입니다(라운드 109 실측).\n" +
        "· 네트워크 주소가 아닌데 이름이 주소 모양이라면 NOT_A_NETWORK_ADDRESS에 **이유와 함께** 적으세요."
    ).toEqual(declared);
  });

  it("선언된 원문 주소 칸마다 상한 상수가 컬럼 폭과 같다", () => {
    for (const entry of DECLARED_RAW_ADDRESS_COLUMNS) {
      const column = columnOf(entry.table, entry.column);
      expect(column?.kind).toBe("varchar");
      const source = readRepoFile(entry.bound.file);
      const declaration = source.match(new RegExp(`\\bconst\\s+${entry.bound.name}\\s*=\\s*(\\d+)\\s*;`));
      expect(declaration, `${entry.bound.file}의 ${entry.bound.name}을 찾지 못했어요`).not.toBeNull();
      expect(
        Number(declaration![1]),
        `${entry.table}.${entry.column}의 폭과 ${entry.bound.name}이 갈렸어요 — ` +
          "그 사이 길이의 값이 방어를 지나 DB에서 22001로 터집니다"
      ).toBe(column!.width);
      expect(entry.why.trim().length).toBeGreaterThan(20);
    }
  });

  it("해시 주소 칸은 sha256 hex를 담는다 (오늘 셋)", () => {
    expect(hashedAddressColumns.length).toBeGreaterThanOrEqual(3);
    for (const column of hashedAddressColumns) {
      expect(
        column.width,
        `${column.table}.${column.column}의 폭(${column.width})이 sha256 hex ${SHA256_HEX_LENGTH}자보다 좁아요`
      ).toBeGreaterThanOrEqual(SHA256_HEX_LENGTH);
    }
  });

  it("면제는 이유가 값으로 있을 때만 선다 (오늘 0건)", () => {
    for (const exempt of NOT_A_NETWORK_ADDRESS) {
      expect(exempt.why.trim().length, `${exempt.table}.${exempt.column}의 면제 이유가 비었어요`).toBeGreaterThan(20);
    }
    // 오늘의 값: 0. 0도 값이다 — 늘어나는 순간 위 줄이 이유를 요구한다.
    expect(NOT_A_NETWORK_ADDRESS.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ⓔ 사각
// ---------------------------------------------------------------------------

describe("ⓔ 사각 — 이 그물이 못 보는 것을 값과 하한으로 적는다", () => {
  const BLIND_SPOTS = [
    {
      id: "scope-apps-api-src",
      statement:
        "유입은 `apps/api/src/**`만 걷는다 — `apps/admin`·`apps/mobile`·`scripts/**`는 밖이다. " +
        "오늘 DB에 쓰는 코드가 전부 이 뿌리 아래에 있어서지, 저 뿌리들이 안전해서가 아니다.",
      floor: SCANNED_FLOOR,
      measure: () => scannedSources.length,
      reopen: "다른 앱이나 스크립트가 Prisma로 직접 쓰기 시작하는 날 — 그날 이 뿌리를 넓힌다."
    },
    {
      id: "cross-function-dataflow",
      statement:
        "값이 함수·파일 경계를 넘는 것을 따라가지 않는다. `commerce.controller.ts`가 읽은 ip/user-agent는 " +
        "`onboarding/items-catalog.service.ts`에서 컬럼에 앉는다 — 이 대장은 그 연결을 **선언으로** 들 뿐 " +
        "증명하지 않는다. 그래서 중간에서 값이 다른 칸으로 새면 못 본다.",
      /** 유입과 write가 다른 파일인 싱크의 수(오늘 둘 — affiliate_clicks의 ip_hash·user_agent). */
      floor: 2,
      measure: () =>
        INGRESS_SITES.filter((site) => site.path.endsWith("commerce.controller.ts")).flatMap((site) => site.sinks)
          .length,
      reopen: "이 대장이 `data: { … }` 리터럴을 파싱해 대입식을 따라가는 법을 배우는 날."
    },
    {
      id: "body-field-ingress",
      statement:
        "요청 **본문**으로 오는 클라이언트 값(DTO가 받는 것)은 모집단 밖이다 — 그 축은 라운드 108·109가 " +
        "DTO `@MaxLength` 대 컬럼 폭으로 이미 지킨다. 여기에 자를 다시 대면 `@db.VarChar` 전수와 겹쳐 " +
        "거짓 빨강만 는다. ⚠️ 밖에 있는 칸의 수를 값으로 든다.",
      /** 오늘의 `@db.VarChar` 전수(라운드 109가 손으로 대조한 그 수). */
      floor: 73,
      measure: () => varcharColumns.length,
      reopen: "DTO 상한과 컬럼 폭을 한자리에서 파생 대조하는 계약이 서는 날 — 그날 이 수가 그 대장으로 넘어간다."
    },
    {
      id: "name-shaped-address-census",
      statement:
        "ⓓ의 모집단은 **컬럼 이름 모양**에서 나온다. 주소를 담으면서 이름에 ip/addr이 없는 칸은 못 본다. " +
        "그래도 손 목록보다 나은 이유는 하나다 — 새 칼럼이 사람의 기억 없이 들어온다.",
      /** 주소 모양이 아니어서 ⓓ가 보지 않는 varchar 칸의 수(오늘 69 = 73 − 4). */
      floor: 69,
      measure: () => varcharColumns.length - addressShapedVarchars.length,
      reopen:
        "스키마가 컬럼의 출처(사용자 입력 · 프록시 헤더 · 서버 생성)를 주석 규약이나 " +
        "`///` 문서로 표기하기 시작하는 날 — 그날 모집단이 이름에서 출처로 옮겨 간다."
    },
    {
      id: "zero-writer-hash-columns",
      statement:
        "해시 주소 칸 셋 중 **오늘 쓰는 곳이 있는 것은 `affiliate_clicks.ip_hash` 하나**다 — " +
        "`consents.ip_hash`와 `audit_logs.ip_hash`는 write 경로가 0건이다(감사 로거의 " +
        "`ipHash` 필드는 어느 호출자도 채우지 않는다). 즉 저 둘에 대해 ⓒ-2는 **아무것도 증명하지 않았다**.",
      /** 오늘 `ipHash` 대입 자리의 수(하한). 늘어나면 ⓒ-2가 그 자리를 물기 시작한다. */
      floor: 3,
      measure: () => hashAssignments.length,
      reopen: "저 두 칸에 값을 채우는 코드가 생기는 날 — 그날 ⓒ-2가 그 자리를 처음으로 문다."
    }
  ] as const;

  it("사각마다 문장과 재개 조건이 비어 있지 않고 id가 서로 다르다", () => {
    expect(new Set(BLIND_SPOTS.map((spot) => spot.id)).size).toBe(BLIND_SPOTS.length);
    for (const spot of BLIND_SPOTS) {
      expect(spot.statement.trim().length, `${spot.id} 사각의 문장이 비었어요`).toBeGreaterThan(30);
      expect(spot.reopen.trim().length, `${spot.id} 사각의 재개 조건이 비었어요`).toBeGreaterThan(20);
    }
  });

  for (const spot of BLIND_SPOTS) {
    it(`${spot.id}: 사각이 오늘도 실재한다 (유령 사각 금지)`, () => {
      expect(
        spot.measure(),
        `${spot.id} 사각을 다시 재니 하한(${spot.floor}) 아래예요 — ` +
          "사각이 사라졌다면 그 줄을 지우고, 좁아졌다면 하한을 내리세요"
      ).toBeGreaterThanOrEqual(spot.floor);
    });
  }
});

// ---------------------------------------------------------------------------
// 이 그물의 자리 — 무엇을 세우지 않았는가
// ---------------------------------------------------------------------------

describe("이 그물의 자리 — 폭 그물을 세우지 않았다는 사실이 계약이다", () => {
  const selfSource = readRepoFile("packages/test-utils/src/untrusted-input-sink-ledger.test.ts");

  it("라운드 109의 폭 제안을 거부한 근거가 이 파일에 값으로 적혀 있다", () => {
    expect(selfSource).toContain("폭 그물은 그 결함에 초록이었다");
    expect(selfSource).toContain("절벽을 옮길 뿐이다");
  });

  it("`@db.VarChar` 전수에 자를 다시 대지 않는다 — 그 수는 사각의 값으로만 산다", () => {
    // ⚠️ 일흔셋은 **지켜야 할 약속이 아니라** 밖에 둔 것의 크기다. 등호로 물면 컬럼이 하나
    // 늘 때마다 이 대장이 빨개지고, 다음 사람이 습관적으로 숫자를 맞춘다.
    expect(varcharColumns.length).toBeGreaterThanOrEqual(73);
    expect(rawAddressColumns.length).toBeLessThan(varcharColumns.length);
  });

  it("계약 그물 목록 두 이름을 export하지 않는다 (contract-net-ledger의 모집단 밖)", () => {
    expect(/^export const CONTRACT_NETS_BEFORE_THIS_ONE\b/m.test(selfSource)).toBe(false);
    expect(/^export const CONTRACT_NET_COUNT_WITH_THIS_ONE\b/m.test(selfSource)).toBe(false);
  });

  it("줄 번호를 좌표로 싣지 않는다 — 모든 좌표는 파일·바늘·개수다", () => {
    for (const site of INGRESS_SITES) {
      expect(site.path.endsWith(".ts")).toBe(true);
    }
    expect(selfSource).toContain("줄 번호를 싣지 않는다");
  });
});
