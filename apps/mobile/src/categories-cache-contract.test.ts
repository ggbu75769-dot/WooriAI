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

describe("공유 [\"categories\"] 캐시 규약 (전역 가드)", () => {
  it("categories 쿼리 키를 쓰는 모든 소스가 includeAll: true로 채운다", () => {
    const files = [...walk(join(process.cwd(), "app")), ...walk(join(process.cwd(), "src"))];
    const consumers = files.filter((file) => readFileSync(file, "utf8").includes('queryKey: ["categories"]'));
    // 규약의 존재 자체도 고정한다 — 소비처가 0이면 grep 패턴이 낡은 것이다.
    expect(consumers.length).toBeGreaterThanOrEqual(4);
    for (const file of consumers) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} 는 ["categories"] 캐시를 기본(12행) 목록으로 채우면 안 된다`).toContain(
        "includeAll: true"
      );
    }
  });
});
