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

  // ── 폴 자체가 목적인 하부 배선 ───────────────────────────────────────────────────────
  "src/offline/sync-controller.ts":
    "아웃박스 flush의 사전 조건이다(문구 판정이 아니라 전송 여부) — await 한 번이고 화면 상태가 없다.",
  "src/onboarding/selected-child-recovery.ts":
    "MOB-116 복구 경로가 **주입받은** 폴 함수다(wiring.isCurrentlyOnline). 결과는 setState가 " +
    "아니라 전이 리듀서(observe)로 들어가고, 그 리듀서가 자기 가드를 진다(라운드 71 트랙 C)."

  // ⚠ 라운드 72 리뷰 M-2로 **둘이 이 목록에서 사라졌다.** `app/settings/privacy.tsx`(라운드 71 B)와
  // `src/onboarding/step-ui.tsx`(라운드 72 트랙 A)는 "같은 cancelled 가드를 이미 갖고 있고 데모
  // 세션 갈래가 하나 더 걸린다"를 사유로 손으로 적은 폴을 들고 있었다. 그런데 그 갈래는 훅에
  // 넘기는 **인자 하나**로 표현된다(`isError && !isDemoSession`) — 훅 밖에 남을 이유가 아니었다.
  // 이제 둘 다 `useErrorTimeConnectivity`를 부르므로 `isCurrentlyOnline`을 아예 import하지 않는다.
};

