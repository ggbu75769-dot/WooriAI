import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProductLink } from "./admin-api";
import {
  EMPTY_ITEM_FILTERS,
  activeNonSponsoredLinkCount,
  activeProductLinkCount,
  filterItemTemplates,
  hasAnyItemFilter,
  itemFilterSummary,
  productLinkCount,
  type FilterableItem
} from "./item-filters";

function link(id: string, active = true): ProductLink {
  return {
    id,
    itemTemplateId: "item-1",
    platform: "coupang",
    title: `링크 ${id}`,
    url: "https://example.com",
    affiliateUrl: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureText: null,
    active,
    healthStatus: null,
    healthCheckedAt: null
  };
}

/** 서버가 세어 주는 활성 링크 수(activeLinkCount)를 픽스처에서도 같은 규칙으로 만든다. */
function item(name: string, productLinks: ProductLink[]): FilterableItem {
  return { name, productLinks, activeLinkCount: productLinks.filter((entry) => entry.active).length };
}

const swaddle = item("신생아 속싸개", [link("a"), link("b")]);
const sterilizer = item("젖병 소독기", []);
const tub = item("아기 욕조 Tub", [link("c")]);
// UX-X(R43) M-5: 링크는 등록돼 있는데 전부 비활성 — 사용자 화면에서는 구매처가 0이다.
const bottleWarmer = item("젖병 워머", [link("d", false), link("e", false)]);
const items = [swaddle, sterilizer, tub];

/** 라운드 84 트랙 A: 광고 링크. 같은 링크에 스폰서 표시만 붙인다(다른 값은 그대로). */
function sponsoredLink(id: string, active = true): ProductLink {
  return { ...link(id, active), isSponsored: true };
}

// 활성 링크가 스폰서 하나뿐 — 앱에서 채워진(가장 강조되는) 구매 버튼이 서지 않는다.
// 링크 수는 1이라 '상품 링크 없음만 보기'에는 걸리지 않는다(둘은 다른 질문이다).
const stroller = item("유모차", [sponsoredLink("s1")]);
// 비스폰서 링크가 있지만 내려가 있다 — 사용자가 보는 것은 광고 링크 하나뿐이다.
const walker = item("보행기", [link("g", false), sponsoredLink("s2")]);
// 스폰서 옆에 활성 일반 링크가 있다 — 강조되는 버튼이 그 링크에 선다.
const wipes = item("물티슈 대용량", [sponsoredLink("s3"), link("h")]);

describe("filterItemTemplates (UX-X C7)", () => {
  it("returns everything, in order, with no filters", () => {
    expect(filterItemTemplates(items)).toEqual(items);
    expect(filterItemTemplates(items, EMPTY_ITEM_FILTERS)).toEqual(items);
  });

  it("matches the name case-insensitively as a substring", () => {
    expect(filterItemTemplates(items, { query: "속싸개" })).toEqual([swaddle]);
    expect(filterItemTemplates(items, { query: "tub" })).toEqual([tub]);
    expect(filterItemTemplates(items, { query: "  " })).toEqual(items);
    expect(filterItemTemplates(items, { query: "없는이름" })).toEqual([]);
  });

  it("keeps only link-less items for 상품 링크 없음만 보기", () => {
    expect(filterItemTemplates(items, { missingLinksOnly: true })).toEqual([sterilizer]);
  });

  /**
   * UX-X(R43) M-5: 종전에는 productLinks.length로 걸러서, 링크가 전부 비활성인
   * 준비템이 "링크 있음"으로 취급돼 이 필터에서 빠졌다 — 사용자에게는 구매처가
   * 0인 화면인데 운영자에게는 보이지 않는 지점이었다.
   */
  it("also catches items whose links are all inactive (구매처 0 for the user)", () => {
    const withInactiveOnly = [...items, bottleWarmer];
    expect(filterItemTemplates(withInactiveOnly, { missingLinksOnly: true })).toEqual([sterilizer, bottleWarmer]);
  });

  it("combines the two filters with AND", () => {
    expect(filterItemTemplates(items, { missingLinksOnly: true, query: "소독" })).toEqual([sterilizer]);
    expect(filterItemTemplates(items, { missingLinksOnly: true, query: "속싸개" })).toEqual([]);
  });
});

