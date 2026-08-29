import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  importResumeCardAccessibilityLabel,
  importResumeCardSubtitle,
  importUndoActionAccessibilityLabel,
  importUndoCardAccessibilityLabel,
  importUndoCardSubtitle,
  importUndoConfirmMessage,
  importUndoResultMessage,
  isConfirmedImportEntry,
  isMissingImportJobError,
  resolveImportResumeCard,
  sanitizeImportResumeBlob,
  sanitizeImportResumeEntry,
  shouldForgetImportResume,
  shouldMarkImportResumeConfirmed,
  IMPORT_RESUME_CARD_TITLE,
  IMPORT_UNDO_CARD_TITLE,
  IMPORT_UNDO_CONFIRM_TITLE,
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
    expect(sanitizeImportResumeBlob({ entry })).toEqual({ entry, confirmed: null });
    expect(sanitizeImportResumeBlob({ entry: { ...entry, jobId: "" } })).toEqual({ entry: null, confirmed: null });
    expect(sanitizeImportResumeBlob({})).toEqual({ entry: null, confirmed: null });
    expect(sanitizeImportResumeBlob(null)).toEqual({ entry: null, confirmed: null });
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

  it("끝난 잡(취소·실패)과 사라진 잡에서만 저장본을 지운다", () => {
    for (const status of ["cancelled", "failed"]) {
      expect(shouldForgetImportResume({ status, error: null }), status).toBe(true);
    }
    // 라운드 67 #3: **확정된 잡은 더는 지우지 않는다** — 결과 카드(되돌리기 입구)로 남는다.
    for (const status of ["confirmed", "uploaded", "analyzing", "preview_ready", undefined]) {
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
    // 라운드 67 적대 리뷰 #1: 칸이 나뉜 뒤로 두 카드는 서로의 조건이 아니다(함께 설 수 있다).
    expect(src).toContain("{resumeCard ? (");
    expect(src).not.toContain("{resumeCard && !undoCard ? (");
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
    const cardStyle = src.slice(src.indexOf("  resumeCard: {"), src.indexOf("  undoButton: {"));
    expect(cardStyle).toContain("minHeight: theme.touchTarget");
    expect(cardStyle).toContain("backgroundColor: theme.colors.white");
    expect(cardStyle).toContain("...theme.shadows.card");
    expect(cardStyle).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it("검수 화면은 순수 판정 하나로 저장본을 지우고, 자기 잡만 지운다", () => {
    const src = reviewScreen();
    expect(src).toContain(
      'import { shouldForgetImportResume, shouldMarkImportResumeConfirmed } from "../../src/import/import-resume";'
    );
    expect(src).toContain("if (shouldForgetImportResume({ status, error: job.error })) {");
    expect(src).toContain("forgetImportReview(importJobId);");
    // 상태 목록을 화면이 다시 나열하면 그 목록이 두 번째 계약이 된다.
    expect(src).not.toContain('status === "cancelled" ||');
  });
});

/**
 * 라운드 67 #3 — **확정한 가져오기 되돌리기.**
 *
 * 라운드 66이 서버에 출처(`expenses.import_job_id`)를 남기기 시작했지만 앱에는 그 200건을
 * 되돌릴 길이 없었다: 확정하는 순간 저장본이 지워졌고, 서버에는 "내 가져오기 목록"이 없어
 * 그 잡으로 돌아갈 주소를 아무도 몰랐다. 여기서 고정하는 것은 **확정된 저장본이 남는다**는
 * 사실과, 그 카드가 말하는 문장들이다.
 */
describe("라운드 67 #3 확정 가져오기 되돌리기", () => {
  const confirmed: ImportResumeEntry = { ...entry, importedCount: 200 };

  it("건수가 적힌 저장본만 '확정된 잡'이다", () => {
    expect(isConfirmedImportEntry(confirmed)).toBe(true);
    expect(isConfirmedImportEntry(entry)).toBe(false);
    // 0건 확정도 확정이다(모두 건너뛴 파일 — 되돌릴 것이 없다는 사실을 카드가 말해야 한다).
    expect(isConfirmedImportEntry({ ...entry, importedCount: 0 })).toBe(true);
  });

  it("건수만 어긋난 저장본은 버리지 않고 건수만 잃는다 (카드가 갈 곳은 살아 있다)", () => {
    expect(sanitizeImportResumeEntry(confirmed)).toEqual(confirmed);
    for (const broken of [-1, 1.5, Number.NaN, "200", null]) {
      const sanitized = sanitizeImportResumeEntry({ ...entry, importedCount: broken });
      expect(sanitized, String(broken)).toEqual(entry);
      expect(isConfirmedImportEntry(sanitized!), String(broken)).toBe(false);
    }
  });

  it("확정된 잡은 지우는 대신 결과로 바꾼다", () => {
    expect(shouldMarkImportResumeConfirmed({ status: "confirmed" })).toBe(true);
    expect(shouldForgetImportResume({ status: "confirmed", error: null })).toBe(false);
    for (const status of ["preview_ready", "cancelled", "failed", undefined]) {
      expect(shouldMarkImportResumeConfirmed({ status }), String(status)).toBe(false);
    }
  });

  it("결과 카드는 파일명·건수·언제를 말한다", () => {
    expect(IMPORT_UNDO_CARD_TITLE).toBe("방금 가져온 결과");
    expect(importUndoCardSubtitle(confirmed, NOW)).toBe("5월 카드내역.xlsx · 200건 · 3시간 전");
    expect(importUndoCardAccessibilityLabel(confirmed, NOW)).toBe(
      "방금 가져온 결과. 5월 카드내역.xlsx · 200건 · 3시간 전"
    );
    // 시각을 읽을 수 없어도 건수는 남는다(없는 시각만 지어내지 않는다).
    expect(importUndoCardSubtitle({ ...confirmed, createdAt: "어제" }, NOW)).toBe("5월 카드내역.xlsx · 200건");
    // 버튼은 무엇을 되돌리는지까지 읽어 준다.
    expect(importUndoActionAccessibilityLabel(confirmed)).toBe("5월 카드내역.xlsx 되돌리기");
  });

  /**
   * 라운드 67 적대 리뷰(#1): 확정 칸의 저장본이 건수를 잃어도 **카드는 선다**(그 칸에 있다는
   * 사실이 곧 확정이다 — 되돌리기 입구가 손상 blob 하나로 사라지면 안 된다). 그때는 0건이라고
   * 지어내는 대신 건수를 통째로 뺀다.
   */
  it("건수를 모르는 확정 저장본도 카드가 서고, 없는 숫자를 지어내지 않는다", () => {
    expect(importUndoCardSubtitle(entry, NOW)).toBe("5월 카드내역.xlsx · 3시간 전");
    expect(importUndoCardSubtitle(entry, NOW)).not.toContain("0건");
    expect(importUndoCardAccessibilityLabel(entry, NOW)).toBe("방금 가져온 결과. 5월 카드내역.xlsx · 3시간 전");
    // 0건 확정은 여전히 0건이라고 말한다(모두 건너뛴 파일 — 그것은 사실이다).
    expect(importUndoCardSubtitle({ ...entry, importedCount: 0 }, NOW)).toBe("5월 카드내역.xlsx · 0건 · 3시간 전");
  });

  /**
   * 확인 문구가 지는 세 가지: **무엇이** 사라지는지(그 파일에서 온 기록 전부) ·
   * **확정 뒤 고친 기록도 함께 사라진다**(되돌리기의 정의가 "그 파일에서 온 행 전부"라 피할 수
   * 없는 사실이다) · 되돌릴 수 없다. 해요체(DNC-018).
   *
   * 라운드 67 적대 리뷰(#2): 종전에는 "가져온 200건이 모두 사라져요"라고 **크기를 주장**했다.
   * 그 200은 확정 시점의 수라, 그 사이 손으로 몇 건을 지운 사람에게는 실제보다 큰 수다.
   * 이제 문장은 범위를 주장하고 건수는 "가져올 때" 참고 표기로만 붙는다.
   */
  it("확인 문구가 크기가 아니라 범위를 주장한다 (건수는 참고 표기)", () => {
    const message = importUndoConfirmMessage(200);
    expect(message).toBe(
      "이 파일에서 가져온 기록이 모두 사라져요(가져올 때 200건). 가져온 뒤에 고친 기록도 함께 사라지고, 되돌릴 수 없어요."
    );
    // "200건이 사라져요"라는 크기 주장은 더는 없다.
    expect(message).not.toContain("200건이");
    expect(message).toContain("고친 기록도 함께 사라지고");
    expect(message).toContain("되돌릴 수 없어요");
    expect(IMPORT_UNDO_CONFIRM_TITLE).toBe("가져온 기록을 되돌릴까요?");
    expect(importUndoConfirmMessage(1)).toContain("가져올 때 1건");
    // 건수를 모르면 그 괄호가 통째로 빠진다(0건이라고 지어내지 않는다).
    expect(importUndoConfirmMessage()).toBe(
      "이 파일에서 가져온 기록이 모두 사라져요. 가져온 뒤에 고친 기록도 함께 사라지고, 되돌릴 수 없어요."
    );
  });

  it("결과 문구는 서버가 실제로 지운 건수를 말한다", () => {
    expect(importUndoResultMessage(200)).toBe("200건을 되돌렸어요.");
    // 그 사이 손으로 다 지웠다면 0건이다 — 카드의 숫자를 되풀이하지 않는다.
    expect(importUndoResultMessage(0)).toBe("되돌릴 기록이 이미 없었어요.");
  });
});

/**
 * 라운드 67 적대 리뷰(#1) — **새 업로드가 되돌리기 입구를 지웠다.**
 *
 * 저장본이 한 칸이라, 확정된 잡(= 되돌리기의 유일한 입구)이 그 칸에 앉아 있는 동안 새 업로드가
 * 무가드로 덮었다. 잘못 확정한 사람이 가장 자연스럽게 하는 행동(올바른 파일 재업로드)이 곧
 * 입구를 지우는 동작이었던 것이다. 여기서 고정하는 것은 **칸이 둘**이라는 사실과, 옛 1칸
 * 저장본이 어느 칸으로 살아 오는가다.
 */
describe("라운드 67 적대 리뷰 #1 검토 칸 / 확정 칸", () => {
  const confirmed: ImportResumeEntry = { ...entry, jobId: "job-confirmed", importedCount: 200 };

  it("두 칸을 따로 살린다", () => {
    expect(sanitizeImportResumeBlob({ entry, confirmed })).toEqual({ entry, confirmed });
    // 한쪽이 어긋나도 다른 칸은 그대로다(카드 하나가 손상 blob 하나로 함께 사라지지 않는다).
    expect(sanitizeImportResumeBlob({ entry: { ...entry, jobId: "" }, confirmed })).toEqual({
      entry: null,
      confirmed
    });
    expect(sanitizeImportResumeBlob({ entry, confirmed: { ...confirmed, createdAt: "어제" } })).toEqual({
      entry,
      confirmed: null
    });
  });

  it("옛 1칸 저장본의 확정 건은 **확정 칸**으로 살아 온다 (업데이트가 입구를 지우지 않는다)", () => {
    const legacyConfirmed = { ...entry, importedCount: 200 };
    expect(sanitizeImportResumeBlob({ entry: legacyConfirmed })).toEqual({
      entry: null,
      confirmed: legacyConfirmed
    });
    // 건수가 없는 옛 저장본은 종전 그대로 검토 칸이다.
    expect(sanitizeImportResumeBlob({ entry })).toEqual({ entry, confirmed: null });
  });

  it("같은 잡이 두 칸에 있으면 확정 칸이 이긴다 (한 잡의 카드가 둘 서지 않는다)", () => {
    expect(sanitizeImportResumeBlob({ entry, confirmed: { ...entry, importedCount: 12 } })).toEqual({
      entry: null,
      confirmed: { ...entry, importedCount: 12 }
    });
  });

  it("옛 확정 건과 새 확정이 겹치면 확정 칸은 최신 것이고, 옛 건은 건수만 잃는다", () => {
    const legacyConfirmed = { ...entry, importedCount: 200 };
    expect(sanitizeImportResumeBlob({ entry: legacyConfirmed, confirmed })).toEqual({
      entry,
      confirmed
    });
  });

  it("두 카드가 같은 아이 스코프·로그인 판정을 지난다", () => {
    // 확정 칸도 같은 함수를 지난다 — 게이트가 카드마다 갈리면 그 자체가 결함이다.
    expect(resolveImportResumeCard({ entry: confirmed, childId: "child-1", canResume: true })).toEqual(confirmed);
    expect(resolveImportResumeCard({ entry: confirmed, childId: "child-2", canResume: true })).toBeNull();
    expect(resolveImportResumeCard({ entry: confirmed, childId: "child-1", canResume: false })).toBeNull();
  });
});

describe("라운드 67 #3 되돌리기 배선", () => {
  const uploadScreen = () => source("app/import/index.tsx");
  const reviewScreen = () => source("app/import/[importJobId].tsx");
  const client = () => source("src/api/client.ts");

  it("검수 화면이 **읽은 상태**로 확정을 적는다 (뮤테이션 성공이 아니라)", () => {
    const src = reviewScreen();
    expect(src).toContain("shouldMarkImportResumeConfirmed({ status })");
    expect(src).toContain("markImportConfirmed(importJobId, confirmedImportedCount)");
    // 건수는 서버가 말한 값이다 — 화면이 행을 세지 않는다.
    expect(src).toContain("const confirmedImportedCount = job.data?.importedCount;");
  });

  it("결과 카드는 순수 판정으로만 서고, 되돌리기는 확인 Alert를 지난다", () => {
    const src = uploadScreen();
    // 라운드 67 적대 리뷰 #1: 결과 카드는 **확정 칸**에서 온다(검토 칸의 변신이 아니다).
    expect(src).toContain("const confirmedEntry = useImportResumeStore((state) => state.confirmed);");
    expect(src).toContain(
      "const undoCard = resolveImportResumeCard({ entry: confirmedEntry, childId, canResume: canUpload });"
    );
    expect(src).toContain("{undoCard ? (");
    // 라운드 67 적대 리뷰 #2: 건수는 참고값으로만 넘어간다(`?? 0`으로 0건을 지어내지 않는다).
    expect(src).toContain("Alert.alert(IMPORT_UNDO_CONFIRM_TITLE, importUndoConfirmMessage(entry.importedCount)");
    expect(src).not.toContain("importUndoConfirmMessage(entry.importedCount ?? 0)");
    expect(src).toContain("onPress: () => undo.mutate(entry.jobId)");
    // 화면이 문구를 다시 적지 않는다(제목·라벨은 상수로만 들어온다).
    expect(src).toContain("{IMPORT_UNDO_CARD_TITLE}");
    expect(src).toContain("{IMPORT_UNDO_ACTION_LABEL}");
    expect(src).not.toContain(">방금 가져온 결과<");
    expect(src).not.toContain(">되돌리기<");
    // 라운드 41 K-7과 같은 게이트: 보기 전용 세션은 확인 Alert 앞에서 막힌다(서버도 403이다).
    const confirmBlock = src.slice(src.indexOf("const confirmUndo ="), src.indexOf("const canUpload ="));
    expect(confirmBlock).toContain("if (expenseGate.locked) {");
    expect(confirmBlock).toContain("expenseGate.explain();");
    expect(confirmBlock.indexOf("expenseGate.locked")).toBeLessThan(confirmBlock.indexOf("Alert.alert("));
  });

  it("되돌린 뒤 **확정이 태우는 그 넷**을 그대로 무효화하고 카드를 지운다", () => {
    const src = uploadScreen();
    const undoBlock = src.slice(src.indexOf("const undo = useMutation({"), src.indexOf("const confirmUndo ="));
    expect(undoBlock).toContain("forgetImportReview(jobId)");
    for (const key of ["report", "home", "expenses", "budget"]) {
      expect(undoBlock, key).toContain(`queryKey: ["${key}"]`);
    }
    // 결과 문구는 서버가 준 건수에서 온다.
    expect(undoBlock).toContain("importUndoResultMessage(result.deletedCount)");
    // 되돌리기의 되돌리기는 없다 — 이 화면에 복구 입구가 생기지 않는다.
    expect(src).not.toContain("복구하기");
  });

  it("되돌리기 요청은 잡 id 하나만 보낸다 (행 목록을 앱이 만들지 않는다)", () => {
    const src = client();
    expect(src).toContain("export function undoImport(token: string, importJobId: string) {");
    expect(src).toContain('return requestJson<UndoImportResponse>(`/imports/${importJobId}/undo`, { method: "POST", token });');
  });
});
