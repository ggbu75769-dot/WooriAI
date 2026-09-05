import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as localBackend from "../api/local-backend";
import {
  LOCAL_CHILD_ID,
  LOCAL_ITEM_BLOCKS,
  LOCAL_ITEM_CARRIER,
  LOCAL_ITEM_DIAPER,
  LOCAL_PRICE_CHECKED_AT,
  LOCAL_PRICE_CHECKED_AT_OLDER,
  localItemTemplateFixtures,
  localProductLinkFixtures
} from "../api/local-fixtures";
import { formatKrw } from "../money";
import {
  LINK_PRICE_CAPTION_SEPARATOR,
  LINK_PRICE_CHECKED_SUFFIX,
  LINK_PRICE_MAX_AGE_DAYS,
  resolveLinkPriceDisplay,
  withLinkPriceCaption
} from "./link-price";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const detailSource = () => source("app/items/[itemTemplateId].tsx");

/** 오늘을 고정해 연도 표기 판정이 달력과 함께 흔들리지 않게 한다. */
const TODAY = "2026-08-27";

/**
 * 라운드 52 T1 (C-01) — 판매처별 가격 + 확인 시각.
 *
 * 지키는 계약은 하나다: **가격은 언제 확인한 값인지와 함께가 아니면 화면에 나오지 않는다.**
 * 스냅샷 가격만 크게 찍으면 사용자는 그것을 현재가로 읽고, 그건 허위 표시다.
 */
