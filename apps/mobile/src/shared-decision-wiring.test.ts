import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 라운드 72 트랙 E(#5) — **"이 판정을 손으로 다시 적은 자리"를 세는 계약.**
 *
 * 이 저장소에서 가장 성공한 형식은 "판정을 한 벌로 모은다"인데, 그 형식은 **매번 한 벌을
 * 남겼다.** 라운드 52 C-07이 실패 시점 연결 판정을 `useErrorTimeConnectivity`로 모았지만
 * 가져오기 두 화면에 넷이 남았고, 라운드 71 리뷰 S-2가 앱 밖 링크 열기를 `openExternalUrl`로
 * 모았지만 로그인 화면에 하나가 남았다. 셋의 공통점은 **모으는 라운드가 "그 시점에 열려 있던
 * 파일"만 훑었다**는 것이다.
 *
 * 그래서 이번 계약의 단위는 **파일이 아니라 호출 집합**이다: 저장소 전체를 훑어 그 판정을 다시
 * 적은 자리를 세고, 남은 자리는 **이유가 값으로 적힌 제외 목록**에만 있을 수 있다. 다음 라운드가
 * 같은 자리를 또 빠뜨리면(또는 새 사본이 생기면) 이 파일이 빨개진다.
 *
 * react-native 화면은 vitest(node)에서 렌더할 수 없고 `connectivity.ts`·`open-external-url.ts`는
 * 네이티브 모듈을 들고 있어 import조차 되지 않으므로, 이 저장소의 관례대로 소스 그렙이다
 * (support-links.test.ts · import-failure-messages.test.ts의 배선 계약과 같은 형식).
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 주석을 걷어낸 소스. 이 계약이 세는 것은 **실제 호출**이지 그 배선을 설명하는 문장이 아니다
 * (걷지 않으면 "종전에는 이렇게 적었다"는 머리말이 그대로 위반으로 잡힌다).
 *
 * 블록 주석 전체와, 잘라 낸 앞부분이 공백뿐인 줄 주석만 지운다 — 코드 줄 안의 `//`(주소의
 * `https://` 등)는 건드리지 않는다.
 */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

/** 제품 소스 전량(테스트·타입 선언 제외). */
function productSources(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test\.tsx?$/.test(entry) || entry.endsWith(".d.ts")) continue;
      found.push(relative(mobileRoot, fullPath).split(sep).join("/"));
    }
  };
  walk(join(mobileRoot, "app"));
  walk(join(mobileRoot, "src"));
  return found.sort();
}

/**
 * ⓐ-1 **실패 시점 연결 판정.**
 *
 * 판정을 소유한 자리는 둘뿐이다: 폴 자체를 구현한 `src/offline/connectivity.ts`와, 그 폴을
 * "에러로 전환되는 순간 한 번 + cancelled 가드 + 에러 해제 시 복원"으로 감싼 공용 배선
 * `src/offline/use-load-error-copy.ts`. 나머지 자리는 전부 이유가 적힌 제외 목록에 있다.
 */
const CONNECTIVITY_POLL_OWNERS = ["src/offline/connectivity.ts", "src/offline/use-load-error-copy.ts"] as const;

