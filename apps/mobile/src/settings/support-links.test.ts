import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSupportMenuRows } from "./more-menu";
import {
  normalizeSupportUrl,
  SUPPORT_LINK_FAILED_MESSAGE,
  SUPPORT_LINK_FAILED_TITLE,
  SUPPORT_LINK_LABELS,
  supportLinkUrl,
  supportLinkUrls
} from "./support-links";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const originalSupport = process.env.EXPO_PUBLIC_SUPPORT_URL;
const originalFaq = process.env.EXPO_PUBLIC_FAQ_URL;

function setEnv(key: "EXPO_PUBLIC_SUPPORT_URL" | "EXPO_PUBLIC_FAQ_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  setEnv("EXPO_PUBLIC_SUPPORT_URL", originalSupport);
  setEnv("EXPO_PUBLIC_FAQ_URL", originalFaq);
});

/**
 * 라운드 71 트랙 D(GAP-071 #4) — **앱 안에 도움을 구할 길이 0건이었다.**
 *
 * 정적 지원 사이트는 완성돼 있는데(SITE-113) 앱이 그곳을 가리키지 않았고, 예전의 "고객센터"는
 * /settings/privacy로 가는 눈속임 라우팅이라 이미 걷어내진 뒤였다. 호스팅 URL은 사용자 자산이라
 * 이 라운드가 만들 수 없으므로, 약관 링크(라운드 65 B#5)가 세운 형식을 그대로 한 번 더 쓴다.
 */
