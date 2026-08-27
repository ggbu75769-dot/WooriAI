import { describe, expect, it } from "vitest";
import { maskLookupQuery } from "../src/admin/admin-users-lookup.service";

/**
 * R29 리뷰 후속: 접두는 항상 원문보다 짧아야 한다 — 최단 허용 검색어(2자)가 고정 접두
 * 2자에 통째로 보존되던 구멍을 막은 규칙(min(2, 길이-1))을 경계까지 고정한다. DB 불필요.
 */
describe("maskLookupQuery", () => {
  it("2자 검색어는 앞 1자만 남는다 — 원문 전체가 보존되지 않는다", () => {
    expect(maskLookupQuery("김철")).toBe("김***(2자)");
  });

  it("3자 이상은 접두 2자 + 길이", () => {
    expect(maskLookupQuery("김철수")).toBe("김철***(3자)");
    expect(maskLookupQuery("hong@example.com")).toBe("ho***(16자)");
  });

  it("서로게이트 쌍(이모지)이 반토막 나지 않는다", () => {
    expect(maskLookupQuery("😀😀")).toBe("😀***(2자)");
  });

  it("어떤 입력에서도 마스킹 결과에 원문 전체가 부분 문자열로 남지 않는다", () => {
    for (const query of ["ab", "김철", "abc", "test@x.kr"]) {
      expect(maskLookupQuery(query)).not.toContain(query);
    }
  });
});
