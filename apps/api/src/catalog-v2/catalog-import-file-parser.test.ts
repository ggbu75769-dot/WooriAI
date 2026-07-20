import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseCatalogImportFile } from "./catalog-import-file-parser";

describe("catalog CSV/XLSX import file parser", () => {
  it("normalizes a quoted CSV into the existing draft preview schema", async () => {
    const result = await parseCatalogImportFile(Buffer.from('code,nameKo,shortDescription\nR4-TEST-001,"쉼표, 품목",검수 전 설명\n', "utf8"), "catalog.csv");
    expect(result.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.rows).toEqual([{ code: "R4-TEST-001", nameKo: "쉼표, 품목", shortDescription: "검수 전 설명" }]);
  });

  it("reads one bounded XLSX worksheet and rejects formulas", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("catalog");
    sheet.addRow(["code", "nameKo", "sourceSummary"]);
    sheet.addRow(["R4-TEST-002", "엑셀 품목", "외부 검수 전 출처 요약"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseCatalogImportFile(buffer, "catalog.xlsx")).resolves.toMatchObject({ rows: [{ code: "R4-TEST-002", nameKo: "엑셀 품목", sourceSummary: "외부 검수 전 출처 요약" }] });

    sheet.getCell("C2").value = { formula: 'HYPERLINK("https://example.com")', result: "링크" };
    const formulaBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parseCatalogImportFile(formulaBuffer, "catalog.xlsx")).rejects.toMatchObject({ response: expect.objectContaining({ code: "CATALOG_IMPORT_FORMULA_FORBIDDEN" }) });
  });

  it("fails closed on formula-like CSV values and row overflow", async () => {
    await expect(parseCatalogImportFile(Buffer.from("code,nameKo\nR4-TEST-003,=cmd\n"), "catalog.csv"))
      .rejects.toBeInstanceOf(BadRequestException);
    const rows = ["code,nameKo", ...Array.from({ length: 1001 }, (_, index) => `R4-TEST-${index},품목 ${index}`)].join("\n");
    await expect(parseCatalogImportFile(Buffer.from(rows), "catalog.csv"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "CATALOG_IMPORT_TOO_MANY_ROWS" }) });
  });
});