describe("productLinkCount / itemFilterSummary / hasAnyItemFilter", () => {
  it("counts the links already carried by the list response", () => {
    expect(productLinkCount(swaddle)).toBe(2);
    expect(productLinkCount(sterilizer)).toBe(0);
  });

  // 두 수를 나란히 둔다: 화면의 기본 표시는 활성 수, 그 옆의 "비활성 N"은 차이값.
  it("separates the user-visible count from the total registered count", () => {
    expect(activeProductLinkCount(bottleWarmer)).toBe(0);
    expect(productLinkCount(bottleWarmer)).toBe(2);
    expect(activeProductLinkCount(swaddle)).toBe(2);
    expect(activeProductLinkCount(sterilizer)).toBe(0);
  });

  /**
   * 라운드 44 리뷰 N-8: 필드 부재를 0으로 단정하지 않는다.
   *
   * 목록 응답은 런타임에 검증되지 않으므로(admin-api.ts의 request()는 JSON을 그대로
   * 캐스팅한다) activeLinkCount를 아직 안 내려주는 서버 버전과 붙을 수 있다. 종전 `?? 0`은
   * 그 경우 **모든 준비템을 구매처 0개**로 만들었다 — 화면은 "링크 없음"이라고 단정하고,
   * '상품 링크 없음만 보기'는 전부를 남기며, 운영자는 멀쩡한 링크를 다시 등록하러 간다.
   */
  it("N-8: falls back to the registered link count when the server omits activeLinkCount", () => {
    // 구버전 응답: activeLinkCount 없음. 타입은 필수지만 런타임에는 비어 올 수 있다.
    const legacy = { name: "신생아 속싸개", productLinks: [link("a"), link("b")] } as unknown as FilterableItem;

    expect(activeProductLinkCount(legacy)).toBe(2);
    // 없는 문제를 만들어 내지 않는다 — '링크 없음만 보기'에 걸리지 않는다.
    expect(filterItemTemplates([legacy], { missingLinksOnly: true })).toEqual([]);

    // 링크가 정말 하나도 없는 준비템은 그대로 0으로 남아 필터에 걸린다.
    const legacyEmpty = { name: "젖병 소독기", productLinks: [] } as unknown as FilterableItem;
    expect(activeProductLinkCount(legacyEmpty)).toBe(0);
    expect(filterItemTemplates([legacyEmpty], { missingLinksOnly: true })).toEqual([legacyEmpty]);

    // 서버가 0을 **명시**하면 그건 근거 있는 0이다 — 폴백이 덮어쓰지 않는다.
    expect(activeProductLinkCount(bottleWarmer)).toBe(0);
    expect(productLinkCount(bottleWarmer)).toBe(2);
  });

  it("uses the same 건수 wording as the links page", () => {
    expect(itemFilterSummary(3, 3)).toBe("3개");
    expect(itemFilterSummary(3, 1)).toBe("3개 중 1개");
  });

  it("knows whether any filter is actually applied", () => {
    expect(hasAnyItemFilter(EMPTY_ITEM_FILTERS)).toBe(false);
    expect(hasAnyItemFilter({ query: "  " })).toBe(false);
    expect(hasAnyItemFilter({ query: "속" })).toBe(true);
    expect(hasAnyItemFilter({ missingLinksOnly: true })).toBe(true);
  });
});

/* ------------------------------------------------------------------ 라운드 84 트랙 A */

const adminRoot = process.cwd();

