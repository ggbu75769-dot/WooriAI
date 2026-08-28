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

  it("열지 못한 링크는 조용히 실패하지 않는다", () => {
    expect(loginSource).toContain("약관을 열지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(loginSource).toContain("const canOpen = await Linking.canOpenURL(url);");
  });
});
