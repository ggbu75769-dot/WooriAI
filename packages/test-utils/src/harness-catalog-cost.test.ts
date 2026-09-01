// 라운드 95 트랙 D (round95-scout #4 · 결정 #14의 모집단) — **공유 테스트 DB의 누적을 *만드는
// 손*을 세는 자.**
//
// ## 이 파일이 무는 것
//
// `wooriai_test`의 `item_templates`는 라운드마다 **누적**된다(일곱째 시점 9,545 · 활성 8,888 ·
// 753MB — ⚠️ 그 수는 **정찰이 psql로 손으로 잰 환경의 값**이고 이 파일이 내는 수가 아니다).
// 결정 #14(*어느 표를 언제 무엇으로 비울 것인가*)는 여섯 라운드째 열려 있고, 그 결정이 기다리는
// **첫 모집단** — *누구의 손이 그 행을 올렸는가* — 는 지금까지 **아무도 세지 않았다.**
//
// 라운드 91 트랙 C가 세운 짝 계약(`apps/api/test/harness-catalog-cost.test.ts`)의 조항 ⓔ는
// **지우는 쪽**을 센다: 셋업 폐포가 정리를 0건 한다는 부정 단언이다. 그런데 같은 축의 **만드는
// 쪽**은 그 파일 어디에도 없다 — 그 파일의 바늘 목록에 `deleteMany`·`truncate`는 있고
// 생성 낱말은 **0건**이다. 오늘 이 파일이 그 비대칭의 반대쪽을 연다.
//
// ⚠️⚠️ **이 트랙은 결정 #14를 집지 않는다.** *어느 표를 언제 비울 것인가*는 그대로 열어 두고,
// 이 자는 **자만 세운다**. 정리 걸음을 *더하는 것*도 이 트랙의 축이 아니다.
//
// ## ⚠️⚠️ 이 파일은 **저장소 그물이 아니다**
//
// 저장소 그물 **열다섯**(`contract-net-ledger.test.ts`가 세는 그 수)에 들지 않는다: 걷는 뿌리는
// `apps/api/test/**` **하나**이고, `CONTRACT_NETS_BEFORE_THIS_ONE`도
// `CONTRACT_NET_COUNT_WITH_THIS_ONE`도 부르지 않는다. 그 사실을 산문이 아니라 값으로 적는다 —
// 아래 `scanRootCount()`가 **1**이다. ⚠️ 이 파일은 **어떤 이름도 export하지 않는다**(그래서
// 사문 대장의 모집단에도 서지 않는다).
//
// ## 이 파일이 묻는 여섯
//
//  ⓐ **모집단** — `apps/api/test/**`를 걷어 `itemTemplate`의 **생성 꼴** 자리를 전수로 낸다
//     (오늘 **17 · 파일 10**). ⚠️ 손 목록 금지 · 바늘은 **조각으로 이어** 짓는다(자기 배제).
//  ⓑ **판정 셋** — 자리마다 *정리 걸음이 곁에 있는가*를 **넓이가 다른 자 셋**으로 낸다:
//     같은 파일 · 뒤따름 · 이름을 무는 정리. 오늘 정리 없는 자리는 **7 · 9 · 11**이다.
//     ⚠️⚠️ 판정에서 파생하지 않는 자리가 **0건**임을 부정 단언으로 못 박는다.
//  ⓒ **래칫** — *정리 없이 만드는 자리*는 **자마다 늘지 않는다**(오늘 값이 곧 상한).
//     모집단은 **하한**으로 들되 오늘 값(17)이 아니라 **느슨한 하한**이다 — 그 근거는 아래.
//  ⓓ **비대칭의 값 + 두 시점** — 짝 계약이 지우는 쪽 0건을 물고 있다는 사실과, 만드는 쪽
//     열일곱이 오늘 처음 세어졌다는 사실을 **나란히** 놓는다.
//  ⓔ **재개 조건** — 결정 #14를 그대로 열어 두고, 그 술어 하나가 오늘 닫혔음을 기록한다.
//  ⓕ **사각** — 이 계약이 못 보는 것을 값과 하한으로 적는다(넷).
//
// ⚠️ **DB를 쓰지 않는다.** 전부 소스 대조라, PostgreSQL 없이도 초록이다.
// ⚠️ **`apps/api/**`를 한 바이트도 쓰지 않는다** — 읽는 함수만 부른다(아래 ⓓ가 값으로 문다).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "..", "..");

// ---------------------------------------------------------------------------
// ⓐ 뿌리와 바늘 — ⚠️ 바늘은 **조각으로 잇는다**(이 파일이 제 바늘에 걸리지 않게)
// ---------------------------------------------------------------------------

/** 걷는 뿌리 — `apps/api/test` **하나**. 저장소 그물이 아니라는 사실의 값. */
const SCAN_ROOT = ["apps", "api", "test"] as const;

function scanRootCount(): number {
  return 1;
}

/** 짝 계약 — 라운드 91 C가 세운, **지우는 쪽만** 무는 파일. */
const SIBLING_CONTRACT = "harness-catalog-cost.test.ts";

