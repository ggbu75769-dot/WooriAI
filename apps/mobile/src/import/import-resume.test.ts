import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  importResumeCardAccessibilityLabel,
  importResumeCardSubtitle,
  isMissingImportJobError,
  resolveImportResumeCard,
  sanitizeImportResumeBlob,
  sanitizeImportResumeEntry,
  shouldForgetImportResume,
  IMPORT_RESUME_CARD_TITLE,
  type ImportResumeEntry
} from "./import-resume";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const entry: ImportResumeEntry = {
  childId: "child-1",
  jobId: "job-1",
  fileName: "5월 카드내역.xlsx",
  createdAt: new Date(NOW - 3 * 60 * 60 * 1000).toISOString()
};

/**
 * 라운드 56 트랙 D(#5) — 업로드 뒤 검토 화면을 떠나면 그 잡은 미아가 됐다(jobId를 아무도 들고
 * 있지 않고, 서버에는 목록 엔드포인트가 없다). 이 테스트가 고정하는 것은 카드의 **생멸 규칙**이다.
 */
describe("라운드 56 D#5 가져오기 재진입 저장본", () => {
  it("네 필드가 모두 성한 값만 살린다 (옛·손상 blob이 카드로 둔갑하지 않는다)", () => {
    expect(sanitizeImportResumeEntry(entry)).toEqual(entry);
    // 공백은 다듬어서 살린다.
    expect(sanitizeImportResumeEntry({ ...entry, jobId: "  job-1  " })?.jobId).toBe("job-1");

    for (const broken of [
      null,
      undefined,
      "job-1",
      { ...entry, childId: "" },
      { ...entry, childId: undefined },
      { ...entry, jobId: "   " },
      { ...entry, jobId: "j".repeat(65) },
      { ...entry, fileName: "" },
      { ...entry, fileName: "f".repeat(201) },
      { ...entry, createdAt: "어제" },
      { ...entry, createdAt: 1_700_000_000_000 }
    ]) {
      expect(sanitizeImportResumeEntry(broken), JSON.stringify(broken)).toBeNull();
    }
  });

  it("persist blob도 같은 규칙을 지난다", () => {
    expect(sanitizeImportResumeBlob({ entry })).toEqual(entry);
    expect(sanitizeImportResumeBlob({ entry: { ...entry, jobId: "" } })).toBeNull();
    expect(sanitizeImportResumeBlob({})).toBeNull();
    expect(sanitizeImportResumeBlob(null)).toBeNull();
  });

  it("카드 문구는 파일명과 언제만 말한다 (행 수·진행률을 지어내지 않는다)", () => {
    expect(IMPORT_RESUME_CARD_TITLE).toBe("검토하던 가져오기 이어서 보기");
    expect(importResumeCardSubtitle(entry, NOW)).toBe("5월 카드내역.xlsx · 3시간 전");
    expect(importResumeCardAccessibilityLabel(entry, NOW)).toBe(
      "검토하던 가져오기 이어서 보기. 5월 카드내역.xlsx · 3시간 전"
    );
    // 알림함과 같은 표기 모듈을 쓴다 -- "3시간 전"이 자리마다 다르게 들리지 않는다.
    expect(source("src/import/import-resume.ts")).toContain(
      'import { formatRelativeTime } from "../notifications/relative-time";'
    );
  });

  it("시각을 읽을 수 없으면 파일명만 남는다 (없는 시각을 지어내지 않는다)", () => {
    // sanitize를 통과하지 못하는 값이라 저장소에는 들어올 수 없지만, 문구 함수 자체도 방어한다.
    expect(importResumeCardSubtitle({ ...entry, createdAt: "어제" }, NOW)).toBe("5월 카드내역.xlsx");
  });

  it("childId 스코프: 다른 아이의 카드는 보이지 않는다 (지워지지도 않는다)", () => {
    expect(resolveImportResumeCard({ entry, childId: "child-1", canResume: true })).toEqual(entry);
    expect(resolveImportResumeCard({ entry, childId: "child-2", canResume: true })).toBeNull();
    expect(resolveImportResumeCard({ entry, childId: null, canResume: true })).toBeNull();
    expect(resolveImportResumeCard({ entry: null, childId: "child-1", canResume: true })).toBeNull();
  });

  it("비로그인(IMP-003 픽셀락 경로)에는 카드가 존재할 수 없다", () => {
    expect(resolveImportResumeCard({ entry, childId: "child-1", canResume: false })).toBeNull();
  });

  it("404만 '사라진 잡'이다 — 네트워크 실패·5xx는 저장본을 지우지 않는다", () => {
    expect(isMissingImportJobError({ status: 404 })).toBe(true);
    for (const other of [null, undefined, new Error("Network request failed"), { status: 500 }, { status: 403 }, { status: "404" }]) {
      expect(isMissingImportJobError(other), JSON.stringify(other)).toBe(false);
    }
  });

  it("끝난 잡(확정·취소·실패)과 사라진 잡에서만 저장본을 지운다", () => {
    for (const status of ["confirmed", "cancelled", "failed"]) {
      expect(shouldForgetImportResume({ status, error: null }), status).toBe(true);
    }
    for (const status of ["uploaded", "analyzing", "preview_ready", undefined]) {
      expect(shouldForgetImportResume({ status, error: null }), String(status)).toBe(false);
    }
    // 404는 상태를 못 받은 채로도 판정된다(잡 자체가 없으니 status가 올 리 없다).
    expect(shouldForgetImportResume({ status: undefined, error: { status: 404 } })).toBe(true);
    // 잠깐 끊긴 것을 "없어졌다"로 단정하지 않는다.
    expect(shouldForgetImportResume({ status: "preview_ready", error: new Error("offline") })).toBe(false);
  });
});

