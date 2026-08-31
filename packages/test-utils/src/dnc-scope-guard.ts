// 라운드 85 트랙 E (GAP-085 #5) — DNC-016(범위 밖 여섯)의 부정 스윕. 그 조항의 **모집단을 오늘 결정한다.**
//
// 라운드 84 트랙 B가 `dnc-guard-ledger.ts`로 조항 스무 줄에 가드 대장을 세웠고, 그 대장이 남긴
// *"가드 없음"* 셋 가운데 둘의 재개 조건은 **사건이 아니라 결정**을 기다렸다.
//
//   DNC-016: "… 또는 **부정 스윕의 모집단**(무엇을 어디까지 훑을 것인가)이 결정되는 날."
//
// ⚠️ **사건을 기다리는 조건은 저절로 오지만, 결정을 기다리는 조건은 오지 않는다.** 그 결정을
// 어느 라운드도 자기 일로 집어 들지 않으면 그 조항은 영원히 무가드로 산다 — 그리고 그동안
// 저장소는 조용하다. 실패 시나리오는 이렇게 생겼다: 다음 라운드가 *"가격이 언제 확인된 값인지
// 더 잘 보여 주자"* 며 스냅샷을 주기적으로 갱신하는 워커 잡을 하나 만든다. 아무도 *"가격 추적을
// 켠다"* 고 생각하지 않는데 DNC-016의 경계는 그때 넘어가고, **빨개지는 자리가 0건**이다.
//
// 이 파일이 그 결정을 값으로 적는다.
//
// ## ⚠️ 먼저 모집단, 그다음 바늘 — 순서가 규율이다
//
// 대장 자신이 DNC-019 자리에 그 경고를 적어 두었다: *"그 둘을 정하지 않은 스윕은 **첫날부터
// 면제 목록으로 산다**."* 그래서 이 파일은 바늘보다 **뿌리**를 먼저 세운다.
//
//  · **뿌리**(`SCOPE_ROOTS`) — 범위 밖 기능이 저장소에 들어온다면 그 이름이 **반드시 앉는 자리**
//    아홉이다: 스키마의 테이블·열거형·열거형 값·열, API 엔드포인트 경로, 앱·어드민의 라우트 파일,
//    의존성 이름, 워커 잡 이름. 뿌리마다 **왜 이 뿌리인가**가 빈 문자열일 수 없고
//    (`reason`), 계약이 그 경로의 **실재**와 그 뿌리가 실제로 이름을 내놓는지를 함께 확인한다
//    (손으로 배열한 목록은 뿌리가 아니다 — 확인되지 않는 뿌리는 조용한 면제부다).
//  · **바늘**(`OutOfScopeItem.needles`) — 그 이름들 위에서만 돈다. **소스 전문을 훑지 않는다.**
//    주석·문구·테스트 픽스처의 한국어는 이 스윕의 대상이 아니고(그쪽은 DNC-018·DNC-020의 축이다),
//    이 스윕이 묻는 것은 **표면이 생겼는가**다: 테이블이 생겼는가 · 엔드포인트가 생겼는가 ·
//    라우트가 생겼는가 · 의존성이 들어왔는가 · 잡이 돌기 시작했는가.
//
// ## ⚠️ 여섯을 손으로 적지 않는다 — 문서의 그 줄에서 파싱한다
//
// `OUT_OF_SCOPE_SIX`의 `clausePhrase` 여섯은 `docs/dev/do-not-change.md`의 DNC-016 행에서 파싱한
// 문구와 **글자 단위로 같아야 한다**(`parseOutOfScopePhrases`). 조항에 일곱째가 붙는 날 이 스윕이
// **먼저** 빨개진다 — 그 사실이 이 파일이 대장(조항 수를 세는 자리)과 갈리는 지점이다. 대장은
// *"그 조항에 가드가 있는가"* 를 묻고, 이 파일은 *"그 조항이 잠근 여섯이 오늘도 여섯인가, 그리고
// 그 여섯 각각이 저장소에 0건인가"* 를 묻는다. ⚠️ 이 트랙은 그 문서를 **읽기만** 했다(개정은
// PM/Tech Lead 승인 절차다).
//
// ## ⚠️ 면제는 하나이고, 그 이유는 소스로 확인한다
//
// 오늘 바늘에 걸리는 자리는 **둘**이고 같은 항목(가격 추적)에 있다 — `product_links`의
// `price_snapshot_krw`·`price_checked_at`이다. 그 둘은 *가격 추적*이 아니라 **정직 표시**의 근거다
// (*"언제 확인한 값인지 모르면 가격을 아예 싣지 않는다"* — `items-catalog.service.ts`). 라운드 84
// 리뷰 L-8이 정정한 그대로, 그 칸을 지우거나 옮기는 것은 이 트랙의 일이 아니다.
//
// 그래서 그 둘은 **이유 + 재개 조건 + 그 이유의 증명**(`provenBy`)을 지고 면제 대장에 선다.
// ⚠️ 이유가 참인지를 계약이 **소스로 확인한다**(라운드 84 트랙 D의 `provenBy` 관례):
//  ① *"행이 쌓이지 않는다"* → 스키마에 가격 이력·스냅샷 테이블이 0건이고, `product_links`의
//     가격 열이 그 **둘뿐**이다.
//  ② *"주기적으로 갱신되지 않는다"* → `apps/api/src/worker` 아래 어느 파일도 그 두 열의 이름을
//     쓰지 않는다(오늘 그 열을 쓰는 손은 어드민의 대량 적용 하나이고, 그것은 사람의 손이다).
//     ⚠️ 라운드 85 리뷰 M-4: 그 확인은 **디렉터리 전수**(`workerSourceFiles`)로 한다 — 종전에는
//     `*.job.ts`만 읽어 주장(*"어느 파일도"*)보다 좁았고, 스케줄러·상태 서비스가 증명 밖이었다.
// 그리고 **유령 면제**를 막는다 — 면제 줄은 오늘 실제로 걸리는 자리여야 한다. 걸리지 않게 되면
// (열이 사라지거나 이름이 바뀌면) 그 줄을 지우라고 계약이 빨개진다.
//
// ## ⚠️ 이 스윕이 무는 것의 한계 — 이름이지 구현이 아니다
//
// 이 스윕은 **이름**을 본다. 이름을 감춘 구현(예: `misc_json`에 커뮤니티 글을 담는 것)은 잡지
// 못하고, 반대로 이름만 같은 이웃(예: `@react-native-community/cli`)은 뿌리에서 갈라 둔다.
// 그 한계를 값으로 적어 두는 이유는 다음 사람이 이 파일을 *"범위 밖 여섯이 없다는 증명"* 으로
// 읽지 않게 하기 위해서다 — 이것은 **경계가 넘어갈 때 소리가 나는 자리**이고, 그 소리는 대개
// 이름에서 먼저 난다.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** `vitest`가 `packages/test-utils`에서 돌 때의 저장소 뿌리(다른 계약들과 같은 관례). */
export const repoRoot = join(process.cwd(), "..", "..");

