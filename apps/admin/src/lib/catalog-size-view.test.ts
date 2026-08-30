import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG_SIZE_REVIEW_THRESHOLD,
  catalogSizeCaption,
  catalogSizeRemainingToThreshold,
  isCatalogSizeOverThreshold
} from "./catalog-size-view";

const adminRoot = process.cwd();
const repoRoot = join(adminRoot, "..", "..");

/**
 * 라운드 83 트랙 C — 대시보드 "활성 준비템" 카드의 캡션.
 *
 * 이 모듈이 지는 것은 **문턱의 인용**이지 판정이 아니다. 그래서 계약도 둘이다:
 * ⓐ 값이 문턱 아래/위에서 문장이 갈린다(경계 포함), ⓑ 그 문턱이 이 파일에서 **발명된 수가
 * 아니라** known-limitations의 N-4가 적어 둔 재개 트리거와 같은 수다.
 */
describe("catalogSizeCaption (라운드 83 트랙 C)", () => {
  it("문턱을 발명하지 않는다 — N-4의 재개 트리거를 그대로 인용한다", () => {
    const doc = readFileSync(join(repoRoot, "docs", "operations", "known-limitations.md"), "utf8");
    // N-4가 준비템 탭 비가상화를 기각하며 적은 그 한 줄. 문서가 다른 수로 바뀌면 여기가 먼저 빨개진다.
    expect(doc).toContain(`어드민 카탈로그가 **${CATALOG_SIZE_REVIEW_THRESHOLD}건**을 넘거나`);
  });

  it("문턱은 '초과'다 — 같은 수는 아직 아래이고 하나가 남는다", () => {
    expect(isCatalogSizeOverThreshold(CATALOG_SIZE_REVIEW_THRESHOLD - 1)).toBe(false);
    expect(isCatalogSizeOverThreshold(CATALOG_SIZE_REVIEW_THRESHOLD)).toBe(false);
    expect(isCatalogSizeOverThreshold(CATALOG_SIZE_REVIEW_THRESHOLD + 1)).toBe(true);

    expect(catalogSizeRemainingToThreshold(CATALOG_SIZE_REVIEW_THRESHOLD)).toBe(1);
    expect(catalogSizeRemainingToThreshold(CATALOG_SIZE_REVIEW_THRESHOLD - 10)).toBe(11);
    // 이미 넘은 뒤에는 "몇 개 남았다"가 없다(음수로 새지 않는다).
    expect(catalogSizeRemainingToThreshold(CATALOG_SIZE_REVIEW_THRESHOLD + 10)).toBe(0);
  });

  it("문턱 아래에서는 남은 수를 말하고, 도래를 단정하지 않는다", () => {
    const caption = catalogSizeCaption(62);

    expect(caption).toContain(`${CATALOG_SIZE_REVIEW_THRESHOLD}건 초과`);
    // 남은 수는 손으로 적지 않는다 — 파생이다(62 → 201까지 139개).
    expect(caption).toContain(`${catalogSizeRemainingToThreshold(62)}개 더 늘면 도래해요`);
    expect(caption).not.toContain("넘었어요");
  });

  it("문턱 경계에서도 아직 도래하지 않은 문장이다", () => {
    const caption = catalogSizeCaption(CATALOG_SIZE_REVIEW_THRESHOLD);

    expect(caption).toContain("1개 더 늘면 도래해요");
    expect(caption).not.toContain("넘었어요");
  });

  it("문턱을 넘으면 문장이 갈리고, N-4가 다시 판정할 자리를 인용한다", () => {
    const caption = catalogSizeCaption(CATALOG_SIZE_REVIEW_THRESHOLD + 1);

    expect(caption).toContain("넘었어요");
    expect(caption).toContain("다시 판정하기로 적어 둔 조건");
    expect(caption).toContain("N-4");
    expect(caption).not.toContain("더 늘면 도래해요");
  });

  it("어느 갈래도 새 판정·처분을 만들지 않는다 (알림·경고·차단 0건)", () => {
    // 문턱을 넘었을 때 무엇을 할지는 **운영 결정**이다. 캡션이 지시·경보로 읽히면 그 결정을
    // 이 모듈이 대신한 것이 된다 — 두 갈래 모두 사실의 인용까지만 적는다.
    for (const count of [0, 62, CATALOG_SIZE_REVIEW_THRESHOLD, CATALOG_SIZE_REVIEW_THRESHOLD + 50]) {
      const caption = catalogSizeCaption(count);
      expect(caption, String(count)).not.toMatch(/경고|위험|즉시|중단|차단|해야 해요|하세요/);
      // 두 갈래 다 문턱을 인용한다(수를 말하지 않는 문장이 없다).
      expect(caption, String(count)).toContain(String(CATALOG_SIZE_REVIEW_THRESHOLD));
    }
  });

  it("카드의 숫자를 캡션이 다시 적지 않는다 — 수의 출처는 응답 한 곳이다", () => {
    // 카드 본문이 이미 `summary.itemTemplatesActiveCount`를 그리므로, 캡션이 같은 수를 또
    // 적으면 두 자리가 어긋날 수 있다(브로큰 링크 카드가 활성/미검사를 함께 적는 것과 다르다 —
    // 저기는 카드에 없는 두 수를 보태는 것이고, 여기는 같은 수 하나다).
    expect(catalogSizeCaption(62)).not.toContain("62");
    expect(catalogSizeCaption(137)).not.toContain("137");
  });
});

/**
 * 배선 — 대시보드가 이 모듈을 실제로 부르는가, 그리고 **카드가 목록으로 넘어가지 않는가**.
 * 뒤엣것이 라운드 44 N-5의 재발 방지다(카드의 수와 넘어간 목록의 줄 수가 어긋나던 자리).
 */
describe("대시보드 '활성 준비템' 카드 배선", () => {
  const home = readFileSync(join(adminRoot, "app", "page.tsx"), "utf8");

  it("응답의 실측값을 그대로 그리고, 캡션은 이 순수 모듈이 만든다", () => {
    expect(home).toContain('import { catalogSizeCaption } from "../src/lib/catalog-size-view"');
    expect(home).toContain('{ key: "itemTemplatesActiveCount", label: "활성 준비템" }');
    expect(home).toContain("catalogSizeCaption(summary.itemTemplatesActiveCount)");
    // 수를 화면이 지어내지 않는다 — 카드 본문은 `summary[card.key]` 한 곳에서만 읽는다.
    expect(home).toContain("{summary[card.key].toLocaleString(\"ko-KR\")}");
  });

  it("그 카드에는 목록으로 넘어가는 링크가 없다 (라운드 44 N-5 재발 방지)", () => {
    const cards = /const SUMMARY_CARDS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(home)?.[1];
    expect(cards, "SUMMARY_CARDS 구간을 찾지 못했다").toBeTruthy();
    const entry = (cards as string)
      .split(/\n/)
      .find((line) => line.includes('key: "itemTemplatesActiveCount"'));
    expect(entry, "카탈로그 카드 줄을 찾지 못했다").toBeTruthy();
    expect(entry as string).not.toContain("href");
    // 준비템 목록 화면으로 넘기는 자리가 요약 카드 표 전체에 0건이다.
    expect(cards as string).not.toContain("/items");
  });
});