/** 바늘이 무는 Prisma 모델 — **한 낱말**로 든다(사각 ⓐ가 이 하나뿐임을 값으로 진다). */
const MODEL = "itemTemplate";

/** 올리는 손의 꼴 — 값으로 적는다. */
const CREATE_VERBS = ["create", "createMany", "createManyAndReturn", "upsert"] as const;

/** 내리는 손의 꼴 — 값으로 적는다. */
const CLEANUP_VERBS = ["delete", "deleteMany"] as const;

/** 표를 통째로 비우는 꼴 — 모델 호출이 아니라 **날 SQL**로 오는 자리. */
const RAW_CLEANUP_SOURCE = "(?:truncate|drop\\s+table)[^\\n]*item_templates";

/**
 * 트랜잭션 롤백 꼴 — ⚠️ **오늘 0건이다.**
 *
 * 이 저장소의 e2e는 `$transaction` 안에서 일부러 던져 되감는 관례를 쓰지 않고, 만든 행을
 * `afterAll`/`finally`에서 지운다. 그래도 낱말을 **바늘에 넣어 둔다** — 그 관례가 서는 날
 * 이 자가 그 자리를 정리로 읽어야 하고, 오늘의 0은 값으로 아래 ⓕ가 진다.
 */
const ROLLBACK_SOURCE = "\\$transaction[^\\n]*rollback|rollback\\(\\)";

/** ⚠️ 모델 호출 바늘 — 낱말을 이어 붙여 짓는다(이 파일 안에 `모델.동사(` 리터럴이 없다). */
function modelCallNeedle(verbs: readonly string[]): RegExp {
  return new RegExp(`\\b${MODEL}\\s*\\.\\s*(?:${verbs.join("|")})\\s*\\(`);
}

function createNeedle(): RegExp {
  return modelCallNeedle(CREATE_VERBS);
}

function cleanupNeedle(): RegExp {
  return new RegExp(`${modelCallNeedle(CLEANUP_VERBS).source}|${RAW_CLEANUP_SOURCE}|${ROLLBACK_SOURCE}`, "i");
}