/** 조항의 단일 소스. ⚠️ 이 트랙은 이 파일을 **읽기만** 한다. */
export const DNC_CONTRACT_PATH = "docs/dev/do-not-change.md";

/**
 * 이 스윕 자신의 두 파일 — 계약 ⓖ가 읽는다.
 *
 * ⚠️ **스윕은 자기를 모집단에 넣지 않는다.** 이 파일들에는 *"커뮤니티"·"중고"·"보험"* 이 값과
 * 설명으로 실려 있어서, 모집단에 들어오는 순간 이 계약은 **첫날부터 빨간 채로** 산다. 그러면
 * 다음 사람이 고치는 방법은 하나뿐이다 — 자기 자신을 면제 목록에 적는 것. 그 순간 면제 목록이
 * 문을 열고, 대장이 세는 도구가 아니라 면제부가 된다(라운드 84 B가 대장에 적은 그 규율과 같은 축).
 */
export const SWEEP_SELF_FILES = [
  "packages/test-utils/src/dnc-scope-guard.ts",
  "packages/test-utils/src/dnc-scope-guard.test.ts"
] as const;

/** 저장소 상대 경로를 읽는다. */
export function readRepoFile(relativePath: string, baseDir: string = repoRoot): string {
  return readFileSync(join(baseDir, relativePath), "utf8");
}

// ── 뿌리 ──────────────────────────────────────────────────────────────────────

/**
 * 이름이 앉는 자리 아홉.
 *
 * ⚠️ 이 목록이 **모집단의 결정**이다(DNC-016의 재개 조건이 기다리던 그 결정). 늘리는 것은 다음
 * 라운드의 판단이지만, 줄이는 것은 그물을 좁히는 일이라 이유와 함께 적혀야 한다.
 */
export type ScopeNameKind =
  | "schema-table"
  | "schema-enum"
  | "schema-enum-value"
  | "schema-column"
  | "api-endpoint"
  | "mobile-route"
  | "admin-route"
  | "dependency"
  | "worker-job";

export type ScopeRoot = {
  readonly kind: ScopeNameKind;
  /** 저장소 상대 경로(파일 또는 디렉터리) — 계약이 **실재를 확인한다**. */
  readonly path: string;
  /** 이 뿌리가 내놓는 이름 하나의 모양(실패 메시지가 이 말을 쓴다). */
  readonly unit: string;
  /** 왜 이 뿌리인가 — **빈 문자열일 수 없다.** 뿌리도 값이고, 값에는 이유가 붙는다. */
  readonly reason: string;
};

export const SCOPE_ROOTS: readonly ScopeRoot[] = [
  {
    kind: "schema-table",
    path: "apps/api/prisma/schema.prisma",
    unit: "테이블 이름(@@map 또는 모델 이름)",
    reason:
      "범위 밖 기능이 데이터를 쌓기 시작하면 그 자리가 먼저 테이블로 선다(리뷰/댓글 · 가격 이력 · 중고 리스팅). " +
      "도메인 테이블 이름은 DNC-007이 따로 잠그지만 그쪽은 '지우지 마라'이고, 이 뿌리는 '늘지 마라'다."
  },
  {
    kind: "schema-enum",
    path: "apps/api/prisma/schema.prisma",
    unit: "열거형 이름",
    reason:
      "새 종별(보험 상품 종류 · 중고 플랫폼 종류)은 테이블보다 열거형으로 먼저 들어오는 일이 잦다 — 테이블만 세면 그 문이 열려 있다."
  },
  {
    kind: "schema-enum-value",
    path: "apps/api/prisma/schema.prisma",
    unit: "열거형 값(`열거형.값`)",
    reason:
      "중고 연동은 **오늘 있는 `product_platform`에 값 하나가 붙는 모양**으로 가장 싸게 들어온다(coupang · naver · custom 옆에 한 줄). " +
      "그 한 줄은 마이그레이션도 화면도 거의 건드리지 않아 리뷰에서 가장 조용한 자리다."
  },
  {
    kind: "schema-column",
    path: "apps/api/prisma/schema.prisma",
    unit: "열 이름(`테이블.열`)",
    reason:
      "테이블을 새로 만들지 않고 기존 행에 칸을 붙이는 것이 경계를 넘는 가장 흔한 방식이다(가격 이력 · 진단 메모 · 제휴 종별). " +
      "⚠️ 오늘 유일한 면제 둘도 이 뿌리에 있다."
  },
  {
    kind: "api-endpoint",
    path: "apps/api/src",
    unit: "엔드포인트 경로(@Controller · @Get/@Post/@Patch/@Put/@Delete 인자)",
    reason:
      "서버 표면이 생기면 경로 문자열이 먼저 생긴다 — 화면보다 앞서고, DTO·서비스보다 세기 쉽다. " +
      "⚠️ API base path(`/api/v1`)는 DNC-006의 축이라 여기서는 경로 조각만 본다."
  },
  {
    kind: "mobile-route",
    path: "apps/mobile/app",
    unit: "라우트 파일 경로(expo-router는 파일 트리가 곧 라우트다)",
    reason:
      "앱에 표면이 서면 이 뿌리에 파일이 하나 생긴다. 하단 탭 넷은 DNC-003이 잠그지만, 탭 밖 라우트(예: `community.tsx`)는 그 그물 밖이다."
  },
  {
    kind: "admin-route",
    path: "apps/admin/app",
    unit: "라우트 파일 경로(Next.js app router)",
    reason:
      "운영자 화면이 먼저 서고 앱이 나중에 따라오는 순서도 흔하다 — 어드민만 보는 그물이 없으면 그 순서에서 조용해진다."
  },
  {
    kind: "dependency",
    path: "package.json",
    unit: "의존성 이름(dependencies · devDependencies · peer · optional)",
    reason:
      "사진/영수증 인식과 중고 플랫폼 연동은 **자기 힘으로 구현되지 않는다** — 엔진·SDK가 먼저 들어온다. " +
      "잠긴 스택 넷은 DNC-005가 이름으로 못 박지만 그쪽은 '갈아 끼우지 마라'이고, 이 뿌리는 '이 부류가 늘지 마라'다."
  },
  {
    kind: "worker-job",
    path: "apps/api/src/worker/jobs",
    unit: "잡 파일 이름과 `readonly name` 값",
    reason:
      "⚠️ 이 트랙이 연 자리의 실패 시나리오가 정확히 여기다 — **가격 스냅샷을 주기적으로 갱신하는 잡**은 " +
      "화면도 테이블도 만들지 않는다. 잡 이름을 세지 않으면 '현재값 한 벌'이 '이력'이 되는 순간을 아무도 보지 못한다."
  }
];

