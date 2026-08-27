import { describe, expect, it } from "vitest";
import {
  ambiguousTileCategoryCodes,
  buildTileCategoryIdResolver,
  buildTileCategoryResolver,
  categoryCatalog
} from "./categories";

/**
 * 라운드 38 H-6 / H-11 — 서버 카테고리 UUID를 8타일로 옮기는 공용 매핑.
 *
 * 왜 필요한가: 8타일의 id는 코드에 박힌 고정 UUID지만, 엑셀 가져오기·지출 수정 화면을 거친 행은
 * 서버가 시드한 정식 카테고리 UUID(apps/api/prisma/seed-data.ts `categorySeeds` — 고정 id가 없어
 * DB마다 다르다)를 달고 들어온다. id 완전 일치만 보면 그 행들이 전부 "모르는 분류"가 되어
 * "또 기록"의 분류 복사가 실패하고(H-6), 입력 화면 맥락 줄의 카테고리 항이 통째로 사라진다(H-11).
 * 다리 역할은 `code`가 하고, 대응표는 이미 받아 둔 `["categories"]` 캐시에서 온다.
 */

/** 실제 서버가 돌려주는 모양(전량 21행 규약: 정식 12 + 모바일 별칭 8 + 임포트 스텁 1)의 일부. */
const serverCategories = [
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000001", code: "diaper_hygiene" },
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000002", code: "feeding_babyfood" },
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000003", code: "hospital_checkup" },
  // 8타일에 대응이 없는 정식 분류.
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000004", code: "sleep_furniture" },
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000005", code: "insurance_savings" },
  // 엑셀 임포트 스텁(사용자가 고르는 분류가 아니다).
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "import_stub_default" },
  // 8타일 별칭 행 — id 자체가 타일 id다.
  { id: categoryCatalog[0].id, code: "mobile_diaper_hygiene" }
];

const tileId = (label: string) => categoryCatalog.find((entry) => entry.label === label)!.id;

describe("buildTileCategoryIdResolver (서버 카테고리 UUID -> 8타일)", () => {
  it("서버 시드 UUID를 code를 거쳐 같은 분류의 타일로 옮긴다", () => {
    const resolve = buildTileCategoryIdResolver(serverCategories);

    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000001")).toBe(tileId("기저귀"));
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000003")).toBe(tileId("병원/약"));
  });

  it("타일 id는 그대로 통과한다 — 별칭 행도 캐시 없이 해결된다", () => {
    const withCache = buildTileCategoryIdResolver(serverCategories);
    const withoutCache = buildTileCategoryIdResolver(null);

    for (const entry of categoryCatalog) {
      expect(withCache(entry.id), entry.label).toBe(entry.id);
      expect(withoutCache(entry.id), entry.label).toBe(entry.id);
    }
  });

  it("한 code에 타일이 둘이면(분유/유제품 · 식비) 카탈로그 순서상 첫 타일로 결정적으로 보낸다", () => {
    const resolve = buildTileCategoryIdResolver(serverCategories);
    // 서버 code만으로는 둘을 구별할 수 없다 — 어느 쪽이든 임의 선택이므로 결정성만 지킨다.
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000002")).toBe(tileId("분유/유제품"));
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000002")).toBe(
      buildTileCategoryIdResolver(serverCategories)("0f3d0f1a-1f2b-4c3d-8e4f-000000000002")
    );
  });

  it("대응 타일이 없는 분류·임포트 스텁·모르는 id는 null이다 — 분류를 지어내지 않는다", () => {
    const resolve = buildTileCategoryIdResolver(serverCategories);

    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000004")).toBeNull(); // 수면/가구
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000005")).toBeNull(); // 보험/저축
    expect(resolve("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBeNull(); // 가져오기 기본
    expect(resolve("00000000-dead-4bee-8fff-000000000000")).toBeNull();
    expect(resolve("")).toBeNull();
  });

  it("캐시가 없으면(콜드 스타트·오프라인 첫 실행) 타일 id 완전 일치만 남는다 — 종전 동작 그대로", () => {
    for (const categories of [null, undefined, []]) {
      const resolve = buildTileCategoryIdResolver(categories);
      expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000001")).toBeNull();
      expect(resolve(categoryCatalog[0].id)).toBe(categoryCatalog[0].id);
    }
  });

  it("이름·code가 비어 있는 행은 대응표에 넣지 않는다(빈 문자열로 매핑되지 않는다)", () => {
    const resolve = buildTileCategoryIdResolver([
      { id: "broken-1", code: "   " },
      { id: "", code: "diaper_hygiene" }
    ]);

    expect(resolve("broken-1")).toBeNull();
    expect(resolve("")).toBeNull();
  });
});

/**
 * 라운드 39 I-1 — 같은 매핑이 "이 선택이 임의값인가"를 함께 말한다.
 *
 * `feeding_babyfood` 하나에 이 앱의 타일이 둘 걸려 있어서(분유/유제품 · 식비), 서버 시드 행은
 * 늘 첫 타일로 간다. 프리필처럼 어느 쪽이든 골라야 하는 경로에는 그것으로 충분하지만, 카테고리
 * **합계를 문장으로 말하는** 경로에서는 그 임의 선택이 곧 틀린 사실 진술이 된다. 그래서 매핑이
 * 그 사실(ambiguous)을 밖으로 내보내고, 합계 경로만 그것을 "모름"으로 되돌린다.
 */
describe("buildTileCategoryResolver — 모호한 code를 밝힌다 (I-1)", () => {
  it("타일이 둘 걸린 code 집합은 카탈로그에서 파생된다", () => {
    expect([...ambiguousTileCategoryCodes]).toEqual(["feeding_babyfood"]);
  });

  it("모호한 code의 서버 행은 타일을 고르되 ambiguous로 표시한다", () => {
    const resolve = buildTileCategoryResolver(serverCategories);
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000002")).toEqual({
      tileCategoryId: tileId("분유/유제품"),
      ambiguous: true
    });
  });

  it("1:1 code·타일 id·대응 없는 분류는 모호하지 않다", () => {
    const resolve = buildTileCategoryResolver(serverCategories);
    // 1:1 (기저귀/위생)
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000001")).toEqual({
      tileCategoryId: tileId("기저귀"),
      ambiguous: false
    });
    // 타일 id는 code를 거치지 않는다 — "식비" 타일 자신도 모호하지 않다.
    expect(resolve(tileId("식비"))).toEqual({ tileCategoryId: tileId("식비"), ambiguous: false });
    expect(resolve(tileId("분유/유제품"))).toEqual({ tileCategoryId: tileId("분유/유제품"), ambiguous: false });
    // 갈 곳이 아예 없는 분류는 "모름"이지 "모호"가 아니다.
    expect(resolve("0f3d0f1a-1f2b-4c3d-8e4f-000000000004")).toEqual({ tileCategoryId: null, ambiguous: false });
    expect(resolve("")).toEqual({ tileCategoryId: null, ambiguous: false });
  });

  it("id만 쓰는 래퍼는 종전 동작 그대로다 (프리필 경로의 결정적 선택)", () => {
    const resolveId = buildTileCategoryIdResolver(serverCategories);
    const resolve = buildTileCategoryResolver(serverCategories);
    for (const id of [
      "0f3d0f1a-1f2b-4c3d-8e4f-000000000001",
      "0f3d0f1a-1f2b-4c3d-8e4f-000000000002",
      "0f3d0f1a-1f2b-4c3d-8e4f-000000000004",
      categoryCatalog[0].id
    ]) {
      expect(resolveId(id), id).toBe(resolve(id).tileCategoryId);
    }
  });
});
