import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { usesOfflineAwareLoadErrorCopy } from "./offline/offline-aware-screens";
import { resolveScreenPhase } from "./screen-phase";

const mobileRoot = process.cwd();

function readSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/**
 * MOB-130: 4개 조회 화면의 에러 카드가 도달 불가였다. 로딩 분기가
 * `q.isLoading || !q.data`로 적혀 에러 분기 **앞**에 있었고, react-query v5는 에러 확정 시
 * isPending/isLoading=false·data=undefined를 주므로 `!q.data`가 계속 참 → 스켈레톤이
 * 영원히 돌고 "다시 시도"에는 닿지 못했다.
 */
describe("MOB-130 resolveScreenPhase", () => {
  it("returns loading while the query has not settled yet", () => {
    expect(resolveScreenPhase({ isPending: true, isError: false, hasData: false })).toBe("loading");
  });

  it("returns error for the settled-error shape react-query v5 actually produces (isPending=false, data=undefined)", () => {
    // 이 조합이 회귀의 핵심이다. 종전 분기 순서에서는 `!q.data` 때문에 loading으로 새어
    // 나갔다 -- 여기서 error가 나오지 않으면 스켈레톤 영구 표시 버그가 돌아온 것이다.
    expect(resolveScreenPhase({ isPending: false, isError: true, hasData: false })).toBe("error");
  });

  it("keeps error ahead of loading even in the transitional isPending+isError shape", () => {
    expect(resolveScreenPhase({ isPending: true, isError: true, hasData: false })).toBe("error");
  });

  it("reports error rather than stale content when a refetch over cached data fails", () => {
    // 새로고침 실패(캐시 데이터 보유). 실패를 로딩으로도, 정상으로도 위장하지 않는다.
    expect(resolveScreenPhase({ isPending: false, isError: true, hasData: true })).toBe("error");
  });

  it("returns ready only once real data is in hand", () => {
    expect(resolveScreenPhase({ isPending: false, isError: false, hasData: true })).toBe("ready");
  });

  it("returns loading when the query settled without an error but produced no data", () => {
    expect(resolveScreenPhase({ isPending: false, isError: false, hasData: false })).toBe("loading");
  });

  it("never returns anything other than the three phases across every input combination", () => {
    const flags = [false, true];
    for (const isPending of flags) {
      for (const isError of flags) {
        for (const hasData of flags) {
          expect(["loading", "error", "ready"]).toContain(resolveScreenPhase({ isPending, isError, hasData }));
        }
      }
    }
  });
});

/**
 * 문자열 존재가 아니라 **사용과 순서**를 고정한다: 네 화면이 판정을 직접 손으로 적지 않고
 * resolveScreenPhase에 위임하며, 에러 분기가 로딩 분기보다 먼저 온다.
 */
describe("MOB-130 screen branch-order contract", () => {
  /**
   * UX-N: "이 화면이 조회 실패 문구를 오프라인 여부로 갈라 쓰는가"는 여기서 손으로 적지 않는다.
   * 갈라 쓰는 화면은 문구가 더 이상 JSX 리터럴이 아니라 useLoadErrorCopy가 돌려주는 값이므로,
   * 문자열 대신 **그 공용 단일 소스를 쓴다는 사실**을 고정한다(문구 자체는
   * src/offline/messages.test.ts가 고정).
   *
   * 라운드 38 H-12: 같은 사실이 이 파일과 loading-skeleton-contract.test.ts에 두 벌로 적혀 있어
   * 서로 갈릴 수 있었다(한쪽만 켜면 다른 쪽은 옛 리터럴을 계속 기대한다). 이제 두 파일 모두
   * src/offline/offline-aware-screens.ts 한 곳을 읽는다.
   */
  const screens = [
    { path: "app/(tabs)/index.tsx", query: "home", phase: "homePhase" },
    { path: "app/(tabs)/items.tsx", query: "items", phase: "itemsPhase" },
    { path: "app/family/index.tsx", query: "members", phase: "membersPhase" },
    { path: "app/items/[itemTemplateId].tsx", query: "detail", phase: "detailPhase" }
  ] as const;

  for (const screen of screens) {
    it(`${screen.path} delegates its loading/error/ready decision to resolveScreenPhase`, () => {
      const source = readSource(screen.path);

      expect(source).toContain('from "../../src/screen-phase"');
      expect(source).toContain(`const ${screen.phase} = resolveScreenPhase({`);
      expect(source).toContain(`isError: ${screen.query}.isError`);
      expect(source).toContain(`hasData: Boolean(${screen.query}.data)`);
    });

    it(`${screen.path} reaches the retry error card before the skeleton branch`, () => {
      const source = readSource(screen.path);

      const errorBranch = source.indexOf(`hasSession && ${screen.phase} === "error"`);
      const loadingBranch = source.indexOf(`hasSession && ${screen.phase} === "loading"`);
      expect(errorBranch, "error branch should exist").toBeGreaterThan(-1);
      expect(loadingBranch, "loading branch should exist").toBeGreaterThan(-1);
      expect(errorBranch).toBeLessThan(loadingBranch);

      // 에러 카드는 계속 재시도 수단을 단 EmptyStateCard다 -- 오프라인에서도 버튼은 숨기지 않는다.
      const errorBlock = source.slice(errorBranch, loadingBranch);
      if (usesOfflineAwareLoadErrorCopy(screen.path)) {
        expect(source).toContain('from "../../src/offline/use-load-error-copy"');
        expect(source).toContain(`const loadErrorCopy = useLoadErrorCopy(${screen.query}.isError);`);
        expect(errorBlock).toContain("title={loadErrorCopy.title}");
        expect(errorBlock).toContain("actionLabel={loadErrorCopy.actionLabel}");
      } else {
        expect(errorBlock).toContain('title="불러오지 못했어요. 잠시 후 다시 시도해 주세요."');
        expect(errorBlock).toContain('actionLabel="다시 시도"');
      }
      expect(errorBlock).toContain(`${screen.query}.refetch()`);
    });

    it(`${screen.path} no longer hand-rolls the "loading unless data" test that swallowed errors`, () => {
      const source = readSource(screen.path);

      expect(source).not.toContain(`${screen.query}.isLoading || !${screen.query}.data`);
    });
  }
});