/** 이름을 받는 생성 자리 — `const x = await …생성(` 의 `x`. */
function bindingNeedle(): RegExp {
  return new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s+)?[\\w.]*${modelCallNeedle(CREATE_VERBS).source}`);
}

/** 주석 줄인가 — 주석에서 낱말을 부르는 자리는 손이 아니다. */
function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

// ---------------------------------------------------------------------------
// 걷기 — ⚠️ 손 목록이 아니라 파생
// ---------------------------------------------------------------------------

type Site = {
  readonly file: string;
  /** 1부터 세는 줄 번호 — **사람이 찾아가는 용도이지 신원이 아니다**(줄은 밀린다). */
  readonly line: number;
  readonly text: string;
  /** 생성 자리가 받은 이름(없으면 null). */
  readonly binding: string | null;
};

type Entry = { readonly file: string; readonly text: string };

function walkRoot(baseDir: string): readonly Entry[] {
  const root = join(baseDir, ...SCAN_ROOT);
  const out: Entry[] = [];
  const walk = (dir: string): void => {
    let listing: string[];
    try {
      listing = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of listing) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!name.endsWith(".ts")) continue;
      out.push({ file: relative(root, abs).split("\\").join("/"), text: readFileSync(abs, "utf8") });
    }
  };
  walk(root);
  return out.sort((left, right) => left.file.localeCompare(right.file));
}

/** 한 뭉치의 소스에서 **올리는 손**과 **내리는 손**을 전수로 낸다. */
function collectHands(entries: readonly Entry[]): { readonly creates: readonly Site[]; readonly cleanups: readonly Site[] } {
  const creates: Site[] = [];
  const cleanups: Site[] = [];
  const create = createNeedle();
  const cleanup = cleanupNeedle();
  const binding = bindingNeedle();
  for (const entry of entries) {
    entry.text.split("\n").forEach((line, index) => {
      const trimmed = line.trim();
      if (isCommentLine(trimmed)) return;
      if (create.test(line)) {
        const matched = binding.exec(line);
        creates.push({ file: entry.file, line: index + 1, text: trimmed, binding: matched ? matched[1] : null });
      }
      if (cleanup.test(line)) {
        cleanups.push({ file: entry.file, line: index + 1, text: trimmed, binding: null });
      }
    });
  }
  return { creates, cleanups };
}

// ---------------------------------------------------------------------------
// ⓑ 판정 셋 — ⚠️⚠️ **넓이가 다른 자 셋**이고, 셋 다 손 목록이 아니라 소스에서 파생한다
// ---------------------------------------------------------------------------

/**
 * 자 셋 — 넓은 것부터 좁은 것으로.
 *
 *  · `same-file` — 같은 파일 어딘가에 정리 걸음이 있다. **정찰의 계약 ⓑ가 쓴 그 말 그대로**이고,
 *    줄 번호에 매이지 않아 가장 안정하다. ⚠️ 오차 방향은 **거짓 초록**이다 — 그 파일의 다른
 *    행을 지우는 걸음이 이 행까지 지운다고 믿어 준다.
 *  · `forward` — 정리 걸음이 그 생성 **뒤에** 온다. 앞에만 있는 정리(다른 블록의 뒷정리)를
 *    공으로 세지 않는다. ⚠️ 임의의 창 크기를 쓰지 않는다 — *뒤인가*만 묻는다.
 *  · `bound` — 정리 걸음이 그 생성이 **받은 이름**을 문다(`…create` → `delete({ id: x.id })`).
 *    가장 좁고 가장 **거짓 빨강** 쪽이다: 이름을 모듈 변수로 옮겨 담고 지우는 옳은 자리를
 *    정리로 읽지 못한다(오늘 `link-health.db.test.ts:43`이 그 실물이다).
 *
 * ⚠️⚠️ **셋을 함께 두는 것이 이 파일의 판단이다.** 하나만 두면 그 자의 오차 방향이 곧 계약의
 * 오차 방향이 된다. 셋을 나란히 두면 *어느 자로 봐도 정리 없는 자리*(오늘 **7**)가 이 빚의
 * 다툴 수 없는 바닥이고, *가장 좁은 자가 보는 수*(오늘 **11**)가 그 천장이다.
 */
const GAUGES = ["same-file", "forward", "bound"] as const;
type Gauge = (typeof GAUGES)[number];

function isCleanedBy(gauge: Gauge, site: Site, cleanups: readonly Site[]): boolean {
  const sameFile = cleanups.filter((step) => step.file === site.file);
  if (gauge === "same-file") return sameFile.length > 0;
  if (gauge === "forward") return sameFile.some((step) => step.line > site.line);
  if (site.binding === null) return false;
  const named = new RegExp(`\\b${site.binding}\\b`);
  return sameFile.some((step) => named.test(step.text));
}

type Judgment = { readonly site: Site; readonly cleaned: boolean; readonly gauge: Gauge };

function judge(gauge: Gauge, creates: readonly Site[], cleanups: readonly Site[]): readonly Judgment[] {
  return creates.map((site) => ({ site, gauge, cleaned: isCleanedBy(gauge, site, cleanups) }));
}

function uncleanedCount(gauge: Gauge, creates: readonly Site[], cleanups: readonly Site[]): number {
  return judge(gauge, creates, cleanups).filter((row) => !row.cleaned).length;
}

// ---------------------------------------------------------------------------
// ⓒ 래칫과 하한 — ⚠️⚠️ **방향을 고른 근거를 값 옆에 적는다**
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **정리 없는 자리는 *상한*이 옳다 — 그러나 정찰이 적은 수가 아니라 *오늘 다시 잰 수*가
 * 상한이어야 한다.**
 *
 * 정찰(round95-scout #4)은 *정리 걸음 **넷** ⇒ 정리 없는 자리 **열셋***을 적고 그 열셋을 상한으로
 * 두라고 했다. 오늘 같은 뿌리를 걸어 다시 재니 **정리 걸음은 열여섯**이고(정찰이 이름으로 든 넷은
 * `onboarding` 둘 · `admin-affiliate-click-breakdown` 둘뿐이다 — `items-commerce` 일곱 ·
 * `link-health` 둘 · `data-retention-purge` 둘 · `product-link-price-honesty` 하나가 빠졌다),
 * 정리 없는 자리는 **자에 따라 7 · 9 · 11**이다. **어느 자로 봐도 열셋에 못 미친다.**
 *
 * ⚠️ 그래서 정찰의 열셋을 상한으로 옮겨 적었다면 이 계약은 **첫날부터 거짓 초록**이다: 새 자리가
 * 둘 붙어도 상한 아래에 남는다. **상한은 물려받는 수가 아니라 오늘 잰 수다** — 이것이 이 파일이
 * 정찰의 수를 그대로 옮기지 않은 이유이고, "수치는 하한 · 재실측 기준"이라는 규율의 실물이다.
 *
 * ⚠️⚠️ **그리고 상한 하나만으로는 이 축이 지켜지지 않는다.** 정리 없는 자리의 수는 *정리를
 * 더해서*(옳은 길)도 줄지만 *생성을 지워서*(축과 무관한 길)도 준다. 그래서 상한은 **모집단
 * 하한과 짝으로만** 뜻이 선다 — 아래 둘은 한 몸이다.
 */
function uncleanedCeilingToday(): Readonly<Record<Gauge, number>> {
  return { "same-file": 7, forward: 9, bound: 11 };
}

/**
 * ⚠️⚠️ **모집단은 하한이되 오늘의 값(17)이 아니다.**
 *
 * 정찰의 계약 ⓓ는 *"모집단 열일곱은 줄지 않는다"* 를 하한으로 적었다. 그 모양은 이 계약을
 * **자기가 섬기는 결정과 싸우게** 만든다: 결정 #14가 내려져 픽스처를 한 자리로 모으면 생성
 * 자리는 **정직하게 줄고**, 등호에 가까운 하한은 그 옳은 손에게 빨강을 준다(라운드 89 D가
 * `dead-export-ledger`의 하한을 셋에 둔 채 값이 넷→여섯으로 오르는 것을 지켜본 그 판단과 같다).
 *
 * 그래서 하한의 일은 *오늘의 수를 지키는 것*이 아니라 **걷기가 깨졌을 때 판정보다 먼저 빨개지는
 * 것**이다. 하한을 **12**에 둔다 — 오늘 17보다 낮고, 한 파일의 최대 몫(`items-commerce` **4**)의
 * 세 배보다 커서 **걷기가 한두 파일만 읽고 끝나면 판정을 세기 전에 운다.**
 */
const POPULATION_FLOOR = 12;

/** 파일 수의 하한 — 같은 이유로 느슨하다(오늘 10). */
const POPULATION_FILE_FLOOR = 6;

/** 정리 걸음 수의 하한 — 오늘 16. 이 수는 래칫이 아니라 **기록**이다(상한이 이미 그 몫을 진다). */
const CLEANUP_STEP_FLOOR = 10;

// ---------------------------------------------------------------------------
// ⓕ 사각 — 이 계약이 **세지 않는** 것들 (넷)
// ---------------------------------------------------------------------------

/**
 * ⚠️ **ⓐ `itemTemplate` 밖의 표는 이 바늘 밖이다.** 라운드 91 C가 적어 둔 여섯 표 가운데 이 자는
 * **하나**만 본다(`MODEL`이 한 낱말인 것이 그 사실의 값이다). `productLink`·`affiliateClick`·
 * `childItemStatus`·`itemTemplateStage`·`category`가 만드는 누적은 세지 않는다.
 * ⚠️ **재개 조건(사건형): 다른 표에서 누적이 처음 값으로 잡히는 날** — 그날 `MODEL` 한 낱말이
 * 목록이 되고, 그 순간 이 파일의 자기 배제(바늘을 조각으로 잇는 관례)가 다시 검사되어야 한다.
 *
 * ⚠️ **ⓑ 시드(`apps/api/prisma/seed.ts`)가 만드는 행은 이 바늘 밖이다.** 그쪽은 `upsert`라 멱등이고,
 * 누적이 아니라 **고정 62**다. 뿌리를 `apps/api/test`로 둔 것이 그 배제의 실물이다(손 목록이 아니다).
 *
 * ⚠️ **ⓒ 정리가 *같은 파일*에 있는지만 본다.** 다른 파일이나 전역 훅이 지우면 이 자가 못 본다.
 * 세 자 가운데 둘(`forward`·`bound`)의 오차 방향은 **거짓 빨강 = 안전**이고, 가장 넓은
 * `same-file`만 **거짓 초록** 쪽이다 — 그래서 셋을 함께 둔다.
 *
 * ⚠️ **ⓓ 소스 대조이지 DB가 아니다.** 아래 수는 **정찰이 psql로 손으로 잰 환경의 값**이지 이
 * 계약이 내는 수가 아니다. **두 수를 한 낱말로 적지 않는다** — 이 파일은 DB에 붙지 않는다.
 */
const SCOUTED_ENVIRONMENT_SEVENTH = {
  itemTemplatesTotal: 9545,
  itemTemplatesActive: 8888,
  databaseSizeMb: 753,
  seededItemTemplates: 62,
  /** 여섯째 → 일곱째 오름. 다섯째 → 여섯째는 +37이었다 — **오름이 빨라졌다.** */
  growthSinceSixth: 69
} as const;

// ---------------------------------------------------------------------------
// ⓓ·ⓔ 두 시점 — ⚠️⚠️ **옛 문장을 지우지 않고 오늘 옆에 둔다**
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **두 시점 ① — `apps/api` 접점 0건의 규율.**
 *
 * **옛 문장(round95-scout #4 · 보존)**: *"`apps/api/**`가 **네 라운드 연속 접점 0건**이었고
 * (91이 다섯 라운드 만에 열었다) 이 후보가 그 0을 깬다"* · 트랙 머리는 *"유일한 api 트랙 ·
 * `apps/api/**` 접점 0건이 다섯 라운드 만에 깨진다"* 였다. 그 문장은 세는 자가 **`apps/api/test`
 * 안에** 설 것을 전제했다.
 *
 * **오늘**: 세는 자는 `packages/test-utils/src`에 섰다. 그래서 그 문장은 **예고한 방향이 아니라
 * 다른 방향으로** 깨진다 —
 *  · **바이트 접점은 여전히 0이다**: 이 자는 `apps/api/**`를 **읽기만** 한다(쓰는 함수를
 *    import하지 않는다 — 아래 단언이 import 줄 전수로 그 사실을 진다).
 *  · **읽기 접점은 오늘 처음 선다**: `packages/test-utils/src` 아래에서 `apps/api/test/**`를
 *    **디렉터리로 걷는 자**는 오늘 이 파일이 처음이다(종전 다섯 파일은 경로를 *문자열로 이름만*
 *    불렀다 — `dnc-guard-ledger.ts` · `dnc-secret-scan.ts` · `resume-condition-ledger.ts`(+짝) 넷).
 * ⚠️ **두 낱말을 한 낱말로 적지 않는다**: *0바이트*와 *접점 0건*은 오늘 서로 다른 값이다.
 */