/** 뿌리에서 걷어 올린 이름 하나. */
export type ScopeName = {
  readonly kind: ScopeNameKind;
  /** 견주는 대상(소문자로 견준다 — 한글은 그대로다). */
  readonly name: string;
  /** 어디서 왔는가 — 실패 메시지가 사람을 그 파일로 보낸다. */
  readonly where: string;
};

// ── 뿌리에서 이름 걷기 ────────────────────────────────────────────────────────

/** `node_modules`·점 디렉터리를 뺀 재귀 걷기(다른 스윕들과 같은 관례). */
function walkFiles(absoluteDir: string, matches: (fileName: string) => boolean): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (matches(entry.name)) found.push(path);
    }
  };
  walk(absoluteDir);
  return found.sort();
}

/** 스키마의 `model`/`enum` 블록 — 이름은 `@@map`이 있으면 그 값(= DB의 이름)이다. */
const SCHEMA_BLOCK = /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

/**
 * 스키마 소스에서 테이블·열거형·열거형 값·열 이름을 걷는다.
 *
 * ⚠️ 소스 **문자열**을 받는다(파일이 아니라). 픽스처로 실패 방향을 그대로 재현할 수 있어야
 * 한다 — 값이 주석에만 적히면 다음 사람이 그 사실을 다시 발견해야 한다.
 */
export function collectSchemaNames(schemaSource: string, where = "apps/api/prisma/schema.prisma"): ScopeName[] {
  const names: ScopeName[] = [];

  for (const block of schemaSource.matchAll(SCHEMA_BLOCK)) {
    const [, blockKind, declaredName, body] = block;
    const mapped = body.match(/@@map\("([^"]+)"\)/);
    const name = mapped ? mapped[1] : declaredName;
    names.push({ kind: blockKind === "model" ? "schema-table" : "schema-enum", name, where });

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith("//") || line.startsWith("@@") || line.startsWith("*")) continue;
      if (blockKind === "enum") {
        /**
         * ⚠️ **라운드 85 리뷰 M-3 — 종전 `^(\w+)$`는 `@map`이 붙은 값을 통째로 놓쳤다.**
         *
         * Prisma의 열거형 값은 열과 똑같이 `danggeun @map("dg")` 꼴을 쓸 수 있는데, 그 줄은
         * "낱말 하나"가 아니라서 위 정규식에 **한 번도 걸리지 않았다** — 즉 모집단에서 사라졌다.
         * 하필 이 뿌리는 *"중고 연동이 가장 싸게 들어오는 입구"*(오늘 있는 `product_platform`에
         * 값 한 줄)로 세운 자리라, 그 한 줄이 `@map`을 달고 들어오면 스윕이 조용히 초록이었다.
         *
         * 그래서 **열 갈래와 같은 처리**를 한다(`@map`이 있으면 그 값 = DB의 이름). 더해서
         * 선언 이름이 다르면 그것도 함께 싣는다: 이 뿌리의 존재 이유가 *"이름이 앉는 가장 싼
         * 자리"* 인데, 이름을 감추는 가장 싼 방법이 바로 `@map`이기 때문이다(`Danggeun
         * @map("dg")`처럼 둘이 다르면 어느 한쪽만 세는 그물은 나머지 한쪽으로 새어 나간다).
         * ⚠️ 열 갈래는 이 확장을 하지 않는다 — 열 바늘과 면제 대장이 전부 DB 이름(snake_case)
         * 으로 서 있어서, 선언 이름을 함께 실으면 같은 칸이 이름 둘로 세어져 면제가 어긋난다.
         */
        const declared = line.match(/^(\w+)\b/);
        if (!declared) continue;
        const valueMap = line.match(/@map\("([^"]+)"\)/);
        const valueNames = valueMap && valueMap[1] !== declared[1] ? [valueMap[1], declared[1]] : [declared[1]];
        for (const valueName of valueNames) {
          names.push({ kind: "schema-enum-value", name: `${name}.${valueName}`, where });
        }
        continue;
      }
      const field = line.match(/^(\w+)\s+\S/);
      if (!field) continue;
      const columnMap = line.match(/@map\("([^"]+)"\)/);
      names.push({ kind: "schema-column", name: `${name}.${columnMap ? columnMap[1] : field[1]}`, where });
    }
  }

  return names;
}

/** NestJS 데코레이터의 경로 인자 — 컨트롤러의 뿌리와 메서드의 꼬리를 함께 센다. */
const ENDPOINT_DECORATOR = /@(?:Controller|Get|Post|Patch|Put|Delete)\(\s*"([^"]*)"/g;

