import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 토스 이월 해소 트랙 T-C(1) — **탭 루트의 ‹(뒤로) 글리프 제거.**
 *
 * 준비템 탭은 탭 루트라 "뒤로"가 개념적으로 없는 자리다. T9가 PreparationListParity의
 * `onBack`을 옵셔널로 내려 두었는데(그 계약은 design-restore-p2b.test.ts가 지킨다), 유일
 * 호출부인 이 화면이 여전히 지어낸 목적지(`router.push("/(tabs)")`)를 넘겨 헤더에 뒤로
 * 셰브런이 섰다. 이 파일은 그 전달이 걷힌 상태를 지킨다.
 *
 * ⚠️ ITEM-001 픽셀락 캡처와 무관하다: 캡처는 세션을 지우고 찍는 비세션 렌더이고
 * (app/pixel-lock.tsx), 비세션은 `if (!hasSession)` 갈래에서 PreparationListParity에
 * 도달하기 전에 반환한다 — TopAppBar는 캡처에 서지 않는다.
 *
 * 이 저장소의 react-native 화면은 vitest에서 렌더할 수 없어 화면 계약의 확립된 관례대로
 * 소스 그렙을 쓴다(src/design-restore-p2b.test.ts 참고).
 */
describe("준비템 탭 루트: 뒤로 글리프 없음", () => {
  it("items.tsx가 PreparationListParity에 onBack을 넘기지 않는다", () => {
    const items = source("app/(tabs)/items.tsx");
    // 프롭 전달 자체가 없다 -- TopAppBar는 onBack이 없으면 뒤로 버튼 노드를 세우지 않는다
    // (가짜 버튼 금지 규율, PreparationListParity의 T9 주석).
    expect(items).not.toContain("onBack={");
  });

  it("onBack을 쓰는 폴백 빈 카드는 도달 불가다(emptyState를 언제나 넘긴다)", () => {
    const items = source("app/(tabs)/items.tsx");
    // PreparationListParity의 `emptyState ?? <EmptyStateCard ... onPress={onBack} />` 폴백은
    // 호출부가 emptyState를 넘기면 서지 않는다 -- onBack이 사라진 뒤에도 라벨 없는 목적지의
    // 버튼이 그 갈래로 되살아나지 않는다는 확인이다.
    expect(items).toContain("emptyState={");
  });

  it("전제 확인: 유일 호출부가 이 화면이고, onBack은 옵셔널로 남아 있다", () => {
    const parity = source("src/preparation/PreparationListParity.tsx");
    expect(parity).toContain("onBack?: () => void;");
    // 캡처 경로 전제: 비세션은 PreparationListParity 이전에 반환한다.
    const items = source("app/(tabs)/items.tsx");
    const previewReturnIndex = items.indexOf("if (!hasSession) {");
    const parityRenderIndex = items.indexOf("<PreparationListParity");
    expect(previewReturnIndex).toBeGreaterThan(-1);
    expect(parityRenderIndex).toBeGreaterThan(previewReturnIndex);
  });
});