describe("GAP-072 E ⓐ-1 실패 시점 연결 판정은 공용 배선 한 벌이다", () => {
  /**
   * ⚠ 라운드 72 리뷰 M-2 — **스윕의 단위가 파일이 아니라 호출 자리다.**
   *
   * 종전 스윕은 `isCurrentlyOnline().then(set…)` **한 형태만** 봤다. 그래서 같은 일을 하는
   * `.then((online) => { … setIsOnline(online) … })` 꼴 둘(privacy 화면 · 온보딩 step-ui)이
   * 그물을 그대로 빠져나갔고, 그 둘은 "제외 사유가 적힌 자리"로 남아 라운드 72 트랙 E의 통합에서
   * 통째로 빠졌다. 이제는 각 호출의 `.then(...)` **콜백 본문을 괄호 균형으로 잘라** 그 안에
   * setState가 있는지 본다 — 콜백 밖(같은 함수의 `finally`에 있는 `setBusy(false)` 같은 것)은
   * 세지 않으므로 창 크기에 걸리는 오탐도 생기지 않는다.
   */
  const pollCallbackBody = (src: string, callIndex: number): string | null => {
    const after = src.slice(callIndex);
    const head = /^isCurrentlyOnline\(\s*\)\s*\.then\(/.exec(after);
    if (!head) return null;
    let depth = 1;
    let cursor = head[0].length;
    for (; cursor < after.length && depth > 0; cursor += 1) {
      if (after[cursor] === "(") depth += 1;
      else if (after[cursor] === ")") depth -= 1;
    }
    return after.slice(head[0].length, cursor - 1);
  };

  /** 폴의 콜백이 화면 상태를 직접 쓰는 자리(= 손으로 다시 적은 배선). */
  const handRewrittenPolls = (): string[] => {
    const found: string[] = [];
    for (const path of productSources()) {
      if ((CONNECTIVITY_POLL_OWNERS as readonly string[]).includes(path)) continue;
      const src = withoutComments(source(path));
      for (const match of src.matchAll(/isCurrentlyOnline\(/g)) {
        const body = pollCallbackBody(src, match.index);
        if (body && /\bset[A-Z]\w*\(/.test(body)) found.push(path);
      }
    }
    return [...new Set(found)];
  };

  it("훅 파일 밖에서 폴의 콜백이 화면 상태를 직접 쓰는 자리가 제외 목록뿐이다", () => {
    const undeclared = handRewrittenPolls().filter((path) => !(path in CONNECTIVITY_POLL_EXEMPT));
    // setState를 폴의 콜백에 직접 걸면 ① 사라진 화면에 값이 쓰이고 ② 연속 실패에서 늦게 도착한
    // 옛 판정이 최신을 덮는다. 정확히 그 형태가 라운드 71 A의 넷이었고, 라운드 72 리뷰가
    // `.then((online) => {…})` 꼴 둘을 더 찾아냈다.
    expect(undeclared, `손으로 다시 적은 폴: ${undeclared.join(" | ")}`).toEqual([]);
  });

  it("그 스윕이 `.then((online) => {…})` 꼴을 실제로 잡는다 (그물이 다시 성기어지면 빨개진다)", () => {
    // 이 자리는 콜백이 `(online) => { … if (!online) setClickedTitle(…) }`이고 제외 사유가 있다.
    // 종전 스윕(`.then(set` 정규식)은 이 꼴을 한 건도 세지 못했다 — 그것이 M-2의 구멍이었다.
    expect(handRewrittenPolls()).toContain("app/items/[itemTemplateId].tsx");
    // 반대쪽: 통합된 둘은 폴을 아예 부르지 않으므로 이 목록에 없다.
    for (const merged of ["app/settings/privacy.tsx", "src/onboarding/step-ui.tsx"]) {
      expect(handRewrittenPolls(), `통합된 자리: ${merged}`).not.toContain(merged);
    }
  });

  it("남은 호출 자리는 전부 이유가 적힌 제외 목록에 있다", () => {
    const callers = productSources().filter(
      (path) =>
        !(CONNECTIVITY_POLL_OWNERS as readonly string[]).includes(path) &&
        withoutComments(source(path)).includes("isCurrentlyOnline(")
    );
    // 스윕이 실제로 무언가를 찾았다(그렙이 조용히 0을 세면 계약이 아무것도 지키지 않는다).
    expect(callers.length).toBeGreaterThanOrEqual(6);
    // 세 갈래의 대표 자리는 반드시 잡힌다 — 스윕이 무너지면 여기서 먼저 빨개진다.
    for (const anchor of [
      "app/family/index.tsx",
      "app/items/[itemTemplateId].tsx",
      "src/offline/sync-controller.ts"
    ]) {
      expect(callers, `스윕이 놓친 자리: ${anchor}`).toContain(anchor);
    }
    // 통합된 둘은 폴을 import조차 하지 않는다(사본이 되살아나면 여기서 걸린다).
    for (const merged of ["app/settings/privacy.tsx", "src/onboarding/step-ui.tsx"]) {
      expect(callers, `되살아난 사본: ${merged}`).not.toContain(merged);
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
   * 라운드 72 리뷰 M-2 — **데모 세션 갈래를 가진 둘도 같은 배선을 쓴다.**
   *
   * 둘이 훅 밖에 남아 있던 사유는 "판정에 데모 세션 갈래가 하나 더 걸린다"였는데, 그 갈래는
   * 훅에 넘기는 **인자 하나**로 표현된다 — 데모 세션이면 폴을 돌리지 않는다는 뜻이므로
   * 종전 effect 가드(`!isError || isDemoSession`이면 true로 복원)와 동치다. 훅은 조건 없이
   * 호출되므로 hooks 규칙에도 안전하다.
   */
  it("데모 세션 갈래를 가진 둘(개인정보 · 온보딩)도 그 공용 배선을 쓴다", () => {
    const privacy = source("app/settings/privacy.tsx");
    const stepUi = source("src/onboarding/step-ui.tsx");

    expect(privacy).toContain('import { useErrorTimeConnectivity } from "../../src/offline/use-load-error-copy";');
    expect(stepUi).toContain('import { useErrorTimeConnectivity } from "../offline/use-load-error-copy";');

    // 데모 세션 갈래는 **인자**로만 남는다(판정 로직은 한 줄도 새로 쓰지 않았다).
    expect(privacy).toContain("const isOnline = useErrorTimeConnectivity(isError && !isDemoSession);");
    expect(privacy).toContain("destructiveFlowErrorMessage(kind, error, { isOnline: isDemoSession || isOnline })");
    expect(stepUi).toContain("const isOnline = useErrorTimeConnectivity(!isDemoSession);");
    expect(stepUi).toContain("return isDemoSession || isOnline;");

    // 재구현이 남지 않는다 — 두 파일은 폴도 cancelled 가드도 들고 있지 않다.
    for (const [label, src] of [
      ["개인정보", privacy],
      ["온보딩 step-ui", stepUi]
    ] as const) {
      const code = withoutComments(src);
      expect(code, `${label}에 남은 폴`).not.toContain("isCurrentlyOnline");
      expect(code, `${label}에 남은 가드`).not.toContain("let cancelled = false;");
    }

    // 라운드 72 리뷰 S-1: 갈래를 만들지 않는 죽은 인자가 사라졌다(호출부는 언제나 `true`였다).
    expect(stepUi).toContain("export function useOnboardingSaveFailureConnectivity(): boolean {");
    expect(stepUi).toContain("const isOnline = useOnboardingSaveFailureConnectivity();");
    expect(stepUi, "죽은 인자").not.toContain("useOnboardingSaveFailureConnectivity(true)");
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

  /**
   * 라운드 72 리뷰 M-1 — **네 자리의 실패 문구를 한 자리에서 센다.**
   *
   * 라운드 72 트랙 E는 로그인 화면의 문구만 고치면서 그 근거로 "다른 셋은 재시도를 권하지 않는데
   * 이 사본만 그랬다"를 적었는데, **세어 보니 넷 다 "잠시 후 다시 시도해 주세요."였다.** 근거가
   * 거짓이었던 것이 아니라 아무도 세지 않았던 것이다. 그래서 문구 계약도 화면 단위가 아니라
   * **호출 집합 단위**로 둔다 — 여는 규칙이 한 벌이면 그 규칙이 띄우는 알림의 규율도 한 벌이다.
   *
   * 규율은 둘이다.
   *  ⓐ **재시도를 권하지 않는다.** `openExternalUrl`이 알림을 띄우는 경우는 둘뿐이고(열 수 있는지
   *    물었을 때 false · 여는 호출이 던짐) 둘 다 기다려서 풀리지 않는다.
   *  ⓑ **원인을 단정하지 않는다.** 그 둘은 규칙 모듈의 **같은 `catch`**로 들어오므로, "브라우저가
   *    없다"고 말하면 잘못된 주소로 실패한 사람에게 틀린 사실을 말하게 된다(라운드 72 리뷰 S-6).
   */
  it("네 자리의 링크 실패 문구가 재시도도, 원인도 말하지 않는다(해요체 — DNC-018)", async () => {
    // 더보기·설정은 같은 표(support-links.ts)를 읽고, 나머지 둘은 자기 화면의 상수를 갖는다.
    const { SUPPORT_LINK_FAILED_TITLE, SUPPORT_LINK_FAILED_MESSAGE } = await import("./settings/support-links");
    const constantIn = (path: string, name: string): string => {
      const found = source(path).match(new RegExp(`const ${name} = "([^"]+)";`))?.[1];
      expect(found, `${path}의 ${name}`).toBeTruthy();
      return found!;
    };

    const failureCopy: Array<[string, string]> = [
      ["더보기·설정(지원·FAQ)", SUPPORT_LINK_FAILED_TITLE],
      ["더보기·설정(지원·FAQ)", SUPPORT_LINK_FAILED_MESSAGE],
      ["개인정보(약관 링크)", constantIn("app/settings/privacy.tsx", "LEGAL_LINK_FAILED_TITLE")],
      ["개인정보(약관 링크)", constantIn("app/settings/privacy.tsx", "LEGAL_LINK_FAILED_MESSAGE")],
      ["로그인(약관 링크)", constantIn("app/(auth)/login.tsx", "LEGAL_DOCUMENT_OPEN_FAILED_TITLE")],
      ["로그인(약관 링크)", constantIn("app/(auth)/login.tsx", "LEGAL_DOCUMENT_OPEN_FAILED_MESSAGE")]
    ];
    // 화면 넷이 읽는 상수는 **세 벌**(제목·본문 짝 셋)이다 — 더보기와 설정이 같은 표를 읽는다.
    expect(failureCopy).toHaveLength(6);

    for (const [where, copy] of failureCopy) {
      expect(copy, `${where}: 재시도 권유`).not.toContain("다시 시도");
      expect(copy, `${where}: 기다림 권유`).not.toContain("잠시 후");
      expect(copy, `${where}: 지시형·오류 어투`).not.toMatch(/확인하세요|확인해 주세요|하십시오|오류|에러|error/i);
      expect(copy, `${where}: 알 수 없는 원인 단정`).not.toContain("브라우저");
      expect(copy, `${where}: 해요체`).toMatch(/요$|요\.$/);
    }
  });
});
