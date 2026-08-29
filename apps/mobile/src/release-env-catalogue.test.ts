import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 73 트랙 A(GAP-073 #1ⓒⓔ) — **env 카탈로그의 세 번째 방향과, 배포가 만드는 파일의 침묵.**
 *
 * `scripts/check-env.ts`의 드리프트 가드는 종전 **카탈로그 ↔ `.env.example` 양방향만** 봤다.
 * 소스는 한 번도 읽지 않았고, 그래서 "코드가 읽는데 카탈로그에도 예시 파일에도 없는 키"는
 * 어느 쪽에서도 보이지 않았다 — 오늘 그런 키가 둘이었다(EXPO_PUBLIC_SUPPORT_URL ·
 * EXPO_PUBLIC_FAQ_URL, 라운드 71 D). 이 계약은 그 사각을 **여기서도 한 번 더** 센다:
 * 가드가 사라지면 스크립트 검증이 아니라 **집합 비교**가 먼저 빨개진다.
 */

const mobileRoot = process.cwd();
const repoRoot = join(mobileRoot, "..", "..");
const checkEnvSource = readFileSync(join(repoRoot, "scripts", "check-env.ts"), "utf8");
const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
const aabScript = readFileSync(join(repoRoot, "scripts", "build-android-aab.ts"), "utf8");
const bootstrap = readFileSync(join(repoRoot, "scripts", "deploy", "oracle-bootstrap.sh"), "utf8");

/* --------------------------------------------------------------- 카탈로그 읽기 */

type CatalogueEntry = { key: string; scope: string };

const catalogue: CatalogueEntry[] = [...checkEnvSource.matchAll(/key:\s*"([A-Z0-9_]+)",\s*scope:\s*"(\w+)"/g)].map(
  (match) => ({ key: match[1], scope: match[2] })
);

const intentionallyUncatalogued = (() => {
  const start = checkEnvSource.indexOf("const INTENTIONALLY_UNCATALOGUED = [");
  const body = checkEnvSource.slice(start, checkEnvSource.indexOf("] as const;", start));
  return [...body.matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]);
})();

const exampleKeys = envExample
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => line.slice(0, line.indexOf("=")).trim());

/* ------------------------------------------- 앱이 읽는 EXPO_PUBLIC_* 전수 (가드와 같은 규칙) */

function sourceFiles(dir: string, collected: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      sourceFiles(path, collected);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    collected.push(path);
  }
  return collected;
}

const readByApp = (() => {
  const keys = new Map<string, string>();
  for (const file of [join(mobileRoot, "app"), join(mobileRoot, "src")].flatMap((root) => sourceFiles(root))) {
    for (const match of readFileSync(file, "utf8").matchAll(/process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g)) {
      if (!keys.has(match[1])) keys.set(match[1], file);
    }
  }
  return keys;
})();

describe("라운드 73 트랙 A ⓒ — 앱이 읽는 EXPO_PUBLIC_*가 전부 카탈로그에 있다", () => {
  it("소스 방향 집합 비교: 읽는 키 전수 ⊆ 카탈로그 ∪ INTENTIONALLY_UNCATALOGUED", () => {
    const known = new Set([...catalogue.map((entry) => entry.key), ...intentionallyUncatalogued]);
    const uncatalogued = [...readByApp.keys()].filter((key) => !known.has(key)).sort();
    expect(uncatalogued, `읽는 자리: ${uncatalogued.map((key) => readByApp.get(key)).join(", ")}`).toEqual([]);
    // 스캔이 헛돌지 않는다는 사실도 값으로 — 0건이면 위 단언은 언제나 통과한다.
    expect(readByApp.size).toBeGreaterThanOrEqual(8);
  });

  it("오늘 닫힌 사각 둘이 실제로 앱이 읽는 키이고, 이제 카탈로그와 .env.example 양쪽에 있다", () => {
    for (const key of ["EXPO_PUBLIC_SUPPORT_URL", "EXPO_PUBLIC_FAQ_URL"]) {
      expect(readByApp.get(key), `${key}를 읽는 소스`).toContain("support-links.ts");
      expect(catalogue.map((entry) => entry.key)).toContain(key);
      expect(exampleKeys).toContain(key);
    }
  });

  it("⚠️ `.env.example`에 값을 지어 넣지 않는다 — 빈 값 + 주석(오늘의 TERMS/PRIVACY와 같은 모양)", () => {
    for (const key of ["EXPO_PUBLIC_SUPPORT_URL", "EXPO_PUBLIC_FAQ_URL"]) {
      expect(envExample).toMatch(new RegExp(`^${key}=\\s*$`, "m"));
    }
    // 두 줄 위에는 "없으면 무엇을 잃는가"가 적혀 있다(카탈로그의 note와 같은 사실).
    expect(envExample).toContain("앱 안에 도움으로 가는 길이 0건이에요");
  });

  it("가드가 세 방향 모두를 실제로 돈다 (양방향 예시 파일 + 소스 방향)", () => {
    expect(checkEnvSource).toContain("const missingFromExample = catalogueKeys.filter");
    expect(checkEnvSource).toContain("const missingFromCatalogue = exampleKeys.filter");
    // 세 번째 방향: apps/mobile의 소스를 읽고, INTENTIONALLY_UNCATALOGUED가 구제에 참여한다.
    expect(checkEnvSource).toContain('const MOBILE_SOURCE_ROOTS = ["apps/mobile/app", "apps/mobile/src"];');
    expect(checkEnvSource).toContain("process\\.env\\.(EXPO_PUBLIC_[A-Z0-9_]+)");
    expect(checkEnvSource).toContain("[...catalogueKeys, ...INTENTIONALLY_UNCATALOGUED]");
    expect(checkEnvSource).toContain("소스 드리프트 — 앱이 읽지만 카탈로그에 없는 키");
    // 테스트 파일은 앱의 동작이 아니므로 스캔에서 제외한다(가드와 이 계약이 같은 규칙).
    expect(checkEnvSource).toContain("/\\.test\\.tsx?$/.test(entry.name)");
    // 조용한 스킵 금지: 소스를 못 찾으면 그 사실을 출력한다.
    expect(checkEnvSource).toContain("소스 스캔을 건너뜁니다");
  });
});

