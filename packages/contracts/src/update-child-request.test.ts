import { describe, expect, it } from "vitest";
import { updateChildRequestSchema } from "./schemas";

/**
 * CHILD-127: PATCH /children/:childId 요청 계약. `stageMode`는 임신 → 출생 전환을 위해
 * 새로 들어온 optional 필드이므로, 이 필드를 모르는 기존 클라이언트의 바디가 그대로
 * 통과해야 한다(하위 호환).
 */
describe("CHILD-127 updateChildRequestSchema", () => {
  it("accepts the pre-existing bodies unchanged (every field optional)", () => {
    expect(updateChildRequestSchema.parse({})).toEqual({});
    expect(updateChildRequestSchema.parse({ nickname: "반짝이" })).toEqual({ nickname: "반짝이" });
    expect(updateChildRequestSchema.parse({ nickname: "콩이", dueDate: "2026-08-31" })).toEqual({
      nickname: "콩이",
      dueDate: "2026-08-31"
    });
    expect(updateChildRequestSchema.parse({ birthDate: "2026-03-01" })).toEqual({ birthDate: "2026-03-01" });
    expect(updateChildRequestSchema.parse({ manualStage: "infant_4_6" })).toEqual({ manualStage: "infant_4_6" });
  });

  it("accepts the 임신 → 출생 전환 body (stageMode + birthDate together)", () => {
    expect(updateChildRequestSchema.parse({ stageMode: "born", birthDate: "2026-03-01" })).toEqual({
      stageMode: "born",
      birthDate: "2026-03-01"
    });
  });

  it("keeps stageMode to the three domain values", () => {
    for (const stageMode of ["pregnant", "born", "manual"]) {
      expect(updateChildRequestSchema.safeParse({ stageMode }).success).toBe(true);
    }
    expect(updateChildRequestSchema.safeParse({ stageMode: "hatched" }).success).toBe(false);
    expect(updateChildRequestSchema.safeParse({ stageMode: null }).success).toBe(false);
  });

  it("keeps the date fields on the YYYY-MM-DD form and rejects an empty nickname", () => {
    expect(updateChildRequestSchema.safeParse({ birthDate: "2026/03/01" }).success).toBe(false);
    expect(updateChildRequestSchema.safeParse({ dueDate: "" }).success).toBe(false);
    expect(updateChildRequestSchema.safeParse({ nickname: "" }).success).toBe(false);
  });

  it("leaves the direction rule (pregnant → born only) to the server, which alone knows the stored mode", () => {
    // 스키마는 형식만 고정한다 -- 되돌리기 시도도 형식적으로는 유효하고,
    // 서버가 CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED로 거절한다.
    expect(updateChildRequestSchema.safeParse({ stageMode: "pregnant", dueDate: "2026-08-31" }).success).toBe(true);
  });
});