function readAdminSource(relativePath: string): string {
  const filePath = join(adminRoot, ...relativePath.split("/"));
  expect(existsSync(filePath), `apps/admin/${relativePath}가 실재한다`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function readRepoSource(relativePath: string): string {
  const filePath = join(adminRoot, "..", "..", ...relativePath.split("/"));
  expect(existsSync(filePath), `${relativePath}가 실재한다`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * 라운드 84 트랙 A(GAP-084 #1) — **운영자가 "가장 큰 버튼이 서지 않는 준비템"을 찾을 수 있다.**
 *
 * 고치는 문제: 이 화면의 '상품 링크 없음만 보기'는 `활성 링크 ≥ 1`을 묻는다. 그런데 앱 상세
 * 화면에서 **채워진(가장 강조되는) "구매하기" 버튼**을 받는 링크는 `첫 번째 비스폰서 링크`이고
 * (link-marker.ts의 `primaryPurchaseLinkIndex` — 스폰서가 강조를 받으면 구분이 우대가 되므로
 * DNC-011의 취지가 뒤집힌다), 전부 스폰서면 그 버튼은 **아예 서지 않는다**. 즉 "활성 링크는
 * 있는데 전부 광고"인 준비템은 핵심 루프 4단계(구매 링크 클릭)로 가는 가장 큰 문이 닫힌 채로
 * 어드민의 어느 필터에도 걸리지 않았다 — 라운드 82 시드에서 실제로 다섯 품목이 그랬고,
 * 라운드 83 A가 시드를 채워 오늘은 0건이지만 어드민이 링크를 내리거나 스폰서만 등록하는 순간
 * 다시 생긴다(그래서 아래는 시드가 아니라 **픽스처**로 센다).
 *
 * 이 필터는 **세고 고를** 뿐이다 — 스폰서 링크를 숨기지도, 뒤로 미지도, 차단하지도 않는다
 * (DNC-011) · 정렬·추천 점수 무접촉(DNC-009) · 서버 요청 0건(이미 받아온 목록만 좁힌다).
 */
describe("활성 비스폰서 링크 0건 필터 (라운드 84 트랙 A ⓐ)", () => {
  const all = [swaddle, sterilizer, tub, bottleWarmer, stroller, walker, wipes];

  it("앱에서 강조되는 구매 버튼을 받을 링크(활성·비스폰서) 수를 센다", () => {
    expect(activeNonSponsoredLinkCount(swaddle)).toBe(2);
    expect(activeNonSponsoredLinkCount(wipes)).toBe(1);
    // 광고뿐 / 비스폰서가 내려가 있음 / 링크 자체가 없음 — 셋 다 그 버튼이 서지 않는다.
    expect(activeNonSponsoredLinkCount(stroller)).toBe(0);
    expect(activeNonSponsoredLinkCount(walker)).toBe(0);
    expect(activeNonSponsoredLinkCount(sterilizer)).toBe(0);
    expect(activeNonSponsoredLinkCount(bottleWarmer)).toBe(0);
  });

  it("활성 비스폰서 링크가 0건인 준비템만 남긴다", () => {
    expect(filterItemTemplates(all, { missingNonSponsoredLinksOnly: true })).toEqual([
      sterilizer,
      bottleWarmer,
      stroller,
      walker
    ]);
  });

  it("비활성 링크는 세지 않는다 — 사용자에게 보이지 않는 링크는 버튼을 세우지 못한다", () => {
    // 유일한 비스폰서 링크가 내려가 있으면 화면에는 광고 링크만 남는다.
    expect(filterItemTemplates([walker], { missingNonSponsoredLinksOnly: true })).toEqual([walker]);
    // 그 링크를 되살리면 같은 준비템이 필터에서 빠진다(되살릴 대상이 있다는 사실도 값이다).
    const revived = item("보행기", [link("g"), sponsoredLink("s2")]);
    expect(filterItemTemplates([revived], { missingNonSponsoredLinksOnly: true })).toEqual([]);
  });

  it("링크가 0건인 준비템은 두 필터 모두에 걸린다", () => {
    for (const filters of [{ missingLinksOnly: true }, { missingNonSponsoredLinksOnly: true }]) {
      expect(filterItemTemplates([sterilizer], filters)).toEqual([sterilizer]);
    }
  });

  /**
   * ⚠️ 두 필터는 **다른 질문**이다. 스폰서 링크 하나만 걸린 준비템은 '상품 링크 없음만 보기'에
   * 걸리지 않는다(구매처가 실제로 하나 있다 — 그 사실은 참이다). 그래도 그 화면에서 가장 큰
   * 버튼은 서지 않는다. 종전에 그 자리를 물을 수 있는 필터가 0건이었다.
   */
  it("스폰서 링크만 있는 준비템은 새 필터에만 걸린다", () => {
    expect(filterItemTemplates(all, { missingLinksOnly: true })).not.toContain(stroller);
    expect(filterItemTemplates(all, { missingNonSponsoredLinksOnly: true })).toContain(stroller);
    // 광고 옆에 활성 일반 링크가 있으면 버튼이 서므로 어느 쪽에도 걸리지 않는다.
    expect(filterItemTemplates(all, { missingNonSponsoredLinksOnly: true })).not.toContain(wipes);
    expect(filterItemTemplates(all, { missingLinksOnly: true })).not.toContain(wipes);
  });
});

/**
 * ⓑ **술어 동치(파생)** — 이 필터는 자기 판정을 새로 정의하지 않는다. 정본은 모바일의
 * `primaryPurchaseLinkIndex`이고, 그 술어가 바뀌면(예: 스폰서도 채움을 받게 되면) 여기가 먼저
 * 빨개져야 한다. 정본은 **소스 텍스트로 읽는다** — `admin-canonical-mirrors.test.ts`가 손 미러를
 * 대조하는 그 관례 그대로다(apps/admin은 모바일을 의존성으로 들지 않는다).
 */
describe("모바일 CTA 술어와의 동치 (라운드 84 트랙 A ⓑ)", () => {
  /** 정본 한 줄. 이 문자열이 그 파일에서 사라지면 술어가 갈린 것이다. */
  const MOBILE_FILL_PREDICATE = "links.findIndex((link) => !link.isSponsored)";
  const markerSource = readRepoSource("apps/mobile/src/items/link-marker.ts");

  it("정본이 오늘도 '첫 번째 비스폰서 링크'를 고른다", () => {
    expect(markerSource).toContain("export function primaryPurchaseLinkIndex(");
    expect(markerSource, "모바일의 채움 판정이 갈렸어요 — 어드민 필터도 같이 옮겨야 합니다").toContain(
      MOBILE_FILL_PREDICATE
    );
  });

  it("어드민의 판정이 같은 술어를 쓴다(활성 조건만 덧붙는다)", () => {
    const source = readAdminSource("src/lib/item-filters.ts");
    expect(source).toContain("export function activeNonSponsoredLinkCount(");
    expect(source).toContain("link.active && !link.isSponsored");
    // 어느 쪽도 정렬을 건드리지 않는다(DNC-009) — 고르는 것은 순서가 아니라 집합이다.
    expect(source).not.toContain(".sort(");
  });

  /**
   * ⚠️ 라운드 84 리뷰 M-3 — **동치의 서버 절반에도 단언이 선다.**
   *
   * 위 두 줄은 모바일의 술어(`!link.isSponsored`)와 어드민의 술어(`link.active && !link.isSponsored`)를
   * 소스로 맞댄다. 그런데 둘이 동치인 **근거의 절반**은 서버에 있다: 앱이 그 술어를 먹이는 목록에
   * 애초에 활성 링크만 실린다는 사실이다. 그 절반에는 단언이 0건이었고, 서버가 `active: true`를
   * 푸는 날(비활성 링크도 상세에 실리는 날) 어드민의 활성 조건은 조용히 **덧붙은 조건**이 된다 —
   * 앱은 비활성 스폰서 링크에도 채움 버튼을 세우는데 어드민은 그것을 0으로 센다.
   *
   * 읽기만 한다(ⓐ와 같은 관례 — apps/admin은 api를 의존성으로 들지 않는다).
   */
  it("서버 상세 조회가 활성 링크만 싣는다 (어드민에 활성 조건이 붙는 근거)", () => {
    const service = readRepoSource("apps/api/src/onboarding/items-catalog.service.ts");
    expect(service).toContain("const linkRows = await this.prisma.productLink.findMany({");
    expect(service, "서버가 상세 링크를 활성으로 좁히지 않으면 어드민의 활성 조건이 덧붙은 조건이 돼요").toContain(
      "where: { itemTemplateId: item.id, active: true },"
    );
  });

  /**
   * 값으로도 동치를 센다: 앱이 그 술어를 먹이는 목록에는 **활성 링크만** 실리므로
   * (items-catalog.service.ts의 상세 조회가 `active: true`로 좁힌다 — 그 절이 위 줄로 고정된다),
   * 같은 링크 집합에서 "채워진 버튼이 서는가"와 "활성 비스폰서 링크가 1건 이상인가"는 언제나 같은 답이다.
   */
  it("같은 링크 집합에서 두 판정의 답이 같다", () => {
    const appSeesFilledButton = (links: ProductLink[]) =>
      links.filter((entry) => entry.active).findIndex((entry) => !entry.isSponsored) !== -1;

    for (const fixture of [swaddle, sterilizer, tub, bottleWarmer, stroller, walker, wipes]) {
      expect(activeNonSponsoredLinkCount(fixture) > 0, `${fixture.name}`).toBe(
        appSeesFilledButton(fixture.productLinks)
      );
    }
  });
});

/**
 * ⓒ **부정** — 필터는 좁히기만 한다(AND 결합의 기존 규율) · 새 요청을 만들지 않는다.
 */
describe("AND 결합과 요청 0건 (라운드 84 트랙 A ⓒ)", () => {
  const all = [swaddle, sterilizer, tub, bottleWarmer, stroller, walker, wipes];

  it("두 필터를 함께 켜면 각각의 결과보다 좁아지기만 한다", () => {
    const both = filterItemTemplates(all, { missingLinksOnly: true, missingNonSponsoredLinksOnly: true });
    const onlyMissing = filterItemTemplates(all, { missingLinksOnly: true });
    const onlyNonSponsored = filterItemTemplates(all, { missingNonSponsoredLinksOnly: true });

    for (const entry of both) {
      expect(onlyMissing).toContain(entry);
      expect(onlyNonSponsored).toContain(entry);
    }
    expect(both).toEqual([sterilizer, bottleWarmer]);
    // 검색어까지 얹어도 같다 — 원본 순서도 그대로다.
    expect(filterItemTemplates(all, { missingNonSponsoredLinksOnly: true, query: "유모차" })).toEqual([stroller]);
    expect(filterItemTemplates(all, { missingNonSponsoredLinksOnly: true, query: "속싸개" })).toEqual([]);
  });

  it("새 필터가 켜져도 종전 필터의 답은 그대로다 (ⓔ)", () => {
    expect(filterItemTemplates(all, { missingLinksOnly: true })).toEqual([sterilizer, bottleWarmer]);
    expect(filterItemTemplates(all)).toEqual(all);
    expect(hasAnyItemFilter({ missingNonSponsoredLinksOnly: true })).toBe(true);
    expect(hasAnyItemFilter({ missingNonSponsoredLinksOnly: false })).toBe(false);
  });

  it("필터 모듈은 서버로 나가지 않는다 — 이미 받아온 배열만 좁힌다", () => {
    const source = readAdminSource("src/lib/item-filters.ts");
    expect(source).not.toMatch(/\bawait\b|\bfetch\(|listItemTemplates/);
    // 목록을 부르는 자리는 화면에 한 곳뿐이고, 새 체크박스는 상태만 바꾼다.
    const page = readAdminSource("app/items/page.tsx");
    expect((page.match(/listItemTemplates\(/g) ?? []).length).toBe(1);
    expect(page).toContain("setFilters({ ...filters, missingNonSponsoredLinksOnly: event.target.checked })");
  });
});

/**
 * ⓓ **문구** — 새 한국어 문장은 **둘**(라벨 · 힌트)이고 해요체이며, 무엇이 *"잘못됐다"* 고
 * 단정하지 않는다. 광고 링크만 걸린 것은 운영의 결정일 수 있고, 이 화면이 하는 일은 그 자리를
 * **찾을 수 있게** 하는 것뿐이다(차단·경고 0건).
 */
describe("새 필터의 문구 (라운드 84 트랙 A ⓓ)", () => {
  const page = readAdminSource("app/items/page.tsx");
  /**
   * ⚠️ 라운드 84 리뷰 L-9 — 종전 라벨 "스폰서 아닌 상품 링크 없음만 보기"는 두 가지로 오독됐다:
   * ① "스폰서 아닌 (상품 링크 없음만)"으로 끊어 읽히고 ② **활성** 조건을 한 글자도 말하지 않는다
   * (비스폰서 링크가 있어도 내려가 있으면 이 필터에 걸린다 — 판정은 그때부터 라벨과 다른 말을 한다).
   */
  const LABEL = "활성 비스폰서 링크가 없는 준비템만 보기";
  const HINT = "앱에서 강조되는 구매 버튼은 스폰서가 아닌 활성 링크가 받는데, 그 링크가 없는 준비템만 나와요.";
  /** 라운드 84 리뷰 L-11 — 두 필터의 **포함 관계**(필터1 ⊆ 필터2)를 힌트가 한 줄로 말한다. */
  const HINT_INCLUSION = "위 필터에 걸리는 준비템은 여기에도 모두 나와요 — 이 필터가 위 필터를 포함해요.";

  it("라벨과 힌트가 그 자리에 있다", () => {
    expect(page).toContain(LABEL);
    expect(page).toContain(HINT);
    expect(page).toContain(HINT_INCLUSION);
    expect(page).toContain('id="item-filter-missing-non-sponsored-links"');
    // 오독되던 종전 라벨은 남아 있지 않다(문구가 두 벌이 되지 않는다).
    expect(page).not.toContain("스폰서 아닌 상품 링크 없음만 보기");
  });

  it("라벨이 판정의 두 조건(활성 · 비스폰서)을 모두 말한다", () => {
    for (const word of ["활성", "비스폰서"]) {
      expect(LABEL, `라벨이 ${word} 조건을 말하지 않아요`).toContain(word);
    }
  });

  /**
   * ⚠️ 라운드 84 리뷰 L-11 — 포함 관계는 **문장으로만** 말한다. 라디오 버튼으로 바꾸는 것은
   * 과공학이고(두 필터를 함께 켤 수 있다는 사실 자체는 참이다 — AND 결합의 기존 규율), 무엇보다
   * 종전 필터의 동작을 바꾼다. 그래서 체크박스 둘은 그대로다.
   */
  it("포함 관계를 말할 뿐 입력 방식을 바꾸지 않는다 (라디오 0건)", () => {
    expect(page).not.toContain('type="radio"');
    expect((page.match(/id="item-filter-missing-(non-sponsored-)?links"/g) ?? []).length).toBe(2);
  });

  it("포함 관계가 실제로 참이다 (문장과 판정이 갈리지 않는다)", () => {
    const all = [swaddle, sterilizer, tub, bottleWarmer, stroller, walker, wipes];
    const narrow = filterItemTemplates(all, { missingLinksOnly: true });
    const wide = filterItemTemplates(all, { missingNonSponsoredLinksOnly: true });
    for (const entry of narrow) {
      expect(wide, `${entry.name}: 위 필터에 걸리는데 아래 필터에는 없어요`).toContain(entry);
    }
    expect(wide.length).toBeGreaterThan(narrow.length);
  });

  it("해요체이고, 무엇이 잘못됐다고 말하지 않는다", () => {
    expect(HINT.endsWith("요.")).toBe(true);
    expect(HINT_INCLUSION.endsWith("요.")).toBe(true);
    for (const banned of ["잘못", "오류", "위반", "문제", "실수", "고쳐"]) {
      expect(`${LABEL} ${HINT} ${HINT_INCLUSION}`, `단정하는 낱말(${banned})`).not.toContain(banned);
    }
  });

  /**
   * ⚠️ 라운드 84 리뷰 L-10 — **필터가 무엇을 보고 골랐는지가 결과에도 보인다.**
   *
   * 종전에는 새 필터를 켜야만 그 자리가 드러났고, 목록의 어느 칸도 "이 준비템은 활성 링크가 있는데
   * 전부 광고다"라고 말하지 않았다. 링크 열의 의미(활성 링크 수)는 그대로 두고, 그 경우에만 괄호
   * 한 칸이 는다 — 종전 "(비활성 N)"과 같은 형식이다.
   */
  it("링크 열이 새 판정의 근거를 함께 보여 준다 (열의 의미는 그대로)", () => {
    const page = readAdminSource("app/items/page.tsx");
    expect(page).toContain("activeProductLinkCount(item) > 0 && activeNonSponsoredLinkCount(item) === 0");
    expect(page).toContain("(비스폰서 0)");
    // 기존 표시는 바이트 불변이다 — 활성 수와 "(비활성 N)"이 그대로다.
    expect(page).toContain("(비활성 {productLinkCount(item) - activeProductLinkCount(item)})");
    // 그 배지가 서는 조건이 곧 필터의 조건이다(픽스처로 같은 답을 확인한다).
    for (const fixture of [stroller, walker]) {
      expect(activeProductLinkCount(fixture) > 0 && activeNonSponsoredLinkCount(fixture) === 0).toBe(
        activeProductLinkCount(fixture) > 0 &&
          filterItemTemplates([fixture], { missingNonSponsoredLinksOnly: true }).length === 1
      );
    }
    // 링크가 아예 없는 준비템에는 붙지 않는다(그 자리는 활성 수 0이 이미 말한다).
    expect(activeProductLinkCount(sterilizer) > 0 && activeNonSponsoredLinkCount(sterilizer) === 0).toBe(false);
    // 스폰서 링크를 숨기거나 뒤로 미는 배선은 여전히 0건이다(DNC-011).
    expect(page).not.toContain("isSponsored ?");
    expect(page).not.toMatch(/filter\([^)]*isSponsored/);
  });

  /**
   * ⚠️ 라운드 84 리뷰 L-12 — **필드 부재 폴백의 방향이 N-8과 반대라는 사실을 값으로 고정한다.**
   *
   * 오늘 두 필드는 모두 필수라 이 경우가 실제로 오지는 않는다. 그래서 코드 동작은 바꾸지 않고,
   * 방향이 반대라는 것과 그 이유(이 판정에는 배열 말고 대체 근거가 없다)를 주석과 이 줄에 남긴다.
   */
  it("L-12: productLinks가 비어 오면 두 판정의 폴백 방향이 반대다", () => {
    const legacy = { name: "신생아 속싸개", activeLinkCount: 2 } as unknown as FilterableItem;

    // N-8: 없는 문제를 만들지 않는 쪽 — 서버가 센 활성 수를 그대로 믿는다.
    expect(activeProductLinkCount(legacy)).toBe(2);
    expect(filterItemTemplates([legacy], { missingLinksOnly: true })).toEqual([]);

    // 새 판정: 배열이 없으면 0 — **없는 문제를 만드는 쪽**이다(그 사실을 숨기지 않는다).
    expect(activeNonSponsoredLinkCount(legacy)).toBe(0);
    expect(filterItemTemplates([legacy], { missingNonSponsoredLinksOnly: true })).toEqual([legacy]);

    // 그 비대칭이 주석에 값으로 적혀 있다(다음 사람이 이 판단을 다시 하지 않게).
    const source = readAdminSource("src/lib/item-filters.ts");
    expect(source).toContain("필드 부재 폴백의 방향이 N-8과 반대다");
  });

  it("기존 필터의 문구는 한 글자도 바뀌지 않는다 (ⓔ)", () => {
    expect(page).toContain("상품 링크 없음만 보기");
    expect(page).toContain("링크가 전부 비활성인 준비템도 함께 나와요.");
    expect(page).toContain("대소문자를 가리지 않고 부분 일치로 찾아요.");
    expect(page).toContain("필터 초기화");
    // 요약 문구도 그대로다(itemFilterSummary = linkFilterSummary).
    expect(page).toContain("itemFilterSummary(items.length, filteredItems?.length ?? 0)");
  });
});