describe("resolveLinkPriceDisplay — 둘 다 있을 때만 그린다", () => {
  it("가격과 확인 시각이 둘 다 있으면 값과 캡션을 함께 돌려준다", () => {
    expect(resolveLinkPriceDisplay({ priceSnapshotKrw: 89_000, priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY)).toEqual({
      priceText: "89,000원",
      checkedAtCaption: "8월 20일 확인"
    });
  });

  it("가격만 있으면 아무것도 그리지 않는다 (기준 시각 없는 값은 현재가로 읽힌다)", () => {
    expect(resolveLinkPriceDisplay({ priceSnapshotKrw: 89_000 }, TODAY)).toBeNull();
  });

  it("확인 시각만 있으면 아무것도 그리지 않는다 (가리킬 값이 없다)", () => {
    expect(resolveLinkPriceDisplay({ priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY)).toBeNull();
  });

  it("둘 다 없으면 null이고, 링크 자체가 없어도 던지지 않는다", () => {
    expect(resolveLinkPriceDisplay({}, TODAY)).toBeNull();
    expect(resolveLinkPriceDisplay(null, TODAY)).toBeNull();
    expect(resolveLinkPriceDisplay(undefined, TODAY)).toBeNull();
  });

  it("판매가로 읽을 수 없는 수는 그리지 않는다 (0원·음수·소수·NaN)", () => {
    for (const priceSnapshotKrw of [0, -1_000, 45_900.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveLinkPriceDisplay({ priceSnapshotKrw, priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY)).toBeNull();
    }
  });

  it("해석할 수 없는 확인 시각이면 가격도 그리지 않는다", () => {
    for (const priceCheckedAt of ["", "어제", "2026-13-45T00:00:00.000Z", "not-a-date"]) {
      expect(resolveLinkPriceDisplay({ priceSnapshotKrw: 45_900, priceCheckedAt }, TODAY)).toBeNull();
    }
  });
});

describe("표기 — 금액은 앱 단일 소스, 시각은 서울 달력", () => {
  it("금액은 formatKrw 그대로다 ('₩' 없이 쉼표 + 원)", () => {
    const display = resolveLinkPriceDisplay({ priceSnapshotKrw: 289_000, priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY)!;

    expect(display.priceText).toBe(formatKrw(289_000));
    expect(display.priceText).toBe("289,000원");
    expect(display.priceText).not.toContain("₩");
  });

  it("확인 시각은 서울 달력으로 읽는다 — 기기·러너 타임존이 UTC여도 하루가 밀리지 않는다", () => {
    // 서울 2026-08-20 00:30 (UTC로 읽으면 8월 19일이다).
    expect(resolveLinkPriceDisplay({ priceSnapshotKrw: 45_900, priceCheckedAt: "2026-08-19T15:30:00.000Z" }, TODAY))
      .toEqual({ priceText: "45,900원", checkedAtCaption: "8월 20일 확인" });
    // 서울 자정 경계 양쪽.
    expect(
      resolveLinkPriceDisplay({ priceSnapshotKrw: 45_900, priceCheckedAt: "2026-08-20T14:59:00.000Z" }, TODAY)!
        .checkedAtCaption
    ).toBe("8월 20일 확인");
    expect(
      resolveLinkPriceDisplay({ priceSnapshotKrw: 45_900, priceCheckedAt: "2026-08-20T15:00:00.000Z" }, TODAY)!
        .checkedAtCaption
    ).toBe("8월 21일 확인");
  });

  it("해가 다른 확인 시각에는 연도를 붙인다 ('1월 2일'이 올해로 읽히지 않게)", () => {
    // 라운드 52 QA P3-8b: 180일을 넘긴 값은 아예 그리지 않으므로, 연도 표기 규칙은 **아직
    // 그릴 수 있는 나이의** 해 넘김으로 짚는다(2026-03-01에서 본 2025-12-20 = 71일 전).
    expect(
      resolveLinkPriceDisplay({ priceSnapshotKrw: 45_900, priceCheckedAt: "2025-12-20T09:00:00.000Z" }, "2026-03-01")!
        .checkedAtCaption
    ).toBe("2025년 12월 20일 확인");
  });

  it("오래된 값이어도 문구가 신선도를 대신 주장하지 않는다 (해요체·'확인'만)", () => {
    const stale = resolveLinkPriceDisplay(
      { priceSnapshotKrw: 45_900, priceCheckedAt: "2025-12-20T09:00:00.000Z" },
      "2026-03-01"
    )!;

    expect(stale.checkedAtCaption.endsWith(LINK_PRICE_CHECKED_SUFFIX)).toBe(true);
    expect(stale.checkedAtCaption).not.toMatch(/지금|현재가|실시간|최저가|최신/);
    // 값 자체도 "최저가"라고 주장하지 않는다 -- 우리는 그 시점에 확인한 한 판매처의 값만 안다.
    expect(stale.priceText).not.toMatch(/최저|할인|특가/);
  });
});

/**
 * 라운드 52 QA P3-8 — 신선도.
 *
 * 규칙 3("날짜가 스스로 오래됨을 말한다")은 어느 선까지만 성립한다. 반년 전 가격은 사용자가
 * 지금 견줄 수 있는 값이 아니고, 그럼에도 큰 글씨로 찍히면 "이 판매처가 더 싸다"는 비교 판단의
 * 근거가 된다. 그리고 미래 시각은 시계가 어긋났다는 신호일 뿐인데, 그대로 두면 나이 판정이
 * 음수가 되어 어떤 낡은 값이든 통과시킨다.
 */
describe("신선도 — 미래 시각과 너무 오래된 값은 그리지 않는다", () => {
  const priced = (priceCheckedAt: string, today: string = TODAY) =>
    resolveLinkPriceDisplay({ priceSnapshotKrw: 45_900, priceCheckedAt }, today);

  it("서울 기준 오늘보다 뒤면 그리지 않는다 (서버·기기 시계 왜곡 방어)", () => {
    // 서울 2026-08-28 = TODAY(08-27)의 다음 날.
    expect(priced("2026-08-27T15:00:00.000Z")).toBeNull();
    // 한참 뒤도 마찬가지.
    expect(priced("2027-01-01T00:00:00.000Z")).toBeNull();
  });

  it("오늘 확인한 값은 정상이다 (가장 흔한 정상 케이스를 막지 않는다)", () => {
    // 서울 2026-08-27 = TODAY.
    expect(priced("2026-08-27T00:30:00.000Z")!.checkedAtCaption).toBe("8월 27일 확인");
  });

  it(`확인한 지 ${LINK_PRICE_MAX_AGE_DAYS}일을 넘기면 가격을 표시하지 않는다`, () => {
    expect(LINK_PRICE_MAX_AGE_DAYS).toBe(180);
    // 경계는 상수에서 계산한다 -- 숫자를 바꾸면 이 테스트가 함께 따라간다.
    const todayMillis = Date.UTC(2026, 7, 27);
    const atAge = (days: number) =>
      new Date(todayMillis - days * 86_400_000 + 3 * 3_600_000).toISOString();

    // 정확히 상한이면 아직 그린다(경계 포함).
    expect(priced(atAge(LINK_PRICE_MAX_AGE_DAYS))).not.toBeNull();
    // 하루만 더 지나면 값도 캡션도 없다 -- 화면은 종전대로 가격 칸을 비운다.
    expect(priced(atAge(LINK_PRICE_MAX_AGE_DAYS + 1))).toBeNull();
    expect(priced(atAge(400))).toBeNull();
  });

  it("오늘을 해석할 수 없으면 나이를 모르므로 그리지 않는다", () => {
    for (const today of ["", "오늘", "2026-08", "2026/08/27"]) {
      expect(priced("2026-08-20T09:00:00.000Z", today), today).toBeNull();
    }
  });

  it("고정 픽스처는 두 값 모두 여전히 그려진다 (데모·픽셀락 화면 무변경)", () => {
    expect(resolveLinkPriceDisplay({ priceSnapshotKrw: 89_000, priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY)).not.toBeNull();
    expect(
      resolveLinkPriceDisplay({ priceSnapshotKrw: 89_000, priceCheckedAt: LOCAL_PRICE_CHECKED_AT_OLDER }, TODAY)
    ).not.toBeNull();
  });
});

describe("withLinkPriceCaption — 값과 같은 행의 캡션", () => {
  it("기존 플랫폼 라벨 뒤에 확인 시각을 잇는다", () => {
    const display = resolveLinkPriceDisplay({ priceSnapshotKrw: 89_000, priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY);

    expect(withLinkPriceCaption("쿠팡", display)).toBe(`쿠팡${LINK_PRICE_CAPTION_SEPARATOR}8월 20일 확인`);
    expect(withLinkPriceCaption("쿠팡", display)).toBe("쿠팡 · 8월 20일 확인");
  });

  it("그릴 가격이 없으면 캡션도 종전 그대로다", () => {
    expect(withLinkPriceCaption("네이버", null)).toBe("네이버");
    expect(withLinkPriceCaption(undefined, null)).toBeUndefined();
  });

  it("기존 라벨이 비어 있어도 확인 시각은 남는다 (캡션 없는 가격을 만들지 않는다)", () => {
    const display = resolveLinkPriceDisplay({ priceSnapshotKrw: 89_000, priceCheckedAt: LOCAL_PRICE_CHECKED_AT }, TODAY);

    expect(withLinkPriceCaption("", display)).toBe("8월 20일 확인");
    expect(withLinkPriceCaption(undefined, display)).toBe("8월 20일 확인");
  });
});

describe("화면 배선 — 값과 캡션은 한 판정에서 같은 행으로 간다", () => {
  it("상세 화면이 모듈 판정을 쓰고, 원시 필드를 직접 읽지 않는다", () => {
    const detail = detailSource();

    expect(detail).toContain('import { resolveLinkPriceDisplay, withLinkPriceCaption } from "../../src/items/link-price";');
    expect(detail).toContain("const linkPrice = hasSession ? resolveLinkPriceDisplay(link) : null;");
    // 서버 원시 필드를 화면이 직접 만지면 "시각 없이 가격만" 배선이 다시 생길 수 있다.
    expect(detail).not.toContain("link.priceSnapshotKrw");
    expect(detail).not.toContain("link.priceCheckedAt");
    // 금액 문자열도 화면에서 따로 만들지 않는다(모듈이 formatKrw 단일 소스를 쓴다).
    expect(detail).not.toContain("formatKrw(");
  });

  it("가격과 확인 시각이 **같은 ProductComparisonRow**에 함께 들어간다", () => {
    const detail = detailSource();
    const rowStart = detail.indexOf("<ProductComparisonRow");
    expect(rowStart).toBeGreaterThan(-1);
    const row = detail.slice(rowStart, detail.indexOf("/>", rowStart));

    expect(row).toContain('price={hasSession ? linkPrice?.priceText ?? "" : visibleDetail.priceBandText ?? ""}');
    expect(row).toContain("caption={hasSession ? withLinkPriceCaption(productPlatformLabel(link.platform), linkPrice) : undefined}");
    // 화면에 ProductComparisonRow는 이 한 곳뿐이다 -- 가격만 그리는 두 번째 배선이 없다.
    expect(detail.indexOf("<ProductComparisonRow", rowStart + 1)).toBe(-1);
  });

  it("가격 판정이 null이면 종전 동작(빈 가격 칸 + 라벨만 있는 캡션)으로 떨어진다", () => {
    const detail = detailSource();

    // null 병합의 대체값이 빈 문자열이므로 컴포넌트가 가격 <Text>를 아예 그리지 않는다.
    expect(detail).toContain('linkPrice?.priceText ?? ""');
    // 캡션은 withLinkPriceCaption이 그대로 통과시킨다(위 단위 테스트가 고정).
    expect(withLinkPriceCaption("쿠팡", null)).toBe("쿠팡");
  });

  it("비세션 프리뷰(ITEM-002 픽셀 락) 경로는 한 글자도 바뀌지 않는다", () => {
    const detail = detailSource();

    // 프리뷰 가지는 종전 그대로 가격대 문자열 / 캡션 없음이다.
    expect(detail).toContain(': visibleDetail.priceBandText ?? ""}');
    expect(detail).toContain(": undefined}");
    // 세션 게이트가 판정 자체를 감싼다 -- 프리뷰에서는 모듈이 호출되지도 않는다.
    expect(detail).toContain("hasSession ? resolveLinkPriceDisplay(link) : null");
  });
});

describe("데모(로컬 백엔드) 배선", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("픽스처의 가격과 확인 시각은 언제나 짝이다 (한쪽만 있는 링크가 없다)", () => {
    for (const link of localProductLinkFixtures) {
      expect(link.priceSnapshotKrw === null).toBe(link.priceCheckedAt === null);
    }
  });

  it("확인 시각은 **고정 상수**다 -- 실행할 때마다 오늘로 밀리지 않는다", () => {
    const fixturesSource = source("src/api/local-fixtures.ts");
    const arrayStart = fixturesSource.indexOf("export const localProductLinkFixtures");
    const arrayBlock = fixturesSource.slice(arrayStart, fixturesSource.indexOf("\n];", arrayStart));

    expect(arrayBlock).not.toContain("Date.now(");
    expect(arrayBlock).not.toContain("new Date(");
    for (const link of localProductLinkFixtures) {
      if (link.priceCheckedAt === null) continue;
      expect([LOCAL_PRICE_CHECKED_AT, LOCAL_PRICE_CHECKED_AT_OLDER]).toContain(link.priceCheckedAt);
    }
  });

  /**
   * FIX-C(2026-09-03) — 두 시점. ① 라운드 52 C-01 당시 픽스처에는 가격 스냅샷이 있었고 이
   * 케이스는 "있는 가격은 전부 그릴 수 있고 가격대 안"임을 지켰다(priced.length > 0).
   * ② FIX-C: 플랜 B 정합(서버 시드 2026-09-02와 같은 원칙)으로 데모 링크는 전부 쿠팡 **검색**
   * 링크가 됐다 — 검색 결과 페이지에는 단일 가격이 없으므로 스냅샷은 전 행 null이다(확인할
   * 수 없는 가격을 적으면 허위 데이터다). 하한을 0으로 내리되, 가격이 되살아나는 날(플랜 A
   * 전환)을 위한 래칫으로 "있다면 그릴 수 있고 가격대 안"은 그대로 남긴다.
   */
  it("가격이 있는 픽스처는 전부 그릴 수 있고, 그 준비템의 가격대 안에 있다 (플랜 B: 현재 0건)", () => {
    const priced = localProductLinkFixtures.filter((link) => link.priceSnapshotKrw !== null);
    expect(priced.length).toBeGreaterThanOrEqual(0);

    for (const link of priced) {
      const display = resolveLinkPriceDisplay(
        { priceSnapshotKrw: link.priceSnapshotKrw ?? undefined, priceCheckedAt: link.priceCheckedAt ?? undefined },
        TODAY
      );
      expect(display).not.toBeNull();
      expect(display!.priceText).toBe(formatKrw(link.priceSnapshotKrw!));

      const item = localItemTemplateFixtures.find((fixture) => fixture.id === link.itemTemplateId)!;
      expect(item).toBeDefined();
      if (item.priceMinKrw !== null) expect(link.priceSnapshotKrw!).toBeGreaterThanOrEqual(item.priceMinKrw);
      if (item.priceMaxKrw !== null) expect(link.priceSnapshotKrw!).toBeLessThanOrEqual(item.priceMaxKrw);
    }
  });

  it("가격을 확인한 적 없는 링크도 남아 있다 (빈 가격 칸 경로가 데모에서도 관찰된다)", () => {
    expect(localProductLinkFixtures.some((link) => link.priceSnapshotKrw === null)).toBe(true);

    const blocks = localBackend.getItemDetail(LOCAL_CHILD_ID, LOCAL_ITEM_BLOCKS);
    for (const link of blocks.productLinks) {
      // 키 자체가 없어야 한다 -- undefined를 실어 보내는 것과 달리 계약 위반 소지가 없다.
      expect("priceSnapshotKrw" in link).toBe(false);
      expect("priceCheckedAt" in link).toBe(false);
      expect(resolveLinkPriceDisplay(link, TODAY)).toBeNull();
    }
  });

  /**
   * FIX-C(2026-09-03) — 두 시점 이관. ① 종전 두 케이스는 데모 상세가 가격·확인 시각을
   * 그대로 내보내는 것(아기띠 89,000원 · 8월 20일 확인)과, 한 화면의 판매처들이 서로 다른
   * 가격·시각을 말하는 것(기저귀 제휴 vs 스폰서 — DNC-011 가격 비교 포함)을 지켰다.
   * ② FIX-C: 플랜 B 정합으로 데모 링크의 가격 스냅샷이 전부 사라졌다(위 케이스 주석 참고 —
   * 검색 링크에는 단일 가격이 없다). 스폰서 행도 지워졌으므로(활성 스폰서 0 — DNC-011의
   * 반대 방향 오류 방지) 비교 대상 자체가 없다. 이제 지키는 사실: **모든** 데모 상세의 링크에
   * 가격 키가 아예 실리지 않고(undefined 키를 흘리지 않는 종전 규칙 그대로), 화면 판정은
   * null이라 가격 칸이 빈다. "그대로 내보낸다"는 배선 자체는 위 blocks 케이스와 서버 규칙
   * 미러(local-backend.ts getItemDetail의 짝 규칙)가 계속 지킨다.
   */
  it("플랜 B: 데모 상세 어디에도 가격 스냅샷이 실리지 않는다 (키 자체가 없다)", () => {
    for (const itemId of [LOCAL_ITEM_CARRIER, LOCAL_ITEM_DIAPER]) {
      const links = localBackend.getItemDetail(LOCAL_CHILD_ID, itemId).productLinks;
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect("priceSnapshotKrw" in link).toBe(false);
        expect("priceCheckedAt" in link).toBe(false);
        expect(resolveLinkPriceDisplay(link, TODAY)).toBeNull();
      }
    }
  });
});

describe("DNC-009 — 가격은 표시 전용이다 (정렬·추천에 유입되지 않는다)", () => {
  it("데모 추천 정렬에 넘기는 값에 가격이 없다", () => {
    const backend = source("src/api/local-backend.ts");
    const callStart = backend.indexOf("const sorted = sortRecommendedItems(");
    expect(callStart).toBeGreaterThan(-1);
    const call = backend.slice(callStart, backend.indexOf("\n  );", callStart));

    expect(call).not.toContain("price");
  });

  it("추천 점수 모듈 자체가 가격을 모른다", () => {
    const recommendation = readFileSync(join(mobileRoot, "../../packages/domain/src/recommendation.ts"), "utf8");

    expect(recommendation).not.toContain("price");
  });

  it("이 모듈은 상세 화면 한 곳에서만 쓰인다 (정렬 소스가 부르지 않는다)", () => {
    const roots = ["src", "app"];
    const importers: string[] = [];

    for (const root of roots) {
      const dir = join(mobileRoot, root);
      for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (!/\.tsx?$/.test(entry.name)) continue;
        const path = join(entry.parentPath ?? entry.path, entry.name);
        if (path.endsWith(join("src", "items", "link-price.ts"))) continue;
        // 라운드 64 M-2: 이 가드가 지키는 것은 **제품 코드**의 결합이다(정렬·추천 소스가
        // 가격 표시 규칙을 부르면 DNC-009가 흔들린다). 테스트 파일은 그 결합을 만들지
        // 않으므로 전부 건너뛴다 — 계약 상수 드리프트 가드(src/api/contracts-mirror.test.ts)가
        // 이 모듈의 LINK_PRICE_MAX_AGE_DAYS를 읽어야 한다.
        if (/\.test\.tsx?$/.test(entry.name)) continue;
        if (readFileSync(path, "utf8").includes("items/link-price")) {
          importers.push(path.slice(mobileRoot.length + 1).replace(/\\/g, "/"));
        }
      }
    }

    expect(importers).toEqual(["app/items/[itemTemplateId].tsx"]);
  });
});
