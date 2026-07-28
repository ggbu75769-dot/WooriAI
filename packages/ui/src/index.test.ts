import { describe, expect, it } from "vitest";
import { uiPackageName } from "./index";

describe("@wooriai/ui public API", () => {
  it("exports its canonical package identity", () => {
    expect(uiPackageName).toBe("@wooriai/ui");
  });
});
