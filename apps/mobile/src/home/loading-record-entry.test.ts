import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

/**
 * 라운드 105 트랙 HOME(라운드 104 정찰 A F2) — **홈이 로딩인 동안에도 기록 입구가 남는다.**
 *
 * 무엇이 문제였나: 홈은 조회 상태마다 화면 전체를 갈아 끼우는데(early return), 세 갈래 중
 * **로딩 갈래에만** 지출 기록 입구가 하나도 없었다. 실패 갈래는 "기록은 지금도 남길 수 있어요"
 * 한 줄과 입구를 함께 남기고, 준비된 세션 렌더는 FAB를 떠 있게 두는데, 그 사이의 로딩 화면만
 * 스켈레톤 5개였다. 이 앱에서 지출 기록은 SQLite 우선 저장이라 조회를 기다리는 동안에도 실제로
 * 남길 수 있고, 로딩은 짧지 않을 수 있다(["home"] 조회의 retry 기본 3회 × 요청당 10초 상한 +
 * 백오프). 콜드 스타트마다 · 아이 전환마다 지나는 자리다.
 *
 * 이 파일이 잠그는 것은 "입구가 있다"가 아니라 **세 갈래가 같은 한 줄을 쓴다**는 사실이다 --
 * 슬롯·게이트·목적지가 갈리면 로딩이 끝나는 순간 버튼이 자리를 옮기거나, 잠금 판정이 한 갈래만
 * 비껴간다.
 */
const RECORD_ENTRY_LINE =
  'floatingAction={<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />}';

/** 로딩 갈래 슬라이스 — 두 끝의 실재를 먼저 묻는다(라운드 78). */
function loadingBranch(): string {
  const start = homeSource.indexOf('if (hasSession && homePhase === "loading") {');
  const end = homeSource.indexOf("if (authToken && !childId) {", start);
  expect(start, "로딩 갈래 표식을 찾지 못했어요").toBeGreaterThan(-1);
  expect(end, "로딩 갈래 다음 표식(아이 대기 갈래)을 찾지 못했어요").toBeGreaterThan(start);
  return homeSource.slice(start, end);
}

describe("라운드 105 트랙 HOME(정찰 A F2) 홈 로딩 갈래의 기록 입구", () => {
  it("로딩 스켈레톤 화면에도 지출 기록 입구가 선다", () => {
    expect(loadingBranch()).toContain(RECORD_ENTRY_LINE);
  });

  it("그 한 줄은 세션 홈 렌더의 것과 글자 하나까지 같다(슬롯 · 게이트 · 목적지)", () => {
    const sessionStart = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)");
    expect(sessionStart, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    const sessionRender = homeSource.slice(sessionStart);
    expect(sessionRender, "세션 렌더의 FAB 한 줄").toContain(RECORD_ENTRY_LINE);
    // 두 갈래가 같은 문자열을 쓴다 = 파일 전체에 이 줄이 정확히 둘이다(로딩 · 세션).
    expect(homeSource.split(RECORD_ENTRY_LINE).length - 1, "같은 한 줄이 서는 갈래 수").toBe(2);
  });

  it("입구는 잠금 판정을 우회하지 않는다(보기 전용 참여자는 눌렀을 때 안내받는다)", () => {
    const loading = loadingBranch();
    expect(loading).toContain("expenseGate.guard(");
    // 잠겼다고 화면에서 지우지 않는다 -- 약속 문장 없이 서 있는 입구의 관례(다른 진입점과 같다).
    expect(loading).not.toContain("expenseGate.locked ? null :");
  });

  it("D6 스켈레톤 계약은 그대로다 -- 더한 것은 떠 있는 입구뿐이다", () => {
    const loading = loadingBranch();
    expect(loading.match(/<SkeletonCard \/>/g) ?? []).toHaveLength(2);
    expect(loading.match(/<SkeletonRow \/>/g) ?? []).toHaveLength(3);
    expect(loading).not.toContain("잠시만요");
    // (머리말은 "가짜 버튼이 달린 EmptyStateCard 대신"이라고 적혀 있으므로 여는 태그로 묻는다.)
    expect(loading).not.toContain("<EmptyStateCard");
  });

  it("로딩 화면은 실패 갈래의 보조문을 옮겨 오지 않는다(없는 실패를 암시하지 않는다)", () => {
    // "기록은 지금도 남길 수 있어요"는 무언가 잘못됐다는 사실이 앞에 설 때 참인 문장이다.
    // 새 한국어 0글자로 고친다는 것이 이 자리의 값이기도 하다.
    expect(loadingBranch()).not.toContain("OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE");
    expect(loadingBranch()).not.toContain("OFFLINE_RECORDING_ENTRY_LABEL");
  });

  it("실패 갈래의 입구(라운드 39 UX-P)는 종전 그대로 남는다", () => {
    const start = homeSource.indexOf('if (hasSession && homePhase === "error") {');
    const end = homeSource.indexOf('if (hasSession && homePhase === "loading") {', start);
    expect(start, "실패 갈래 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(end, "로딩 갈래 표식을 찾지 못했어요").toBeGreaterThan(start);
    const errorBranch = homeSource.slice(start, end);
    expect(errorBranch).toContain("{OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE}");
    expect(errorBranch).toContain(
      '<TextButton label={OFFLINE_RECORDING_ENTRY_LABEL} onPress={() => router.push("/expenses/new")} />'
    );
    // 보기 전용 참여자에게는 그 한 쌍이 통째로 접힌다(지킬 수 없는 약속 문장을 남기지 않는다).
    expect(errorBranch).toContain("{expenseGate.locked ? null : (");
  });

  it("HOME-001 픽셀락 무접촉 -- 캡처는 비세션 렌더이고 이 갈래는 hasSession 뒤에 있다", () => {
    // ① 캡처 라우트는 세션을 지운 뒤 홈으로 간다(app/pixel-lock.tsx) -- 근거를 소스로 든다.
    const pixelLockSource = readFileSync(join(process.cwd(), "app/pixel-lock.tsx"), "utf8");
    expect(pixelLockSource).toContain('"HOME-001": "/(tabs)"');
    expect(pixelLockSource).toContain("clearSession();");
    expect(pixelLockSource).toContain("clearSelectedChildId();");
    // ② 그래서 캡처는 authToken === null 갈래로 떨어지고, 이 갈래의 조건은 hasSession이다.
    expect(homeSource).toContain("const hasSession = Boolean(authToken && childId);");
    expect(homeSource).toContain('if (hasSession && homePhase === "loading") {');
    // ③ 캡처가 지나는 비세션 프리뷰 렌더에는 floatingAction 슬롯이 없다(FAB는 종전처럼
    //    콘텐츠 끝에 그려진다) -- 슬라이스 두 끝 가드와 함께.
    const previewStart = homeSource.indexOf("// 비세션 프리뷰 렌더(HOME-001 캡처 경로) — **무변경**.");
    const previewEnd = homeSource.indexOf("// 세션 홈 렌더(DSN-053 P2-A)", previewStart);
    expect(previewStart, "비세션 프리뷰 렌더 표식을 찾지 못했어요").toBeGreaterThan(-1);
    expect(previewEnd, "세션 홈 렌더 표식을 찾지 못했어요").toBeGreaterThan(previewStart);
    const preview = homeSource.slice(previewStart, previewEnd);
    expect(preview).not.toContain("floatingAction");
    expect(preview).toContain('<FloatingActionButton onPress={expenseGate.guard(() => router.push("/expenses/new"))} />');
  });
});