const API_TOUCH_TWO_POINTS = {
  /** 옛 문장이 센 것 — 라운드 91 이전 **네 라운드** 연속 0건. */
  scoutedZeroTouchRounds: 4,
  /** 오늘 이 트랙이 apps/api에 쓴 바이트. */
  bytesWrittenToApiToday: 0,
  /** 오늘 이 트랙이 apps/api에 세운 읽기 뿌리. */
  readRootsIntoApiToday: 1
} as const;

/**
 * ⚠️⚠️ **두 시점 ② — 결정 #14의 재개 조건과 그 술어 하나.**
 *
 * **옛 문장(라운드 91 C ~ 94 · 짝 계약 `apps/api/test/harness-catalog-cost.test.ts`의 ⓕ · 보존)**:
 * *"재개 조건(결정형 · 손은 저장소 안): **공유 테스트 DB를 언제 무엇으로 비울지**를 P3가 정하는
 * 날 — 비우는 순간 다른 스위트가 누적 위에서 초록인가가 처음 시험되므로, 그 결정 전에 ⓔ가 먼저
 * 빨개져 사람이 그 결정을 보게 한다."* 그 조건의 술어 가운데 하나가 **"올린 손을 세는 자 0건"**
 * 이었고, 그 자는 **여섯 라운드 동안 서지 않았다** — 짝 계약의 바늘 목록은 지우는 낱말만 들고
 * 생성 낱말을 **0건** 들었다(아래 단언이 그 파일의 소스로 그 0을 낸다).
 *
 * **오늘**: 그 술어가 **0 → 1**이 된다. 세는 자가 섰고, 첫 모집단은 **열일곱**이며 그중 정리
 * 없는 자리는 자에 따라 **7 · 9 · 11**이다.
 *
 * ⚠️⚠️ **그러나 결정은 그대로 열려 있다.** 이 트랙은 *어느 표를 언제 무엇으로 비울지*를 집지
 * 않는다 — 자만 세운다.
 * ⚠️ **재개 조건(결정형 · 손은 저장소 안): 정리 걸음을 관례로 세우는 날** — 그날 첫 모집단은
 * 오늘의 열일곱이고, 그날 지워야 할 자리는 오늘의 **7**(어느 자로 봐도 정리가 없는 바닥)에서
 * **11**(가장 좁은 자가 보는 천장) 사이다. 그 결정이 내려지면 아래 상한 셋은 **내려간다**.
 */