export function collectApiEndpointNames(apiSourceDir: string, baseDir: string = repoRoot): ScopeName[] {
  const names: ScopeName[] = [];
  for (const file of walkFiles(join(baseDir, apiSourceDir), (fileName) => fileName.endsWith(".ts"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(ENDPOINT_DECORATOR)) {
      if (match[1].length === 0) continue;
      names.push({ kind: "api-endpoint", name: match[1], where: toRepoPath(file, baseDir) });
    }
  }
  return names;
}

export function collectRouteNames(
  kind: "mobile-route" | "admin-route",
  routeDir: string,
  baseDir: string = repoRoot
): ScopeName[] {
  const root = join(baseDir, routeDir);
  return walkFiles(root, (fileName) => /\.tsx?$/.test(fileName)).map((file) => ({
    kind,
    name: relative(root, file).split(sep).join("/"),
    where: toRepoPath(file, baseDir)
  }));
}

/** 워크스페이스 매니페스트 전수 — 뿌리 하나 + `apps/*` · `packages/*`(손으로 적지 않는다). */
export function manifestPaths(baseDir: string = repoRoot): string[] {
  const found = ["package.json"];
  for (const workspace of ["apps", "packages"]) {
    let entries;
    try {
      entries = readdirSync(join(baseDir, workspace), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const manifest = `${workspace}/${entry.name}/package.json`;
      if (existsSync(join(baseDir, manifest))) found.push(manifest);
    }
  }
  return found.sort();
}

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

export function collectDependencyNames(baseDir: string = repoRoot): ScopeName[] {
  const names: ScopeName[] = [];
  for (const manifest of manifestPaths(baseDir)) {
    const parsed = JSON.parse(readRepoFile(manifest, baseDir)) as Record<string, Record<string, string> | undefined>;
    for (const field of DEPENDENCY_FIELDS) {
      for (const dependency of Object.keys(parsed[field] ?? {})) {
        names.push({ kind: "dependency", name: dependency, where: manifest });
      }
    }
  }
  return names;
}

export function collectWorkerJobNames(jobsDir: string, baseDir: string = repoRoot): ScopeName[] {
  const names: ScopeName[] = [];
  for (const file of walkFiles(join(baseDir, jobsDir), (fileName) => fileName.endsWith(".job.ts"))) {
    const where = toRepoPath(file, baseDir);
    names.push({ kind: "worker-job", name: relative(join(baseDir, jobsDir), file).split(sep).join("/"), where });
    for (const match of readFileSync(file, "utf8").matchAll(/readonly name = "([^"]+)"/g)) {
      names.push({ kind: "worker-job", name: match[1], where });
    }
  }
  return names;
}

function toRepoPath(absolutePath: string, baseDir: string = repoRoot): string {
  return relative(baseDir, absolutePath).split(sep).join("/");
}

/**
 * ⚠️ **라운드 85 리뷰 M-4 — 워커 면제 증명의 모집단.**
 *
 * `collectWorkerJobNames`가 뿌리는 `*.job.ts`만 훑는다(잡 **이름**을 세는 것이 그 함수의 일이므로
 * 그 자체는 옳다). 그런데 가격 면제의 증명 ②는 *"`apps/api/src/worker` 아래 **어느 파일도** 그
 * 두 열 이름을 쓰지 않는다"* 라고 주장하면서 그 좁은 목록만 읽고 있었다 — 주장보다 좁은 증명이다.
 * 스케줄러·상태 서비스·모듈·공용 타입은 전부 그 아래에 있고, 주기 갱신을 그중 어디에 적어도
 * (예: `scheduler.service.ts`의 틱 안에서 직접 갱신) 그 증명은 초록으로 남았다.
 *
 * 그래서 **디렉터리를 전수로 읽는 자리**를 값으로 둔다. 이것은 모집단(`ScopeName`)이 아니라
 * **증명의 재료**다 — 스윕이 견주는 이름은 여전히 잡 이름뿐이다.
 */
export function workerSourceFiles(workerDir = "apps/api/src/worker", baseDir: string = repoRoot): string[] {
  return tsFilesUnder(workerDir, baseDir);
}

/**
 * 디렉터리 아래 `.ts` 전수(저장소 상대 경로). 뿌리가 **어떤 관례에 기대는지**를 계약이 확인할 때
 * 쓴다 — `collectScopeNames`가 이름을 내놓은 파일만 모은 `scannedFiles`와 다르다: 관례가 깨진
 * 파일은 애초에 이름을 내놓지 못해 그 목록에 없다(그 목록으로 관례를 확인하면 순환이다).
 */
export function tsFilesUnder(relativeDir: string, baseDir: string = repoRoot): string[] {
  return walkFiles(join(baseDir, relativeDir), (fileName) => fileName.endsWith(".ts")).map((file) =>
    toRepoPath(file, baseDir)
  );
}

/**
 * 스케줄러가 실제로 굴리는 잡 파일 경로 — `./jobs/…` import에서 읽는다(손으로 적지 않는다).
 *
 * ⚠️ 라운드 85 리뷰 M-4: 뿌리가 `*.job.ts`만 훑는다는 사실은 **관례가 오늘도 지켜질 때만** 안전하다.
 * `./jobs/price-refresh.ts`(꼬리 없이)로 하나 들어오면 뿌리는 그것을 세지 않고, 그 잡은 이름이
 * 앉는 자리 없이 돌기 시작한다. 그래서 계약이 이 목록과 파일 이름을 대조한다.
 */
export function schedulerJobImportPaths(schedulerSource: string): string[] {
  return [...schedulerSource.matchAll(/from\s+"\.\/(jobs\/[^"]+)"/g)].map((match) => match[1]);
}

/** 뿌리 아홉이 내놓는 이름 전수 — 스윕이 견주는 모집단이다. */
export function collectScopeNames(baseDir: string = repoRoot): ScopeName[] {
  const schema = collectSchemaNames(readRepoFile("apps/api/prisma/schema.prisma", baseDir));
  return [
    ...schema,
    ...collectApiEndpointNames("apps/api/src", baseDir),
    ...collectRouteNames("mobile-route", "apps/mobile/app", baseDir),
    ...collectRouteNames("admin-route", "apps/admin/app", baseDir),
    ...collectDependencyNames(baseDir),
    ...collectWorkerJobNames("apps/api/src/worker/jobs", baseDir)
  ];
}

/** 스윕이 실제로 읽은 파일 전수 — 계약 ⓖ(자기 참조 금지)가 읽는다. */
export function scannedFiles(baseDir: string = repoRoot): string[] {
  const files = new Set<string>(["apps/api/prisma/schema.prisma", ...manifestPaths(baseDir)]);
  for (const name of collectScopeNames(baseDir)) files.add(name.where);
  return [...files].sort();
}

// ── 여섯 · 바늘 · 면제 ────────────────────────────────────────────────────────

/** 오늘 걸리지만 조항 위반이 아닌 자리 — **이유·재개 조건·증명**을 지고 선다. */
export type ScopeExemption = {
  readonly kind: ScopeNameKind;
  /** 걸리는 이름 그대로(모집단에 실재해야 한다 — 유령 면제 금지). */
  readonly name: string;
  /** 왜 이것이 조항 위반이 아닌가 — 빈 문자열일 수 없다. */
  readonly reason: string;
  /** 무엇이 생기면 이 면제를 거두는가 — 빈 문자열일 수 없다. */
  readonly resumeWhen: string;
  /** ⚠️ 그 이유가 **참인지를 무엇으로 확인했는가**(계약이 소스로 다시 확인한다). */
  readonly provenBy: string;
};

export type ScopeNeedle = {
  /** 실패 메시지가 사람에게 말해 주는 이름. */
  readonly label: string;
  /** 이름(소문자)에 대고 견주는 모양. */
  readonly pattern: RegExp;
  /**
   * 이 바늘이 도는 뿌리(없으면 그 항목의 뿌리 전부).
   *
   * ⚠️ **넓은 낱말은 좁은 뿌리에서만 쓴다.** `price` 한 낱말은 열 이름에서는 잡음이 크지만
   * (`item_templates`의 가격대 두 칸은 시간축이 없는 카탈로그 값이다) **잡 이름에서는 정확하다** —
   * 워커의 이름 공간은 일곱이고 그중 가격을 다루는 것은 0건이며, 가격을 주기적으로 만지는 잡이
   * 생기는 순간이 곧 '현재값 한 벌'이 '이력'이 되는 순간이다. 뿌리를 좁히는 대신 낱말을 좁히면
   * 그 자리를 놓친다(이 파일이 실제로 한 번 놓쳤던 자리다 — 그 잡의 이름은 `price-refresh`처럼
   * '이력'도 '추이'도 말하지 않는다).
   */
  readonly kinds?: readonly ScopeNameKind[];
};

export type OutOfScopeItem = {
  readonly id: string;
  /** ⚠️ 조항 문서의 DNC-016 행에서 파싱한 문구와 **글자 단위로** 같아야 한다. */
  readonly clausePhrase: string;
  /** 이 항목이 어느 뿌리에 서는가 — 항목마다 다르다(그리고 다른 이유가 값으로 적힌다). */
  readonly roots: readonly ScopeNameKind[];
  /** 왜 이 뿌리들인가 · 왜 나머지는 아닌가. */
  readonly rootsReason: string;
  readonly needles: readonly ScopeNeedle[];
  readonly exemptions: readonly ScopeExemption[];
  /**
   * ⚠️ **이 항목의 바늘이 실제로 무는 가짜 이름 하나.**
   *
   * 물지 못하는 스윕은 영원히 초록이고, 그 사실은 아무도 모른다. 계약이 이 이름을 모집단에
   * 섞어 넣어 **빨개지는 것을 실제로 보인다**(그리고 이 이름이 오늘 저장소에 없다는 것도 함께 센다).
   */
  readonly tripSample: { readonly kind: ScopeNameKind; readonly name: string };
};

/**
 * DNC-016이 잠근 여섯.
 *
 * ⚠️ `clausePhrase`는 문서에서 파싱한 여섯과 대조된다 — 조항에 일곱째가 붙으면 이 스윕이 먼저
 * 빨개진다(그때 새 항목의 뿌리·바늘을 정하는 것이 그 라운드의 일이다).
 */
export const OUT_OF_SCOPE_SIX: readonly OutOfScopeItem[] = [
  {
    id: "photo-receipt-ai",
    clausePhrase: "사진/영수증 AI",
    roots: ["dependency", "api-endpoint", "worker-job", "schema-table", "schema-column"],
    rootsReason:
      "이미지에서 글자를 읽는 일은 스스로 구현되지 않는다 — **엔진·SDK가 먼저 들어오고**(dependency), " +
      "요청 표면(api-endpoint)과 비동기 처리(worker-job)가 뒤따르며, 결과가 앉을 칸(schema-*)이 마지막이다. " +
      "⚠️ 엑셀/CSV 가져오기의 '분석'은 이 항목이 아니다 — 그쪽은 DNC-012가 미리보기·승인 규율로 따로 잠근 자리이고, " +
      "여기서 묻는 것은 **사진·영수증 이미지의 인식**이다. 라우트 뿌리는 이 항목에 두지 않는다(화면은 인식 기능의 " +
      "증상이지 그 기능 자체가 아니고, 화면 축은 아래 다섯이 이미 걷는다).",
    needles: [
      { label: "OCR", pattern: /(^|[^a-z])ocr([^a-z]|$)/ },
      { label: "OCR 엔진 이름", pattern: /tesseract|textract/ },
      { label: "비전 API", pattern: /(^|[^a-z])vision([^a-z]|$)/ },
      { label: "온디바이스 ML 키트", pattern: /ml-?kit/ },
      { label: "인식(recognition)", pattern: /recogni/ },
      { label: "이미지 라벨링", pattern: /image-label/ },
      { label: "영수증 인식", pattern: /(receipt|영수증)[a-z_.가-힣-]*(scan|ocr|ai|인식|스캔|판독)/ },
      { label: "인식 대상이 영수증", pattern: /(scan|ocr|인식|판독)[a-z_.가-힣-]*(receipt|영수증)/ },
      { label: "AI/LLM 이름 조각", pattern: /(^|[^a-z])(ai|llm)[-_]|[-_](ai|llm)([^a-z]|$)/ }
    ],
    exemptions: [],
    tripSample: { kind: "dependency", name: "@some-vendor/receipt-ocr" }
  },
  {
    id: "community",
    clausePhrase: "커뮤니티",
    roots: ["schema-table", "schema-column", "api-endpoint", "mobile-route", "admin-route"],
    rootsReason:
      "커뮤니티는 **글과 관계가 쌓이는 기능**이라 테이블(글·댓글·팔로우)과 표면(라우트·엔드포인트)으로 온다. " +
      "⚠️ 의존성 뿌리는 이 항목에 두지 않는다: 커뮤니티는 라이브러리로 들어오지 않고, 그 뿌리에서 이 바늘이 무는 것은 " +
      "**이름만 같은 이웃**이다(`@react-native-community/cli`는 React Native 벤더 네임스페이스이지 제품 표면이 아니다). " +
      "그 하나를 면제 줄로 적는 것보다 뿌리에서 가르는 편이 정직하다 — 면제 목록은 좁을수록 값이다.",
    needles: [
      { label: "커뮤니티", pattern: /community|커뮤니티/ },
      { label: "게시글", pattern: /(^|[^a-z])posts?([^a-z]|$)|게시(글|판)/ },
      { label: "댓글", pattern: /(^|[^a-z])comments?([^a-z]|$)|댓글/ },
      { label: "피드", pattern: /(^|[^a-z])feeds?([^a-z]|$)/ },
      { label: "좋아요", pattern: /(^|[^a-z])(likes?|hearts?)([^a-z]|$)/ },
      { label: "팔로우", pattern: /(^|[^a-z])follow(er|ers|ing|s)?([^a-z]|$)|팔로/ },
      { label: "스레드", pattern: /(^|[^a-z])threads?([^a-z]|$)/ },
      { label: "답글", pattern: /(^|[^a-z])(replies|reply)([^a-z]|$)/ }
    ],
    exemptions: [],
    tripSample: { kind: "mobile-route", name: "community/index.tsx" }
  },
  {
    id: "price-tracking",
    clausePhrase: "가격 추적",
    roots: ["schema-table", "schema-enum", "schema-column", "worker-job", "api-endpoint"],
    rootsReason:
      "가격 추적은 **시간축이 생기는 일**이다 — 이력 테이블 · 시계열 칸 · 그것을 채우는 주기 잡 · 비교/알림 엔드포인트. " +
      "⚠️ 열 바늘 하나는 `product_links`에만 앵커를 건다: 가격은 링크에 붙고, 그 행에 가격 칸이 **오늘 둘보다 늘어나는 것**이 " +
      "곧 경계다. `item_templates`의 `price_min_krw`·`price_max_krw`는 카탈로그의 정적 가격대(시간축이 없다)라 그 앵커 밖이고, " +
      "혹시 그쪽에 시간축이 생기더라도 앞의 두 바늘(이력·추이 모양)이 테이블·열 전수에서 잡는다. " +
      "라우트 뿌리는 두지 않는다 — 화면은 그 데이터가 생긴 뒤에 온다.",
    needles: [
      { label: "가격 이력·추이 모양", pattern: /(price|가격)[a-z_.가-힣-]*(history|log|trend|series|chart|alert|watch|daily|weekly|이력|추이|알림)/ },
      { label: "이력·추이가 가격을 가리키는 모양", pattern: /(history|log|trend|series|이력|추이)[a-z_.가-힣-]*(price|가격)/ },
      { label: "최저가 비교", pattern: /lowest[-_]?price|최저가|가격비교|price[-_]?compare/ },
      { label: "가격 인하 알림·추적", pattern: /price[-_]?(drop|track)|가격인하|가격추적/ },
      { label: "링크 행의 가격 칸", pattern: /^product_links\.[a-z_]*(price|가격)/, kinds: ["schema-column"] },
      {
        // ⚠️ 정찰이 이름 붙인 실패 시나리오가 정확히 이 자리다: *"스냅샷을 주기적으로 갱신하는
        // 워커 잡"*. 그런 잡의 이름은 대개 `price-refresh`이고 '이력'도 '추이'도 말하지 않는다 —
        // 위 네 바늘은 전부 그것을 놓친다. 잡·테이블·열거형은 이름 공간이 좁아 넓은 낱말이 값이다.
        label: "가격이 이름에 선 잡·테이블·열거형",
        pattern: /price|가격/,
        kinds: ["worker-job", "schema-table", "schema-enum"]
      }
    ],
    exemptions: [
      {
        kind: "schema-column",
        name: "product_links.price_snapshot_krw",
        reason:
          "가격 추적이 아니라 **정직 표시**의 근거다. 이 칸은 링크의 '현재값 한 벌'이고 행이 쌓이지 않는다 — " +
          "쓰임은 '언제 확인한 값인지 모르면 가격을 아예 싣지 않는다'(items-catalog.service.ts의 toProductLinkDto)이며, " +
          "조항이 말하는 가격 추적/최저가 비교가 아니다(라운드 84 리뷰 L-8이 정정한 그대로). " +
          "⚠️ 이 칸을 지우거나 옮기는 것은 이 스윕의 일이 아니다 — 그 값이 사라지면 정직 표시의 근거가 사라진다.",
        resumeWhen:
          "이 칸이 **행으로 쌓이기 시작하는 날** — 가격 이력/추이 테이블이 서거나, product_links에 시계열 칸이 붙거나, " +
          "스냅샷을 주기적으로 갱신하는 워커 잡이 생기거나, 최저가 비교·가격 인하 알림 표면이 서는 날. " +
          "그날 이 면제 줄을 거두고 위반으로 읽는다(그 셋 중 앞의 둘은 위 바늘 넷이 이미 따로 문다).",
        provenBy:
          "스키마에 가격 이력·스냅샷 테이블이 0건이고 product_links의 가격 칸이 이 둘뿐이라는 것 · " +
          "apps/api/src/worker 아래 어느 파일도 이 칸 이름을 쓰지 않는다는 것(주기 수집 잡 부재)."
      },
      {
        kind: "schema-column",
        name: "product_links.price_checked_at",
        reason:
          "짝이 되는 칸이다 — 가격을 **언제** 확인했는지(NULL = 모름). 시각 하나가 값 하나에 붙어 있을 뿐 " +
          "행이 쌓이지 않으므로 시간축이 아니고, 이 칸이 없으면 위 칸의 정직 표시가 성립하지 않는다(둘은 한 벌이다).",
        resumeWhen:
          "같은 날 — 이 칸이 여러 시점을 담기 시작하거나(이력 테이블 · 시계열 칸), 사람이 아닌 잡이 이 칸을 주기적으로 " +
          "갱신하기 시작하는 날. 오늘 이 칸을 쓰는 손은 어드민의 대량 적용 하나이고 그것은 사람의 손이다.",
        provenBy: "위와 같다(같은 두 확인이 두 칸을 함께 증명한다)."
      }
    ],
    tripSample: { kind: "schema-table", name: "product_link_price_history" }
  },
  {
    id: "used-market",
    clausePhrase: "중고 연동",
    roots: ["schema-table", "schema-enum", "schema-enum-value", "api-endpoint", "dependency", "mobile-route", "admin-route"],
    rootsReason:
      "조항의 말은 중고 **연동**이다 — 플랫폼 축이지 물건의 상태가 아니다. 그래서 뿌리에 열거형(값 한 줄이 가장 싼 입구)과 " +
      "의존성·엔드포인트·라우트를 두고, **열 뿌리는 두지 않는다**: `item_templates.used_secondhand_ok`는 " +
      "'이 품목은 중고로 사도 되는가'라는 카탈로그 속성이고 연동이 아니다(그리고 `refresh_tokens.used_at`처럼 " +
      "영어 낱말 'used'는 칸 이름에서 잡음이 크다). 바늘도 같은 판단을 진다 — 이름 하나만으로 걸지 않고 " +
      "**플랫폼 이름**이거나 **연동을 뜻하는 낱말과 붙은 모양**일 때만 문다.",
    needles: [
      { label: "중고 플랫폼 이름", pattern: /danggeun|당근마켓|karrot|bunjang|번개장터|joonggonara|중고나라|hellomarket|헬로마켓/ },
      { label: "중고 + 연동 낱말", pattern: /(used|second[-_]?hand|중고)[a-z_.가-힣-]*(platform|market|listing|deal|api|integration|sync|feed|연동|장터|거래)/ },
      { label: "연동 낱말 + 중고", pattern: /(platform|market|listing|deal|integration|연동|장터|거래)[a-z_.가-힣-]*(used|second[-_]?hand|중고)/ },
      { label: "중고 장터 표면", pattern: /(^|[^a-z])used[-_]?(market|goods|deal)([^a-z]|$)/ }
    ],
    exemptions: [],
    tripSample: { kind: "schema-enum-value", name: "product_platform.danggeun" }
  },
  {
    id: "insurance-finance",
    clausePhrase: "보험/금융 제휴",
    roots: ["schema-table", "schema-enum", "schema-enum-value", "schema-column", "api-endpoint", "dependency", "mobile-route", "admin-route"],
    rootsReason:
      "제휴 상품은 **종별로 들어온다** — 링크 종별(열거형 값) · 상품 테이블 · 전용 화면 · 파트너 SDK. 그래서 뿌리가 가장 넓다. " +
      "⚠️ `finance`라는 낱말은 바늘로 쓰지 않는다: 서버의 `apps/api/src/finance`는 가계 지출·예산 도메인의 이름이고 " +
      "제휴가 아니다(이름만 같은 이웃을 무는 바늘은 첫날부터 면제 줄을 부른다). 대신 **상품 종별의 이름**으로 문다.",
    needles: [
      { label: "보험", pattern: /insurance|보험/ },
      { label: "대출", pattern: /(^|[^a-z])loans?([^a-z]|$)|대출/ },
      { label: "담보대출", pattern: /mortgage|담보대출/ },
      { label: "연금", pattern: /pension|연금/ },
      { label: "카드 발급", pattern: /credit[-_]?card[-_]?(issue|apply)|카드발급|카드신청/ },
      { label: "예적금·펀드", pattern: /적금|예금|펀드|(^|[^a-z])funds?([^a-z]|$)/ },
      { label: "투자", pattern: /(^|[^a-z])invest(ment|ments)?([^a-z]|$)|투자/ }
    ],
    exemptions: [],
    tripSample: { kind: "api-endpoint", name: "partners/insurance" }
  },
  {
    id: "medical-advice",
    clausePhrase: "의료 조언",
    roots: ["schema-table", "schema-column", "api-endpoint", "mobile-route", "admin-route"],
    rootsReason:
      "의료 조언이 기능이 되면 **진단·증상·처방을 다루는 데이터와 표면**이 생긴다. " +
      "⚠️ 문구 축은 이 항목의 뿌리가 아니다 — 추천 문구가 효능을 단정하지 않는지는 DNC-020이 문구 자체로 이미 문다 " +
      "(item-trust-notes.test.ts). 이 스윕이 묻는 것은 그 옆 칸이다: **조언을 담을 자리가 생겼는가.** " +
      "의존성 뿌리는 두지 않는다(의료 조언은 SDK로 오지 않고, 온다면 위 다섯 중 하나를 반드시 지난다).",
    needles: [
      { label: "진단", pattern: /diagnos|진단/ },
      { label: "증상", pattern: /symptom|증상/ },
      { label: "처방", pattern: /prescription|처방/ },
      { label: "복용량", pattern: /dosage|복용/ },
      { label: "치료", pattern: /treatment|치료/ },
      { label: "원격진료", pattern: /telemedicine|원격진료|비대면진료/ },
      { label: "의료 상담·조언", pattern: /medical[-_]?(advice|consult)|의료[-_\s]?(상담|조언)/ }
    ],
    exemptions: [],
    tripSample: { kind: "api-endpoint", name: "children/:childId/symptom-advice" }
  }
];

// ── 판정 ──────────────────────────────────────────────────────────────────────

export type ScopeViolation = {
  readonly itemId: string;
  readonly needle: string;
  readonly kind: ScopeNameKind;
  readonly name: string;
  readonly where: string;
};

/** 실패 메시지 한 줄 — 어느 항목의 어느 바늘이 어디서 걸렸는가. */
export function describeViolation(violation: ScopeViolation): string {
  return `${violation.itemId} · ${violation.needle} · ${violation.kind} \`${violation.name}\` (${violation.where})`;
}

/** 한 항목의 바늘에 걸리는 자리 전수 — **면제를 빼지 않는다**(유령 면제 검사가 이것을 읽는다). */
export function findScopeHits(item: OutOfScopeItem, names: readonly ScopeName[]): ScopeViolation[] {
  const hits: ScopeViolation[] = [];
  for (const name of names) {
    if (!item.roots.includes(name.kind)) continue;
    const haystack = name.name.toLowerCase();
    for (const needle of item.needles) {
      if (needle.kinds && !needle.kinds.includes(name.kind)) continue;
      if (needle.pattern.test(haystack)) {
        hits.push({ itemId: item.id, needle: needle.label, kind: name.kind, name: name.name, where: name.where });
      }
    }
  }
  return hits;
}

function isExempt(item: OutOfScopeItem, hit: ScopeViolation): boolean {
  return item.exemptions.some((exemption) => exemption.kind === hit.kind && exemption.name === hit.name);
}

/** 한 항목의 위반 전수 — 면제 대장에 선 자리를 뺀 나머지. 여기 한 줄이라도 남으면 경계가 넘어갔다. */
export function findScopeViolations(item: OutOfScopeItem, names: readonly ScopeName[]): ScopeViolation[] {
  return findScopeHits(item, names).filter((hit) => !isExempt(item, hit));
}

/** 실패했을 때 사람에게 무엇을 하라고 말하는가(항목마다 다르다 — 한 덩어리 메시지를 쓰지 않는다). */
export function scopeFailureHint(item: OutOfScopeItem): string {
  return (
    `DNC-016 범위 밖 항목 "${item.clausePhrase}"(${item.id})의 이름이 저장소에 생겼어요. ` +
    "이 조항은 MVP 범위를 잠근 절대 규칙이라 임의로 열 수 없어요 — 기능이 정말 필요하면 " +
    "docs/dev/do-not-change.md 개정을 먼저 문서로 남기고(PM/Tech Lead 승인), " +
    "범위 밖이 아닌 자리라면 이 항목의 뿌리·바늘·면제(packages/test-utils/src/dnc-scope-guard.ts)를 " +
    "이유와 재개 조건과 함께 고치세요."
  );
}

// ── 문서에서 여섯을 읽는다 ────────────────────────────────────────────────────

/** DNC-016 행의 "Do Not Change" 칸에서 범위 밖 문구 전수를 파싱한다(수도 이름도 손으로 적지 않는다). */
export function parseOutOfScopePhrases(contractSource: string): string[] {
  const row = contractSource.split("\n").find((line) => /^\|\s*DNC-016\s*\|/.test(line));
  if (!row) return [];
  const cells = row.split("|").map((cell) => cell.trim());
  const locked = cells[3] ?? "";
  const enumeration = locked.split(/은\s*MVP/)[0];
  return enumeration
    .split(",")
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

// ── DNC-001 판정(계약 ⓔ) ──────────────────────────────────────────────────────

/**
 * ⚠️ **라운드 84 대장의 가설을 오늘 판정한다.**
 *
 * DNC-001의 재개 조건에는 *"또는 DNC-016의 부정 스윕이 서는 날 — 그 스윕의 모집단이 이 조항의
 * 첫 가드가 된다(같은 축이다)"* 라고 적혀 있었다. 오늘 그 스윕이 섰고, **같은 축이라는 말은
 * 가설이었다.** 실측은 아래와 같다: DNC-001이 이름으로 잠근 포지션 이탈 축은 셋인데, 이 스윕의
 * 여섯 가운데 그중 하나(커뮤니티)만 자기 항목으로 걷는다.
 *
 * 그리고 그 하나조차 이 조항의 가드가 되지 못한다 — 라운드 84 B가 세운 판정 기준 그대로다:
 * *"이웃 조항의 가드가 위반의 증상 하나를 부수적으로 잡는 것은 그 이웃의 가드다."* 커뮤니티
 * 라우트가 서면 빨개지는 것은 **DNC-016의 항목**이고, DNC-001이 잠근 것은 **포지션 문장**이다.
 */
export type PositionAxis = {
  /** 조항 문서의 DNC-001 행에 **글자로 실려 있어야 한다**(계약이 확인한다). */
  readonly axis: string;
  /** 이 스윕의 어느 항목이 그 축을 걷는가(없으면 null). */
  readonly sweptBy: string | null;
  readonly note: string;
};

export const DNC_001_POSITION_AXES: readonly PositionAxis[] = [
  {
    axis: "커뮤니티",
    sweptBy: "community",
    note:
      "이 스윕의 community 항목이 테이블·엔드포인트·라우트 축에서 걷는다. " +
      "⚠️ 다만 그것은 DNC-016의 항목이고, 그 빨강이 말하는 것은 '범위 밖 기능이 들어왔다'이지 '포지션이 바뀌었다'가 아니다."
  },
  {
    axis: "쇼핑몰",
    sweptBy: null,
    note:
      "범위 밖 여섯에 쇼핑몰이 없다 — 이 스윕의 바늘 어느 것도 자체 장바구니·결제·독립 카탈로그를 읽지 않는다. " +
      "제휴 링크로 밖에 내보내는 오늘의 커머스와 스스로 파는 것을 가르는 술어는 이 파일에 0건이다."
  },
  {
    axis: "일반 가계부",
    sweptBy: null,
    note:
      "같은 이유로 0건이다. 이 앱은 이미 지출을 기록하므로 그 축의 이탈은 '기록이 생기는 것'이 아니라 " +
      "'아이·시기 축이 빠지는 것'인데, 이름을 세는 이 스윕은 무엇이 **빠지는지**를 보지 못한다(그물의 방향이 반대다)."
  }
];

/**
 * 판정 — **무가드로 남는다.**
 *
 * 셋 중 하나만 걷히고, 그 하나도 이웃(DNC-016)의 가드다. 래칫은 실제로 닫힌 수(DNC-016 하나)만큼만
 * 내린다 — 3 → 2. ⚠️ 이 줄은 계약이 파생값과 대조한다(손으로 적힌 판정이 되지 않도록).
 */
export const DNC_001_SWEEP_VERDICT = "unguarded" as const;

/** 이 스윕이 걷는 포지션 축 — 대장에 적는 수의 출처다(손으로 세지 않는다). */
export function sweptPositionAxes(): readonly PositionAxis[] {
  return DNC_001_POSITION_AXES.filter((axis) => axis.sweptBy !== null);
}
