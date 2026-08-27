import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVISION_STATUS_FILTER,
  REVISION_STATUS_FILTERS,
  revisionStatusFilterFromSearchParams,
  revisionTargetLabel,
  shortEntityId
} from "./revision-rows";

describe("revisionTargetLabel (UX-X C6)", () => {
  it("uses the payload name a human recognises, per entity type", () => {
    expect(revisionTargetLabel({ entityId: "abc", payload: { title: "쿠팡 속싸개 3종" } })).toBe("쿠팡 속싸개 3종");
    expect(revisionTargetLabel({ entityId: "abc", payload: { name: "젖병 소독기" } })).toBe("젖병 소독기");
    expect(revisionTargetLabel({ entityId: "abc", payload: { key: "affiliate_purchase" } })).toBe("affiliate_purchase");
  });

  it("prefers title over name/key and trims surrounding whitespace", () => {
    expect(revisionTargetLabel({ entityId: null, payload: { title: "  링크 제목  ", name: "준비템" } })).toBe("링크 제목");
  });

  it("falls back to a shortened entityId, then to 신규 for a create draft", () => {
    expect(revisionTargetLabel({ entityId: "0a1b2c3d-4e5f-6789-abcd-ef0123456789", payload: { active: false } })).toBe(
      "0a1b2c3d…"
    );
    expect(revisionTargetLabel({ entityId: null, payload: { active: false } })).toBe("신규");
    // 빈 문자열/공백뿐인 이름은 이름이 아니다.
    expect(revisionTargetLabel({ entityId: null, payload: { title: "   " } })).toBe("신규");
  });

  it("leaves already-short ids alone", () => {
    expect(shortEntityId("abc")).toBe("abc");
    expect(shortEntityId("12345678")).toBe("12345678");
  });
});

describe("revisionStatusFilterFromSearchParams (UX-X C5)", () => {
  it("reads the dashboard card's ?status=in_review", () => {
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=in_review"))).toBe("in_review");
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=all"))).toBe("all");
  });

  it("falls back to the default for a missing, unknown, or non-selectable status", () => {
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams(""))).toBe(DEFAULT_REVISION_STATUS_FILTER);
    expect(revisionStatusFilterFromSearchParams(null)).toBe(DEFAULT_REVISION_STATUS_FILTER);
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=nonsense"))).toBe("in_review");
    // select에 없는 상태(초안/게시 처리 중/보관됨)로는 들어가지 않는다.
    expect(revisionStatusFilterFromSearchParams(new URLSearchParams("status=draft"))).toBe("in_review");
    expect(REVISION_STATUS_FILTERS).not.toContain("draft");
  });
});