describe("지원 · FAQ 링크 (env가 있을 때만 행이 선다)", () => {
  it("값이 없으면 URL도 행도 없다 -- 화면은 종전 그대로다", () => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", undefined);
    setEnv("EXPO_PUBLIC_FAQ_URL", undefined);
    expect(supportLinkUrls()).toEqual({ support: null, faq: null });
    expect(supportLinkUrl("support")).toBeNull();
    expect(supportLinkUrl("faq")).toBeNull();
    expect(buildSupportMenuRows()).toEqual([]);
  });

  it("주입된 값은 그대로 쓴다", () => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", "https://wooriai.example.com/support.html");
    setEnv("EXPO_PUBLIC_FAQ_URL", "https://wooriai.example.com/faq.html");
    expect(supportLinkUrls()).toEqual({
      support: "https://wooriai.example.com/support.html",
      faq: "https://wooriai.example.com/faq.html"
    });
  });

  it("열 수 없는 값은 링크로 인정하지 않는다(죽은 링크를 그리지 않는다)", () => {
    for (const raw of [
      "",
      "   ",
      "그때 알려드릴게요",
      "javascript:alert(1)",
      "mailto:support@example.com",
      "wooriai://support",
      "example.com/support"
    ]) {
      expect(normalizeSupportUrl(raw)).toBeNull();
    }
    expect(normalizeSupportUrl(undefined)).toBeNull();
    expect(normalizeSupportUrl(null)).toBeNull();
    // 앞뒤 공백은 주입 실수라 잘라 낸다.
    expect(normalizeSupportUrl("  https://a.example/faq.html  ")).toBe("https://a.example/faq.html");
    // 자체 호스팅 중인 스테이징(http)도 열리기는 한다.
    expect(normalizeSupportUrl("http://10.0.2.2:8080/faq.html")).toBe("http://10.0.2.2:8080/faq.html");
  });

  it("정규화를 통과하지 못한 값은 행을 만들지 않는다(주입 실수가 죽은 행이 되지 않는다)", () => {
    setEnv("EXPO_PUBLIC_SUPPORT_URL", "[지원 URL]");
    setEnv("EXPO_PUBLIC_FAQ_URL", "   ");
    expect(buildSupportMenuRows()).toEqual([]);
  });

  it("이메일 주소도 URL도 앱에 박혀 있지 않다(placeholder 상태 — 값이 없으면 행 자체가 없다)", () => {
    // 사용자에게 도달하는 것은 렌더되는 코드뿐이라 주석은 걷어내고 본다(주입 방법을 적은 머리말은
    // `https://.../support.html` 같은 예시를 담는다 -- settings-flow.test.ts의 그 관례).
    const rendered = (relativePath: string) =>
      source(relativePath)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, " ");
    for (const relativePath of [
      "src/settings/support-links.ts",
      "src/settings/more-menu.ts",
      "app/(tabs)/more.tsx",
      "app/settings/index.tsx"
    ]) {
      expect(rendered(relativePath), `${relativePath}에 하드코딩된 주소`).not.toMatch(/https?:\/\//);
      expect(rendered(relativePath), `${relativePath}에 하드코딩된 이메일`).not.toMatch(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
      );
      // 문의처를 문장으로 지어내지도 않는다(`[지원 이메일]`은 아직 placeholder다).
      expect(rendered(relativePath), `${relativePath}에 지어낸 문의처`).not.toContain("@example");
    }
  });

  it("EXPO_PUBLIC_* 는 리터럴 멤버 표현식으로 읽는다(babel이 번들 시점에 인라인한다)", () => {
    const linksSource = source("src/settings/support-links.ts");
    expect(linksSource).toContain("process.env.EXPO_PUBLIC_SUPPORT_URL");
    expect(linksSource).toContain("process.env.EXPO_PUBLIC_FAQ_URL");
    // 동적 접근(process.env[key])은 번들에서 값이 사라진다.
    expect(linksSource).not.toMatch(/process\.env\[/);
  });

  it("문서 본문을 앱 번들에 복사하지 않고, 인앱 웹뷰도 만들지 않는다", () => {
    for (const relativePath of ["src/settings/support-links.ts", "app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      expect(source(relativePath)).not.toContain("<html");
      expect(source(relativePath)).not.toContain("react-native-webview");
      expect(source(relativePath)).not.toContain("WebView");
    }
    // 새 의존성 0건(known-limitations A절) -- 여는 방법은 이미 있는 Linking 하나다.
    expect(source("package.json")).not.toContain("webview");
  });

  it("행 이름 · 부제가 도움 문서가 실제로 담은 것만 말한다(해요체 · DNC-018)", () => {
    for (const kind of ["support", "faq"] as const) {
      const { title, subtitle } = SUPPORT_LINK_LABELS[kind];
      expect(title.trim().length).toBeGreaterThan(0);
      expect(subtitle.endsWith("요")).toBe(true);
    }
    // 앱이 답을 해 준다고 약속하지 않는다(가는 곳은 정적 페이지다).
    for (const { subtitle } of Object.values(SUPPORT_LINK_LABELS)) {
      for (const overclaim of ["바로 답", "상담", "24시간", "전화"]) {
        expect(subtitle, overclaim).not.toContain(overclaim);
      }
    }
    expect(SUPPORT_LINK_FAILED_MESSAGE.endsWith("요.")).toBe(true);
  });

  /**
   * 라운드 72 리뷰 M-1 — **재시도를 권하지 않고, 원인도 단정하지 않는다.**
   *
   * 이 알림이 뜨는 경우는 `openExternalUrl` 한 벌이 아는 둘뿐이고(열 수 있는지 물었을 때
   * false · 여는 호출이 던짐) 둘 다 기다려서 풀리지 않는다. 그리고 둘이 같은 `catch`로 들어오므로
   * 원인을 이름으로 부르면 한쪽에는 틀린 사실이 된다. 네 자리 전부의 스윕은
   * `src/shared-decision-wiring.test.ts` ⓐ-2에 있고, 여기서는 이 화면 몫을 값으로 못박는다.
   */
  it("링크 실패 문구에 '다시 시도'도, 원인 단정도 없다", () => {
    for (const copy of [SUPPORT_LINK_FAILED_TITLE, SUPPORT_LINK_FAILED_MESSAGE]) {
      expect(copy).not.toContain("다시 시도");
      expect(copy).not.toContain("잠시 후");
      expect(copy).not.toMatch(/확인하세요|확인해 주세요|하십시오|오류|에러|error/i);
      expect(copy, "앱이 알 수 없는 원인").not.toContain("브라우저");
      expect(copy).toMatch(/요$|요\.$/);
    }
    // 종전 문장은 저장소 어디에도 남지 않는다.
    expect(source("src/settings/support-links.ts")).not.toMatch(
      /=\s*"잠시 후 다시 시도해 주세요\."/
    );
  });
});

/**
 * 목록·라벨은 `more-menu.ts` **한 곳**에서 오고, 더보기 탭과 설정 화면이 **같은 표**를 읽는다
 * (react-native 화면은 vitest에서 렌더할 수 없어 소스 그렙으로 배선을 고정한다 --
 * export-flow/import-flow 테스트와 같은 관례).
 */
