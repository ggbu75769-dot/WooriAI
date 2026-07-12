import { describe, expect, it } from "vitest";
import { maxImportFileSizeBytes, validateImportFile } from "./import-file-validation";

describe("validateImportFile", () => {
  it("accepts a csv file within the size limit", () => {
    expect(validateImportFile("5월 지출내역.csv", 1024)).toEqual({ ok: true });
  });

  it("accepts an xlsx file within the size limit", () => {
    expect(validateImportFile("5월 지출내역.xlsx", maxImportFileSizeBytes)).toEqual({ ok: true });
  });

  it("accepts uppercase extensions", () => {
    expect(validateImportFile("EXPENSES.XLSX", 100)).toEqual({ ok: true });
  });

  it("rejects unsupported extensions", () => {
    expect(validateImportFile("photo.png", 100)).toEqual({
      ok: false,
      message: "csv 또는 xlsx 파일만 올릴 수 있어요"
    });
  });

  it("rejects files with no extension", () => {
    expect(validateImportFile("expenses", 100)).toEqual({
      ok: false,
      message: "csv 또는 xlsx 파일만 올릴 수 있어요"
    });
  });

  it("rejects files larger than 10MB", () => {
    expect(validateImportFile("expenses.csv", maxImportFileSizeBytes + 1)).toEqual({
      ok: false,
      message: "10MB 이하 파일만 올릴 수 있어요"
    });
  });

  it("does not fail the size check when size is unknown", () => {
    expect(validateImportFile("expenses.csv", undefined)).toEqual({ ok: true });
    expect(validateImportFile("expenses.csv", null)).toEqual({ ok: true });
  });
});
