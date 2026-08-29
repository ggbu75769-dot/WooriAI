import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  legalDocumentUrl,
  legalDocumentUrls,
  legalKindForConsentType,
  normalizeLegalDocumentUrl
} from "./legal-links";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const originalTerms = process.env.EXPO_PUBLIC_TERMS_URL;
const originalPrivacy = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;

function setEnv(key: "EXPO_PUBLIC_TERMS_URL" | "EXPO_PUBLIC_PRIVACY_POLICY_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  setEnv("EXPO_PUBLIC_TERMS_URL", originalTerms);
  setEnv("EXPO_PUBLIC_PRIVACY_POLICY_URL", originalPrivacy);
});

/**
 * 라운드 65 B(#5): 사용자는 **읽을 수 없는 문서에 필수 동의**를 하고 앱을 시작했다. 문서 호스팅
 * URL은 사용자 자산이라 이 라운드가 만들 수 없으므로, 푸시 토글과 같은 관례를 쓴다 -- 값이
 * 주입된 빌드에만 링크가 생기고, 없으면 화면이 종전과 한 글자도 다르지 않다.
 */
describe("약관 링크 (env가 있을 때만 그린다)", () => {
  it("값이 없으면 링크가 없다 -- 화면은 종전 그대로다", () => {
    setEnv("EXPO_PUBLIC_TERMS_URL", undefined);
    setEnv("EXPO_PUBLIC_PRIVACY_POLICY_URL", undefined);
    expect(legalDocumentUrls()).toEqual({ terms: null, privacy: null });
    expect(legalDocumentUrl("terms")).toBeNull();
  });

  it("주입된 값은 그대로 쓴다", () => {
    setEnv("EXPO_PUBLIC_TERMS_URL", "https://wooriai.example.com/terms-of-service.html");
    setEnv("EXPO_PUBLIC_PRIVACY_POLICY_URL", "https://wooriai.example.com/privacy-policy.html");
    expect(legalDocumentUrls()).toEqual({
      terms: "https://wooriai.example.com/terms-of-service.html",
      privacy: "https://wooriai.example.com/privacy-policy.html"
    });
  });

  it("열 수 없는 값은 링크로 인정하지 않는다(죽은 링크를 그리지 않는다)", () => {
    for (const raw of ["", "   ", "그때 알려드릴게요", "javascript:alert(1)", "wooriai://terms", "example.com/terms"]) {
      expect(normalizeLegalDocumentUrl(raw)).toBeNull();
    }
    expect(normalizeLegalDocumentUrl(undefined)).toBeNull();
    expect(normalizeLegalDocumentUrl(null)).toBeNull();
    // 앞뒤 공백은 주입 실수라 잘라 낸다.
    expect(normalizeLegalDocumentUrl("  https://a.example/terms.html  ")).toBe("https://a.example/terms.html");
    // 자체 호스팅 중인 스테이징(http)도 열리기는 한다.
    expect(normalizeLegalDocumentUrl("http://10.0.2.2:8080/terms.html")).toBe("http://10.0.2.2:8080/terms.html");
  });

  it("읽을 문서가 있는 동의 항목만 링크를 갖는다", () => {
    expect(legalKindForConsentType("terms")).toBe("terms");
    expect(legalKindForConsentType("privacy")).toBe("privacy");
    // marketing(소식 알림 동의)에는 읽을 문서가 없다 -- 링크가 생기지 않는다.
    expect(legalKindForConsentType("marketing")).toBeNull();
    expect(legalKindForConsentType(null)).toBeNull();
    expect(legalKindForConsentType(undefined)).toBeNull();
  });

  it("EXPO_PUBLIC_* 는 리터럴 멤버 표현식으로 읽는다(babel이 번들 시점에 인라인한다)", () => {
    const linksSource = source("src/consent/legal-links.ts");
    expect(linksSource).toContain("process.env.EXPO_PUBLIC_TERMS_URL");
    expect(linksSource).toContain("process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL");
    // 동적 접근(process.env[key])은 번들에서 값이 사라진다.
    expect(linksSource).not.toMatch(/process\.env\[/);
  });

  it("약관 본문을 앱 번들에 복사하지 않는다(infra/legal/*.html이 단일 소스)", () => {
    const linksSource = source("src/consent/legal-links.ts");
    expect(linksSource).not.toContain("<html");
    expect(linksSource).not.toContain("react-native-webview");
  });
});

describe("로그인 화면의 약관 링크 (source contract)", () => {
  const loginSource = source("app/(auth)/login.tsx");

  it("필수 동의 두 줄에만 문서 링크를 붙인다", () => {
    expect(loginSource).toContain("const legalUrls = legalDocumentUrls();");
    expect(loginSource).toContain("documentUrl={legalUrls.terms}");
    expect(loginSource).toContain("documentUrl={legalUrls.privacy}");
    // 선택(통계) 동의에는 읽을 문서가 없으므로 링크도 없다.
    const analyticsLabel = loginSource.indexOf('label="익명 사용 통계 수집 동의"');
    const analyticsRow = loginSource.slice(
      loginSource.lastIndexOf("<ConsentRow", analyticsLabel),
      loginSource.indexOf("/>", analyticsLabel)
    );
    expect(analyticsRow).not.toContain("documentUrl=");
  });

  it("URL이 없으면 링크도, 감싸는 View도 만들지 않는다", () => {
    expect(loginSource).toContain("if (!documentUrl) return row;");
    expect(loginSource).toContain('accessibilityLabel={`${label} 전문 보기`}');
  });

  /**
   * 라운드 72 트랙 E(#5ⓑ) — **여는 규칙은 이 화면이 다시 적지 않는다.**
   *
   * 라운드 71 리뷰 S-2가 `openExternalUrl` 한 벌로 모은 화면은 셋이었고(더보기·설정·개인정보),
   * 이 화면에 **넷째 사본**이 남아 있었다.
   *
   * ⚠️ 라운드 72 리뷰 M-1 정정: 종전 이 머리말은 "다른 셋은 재시도를 권하지 않는데 이 사본만
   * '잠시 후 다시 시도해 주세요'라고 말했다"고 적었는데 **거짓이었다.** 네 자리가 전부 그렇게
   * 말하고 있었다(`SUPPORT_LINK_FAILED_MESSAGE` · privacy 화면의 `LEGAL_LINK_FAILED_MESSAGE` ·
   * 이 화면의 상수). 사본이 갈린 자리가 문구였던 것이 아니라, 넷이 **같은 잘못을 함께** 하고
   * 있었다 — 여기서 실패하는 이유(열 브라우저 없음 · 잘못된 주소)는 **기다려서 풀리지 않는다.**
   * 네 자리 전부의 부정 단언은 `src/shared-decision-wiring.test.ts` ⓐ-2가 진다.
   */
  it("열지 못한 링크는 조용히 실패하지 않고, 여는 규칙은 공용 한 벌에서 온다", () => {
    expect(loginSource).toContain('import { openExternalUrl } from "../../src/settings/open-external-url";');
    expect(loginSource).toContain(
      "openExternalUrl(url, { failTitle: LEGAL_DOCUMENT_OPEN_FAILED_TITLE, failMessage: LEGAL_DOCUMENT_OPEN_FAILED_MESSAGE });"
    );
    // 문구는 여전히 **이 화면의 상수**다(규칙 모듈은 문장을 만들지 않는다).
    expect(loginSource).toContain('const LEGAL_DOCUMENT_OPEN_FAILED_TITLE = "약관을 열지 못했어요";');
    expect(loginSource).toMatch(/const LEGAL_DOCUMENT_OPEN_FAILED_MESSAGE = "[^"]+";/);
    // 재구현이 남지 않는다.
    expect(loginSource).not.toContain("Linking.canOpenURL");
    expect(loginSource).not.toContain("Linking.openURL");
  });

  /**
   * 부정 단언 — 다시 눌러도 같은 답이 오는 실패에 **재시도를 권하지 않는다**(라운드 70 B가
   * 저장 실패에서, 라운드 71 A가 가져오기 실패에서 세운 그 규율). 해요체(DNC-018)도 함께 본다.
   *
   * 라운드 72 리뷰 S-6 — **원인 단정도 함께 막는다.** `canOpenURL`이 false인 경우와 `openURL`이
   * 던지는 경우가 규칙 모듈의 **같은 `catch`**로 들어오므로, 이 자리에서 "브라우저가 없다"고
   * 말하면 잘못된 주소로 실패한 사람에게 틀린 사실을 말하게 된다.
   */
  it("링크 실패 문구에 '다시 시도'도, 원인 단정도 없다", () => {
    const failureCopy = [
      loginSource.match(/const LEGAL_DOCUMENT_OPEN_FAILED_TITLE = "([^"]+)";/)?.[1],
      loginSource.match(/const LEGAL_DOCUMENT_OPEN_FAILED_MESSAGE = "([^"]+)";/)?.[1]
    ];
    for (const copy of failureCopy) {
      expect(copy, "실패 문구 상수를 찾지 못했다").toBeTruthy();
      expect(copy).not.toContain("다시 시도");
      expect(copy).not.toContain("잠시 후");
      expect(copy).not.toMatch(/확인하세요|확인해 주세요|하십시오|오류|에러|error/i);
      // 앱이 알 수 없는 원인을 단정하지 않는다(두 실패가 같은 catch로 들어온다).
      expect(copy).not.toContain("브라우저");
      expect(copy).toMatch(/요$|요\.$/);
    }
    // 종전 문장은 **코드**로 남지 않는다(머리말이 옛 문장을 이력으로 인용하는 것과, 상수가
    // 그 문장을 정의하는 것은 다르다 — 그래서 주석을 걷어내고 본다).
    const renderedLogin = loginSource
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    expect(renderedLogin).not.toContain("약관을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(renderedLogin).not.toContain("이 기기에서 열 수 있는 브라우저를 찾지 못했어요.");
  });

  /**
   * ⚠️ 이 트랙은 링크 열기 한 벌만 만진다 — 로그인 성공·실패·카카오·테스트 로그인 갈래는
   * 한 글자도 바뀌지 않는다(그 갈래들은 후보 1도 이 파일도 열지 않는다).
   */
  it("로그인 성공·실패·카카오·테스트 분기는 무변경이다", () => {
    for (const line of [
      "const result = isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin(\"kakao\");",
      "if (error instanceof KakaoLoginCancelledError) return;",
      "const accountStatusMessage = accountStatusErrorMessage(error);",
      '? "로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요."',
      ': "서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요."',
      "await upsertConsents(result.tokens.accessToken).catch(() => undefined);",
      'router.replace(inviteResumeHref ?? "/onboarding/child-status");',
      "startTestSession();",
      'router.replace(inviteResumeHref ?? "/");'
    ]) {
      expect(loginSource, line).toContain(line);
    }
  });
});