const DECISION_14_PREDICATE = {
  /** 옛 시점 — 올린 손을 세는 자의 수. */
  countersBefore: 0,
  /** 오늘 — 이 파일. */
  countersToday: 1,
  /** 그 술어가 닫히기를 기다린 라운드 수(91 → 95의 정찰 여섯 시점). */
  roundsWaited: 6
} as const;

// ---------------------------------------------------------------------------

const entries = walkRoot(repoRoot);
const { creates, cleanups } = collectHands(entries);
const createFiles = new Set(creates.map((site) => site.file));

describe("공유 테스트 DB 누적을 만드는 손 계약 (라운드 95 트랙 D · round95-scout #4 · 결정 #14의 모집단)", () => {
  it("ⓐ 모집단: 뿌리 하나를 걷어 올리는 손을 전수로 내고, 바늘을 조각으로 잇는다", () => {
    expect(scanRootCount()).toBe(1);
    expect(SCAN_ROOT.join("/")).toBe("apps/api/test");
    expect(MODEL).toBe("itemTemplate");
    expect([...CREATE_VERBS]).toEqual(["create", "createMany", "createManyAndReturn", "upsert"]);
    expect([...CLEANUP_VERBS]).toEqual(["delete", "deleteMany"]);

    // ⚠️ 자기 배제 — 이 파일은 제 바늘이 무는 **낱말 붙임꼴을 한 번도 적지 않는다**.
    //    (바늘을 조각으로 잇는 관례가 유령이 아님을 자기 소스로 보인다.)
    const self = readFileSync(join(repoRoot, "packages/test-utils/src", SIBLING_CONTRACT), "utf8");
    expect(createNeedle().test(self), "이 파일이 제 바늘에 걸려요 — 바늘을 조각으로 이어 주세요").toBe(false);

    // ⚠️⚠️ **이름이 같은 두 파일** — 뿌리 안에 `harness-catalog-cost.test.ts`가 **있다**. 그것은
    //    이 파일이 아니라 **짝 계약**(라운드 91 C)이다. 자기 배제를 *이름*으로 걸었다면 이 자는
    //    남의 파일을 자기로 알고 모집단에서 뺐을 것이다 — 배제는 **경로**가 진다(뿌리가 다르다).
    const walkedSibling = entries.find((entry) => entry.file === SIBLING_CONTRACT);
    expect(walkedSibling, "짝 계약이 뿌리에서 사라졌어요").toBeDefined();
    expect(walkedSibling!.text, "이름이 같다고 같은 파일이 아니다").not.toBe(self);
    // 그리고 그 짝 계약은 올리는 손을 0건 지고 있다(ⓓ가 그 0을 축으로 쓴다).
    expect(creates.some((site) => site.file === SIBLING_CONTRACT)).toBe(false);
  });

  it("ⓐ 유령 방지: 걷기가 깨지면 판정을 세기 전에 빨개진다", () => {
    expect(entries.length, "뿌리를 걷지 못했어요").toBeGreaterThan(0);
    expect(creates.length, "올리는 손이 0건이면 걷기가 깨진 것이다").toBeGreaterThanOrEqual(POPULATION_FLOOR);
    expect(createFiles.size).toBeGreaterThanOrEqual(POPULATION_FILE_FLOOR);
    expect(cleanups.length).toBeGreaterThanOrEqual(CLEANUP_STEP_FLOOR);
    // 자리가 한 파일에 몰려 있지 않다.
    expect(createFiles.size).toBeGreaterThanOrEqual(3);
    // 실재하는 파일들이다.
    for (const site of creates) {
      expect(entries.some((entry) => entry.file === site.file), `${site.file}이 뿌리에 없어요`).toBe(true);
    }
  });

  it("ⓑ 판정 셋: 모든 자리가 셋 다에서 파생하고, 파생하지 않는 자리가 0건이다", () => {
    for (const gauge of GAUGES) {
      const rows = judge(gauge, creates, cleanups);
      expect(rows.length, `${gauge}가 모든 자리를 판정하지 않았어요`).toBe(creates.length);
      // ⚠️⚠️ 판정에서 파생하지 않는 자리 — **0건**을 부정 단언으로 못 박는다.
      const undecided = rows.filter((row) => typeof row.cleaned !== "boolean");
      expect(undecided.map((row) => `${row.site.file}:${row.site.line}`)).toEqual([]);
      // 두 갈래의 합이 모집단이다(셋째 갈래가 몰래 생기지 않는다).
      expect(rows.filter((row) => row.cleaned).length + rows.filter((row) => !row.cleaned).length).toBe(creates.length);
    }

    // ⚠️ 자가 넓은 순서대로 정리를 **더 많이** 인정한다 — 셋의 뜻이 서로 어긋나지 않는다.
    const [wide, middle, narrow] = GAUGES.map((gauge) => uncleanedCount(gauge, creates, cleanups));
    expect(wide).toBeLessThanOrEqual(middle);
    expect(middle).toBeLessThanOrEqual(narrow);
    // 그리고 어느 자도 모집단 전부를 정리로 읽지 않는다(정리가 다 있으면 이 축이 없다).
    expect(wide).toBeGreaterThan(0);
  });

  it("ⓒ 래칫: 정리 없이 누적을 만드는 자리는 자마다 늘지 않는다 (오늘 7 · 9 · 11)", () => {
    const ceiling = uncleanedCeilingToday();
    for (const gauge of GAUGES) {
      const rows = judge(gauge, creates, cleanups).filter((row) => !row.cleaned);
      expect(
        rows.map((row) => `${row.site.file}:${row.site.line}`).length,
        `[${gauge}] 정리 없이 공유 테스트 DB에 누적을 만드는 자리가 늘었어요 — 만든 행을 같은 ` +
          "파일에서 지우거나(afterAll/finally), 늘려야 한다면 결정 #14를 먼저 문서로 남겨 주세요. " +
          `오늘 정리 없는 자리: ${rows.map((row) => `${row.site.file}:${row.site.line}`).join(" · ")}`
      ).toBeLessThanOrEqual(ceiling[gauge]);
    }
    // ⚠️ 상한이 **오늘 잰 수**임을 값으로 보인다 — 정찰의 열셋을 물려받았다면 거짓 초록이었다.
    expect(ceiling["same-file"]).toBe(uncleanedCount("same-file", creates, cleanups));
    expect(ceiling.forward).toBe(uncleanedCount("forward", creates, cleanups));
    expect(ceiling.bound).toBe(uncleanedCount("bound", creates, cleanups));
    // ⚠️ 그리고 어느 자의 상한도 정찰이 적은 열셋보다 **작다**(재실측이 정찰을 좁혔다).
    for (const gauge of GAUGES) expect(ceiling[gauge]).toBeLessThan(13);
    // ⚠️⚠️ 상한과 하한은 한 몸이다 — 하한이 없으면 생성을 지워 상한을 맞출 수 있다.
    expect(POPULATION_FLOOR).toBeLessThan(creates.length);
    expect(POPULATION_FLOOR).toBeGreaterThan(Math.max(...[...createFiles].map((file) => creates.filter((site) => site.file === file).length)));
  });

  it("ⓓ 비대칭의 값: 짝 계약은 지우는 쪽만 물고, 만드는 쪽은 오늘 처음 세어진다", () => {
    const sibling = readFileSync(join(repoRoot, ...SCAN_ROOT, SIBLING_CONTRACT), "utf8");
    // 짝 계약은 **지우는 낱말**을 값으로 들고 있다.
    expect(sibling).toContain("DESTRUCTIVE_TOKENS");
    expect(sibling).toContain("deleteMany");
    // ⚠️⚠️ 그런데 **만드는 쪽 바늘은 0건이다** — 그 0이 이 파일이 여는 자리다.
    expect(
      createNeedle().test(sibling),
      "짝 계약이 만드는 쪽을 세기 시작했어요 — 그렇다면 이 파일의 축이 그 파일과 겹칩니다"
    ).toBe(false);
    // 그 파일이 무는 것은 **셋업 폐포**이지 스위트가 만드는 행이 아니다.
    expect(sibling).toContain("SETUP_CLOSURE");

    // 오늘 세어진 만드는 쪽 — 열일곱 이상 · 파일 열 근처.
    expect(creates.length).toBeGreaterThanOrEqual(POPULATION_FLOOR);
    expect(DECISION_14_PREDICATE.countersBefore).toBe(0);
    expect(DECISION_14_PREDICATE.countersToday).toBe(1);
    expect(DECISION_14_PREDICATE.roundsWaited).toBeGreaterThan(0);
  });

  it("ⓓ 두 시점 ①: apps/api 바이트는 0이고, 읽기 뿌리는 오늘 처음 선다", () => {
    expect(API_TOUCH_TWO_POINTS.bytesWrittenToApiToday).toBe(0);
    expect(API_TOUCH_TWO_POINTS.readRootsIntoApiToday).toBe(scanRootCount());
    expect(API_TOUCH_TWO_POINTS.scoutedZeroTouchRounds).toBeGreaterThan(0);

    // ⚠️ "0바이트"를 산문이 아니라 **import 줄 전수**로 진다 — 쓰는 함수를 한 번도 부르지 않는다.
    const self = readFileSync(join(repoRoot, "packages/test-utils/src", SIBLING_CONTRACT), "utf8");
    const imports = [...self.matchAll(/^import .*$/gm)].map((match) => match[0]);
    expect(imports).toHaveLength(3);
    expect(imports.every((line) => /from "node:(fs|path)";$|from "vitest";$/.test(line))).toBe(true);
    const fsImport = imports.find((line) => line.includes("node:fs")) as string;
    for (const writer of ["writeFileSync", "appendFileSync", "mkdirSync", "rmSync", "unlinkSync", "renameSync", "cpSync"]) {
      expect(fsImport.includes(writer), `쓰는 함수 ${writer}를 들여왔어요 — 이 트랙은 읽기만 합니다`).toBe(false);
    }
  });

  it("ⓔ 재개 조건: 결정 #14는 열려 있고, 그 술어 하나만 오늘 닫힌다", () => {
    // 짝 계약이 그 결정형을 오늘도 지고 있다(옛 문장이 사라지지 않았다).
    const sibling = readFileSync(join(repoRoot, ...SCAN_ROOT, SIBLING_CONTRACT), "utf8");
    expect(sibling).toContain("공유 테스트 DB를 언제 무엇으로 비울지");
    expect(/재개\s*조건\(결정형\s*·\s*손은\s*저장소\s*안\)/.test(sibling)).toBe(true);
    // 그리고 이 파일도 같은 결정형을 **닫지 않고** 다시 적는다.
    const self = readFileSync(join(repoRoot, "packages/test-utils/src", SIBLING_CONTRACT), "utf8");
    expect(/재개\s*조건\(결정형\s*·\s*손은\s*저장소\s*안\)/.test(self)).toBe(true);
    // ⚠️⚠️ 이 트랙이 결정을 집지 않았다는 값 — 정리 걸음을 **한 걸음도 더하지 않았다**.
    expect(cleanups.length).toBeGreaterThanOrEqual(CLEANUP_STEP_FLOOR);
    expect(uncleanedCount("same-file", creates, cleanups)).toBeGreaterThan(0);
  });

  it("ⓕ 사각: 세지 않는 것을 값으로 적는다 (넷)", () => {
    // ⓐ 표 하나만 본다.
    expect(MODEL.length).toBeGreaterThan(0);
    expect(Array.isArray(GAUGES)).toBe(true);
    // ⓑ 시드는 밖이다 — 뿌리가 `test`라 `prisma/seed.ts`가 구조적으로 들어올 수 없다.
    expect(entries.some((entry) => entry.file.includes("seed.ts"))).toBe(false);
    expect(SCOUTED_ENVIRONMENT_SEVENTH.seededItemTemplates).toBeGreaterThan(0);
    // ⓒ 롤백 꼴은 바늘에 들어 있으나 오늘 0건이다 — 그 0을 값으로 적는다.
    const rollback = new RegExp(ROLLBACK_SOURCE, "i");
    expect(entries.filter((entry) => rollback.test(entry.text)).length).toBe(0);
    // ⓓ DB의 수는 **정찰이 손으로 잰 환경의 값**이고 이 계약이 내는 수가 아니다.
    for (const value of Object.values(SCOUTED_ENVIRONMENT_SEVENTH)) expect(value).toBeGreaterThan(0);
    expect(SCOUTED_ENVIRONMENT_SEVENTH.itemTemplatesActive).toBeLessThan(SCOUTED_ENVIRONMENT_SEVENTH.itemTemplatesTotal);
    // ⚠️ 두 수를 한 낱말로 적지 않는다 — 소스가 낸 수는 DB의 수와 자릿수부터 다르다.
    expect(creates.length).toBeLessThan(SCOUTED_ENVIRONMENT_SEVENTH.growthSinceSixth);
  });

  it("⚠️ 픽스처: 정리 없는 생성이 잡히고, 정리 있는 생성이 정리로 판정된다", () => {
    const make = (verb: string, binding?: string) =>
      `${binding ? `const ${binding} = ` : ""}await prisma.${MODEL}.${verb}({ data: {} });`;
    const clean = (verb: string, inner: string) => `await prisma.${MODEL}.${verb}({ where: { ${inner} } });`;

    // ① 정리 0건 — 셋 다 "정리 없음"으로 잡는다.
    const dirty = collectHands([{ file: "가짜-정리없음.test.ts", text: `${make("create", "made")}\n` }]);
    expect(dirty.creates).toHaveLength(1);
    expect(dirty.cleanups).toHaveLength(0);
    for (const gauge of GAUGES) expect(uncleanedCount(gauge, dirty.creates, dirty.cleanups)).toBe(1);

    // ② 이름을 무는 뒷정리 — 셋 다 "정리 있음"으로 읽는다.
    const tidy = collectHands([
      { file: "가짜-정리있음.test.ts", text: `${make("create", "made")}\n${clean("deleteMany", "id: made.id")}\n` }
    ]);
    expect(tidy.creates).toHaveLength(1);
    for (const gauge of GAUGES) expect(uncleanedCount(gauge, tidy.creates, tidy.cleanups)).toBe(0);

    // ③ 정리가 **앞에만** 있는 자리 — 넓은 자는 초록, 좁은 자 둘은 빨강(자 셋이 갈리는 실물).
    const before = collectHands([
      { file: "가짜-앞정리.test.ts", text: `${clean("deleteMany", "id: other")}\n${make("create", "made")}\n` }
    ]);
    expect(uncleanedCount("same-file", before.creates, before.cleanups)).toBe(0);
    expect(uncleanedCount("forward", before.creates, before.cleanups)).toBe(1);
    expect(uncleanedCount("bound", before.creates, before.cleanups)).toBe(1);

    // ④ 주석 속의 손은 손이 아니다.
    const commented = collectHands([{ file: "가짜-주석.test.ts", text: `// ${make("create", "made")}\n` }]);
    expect(commented.creates).toHaveLength(0);

    // ⑤ 이름 없는 생성(`await prisma.…create(`)도 모집단이다 — 오늘 실제로 넷이 그렇다.
    const anonymous = collectHands([{ file: "가짜-무명.test.ts", text: `${make("create")}\n` }]);
    expect(anonymous.creates).toHaveLength(1);
    expect(anonymous.creates[0].binding).toBeNull();
    expect(uncleanedCount("bound", anonymous.creates, anonymous.cleanups)).toBe(1);
    expect(creates.filter((site) => site.binding === null).length).toBeGreaterThan(0);
  });

  it("⚠️ 교란: 정리를 걷어 내면 상한이 빨개지고, 뿌리를 숨기면 하한이 먼저 빨개진다", () => {
    // ① 정리 걸음을 전부 걷어 내면 — 세 자 모두 모집단 전부를 "정리 없음"으로 읽는다.
    const ceiling = uncleanedCeilingToday();
    for (const gauge of GAUGES) {
      const without = uncleanedCount(gauge, creates, []);
      expect(without, `[${gauge}] 정리를 다 걷어 냈는데도 수가 그대로면 이 자는 아무것도 보지 않는다`).toBe(
        creates.length
      );
      expect(without, `[${gauge}] 정리를 걷어 냈는데 상한이 초록이면 래칫이 헐겁다`).toBeGreaterThan(ceiling[gauge]);
    }

    // ② 정리 없는 자리 하나가 더 붙으면 — 세 자 모두 상한을 넘는다.
    const grown = [...creates, { file: "가짜-새자리.test.ts", line: 1, text: "", binding: null } as const];
    for (const gauge of GAUGES) {
      expect(uncleanedCount(gauge, grown, cleanups)).toBeGreaterThan(ceiling[gauge]);
    }

    // ③ 뿌리가 통째로 사라지면 — 판정이 아니라 **하한**이 먼저 운다.
    const blind = collectHands([]);
    expect(blind.creates).toHaveLength(0);
    expect(blind.creates.length).toBeLessThan(POPULATION_FLOOR);
    // 그때 판정은 조용하다(0건이라 상한 아래다) — 그래서 하한이 필요하다는 사실의 값이다.
    for (const gauge of GAUGES) expect(uncleanedCount(gauge, blind.creates, blind.cleanups)).toBe(0);

    // ④ 걷기가 한 파일만 읽고 끝나도 하한이 운다(가장 큰 한 파일의 몫으로도 하한에 못 미친다).
    const biggest = [...createFiles]
      .map((file) => creates.filter((site) => site.file === file))
      .sort((left, right) => right.length - left.length)[0];
    expect(biggest.length).toBeLessThan(POPULATION_FLOOR);
  });
});