const CONNECTIVITY_POLL_EXEMPT: Record<string, string> = {
  // ── setState가 없는 자리(말하고 끝난다) ──────────────────────────────────────────────
  "app/family/index.tsx":
    "구성원 삭제·초대 취소 실패는 Alert 한 번이다 — 폴 결과를 화면 상태로 남기지 않으므로 " +
    "언마운트 후 setState도, 연속 실패의 덮어쓰기도 성립하지 않는다(라운드 52 C-05).",
  "app/import/index.tsx":
    "되돌리기 실패도 같은 Alert 한 번이다(라운드 71 트랙 A). 이 화면의 **업로드** 실패 문구는 " +
    "라운드 72 트랙 E에서 useErrorTimeConnectivity로 옮겼고, 남은 이 한 자리만 폴을 직접 띄운다.",
  "src/export/ExpenseCsvExport.tsx":
    "내보내기 실패는 토스트 한 번이다(showToast) — 판정을 상태로 들고 있지 않다.",
  "app/expenses/new.tsx":
    "여기서 연결 상태는 문구가 아니라 **분석 이벤트의 payload**(offline 플래그)다. 화면에 서는 " +
    "문장이 아니므로 실패 문구 배선이 아니다.",

  // ── 자기 seq 가드를 가진 자리 ────────────────────────────────────────────────────────
  "app/items/[itemTemplateId].tsx":
    "구매 링크 실패 안내는 자기 seq 가드를 갖고 있다(linkNoticeSeqRef) — 더 최신 문구가 섰거나 " +
    "화면이 사라졌으면 결과를 버린다. 공용 훅과 같은 사실을 이미 지키고, 입력이 '에러 상태'가 " +
    "아니라 '이 안내가 아직 최신인가'라 훅의 시그니처로 옮길 수 없다.",

  // ── 이미 같은 cancelled 가드를 갖고 있으나 입력이 하나 더 있는 자리 ──────────────────
  "app/settings/privacy.tsx":
    "파괴적 흐름 문구(destructiveFlowErrorMessage)는 같은 cancelled 가드·복원을 이미 갖고 있고, " +
    "판정에 **데모 세션 갈래**가 하나 더 걸린다(isDemoSession이면 언제나 온라인으로 읽는다). " +
    "훅에 없는 입력이라 그대로 두고, 이 파일은 라운드 72 어느 트랙의 소유도 아니다.",

  // ── 폴 자체가 목적인 하부 배선 ───────────────────────────────────────────────────────
  "src/offline/sync-controller.ts":
    "아웃박스 flush의 사전 조건이다(문구 판정이 아니라 전송 여부) — await 한 번이고 화면 상태가 없다.",
  "src/onboarding/selected-child-recovery.ts":
    "MOB-116 복구 경로가 **주입받은** 폴 함수다(wiring.isCurrentlyOnline). 결과는 setState가 " +
    "아니라 전이 리듀서(observe)로 들어가고, 그 리듀서가 자기 가드를 진다(라운드 71 트랙 C).",
  "src/onboarding/step-ui.tsx":
    "온보딩 저장 실패 문구의 배선(라운드 72 트랙 A). privacy.tsx와 같은 이유로 훅 밖에 있다 — " +
    "같은 cancelled 가드·복원을 이미 갖고 있고, 판정에 **데모 세션 갈래**가 하나 더 걸린다" +
    "(로컬 백엔드는 네트워크를 지나지 않으므로 그 실패를 오프라인이라 부르면 틀린 사실이다). " +
    "파일은 트랙 A 소유이고 이 트랙은 읽기만 한다."
};