describe("두 화면이 같은 표를 읽는다 (source contract)", () => {
  it("더보기 탭은 세션 메뉴 한 벌에서 행을 받고, 그 안에 지원 행이 섞여 온다", () => {
    const moreSource = source("app/(tabs)/more.tsx");
    expect(moreSource).toContain("buildMoreSessionMenuRows({ exportTitle: EXPORT_MENU_TITLE, appLockEnabled })");
    expect(moreSource).toContain("const externalUrl = row.externalUrl;");
    expect(moreSource).toContain("? () => openSupportLink(externalUrl)");
    // 행 이름을 화면이 다시 적지 않는다.
    for (const { title } of Object.values(SUPPORT_LINK_LABELS)) {
      expect(moreSource, `더보기가 다시 적은 라벨: ${title}`).not.toContain(title);
    }
  });

  it("설정 화면은 같은 목록 함수를 읽고 행 이름 · 부제를 다시 적지 않는다", () => {
    const settingsSource = source("app/settings/index.tsx");
    expect(settingsSource).toContain('import { buildSupportMenuRows } from "../../src/settings/more-menu";');
    expect(settingsSource).toContain("const supportRows = buildSupportMenuRows();");
    expect(settingsSource).toContain("{supportRows.map((row) => (");
    expect(settingsSource).toContain("title={row.title}");
    expect(settingsSource).toContain("subtitle={row.subtitle}");
    expect(settingsSource).toContain("onPress={() => openSupportLink(row.url)}");
    for (const { title, subtitle } of Object.values(SUPPORT_LINK_LABELS)) {
      expect(settingsSource, `설정이 다시 적은 라벨: ${title}`).not.toContain(title);
      expect(settingsSource, `설정이 다시 적은 부제: ${subtitle}`).not.toContain(subtitle);
    }
  });

  /**
   * 라운드 71 리뷰 S-2 — 여는 규칙이 화면마다 한 벌씩(셋)이던 것을 `src/settings/open-external-url.ts`
   * 한 곳으로 합쳤다. 계약이 지키는 사실은 그대로다(인앱 웹뷰 0건 · 조용한 실패 0건). 다만 그
   * 사실을 확인하는 자리가 옮겨졌으므로, 규칙은 그 모듈에서 보고 화면에서는 **넘기는 문구**를 본다.
   */
  it("여는 방법은 Linking.openURL 하나이고, 열기 실패를 조용히 넘기지 않는다", () => {
    const opener = source("src/settings/open-external-url.ts");
    expect(opener).toContain("const canOpen = await Linking.canOpenURL(url);");
    expect(opener).toContain("await Linking.openURL(url);");
    expect(opener).toContain("Alert.alert(failTitle, failMessage);");
    // 규칙 모듈은 문장을 만들지 않는다 — 문구는 언제나 화면이 넘긴 단일 소스 상수다.
    expect(opener).not.toContain(SUPPORT_LINK_FAILED_TITLE);
    expect(opener).not.toContain(SUPPORT_LINK_FAILED_MESSAGE);

    for (const relativePath of ["app/(tabs)/more.tsx", "app/settings/index.tsx"]) {
      const screenSource = source(relativePath);
      expect(screenSource, relativePath).toContain('import { openExternalUrl } from "../../src/settings/open-external-url";');
      expect(screenSource, relativePath).toContain(
        "openExternalUrl(url, { failTitle: SUPPORT_LINK_FAILED_TITLE, failMessage: SUPPORT_LINK_FAILED_MESSAGE });"
      );
      // 화면에 재구현이 남지 않는다(세 벌은 갈릴 때까지만 같다).
      expect(screenSource, relativePath).not.toContain("Linking.canOpenURL");
      expect(screenSource, relativePath).not.toContain("Linking.openURL");
      // 문구도 단일 소스에서 온다(화면이 다시 적지 않는다).
      expect(screenSource, relativePath).not.toContain(SUPPORT_LINK_FAILED_TITLE);
      expect(screenSource, relativePath).not.toContain(SUPPORT_LINK_FAILED_MESSAGE);
      // 앱 안 라우트로 위장해 보내지 않는다(예전 "고객센터"→/settings/privacy가 그 실수였다).
      expect(screenSource, relativePath).not.toContain('router.push("/support")');
      expect(screenSource, relativePath).not.toContain('router.push("/faq")');
    }
  });

  it("⚠️ 하단 탭 구성은 그대로다(DNC-003) -- 새 행은 더보기 목록 · 설정 화면 안이다", () => {
    const tabsSource = source("app/(tabs)/_layout.tsx");
    for (const forbidden of ["support", "faq", "지원", "도움"]) {
      expect(tabsSource, `탭에 ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("infra의 지원 페이지는 이 트랙이 손대지 않는다(앱은 가리키기만 한다)", () => {
    // 문서 본문은 저장소의 그 파일이 단일 소스다 -- 앱이 복사하면 개정할 때 두 벌이 갈린다.
    const repoRoot = join(mobileRoot, "..", "..");
    for (const relativePath of ["infra/site/support.html", "infra/site/faq.html"]) {
      expect(readFileSync(join(repoRoot, relativePath), "utf8").length).toBeGreaterThan(0);
    }
  });
});