describe("라운드 73 트랙 A ⓑ — 실사용자 빌드가 요구하는 키는 앱이 실제로 읽는 키다", () => {
  it("AAB가 묻는 EXPO_PUBLIC_* 전부가 앱 소스에서 읽히고 카탈로그에도 있다", () => {
    const start = aabScript.indexOf("type PublicEnvRequirement");
    const end = aabScript.indexOf("function buildChildEnv");
    const asked = [...aabScript.slice(start, end).matchAll(/key:\s*"(EXPO_PUBLIC_[A-Z0-9_]+)"/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(0);
    for (const key of asked) {
      // 빌드가 묻는데 앱은 읽지 않는 키 = 아무 효과도 없는 관문이다.
      expect([...readByApp.keys()], `${key}를 읽는 앱 소스가 없다`).toContain(key);
      expect(catalogue.map((entry) => entry.key), `${key}가 카탈로그에 없다`).toContain(key);
    }
  });
});

describe("라운드 73 트랙 A ⓔ — 배포가 만드는 .env.production이 침묵하지 않는다", () => {
  const heredoc = (() => {
    const start = bootstrap.indexOf('cat > "$ENV_FILE" <<EOF');
    expect(start, ".env.production heredoc을 찾지 못했습니다").toBeGreaterThan(-1);
    return bootstrap.slice(start, bootstrap.indexOf("\nEOF", start));
  })();

  it("운영 스위치(api scope의 *_ENABLED) 전부가 값으로 적혀 있다 — 파생 단언", () => {
    const switches = catalogue
      .filter((entry) => entry.scope === "api" && entry.key.endsWith("_ENABLED"))
      .map((entry) => entry.key);
    // 오늘 그 집합은 셋이다(WORKER · LINK_HEALTH · PUSH). 늘어나면 이 단언이 먼저 빨개진다.
    expect(switches.length).toBeGreaterThanOrEqual(3);
    for (const key of switches) {
      expect(heredoc, `${key}가 .env.production에 없다(침묵)`).toMatch(new RegExp(`^${key}=`, "m"));
    }
  });

  it("⚠️ 값은 바뀌지 않는다 — LINK_HEALTH_ENABLED는 명시만 하고 켜지 않는다", () => {
    expect(heredoc).toMatch(/^LINK_HEALTH_ENABLED=0$/m);
    expect(heredoc).toMatch(/^PUSH_ENABLED=0$/m);
    // 종전부터 켜져 있던 워커는 그대로 1이다.
    expect(heredoc).toMatch(/^WORKER_ENABLED=1$/m);
  });

  it("이미 배포된 서버의 .env.production을 덮지 않는다 (부트스트랩의 존재 가드 유지)", () => {
    expect(bootstrap).toContain('if [ ! -f "$ENV_FILE" ]; then');
    expect(bootstrap).toContain(".env.production 기존 파일 유지");
  });
});
