import { describe, expect, it } from "vitest";
import { accountDeletionPresentation } from "./account-deletion-presentation";

const NOW = Date.parse("2026-07-26T00:00:00.000Z");

describe("account deletion recovery presentation", () => {
  it("keeps a blocked ownership request cancellable without promising deletion progress", () => {
    expect(accountDeletionPresentation({ state: "failed", dueAt: null }, NOW)).toEqual({
      mode: "blocked",
      title: "가족 소유권 이전 필요",
      notice: "삭제는 시작되지 않았고 계정 접근도 그대로 유지돼요. 가족 소유권을 이전한 뒤 다시 시도해 주세요.",
      canCancel: true
    });
  });

  it("does not offer cancellation or a grace-period promise after an immediate retry", () => {
    expect(accountDeletionPresentation({ state: "requested", dueAt: "2026-07-26T00:00:00.000Z" }, NOW)).toEqual({
      mode: "processing",
      title: "삭제 처리 재개 중",
      notice: "소유권 확인을 마쳐 삭제 처리를 재개했어요. 곧 계정 접근이 중단될 수 있어요.",
      canCancel: false
    });
  });

  it("keeps a future initial request in its cancellable grace period", () => {
    expect(accountDeletionPresentation({ state: "requested", dueAt: "2026-08-02T00:00:00.000Z" }, NOW)).toEqual({
      mode: "grace",
      title: "삭제 유예 중",
      notice: "예정 시각 전까지 로그인과 데이터 이용이 유지돼요.",
      canCancel: true
    });
  });
});
