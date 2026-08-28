import { describe, expect, it } from "vitest";
import { RECOVERY_CODES_LOW_THRESHOLD, recoveryCodesNotice } from "./recovery-codes-view";

/**
 * GAP-064 #7: 복구 코드는 한 장씩 소모되는데 잔량을 말해 주는 자리가 없어, 운영자는
 * 마지막 한 장을 쓴 사실을 다 쓴 뒤에야 알았다. 그 시점엔 재등록 입구조차 코드를
 * 요구하므로 어드민에서 영구히 잠긴다.
 */
describe("recoveryCodesNotice", () => {
  it("장수를 그대로 말한다", () => {
    expect(recoveryCodesNotice(7)).toMatchObject({ text: "남은 복구 코드 7장", low: false, actionText: "" });
  });

  it("임계 이하에서는 지금 재등록하라고 같은 자리에서 덧붙인다", () => {
    const notice = recoveryCodesNotice(RECOVERY_CODES_LOW_THRESHOLD);
    expect(notice?.low).toBe(true);
    expect(notice?.actionText).toContain("인증 앱 다시 등록");
  });

  it("0장도 같은 안내를 쓴다 — 들어와 있는 지금이 재등록할 수 있는 유일한 시점이다", () => {
    const notice = recoveryCodesNotice(0);
    expect(notice).toMatchObject({ text: "남은 복구 코드 0장", low: true });
    expect(notice?.actionText.length).toBeGreaterThan(0);
  });

  it("모르면 말하지 않는다 — 잔량이 없는 응답을 0으로 단정하지 않는다", () => {
    expect(recoveryCodesNotice(undefined)).toBeNull();
    expect(recoveryCodesNotice(Number.NaN)).toBeNull();
    expect(recoveryCodesNotice(-1)).toBeNull();
  });

  /** 값·해시는 이 모듈에 아예 들어오지 않는다(서버도 개수만 보낸다). */
  it("개수 말고 다른 입력을 받지 않는다", () => {
    expect(recoveryCodesNotice.length).toBe(1);
  });
});
