import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  importUploadFileStatusText,
  importUploadPhase,
  IMPORT_UPLOAD_GUIDE_TEXT,
  IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE,
  IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE
} from "./upload-copy";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const screen = () => source("app/import/index.tsx");

describe("UX-S 가져오기 첫 화면 문구", () => {
  it("안내는 무엇을 고르면 무엇이 나오는지와 상한을 말한다 (해요체)", () => {
    expect(IMPORT_UPLOAD_GUIDE_TEXT).toBe("csv·xlsx 파일을 고르면 분석 결과를 보여드려요 · 10MB 이하");
  });

  it("파일 카드 상태는 아직 사실이 아닌 완료를 말하지 않는다", () => {
    expect(importUploadFileStatusText("picked")).toBe("파일을 골랐어요");
    expect(importUploadFileStatusText("uploading")).toBe("업로드하고 분석하는 중이에요");
    expect(importUploadFileStatusText("failed")).toBe("업로드하지 못했어요");
    for (const phase of ["picked", "uploading", "failed"] as const) {
      expect(importUploadFileStatusText(phase)).not.toBe("업로드 완료");
    }
  });

  it("진행 중이 실패보다 우선한다 (다시 올리는 중에 실패 문구가 남지 않는다)", () => {
    expect(importUploadPhase({ isUploading: true, hasError: true })).toBe("uploading");
    expect(importUploadPhase({ isUploading: false, hasError: true })).toBe("failed");
    expect(importUploadPhase({ isUploading: false, hasError: false })).toBe("picked");
  });

  it("비로그인 CTA 안내는 지금 보이는 숫자가 예시임을 밝힌다", () => {
    expect(IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE).toBe("로그인하면 내 파일을 가져올 수 있어요");
    expect(IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE).toContain("예시");
  });
});

describe("UX-S 가져오기 첫 화면 배선 (app/import/index.tsx)", () => {
  it("로그인 상태에서는 가짜 미리보기 카드와 가짜 파일 카드를 그리지 않는다", () => {
    const src = screen();
    // 목업은 비로그인(=IMP-003 픽셀락 캡처) 경로 전용이다.
    expect(src).toContain("const showPreviewMockup = !canUpload;");
    expect(src).toContain("{showPreviewMockup ? (");
    expect(src).toContain("const showFileCard = showPreviewMockup || Boolean(selectedFileName);");
    expect(src).toContain("{showFileCard ? (");
    // 가짜 파일명·완료 배지는 목업 분기 안에서만 나온다.
    expect(src).toContain('{showPreviewMockup ? "5월 지출내역.xlsx" : selectedFileName}');
    expect(src).toContain('{showPreviewMockup ? "업로드 완료" : importUploadFileStatusText(uploadPhase)}');
  });

  it("파일을 고르기 전에는 안내와 파일 선택 CTA만 남는다", () => {
    const src = screen();
    expect(src).toContain("{!showPreviewMockup && !selectedFileName ? (");
    expect(src).toContain("{IMPORT_UPLOAD_GUIDE_TEXT}");
    expect(src).toContain('canUpload ? "엑셀 파일 선택하기"');
  });

  it("IMP-003 픽셀락 렌더 불변: 목업 문자열과 프레임 스타일이 그대로다", () => {
    const src = screen();
    for (const pinned of [
      "AI 분류 미리보기",
      "총 128건",
      "₩1,245,700",
      "5월 지출내역.xlsx",
      "업로드 완료",
      "적용하고 리포트 보기",
      "검수 후 승인하기 전까지는 지출로 저장되지 않아요.",
      "excelPreviewRows",
      "ImportPreviewCategoryRow",
      "excelUploadedFileCardStyle",
      "excelPreviewPixelFrameStyle"
    ]) {
      expect(src, pinned).toContain(pinned);
    }
  });

  it("비로그인 CTA는 더 이상 무반응이 아니다 -- 렌더 대신 Alert으로 말한다", () => {
    const src = screen();
    expect(src).toContain("Alert.alert(IMPORT_UPLOAD_SIGN_IN_ALERT_TITLE, IMPORT_UPLOAD_SIGN_IN_ALERT_MESSAGE)");
    expect(src).toContain('from "react-native"');
    // 예전의 "가드 안에서 아무것도 하지 않는" 형태로 되돌아가면 안 된다.
    expect(src).not.toMatch(/const applyPreview = \(\) => \{\s*if \(canUpload\) \{\s*pickAndUpload\(\);\s*\}\s*\};/);
  });
});