describe("라운드 56 D#5 가져오기 화면 배선", () => {
  const uploadScreen = () => source("app/import/index.tsx");
  const reviewScreen = () => source("app/import/[importJobId].tsx");

  it("업로드가 **성공한 뒤** 이번 업로드의 파일명으로 기록한다", () => {
    const src = uploadScreen();
    expect(src).toContain("onSuccess: (job, asset) => {");
    expect(src).toContain("rememberImportReview({");
    expect(src).toContain("childId: job.childId,");
    expect(src).toContain("jobId: job.id,");
    expect(src).toContain("fileName: asset.name,");
    // 기록이 검수 화면으로 미는 것보다 먼저다(밀고 나면 이 화면은 언마운트될 수 있다).
    expect(src.indexOf("rememberImportReview({")).toBeLessThan(src.indexOf("router.push(`/import/${job.id}`)"));
  });

  it("카드는 순수 판정으로만 그려지고, 누르면 그 잡으로 간다", () => {
    const src = uploadScreen();
    expect(src).toContain(
      "const resumeCard = resolveImportResumeCard({ entry: resumeEntry, childId, canResume: canUpload });"
    );
    expect(src).toContain("{resumeCard ? (");
    expect(src).toContain("onPress={() => router.push(`/import/${resumeCard.jobId}`)}");
    expect(src).toContain("accessibilityLabel={importResumeCardAccessibilityLabel(resumeCard, now)}");
    expect(src).toContain("{importResumeCardSubtitle(resumeCard, now)}");
    // 화면이 문구를 다시 적지 않는다 -- 제목은 상수로만 들어온다(JSX에 리터럴 없음).
    expect(src).toContain("{IMPORT_RESUME_CARD_TITLE}");
    expect(src).not.toContain(">검토하던 가져오기 이어서 보기<");
  });

  it("IMP-003 픽셀락 렌더 불변: 비로그인 목업 계약이 그대로다", () => {
    const src = uploadScreen();
    // 카드 게이트가 canUpload를 지나므로 비로그인 렌더에는 새 요소가 생기지 않는다.
    expect(src).toContain("canResume: canUpload");
    for (const pinned of [
      "const showPreviewMockup = !canUpload;",
      "AI 분류 미리보기",
      "총 128건",
      "₩1,245,700",
      "5월 지출내역.xlsx",
      "업로드 완료",
      "적용하고 리포트 보기",
      "검수 후 승인하기 전까지는 지출로 저장되지 않아요.",
      "excelPreviewPixelFrameStyle"
    ]) {
      expect(src, pinned).toContain(pinned);
    }
  });

  it("카드도 최소 터치 타깃을 지키고 새 색을 만들지 않는다", () => {
    const src = uploadScreen();
    const cardStyle = src.slice(src.indexOf("  resumeCard: {"), src.indexOf("  guideCard: {"));
    expect(cardStyle).toContain("minHeight: theme.touchTarget");
    expect(cardStyle).toContain("backgroundColor: theme.colors.white");
    expect(cardStyle).toContain("...theme.shadows.card");
    expect(cardStyle).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it("검수 화면은 순수 판정 하나로 저장본을 지우고, 자기 잡만 지운다", () => {
    const src = reviewScreen();
    expect(src).toContain('import { shouldForgetImportResume } from "../../src/import/import-resume";');
    expect(src).toContain("if (shouldForgetImportResume({ status, error: job.error })) forgetImportReview(importJobId);");
    // 상태 목록을 화면이 다시 나열하면 그 목록이 두 번째 계약이 된다.
    expect(src).not.toContain('status === "cancelled" ||');
  });
});
