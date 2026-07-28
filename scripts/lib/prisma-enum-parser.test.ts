import { describe, expect, it } from "vitest";
import { parsePrismaEnum } from "./prisma-enum-parser";

describe("Prisma enum parser", () => {
  it("returns only enum values in declaration order", () => {
    expect(parsePrismaEnum(`enum ChildSex {
      male
      female // comment
      unknown
      @@map("child_sex")
    }`, "ChildSex")).toEqual(["male", "female", "unknown"]);
  });

  it("fails closed when the enum is absent", () => {
    expect(parsePrismaEnum("model Child { id String }", "ChildSex")).toEqual([]);
  });
});