describe("GAP-072 E ⓐ-1 실패 시점 연결 판정은 공용 배선 한 벌이다", () => {
  it("훅 파일 밖에 `isCurrentlyOnline().then(set…)` 형태가 0건이다", () => {
    const handRewritten: string[] = [];
    for (const path of productSources()) {
      if ((CONNECTIVITY_POLL_OWNERS as readonly string[]).includes(path)) continue;
      const src = withoutComments(source(path));
      for (const match of src.matchAll(/isCurrentlyOnline\(\)\s*\.then\(\s*set/g)) {
        handRewritten.push(`${path}: ${src.slice(match.index, match.index + 60).split("\n")[0]}`);
      }
    }
    // 이 형태가 정확히 라운드 71 A가 가져오기 두 화면에 남긴 넷이었다. setState를 폴의 콜백에
    // 직접 걸면 ① 사라진 화면에 값이 쓰이고 ② 연속 실패에서 늦게 도착한 옛 판정이 최신을 덮는다.
    expect(handRewritten, `손으로 다시 적은 폴: ${handRewritten.join(" | ")}`).toEqual([]);
  });

  it("남은 호출 자리는 전부 이유가 적힌 제외 목록에 있다", () => {
    const callers = productSources().filter(
      (path) =>
        !(CONNECTIVITY_POLL_OWNERS as readonly string[]).includes(path) &&
        withoutComments(source(path)).includes("isCurrentlyOnline(")
    );
    // 스윕이 실제로 무언가를 찾았다(그렙이 조용히 0을 세면 계약이 아무것도 지키지 않는다).
    expect(callers.length).toBeGreaterThanOrEqual(6);
    // 네 갈래의 대표 자리는 반드시 잡힌다 — 스윕이 무너지면 여기서 먼저 빨개진다.
    for (const anchor of [
      "app/family/index.tsx",
      "app/items/[itemTemplateId].tsx",
      "app/settings/privacy.tsx",
      "src/offline/sync-controller.ts"
    ]) {
      expect(callers, `스윕이 놓친 자리: ${anchor}`).toContain(anchor);
    }
    // 핵심 단언: **선언되지 않은 사본이 0건**이다. 새로 손으로 적은 자리가 생기면 여기서 걸린다.
    // (반대 방향을 등호로 묶지 않는 이유는 이 목록이 다른 트랙 소유 파일까지 담기 때문이다 —
    //  그 파일이 이 라운드에서 빠져도 이 트랙이 빨개질 이유는 없다.)
    const undeclared = callers.filter((path) => !(path in CONNECTIVITY_POLL_EXEMPT));
    expect(undeclared, `이유 없이 손으로 다시 적은 자리: ${undeclared.join(" | ")}`).toEqual([]);
    // 제외에는 **이유가 값으로** 있어야 한다(다음 라운드가 또 세지 않게).
    for (const [path, reason] of Object.entries(CONNECTIVITY_POLL_EXEMPT)) {
      expect(reason.length, `${path}의 제외 사유`).toBeGreaterThan(40);
    }
  });

  it("가져오기 네 자리가 그 공용 배선을 쓴다(판정 로직은 한 줄도 새로 쓰지 않았다)", () => {
    const upload = source("app/import/index.tsx");
    const review = source("app/import/[importJobId].tsx");
    for (const src of [upload, review]) {
      expect(src).toContain('import { useErrorTimeConnectivity } from "../../src/offline/use-load-error-copy";');
    }
    expect(upload).toContain("const uploadFailureOnline = useErrorTimeConnectivity(upload.isError);");
    expect(review).toContain("const toggleFailureOnline = useErrorTimeConnectivity(toggleRow.isError);");
    expect(review).toContain("const categoryFailureOnline = useErrorTimeConnectivity(updateCategory.isError);");
    expect(review).toContain("const confirmFailureOnline = useErrorTimeConnectivity(confirm.isError);");
  });

  /**
   * ⓑ **회귀 고정 — 연속 실패에서 늦게 도착한 옛 판정이 최신을 덮지 않는다.**
   *
   * 넷이 지금 도달한 그 배선이 실제로 그 사실을 지키는지 본다(문구 판정 자체는 순수 함수라
   * messages.test.ts가 실행해서 확인하고, 여기서 보는 것은 **가드가 붙어 있는가**다).
   * effect가 정리될 때 — 에러 해제·언마운트·다음 실패로 인한 재실행 — 그 전에 띄운 폴의 결과를
   * 버리므로, 터널 안에서 얻은 "오프라인" 판정이 터널을 빠져나온 뒤의 실패에 얹히지 않는다.
   */
  it("공용 배선이 cancelled 가드와 에러 해제 시 복원을 갖는다", () => {
    const hook = source("src/offline/use-load-error-copy.ts");
    expect(hook).toContain("export function useErrorTimeConnectivity(isError: boolean): boolean {");
    expect(hook).toContain("let cancelled = false;");
    expect(hook).toContain("if (!cancelled) setIsOnline(online);");
    expect(hook).toContain("cancelled = true;");
    // 에러가 풀리면 초기값으로 되돌린다 — 연결이 돌아온 뒤의 실패를 오프라인이라 하지 않는다.
    expect(hook).toContain("setIsOnline(true);");
    // 가드는 **한 벌**이다(사본이 다시 갈라지면 이 수가 늘어난다).
    expect(hook.match(/let cancelled = false;/g) ?? []).toHaveLength(1);
    // 이 트랙이 더한 것은 export 하나뿐이다 — 두 훅의 시그니처는 그대로다.
    expect(hook).toContain("export function useLoadErrorCopy(isError: boolean): LoadErrorCopy {");
    expect(hook).toContain("export function useSaveErrorCopy(isError: boolean, error?: unknown): string {");
  });
});

/**
 * ⓐ-2 **앱 밖으로 나가는 링크.**
 *
 * 규칙(열 수 있는지 묻기 → 열기 → 못 열면 말하기)은 `src/settings/open-external-url.ts` 한 벌이고,
 * 화면은 자기 실패 문구만 넘긴다. 여기서 세는 것은 그 **쌍**(canOpenURL + openURL)을 손으로 다시
 * 적은 자리다.
 */
const EXTERNAL_LINK_OWNER = "src/settings/open-external-url.ts";

const EXTERNAL_LINK_EXEMPT: Record<string, string> = {
  "app/items/[itemTemplateId].tsx":
    "구매 링크(핵심 루프 4단계)는 '못 열면 말하기'로 끝나지 않는다 — 성공 시 구매 후속 등록" +
    "(registerPurchaseFollowup)이 걸리고, 실패 시 COM-106 공유 링크 폴백 UI가 화면 안에 서서 " +
    "같은 주소로 재시도까지 준다. 규칙 모듈이 실패를 삼키면 그 둘이 불가능하므로 이 자리는 " +
    "링크 열기 한 벌의 대상이 아니다(실기기 확인 대상 — known-limitations L-3)."
};

describe("GAP-072 E ⓐ-2 앱 밖 링크 열기는 한 벌이다", () => {
  it("canOpenURL + openURL 쌍이 규칙 모듈 밖에 0건이다(이유가 적힌 제외만 남는다)", () => {
    const pairs = productSources().filter((path) => {
      if (path === EXTERNAL_LINK_OWNER) return false;
      const src = withoutComments(source(path));
      return src.includes("Linking.canOpenURL") && src.includes("Linking.openURL");
    });
    expect(pairs.sort()).toEqual(Object.keys(EXTERNAL_LINK_EXEMPT).sort());
    for (const [path, reason] of Object.entries(EXTERNAL_LINK_EXEMPT)) {
      expect(reason.length, `${path}의 제외 사유`).toBeGreaterThan(40);
    }
  });

  it("링크 열기 화면 넷이 모두 그 한 벌을 부른다(로그인 화면이 넷째다)", () => {
    const callers = [
      "app/(tabs)/more.tsx",
      "app/settings/index.tsx",
      "app/settings/privacy.tsx",
      "app/(auth)/login.tsx"
    ] as const;
    for (const path of callers) {
      const src = source(path);
      expect(src, `${path}가 규칙 한 벌을 부른다`).toMatch(
        /import \{ openExternalUrl \} from "(\.\.\/)+src\/settings\/open-external-url";/
      );
      // 화면에 재구현이 남지 않는다.
      expect(src, `${path}에 남은 재구현`).not.toContain("Linking.canOpenURL");
      expect(src, `${path}에 남은 재구현`).not.toContain("Linking.openURL");
    }
    // 규칙 모듈은 문장을 만들지 않는다 — 문구는 언제나 화면이 넘긴 자기 상수다.
    const opener = source(EXTERNAL_LINK_OWNER);
    expect(opener).toContain("Alert.alert(failTitle, failMessage);");
    expect(opener).not.toContain("열지 못했어요");
  });
});
