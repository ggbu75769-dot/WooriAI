import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// MOB-119 (UX-5B-5 후속): 로딩 분기의 "가짜 버튼" EmptyStateCard(잠시만요) 잔여 3곳을
// D6 스켈레톤으로 교체하는 소스 계약. 이 repo의 vitest는 react-native 컴포넌트를 실행할 수
// 없으므로(ui-pixel-lock-flow.test.ts 참고) 소스 문자열 계약으로 고정한다.
const mobileRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

// UX-N: `offlineAwareCopy`가 켜진 화면은 에러 카드 문구를 오프라인 여부로 갈라 쓰므로 문구가
// JSX 리터럴이 아니다(공용 단일 소스 useLoadErrorCopy → src/offline/messages.ts). 여기서 고정하는
// 것은 원래도 "재시도 수단이 달린 EmptyStateCard가 에러 분기에 남아 있다"이므로, 그 화면에서는
// 같은 사실을 리터럴 대신 공용 문구 사용으로 확인한다.
const screens = [
  { path: "app/family/index.tsx", skeletons: ["<SkeletonCard />", "<SkeletonRow />"], offlineAwareCopy: false },
  { path: "app/items/[itemTemplateId].tsx", skeletons: ["<SkeletonCard />", "<SkeletonRow />"], offlineAwareCopy: true },
  { path: "app/budget.tsx", skeletons: ["<SkeletonCard />"], offlineAwareCopy: true },
  // UX-Q(B): 지출 수정 화면은 MOB-119 당시 목록에 없어 "불러오고 있어요. / 잠시만요"(onPress
  // 없는 죽은 버튼)가 저장소에서 유일하게 살아남아 있었다. 같은 계약으로 들여 재발을 막는다.
  { path: "app/expenses/[expenseId].tsx", skeletons: ["<SkeletonCard />", "<SkeletonRow />"], offlineAwareCopy: false }
] as const;

describe("MOB-119 loading skeleton contract", () => {
  for (const screen of screens) {
    it(`${screen.path} renders skeletons instead of a fake-button loading card`, () => {
      const source = readSource(screen.path);
      // 로딩 상태에서 아무 동작도 없는 "잠시만요" 버튼을 다시 들이지 않는다.
      expect(source).not.toContain("잠시만요");
      expect(source).not.toContain('불러오고 있어요."');
      // 스켈레톤 프리셋을 import해서 실제로 렌더한다.
      expect(source).toContain('/src/ui/Skeleton"');
      for (const skeleton of screen.skeletons) {
        expect(source).toContain(skeleton);
      }
    });

    // 주의(MOB-130): 아래는 에러 카드가 소스에 "있다"만 말한다 -- 실제로 도달 가능한지는
    // 분기 순서의 문제이고, 그 계약은 src/screen-phase.test.ts가 진다.
    it(`${screen.path} keeps the retry EmptyStateCard on the error branch`, () => {
      const source = readSource(screen.path);
      if (screen.offlineAwareCopy) {
        expect(source).toContain("title={loadErrorCopy.title}");
        expect(source).toContain("actionLabel={loadErrorCopy.actionLabel}");
      } else {
        expect(source).toContain('title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."');
        expect(source).toContain('actionLabel="다시 시도"');
      }
    });
  }
});
