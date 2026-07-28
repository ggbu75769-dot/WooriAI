import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CompleteOnboardingDto } from "./dto/complete-onboarding.dto";

function payload(yearMonth: string) {
  return {
    householdId: "11111111-1111-4111-8111-111111111111",
    draftVersion: 2,
    child: {
      nickname: "봄이",
      stageMode: "born",
      birthDate: "2025-05-01",
      stageOverride: false,
      gender: "unknown"
    },
    prepared: { state: "skipped", itemDefinitionIds: [] },
    budget: { yearMonth, amountKrw: 500000 }
  };
}

describe("CompleteOnboardingDto contract parity", () => {
  it("accepts the YYYY-MM value produced by the mobile onboarding draft", async () => {
    const errors = await validate(plainToInstance(CompleteOnboardingDto, payload("2026-07")));
    expect(errors).toEqual([]);
  });

  it("rejects a date-only value where a month key is required", async () => {
    const errors = await validate(plainToInstance(CompleteOnboardingDto, payload("2026-07-01")));
    expect(errors.some((error) => error.property === "budget")).toBe(true);
  });
});
