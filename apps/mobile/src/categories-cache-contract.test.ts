import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R26 리뷰 후속: 공유 `["categories"]` 캐시의 includeAll 규약을 저장소 전역으로 강제한다.
 *
 * CAT-124 이후 이 캐시는 **전량(21행) 목록**을 담는 것이 규약이다 — 이름 해석
 * (buildCategoryNameLookup)이 별칭·스텁 id의 라벨을 여기서 찾기 때문에, 어느 한
 * 소비처라도 `listCategories(token)`(기본 12행)으로 이 키를 먼저 채우면 나머지
 * 소비처의 별칭 라벨이 조용히 "기타"로 무너진다. 종전에는 파일 경로가 하드코딩된
 * 단언 4개가 각자 지켰지만, 5번째 소비처가 생기면 아무도 안 지킨다 — 그래서
 * `queryKey: ["categories"]`가 등장하는 모든 소스를 걸어서 검사한다.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * ⚠️ 두 시점(라운드 103 T3) — **`src/query/**`는 이 스윕의 모집단이 아니다.**
 *
 * 종전에는 뺄 이유가 없었다: 무효화 정책 대장(src/query/shared-cache-policy.ts)의
 * `["categories"]` 줄이 *"앱 안에 이 목록을 바꾸는 쓰기가 0건"* 이라 그 파일에 이 키의 무효화
 * **표현식 문자열**이 한 줄도 없었기 때문이다. 라운드 103이 관리 화면을 세우며 그 대장에
 * `'await queryClient.invalidateQueries({ queryKey: ["categories"] });'` 세 줄이 값으로 들어왔고,
 * 그 문자열 안의 `queryKey: ["categories"]`가 이 스윕에 **소비처로** 잡혔다 — 그 파일은 쿼리를
 * 열지 않으므로 `skipToken` 갈래도 만족할 수 없어 거짓 빨강이 된다.
 *
 * 같은 사각을 그 대장의 짝 테스트가 이미 같은 방법으로 닫아 두었다(shared-cache-policy.test.ts의
 * `literalInvalidationSites`: *"`src/query/**`는 문자열로 들고 있을 뿐이라 뺀다"*). 여기서도 그
 * 관례를 그대로 인용하되, **면제가 진짜 소비처를 숨기지 못하게** 아래 단언이 그 뿌리에
 * `useQuery(`가 0건임을 함께 센다 — 그 뿌리에 쿼리를 여는 파일이 생기는 날 이 면제가 먼저
 * 빨개진다.
 */
const LEDGER_ONLY_ROOT = "src/query/";

describe("공유 [\"categories\"] 캐시 규약 (전역 가드)", () => {
  it("categories 쿼리 키를 쓰는 모든 소스가 includeAll: true로 채운다", () => {
    const mobileRoot = process.cwd();
    const files = [...walk(join(mobileRoot, "app")), ...walk(join(mobileRoot, "src"))];
    const isLedgerOnly = (file: string) =>
      file.slice(mobileRoot.length + 1).split("\\").join("/").startsWith(LEDGER_ONLY_ROOT);
    // 면제가 진짜 소비처를 숨기지 않는다 — 그 뿌리는 쿼리를 **열지 않는** 계약 전용 데이터다.
    for (const file of files.filter(isLedgerOnly)) {
      expect(readFileSync(file, "utf8"), `${file} 가 쿼리를 연다 — 이 면제가 더는 참이 아니다`).not.toContain(
        "useQuery("
      );
    }
    const consumers = files
      .filter((file) => !isLedgerOnly(file))
      .filter((file) => readFileSync(file, "utf8").includes('queryKey: ["categories"]'));
    // 규약의 존재 자체도 고정한다 — 소비처가 0이면 grep 패턴이 낡은 것이다.
    expect(consumers.length).toBeGreaterThanOrEqual(4);
    for (const file of consumers) {
      const source = readFileSync(file, "utf8");
      // 라운드 45 O-5: 이 키를 **읽기만** 하는 화면도 생겼다(app/sync-status.tsx는
      // enabled:false + queryFn: skipToken으로 캐시를 구독만 한다). 규약이 막는 것은 "기본
      // 12행 목록으로 캐시를 **채우는**" 일이므로, 요청을 아예 만들지 않는 구독자는 대상이
      // 아니다 — 대신 정말 요청이 없는지(skipToken)를 같은 강도로 고정한다.
      //
      // 라운드 46 Q-5: 그 "같은 강도"가 문자열 하나였던 탓에, 소비처의 **주석**에
      // `queryFn: skipToken`이 적혀 있기만 해도 통과했다(sync-status.tsx가 실제로 그랬다).
      // 두 옵션이 붙어 있는 코드 형태로 본다 — 주석 한 줄은 이 모양을 만들지 못한다.
      if (!source.includes("listCategories(")) {
        expect(source, `${file} 는 요청 없이 ["categories"] 캐시를 구독만 해야 한다`).toMatch(
          /enabled:\s*false,\s*\n\s*queryFn:\s*skipToken/
        );
        continue;
      }
      expect(source, `${file} 는 ["categories"] 캐시를 기본(12행) 목록으로 채우면 안 된다`).toContain(
        "includeAll: true"
      );
    }
  });
});
