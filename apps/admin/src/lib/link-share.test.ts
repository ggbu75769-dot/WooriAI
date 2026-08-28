import { describe, expect, it } from "vitest";
import { buildShareCopyText, hasShareUrl, shareCopyHint } from "./link-share";

/**
 * GAP-064 #8 + DNC-010: 공개 리다이렉트 URL을 어드민이 뿌리기 시작하면 고지가 앱 밖에
 * 남지 않는다. 그래서 복사 동작은 URL만 복사하지 않는다 — 고지 대상 링크는 문구와
 * URL을 한 덩어리로 복사한다. 반대로 없는 고지를 지어내지도 않는다.
 */
const SHARE_URL = "https://wooriai.example/r/0123456789ab";

describe("buildShareCopyText", () => {
  it("고지 대상 링크는 고지 문구와 URL을 두 줄로 함께 복사한다 (DNC-010)", () => {
    expect(
      buildShareCopyText({
        redirectShareUrl: SHARE_URL,
        disclosureText: "제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요."
      })
    ).toBe(`제휴 링크예요. 구매하시면 우리아이가 수수료를 받을 수 있어요.\n${SHARE_URL}`);
  });

  it("고지 대상이 아닌 일반 링크는 URL 한 줄 그대로다 (없는 고지를 지어내지 않는다)", () => {
    expect(buildShareCopyText({ redirectShareUrl: SHARE_URL, disclosureText: null })).toBe(SHARE_URL);
    expect(buildShareCopyText({ redirectShareUrl: SHARE_URL, disclosureText: "   " })).toBe(SHARE_URL);
  });

  it("공유 URL이 없으면 null이다 — 화면이 죽은 복사 버튼을 만들지 않는다", () => {
    expect(buildShareCopyText({ redirectShareUrl: null, disclosureText: "제휴 링크예요." })).toBeNull();
    expect(buildShareCopyText({ redirectShareUrl: undefined, disclosureText: null })).toBeNull();
    expect(hasShareUrl({ redirectShareUrl: null })).toBe(false);
    expect(hasShareUrl({ redirectShareUrl: SHARE_URL })).toBe(true);
  });
});

describe("shareCopyHint", () => {
  it("고지가 함께 나가는 경우에만 그 사실을 말한다", () => {
    expect(shareCopyHint({ disclosureText: "스폰서 광고 상품이에요." })).toContain("함께 복사");
    expect(shareCopyHint({ disclosureText: null })).toBe("");
  });
});
