import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(adminRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * GAP-064 #4 · #8 (라운드 64): 순수 모듈만 있고 **화면이 부르지 않는** 상태를 막는다.
 *
 * 라운드 58 #3(`lockNow`)·라운드 63 #3(`adminMfaDisable`)이 같은 모양이었다 — 완성된
 * 코드가 호출 0건이라 사용자에게는 없는 것과 같았다. 가격 열(#4)과 공유 링크(#8)는
 * 서버 DTO·클라이언트 타입·순수 모듈까지 다 있어도 **표가 그리지 않으면** 운영은
 * 여전히 자기가 쓴 값을 되읽지 못하고, `/r/:code`는 여전히 도달 불가다.
 */
describe("링크 표의 가격 열 (GAP-064 #4)", () => {
  it("페이지가 link-price-view 모듈을 실제로 렌더한다 — 서식을 따로 짓지 않는다", () => {
    const page = readSource("app/links/page.tsx");

    expect(page).toContain('from "../../src/lib/link-price-view"');
    expect(page).toContain("<th>가격</th>");
    expect(page).toContain("{linkPriceText(link)}");
    expect(page).toContain("{linkPriceCaption(link)");
    // 앱에 보이지 않는 값(시각 없음·만료)은 감추지 않고 흐리게 그린다.
    expect(page).toContain("isLinkPriceVisibleInApp(link) ? undefined : styles.mutedCell");
  });

  it("만료 문턱 숫자를 어드민에 다시 박지 않는다 (라운드 63 #9의 교훈)", () => {
    const page = readSource("app/links/page.tsx");
    const view = readSource("src/lib/link-price-view.ts");

    // 180(LINK_PRICE_MAX_AGE_DAYS)은 서버 계약에만 있고, 어드민은 priceExpired만 읽는다.
    expect(page).not.toMatch(/\b180\b/);
    expect(view).not.toMatch(/\b180\b/);
  });

  it("커버리지 한 줄이 목록 머리말에 선다 — 두 수를 함께 말한다 (#4ⓒ)", () => {
    const page = readSource("app/links/page.tsx");
    expect(page).toContain("linkPriceCoverageSummary(filteredLinks)");
  });

  it("벌크 미리보기가 가격 왕복을 대조할 수 있다 (#4ⓐ)", () => {
    const panel = readSource("src/components/ProductLinkBulkReplace.tsx");

    expect(panel).toContain("<th>현재 가격</th>");
    expect(panel).toContain("<th>새 가격</th>");
    expect(panel).toContain("row.currentPriceSnapshotKrw");
    expect(panel).toContain("row.newPriceSnapshotKrw");
    // 금액 서식은 링크 표와 같은 함수 하나다(두 벌 금지).
    expect(panel).toContain('from "../lib/link-price-view"');
    // 타임아웃 뒤 안내도 URL만 가리키지 않는다.
    expect(panel).toContain("'현재 가격'이 '새 가격'과 같으면");
  });

  it("정렬·랭킹에는 손대지 않는다 (DNC-009 — 가격은 표시 전용)", () => {
    const page = readSource("app/links/page.tsx");
    const view = readSource("src/lib/link-price-view.ts");

    // 가격이 정렬·필터 판정에 끼어들 자리가 없다: 두 소스 어디에도 정렬 호출이 없고
    // (링크 순서는 서버의 displayOrder + 헬스 강등이 정한다), 표시 모듈은 순서를 모른다.
    for (const source of [page, view]) {
      expect(source).not.toContain("sort(");
    }
    // 표시 모듈은 순서를 아예 다루지 않는다(정렬 판정은 서버 한 곳뿐이라고 머리말이 적어 둔다).
    expect(view).toContain("링크 정렬은 서버가 정하고");
  });
});

describe("링크 표의 공유 링크 (GAP-064 #8)", () => {
  it("페이지가 link-share 모듈을 실제로 렌더한다 — /r/:code가 도달 가능해진다", () => {
    const page = readSource("app/links/page.tsx");

    expect(page).toContain('from "../../src/lib/link-share"');
    expect(page).toContain("<th>공유 링크</th>");
    expect(page).toContain("hasShareUrl(link)");
    expect(page).toContain("공유 링크 복사");
    expect(page).toContain("link.redirectShareUrl");
  });

  it("복사되는 것은 URL 한 줄이 아니라 고지 + URL이다 (DNC-010의 필수 조건)", () => {
    const page = readSource("app/links/page.tsx");

    expect(page).toContain("buildShareCopyText(link)");
    expect(page).toContain("shareCopyHint(link)");
    // URL만 클립보드에 넣는 지름길이 남아 있으면 안 된다.
    expect(page).not.toContain("writeText(link.redirectShareUrl");
  });

  it("코드 12자 hex를 화면이 스스로 조립하지 않는다 — 서버가 준 URL을 쓴다", () => {
    const page = readSource("app/links/page.tsx");
    const share = readSource("src/lib/link-share.ts");

    for (const source of [page, share]) {
      expect(source).not.toContain("/r/${");
      expect(source).not.toContain("INVITE_LINK_BASE_URL");
    }
  });
});
