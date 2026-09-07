import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { adaptiveTabBarHeight } from "./responsive";
import { typography } from "./tokens/typography";

/**
 * 이 파일은 **두 개의 서로 다른 주장**을 각각 오라클로 고정한다.
 *
 * ① 금액 타이포(`amountLarge/Medium/Regular`)의 숫자 `lineHeight`가 OS 글꼴 배율을 **안 따라간다**는
 *    주장 → **거짓이다.** react-native 0.76.9는 iOS(구·신 아키텍처 둘 다)와 Android 양쪽에서 숫자
 *    `lineHeight`에 글꼴 배율을 곱한다. 그래서 토큰은 손대지 않는다. 손대면(토큰 쪽에서 배율을 한 번
 *    더 곱하면) 플랫폼이 곱하는 배율과 겹쳐 **이중 배율**이 된다 — 배율 2.0에서 줄상자가 38 → 76이
 *    아니라 152가 되어, 지금은 멀쩡한 금액 행들이 그때 처음 깨진다.
 *
 * ② 탭바 높이가 배율을 안 따라간다는 주장 → **참이다.** `tabBarStyle.height`는 숫자 dp라 배율과
 *    무관하고, 그 안의 라벨(10)만 커진다. 그래서 이쪽만 배선한다.
 *
 * ①은 "우리 코드"가 아니라 **설치된 react-native의 네이티브 소스**가 근거이므로, RN을 올릴 때 그
 * 전제가 바뀌면 여기가 빨개지도록 소스를 직접 읽는다(사람이 옮겨 적은 값이 아니다).
 */
const require_ = createRequire(import.meta.url);
const reactNativeRoot = dirname(require_.resolve("react-native/package.json"));
const mobileRoot = process.cwd();

function readReactNativeSource(relativePath: string): string {
  const filePath = join(reactNativeRoot, relativePath);
  expect(existsSync(filePath), `react-native/${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

function readAppSource(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

/** 정찰이 "숫자 lineHeight는 배율을 안 탄다"고 적은 전제를 설치된 RN에서 다시 잰다. */
describe("A11Y-TYPO-001 재실측: 숫자 lineHeight는 이미 OS 글꼴 배율을 탄다", () => {
  it("설치된 react-native가 0.76.9다 (아래 네이티브 소스 인용의 사정거리)", () => {
    const manifest = JSON.parse(readReactNativeSource("package.json")) as { version: string };
    expect(manifest.version).toBe("0.76.9");
  });

  it("iOS 구 아키텍처(Paper)가 lineHeight에 effectiveFontSizeMultiplier를 곱한다", () => {
    const source = readReactNativeSource("Libraries/Text/RCTTextAttributes.mm");
    expect(source).toContain("CGFloat lineHeight = _lineHeight * self.effectiveFontSizeMultiplier;");
    expect(source).toContain("paragraphStyle.minimumLineHeight = lineHeight;");
    expect(source).toContain("paragraphStyle.maximumLineHeight = lineHeight;");
    // 같은 배수가 maxFontSizeMultiplier 상한도 함께 통과한다 — 즉 상한을 건 5곳(달력 3 · 차트 축 2)도
    // fontSize와 lineHeight가 같은 배수로 묶여 어긋나지 않는다.
    expect(source).toContain("fminf(maxFontSizeMultiplier, fontSizeMultiplier)");
  });

  it("iOS 신 아키텍처(Fabric)도 같은 곱셈을 한다", () => {
    const source = readReactNativeSource(
      "ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/RCTAttributedTextUtils.mm"
    );
    expect(source).toContain(
      "CGFloat lineHeight = textAttributes.lineHeight * RCTEffectiveFontSizeMultiplierFromTextAttributes(textAttributes);"
    );
  });

  it("Android는 lineHeight를 SP로 변환한다 — SP가 곧 dp × fontScale이다", () => {
    const paper = readReactNativeSource(
      "ReactAndroid/src/main/java/com/facebook/react/views/text/TextAttributeProps.java"
    );
    // allowFontScaling(기본 true)이면 SP, 끄면 DIP. 이 앱은 끄는 곳이 0곳이므로 항상 SP 갈래다.
    expect(paper).toContain("? PixelUtil.toPixelFromSP(lineHeight)");
    expect(paper).toContain(": PixelUtil.toPixelFromDIP(lineHeight);");

    const fabric = readReactNativeSource(
      "ReactAndroid/src/main/java/com/facebook/react/views/text/TextAttributes.java"
    );
    expect(fabric).toContain("public float getEffectiveLineHeight()");
    expect(fabric).toContain("? PixelUtil.toPixelFromSP(mLineHeight, getEffectiveMaxFontSizeMultiplier())");

    // SP → PX 변환이 실제로 사용자 글꼴 배율을 타는 지점(안 그러면 위 두 인용이 무의미하다).
    const pixelUtil = readReactNativeSource(
      "ReactAndroid/src/main/java/com/facebook/react/uimanager/PixelUtil.kt"
    );
    expect(pixelUtil).toContain("TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, displayMetrics)");
  });

  /**
   * 두 시점 기록. 종전(그리고 지금도) 금액 3티어는 아래 리터럴이다 — `design-system-restore.test.ts`가
   * 같은 값을 지키고 있고, 이 파일은 "**왜 안 바꿨는지**"를 함께 남긴다. 배율은 플랫폼이 곱하므로
   * 비율(줄상자 ÷ 글자)은 어느 배율에서도 그대로다: 배율 2.0에서 amountLarge는 64/76이지 64/38이 아니다.
   */
  it("금액 3티어는 종전 리터럴 그대로 남는다 (배율은 플랫폼이 곱한다)", () => {
    expect(typography.amountLarge.fontSize).toBe(32);
    expect(typography.amountLarge.lineHeight).toBe(38);
    expect(typography.amountMedium.fontSize).toBe(24);
    expect(typography.amountMedium.lineHeight).toBe(30);
    expect(typography.amountRegular.fontSize).toBe(18);
    expect(typography.amountRegular.lineHeight).toBe(24);

    // 토큰은 **정적 객체**로 남는다. 실측(비테스트 소스 40개 파일): `lineHeight:` 선언 164건 중
    // 145건이 숫자 리터럴(이 토큰 파일 13 + 화면·컴포넌트 132)이고 19건이 토큰 참조다. 훅/게터로
    // 바꾸면 그 소비자 전부가 바뀌어야 하는데, 위 네 인용이 "바꿀 이유 자체가 없다"를 말하고 있다.
    expect(typeof typography.amountLarge).toBe("object");
    expect(typeof typography.amountLarge.lineHeight).toBe("number");
  });
});

/**
 * 탭바 쪽은 정찰의 전제가 참이다: `tabBarStyle.height`는 숫자 dp고 배율을 타지 않는데, 그 안의
 * 라벨만 커진다. 배선의 안전 근거는 딱 하나 — **배율 1.0에서 값이 종전과 정확히 같다**는 것이다.
 *
 * 남는 자리 계산(라이브러리 리터럴은 @react-navigation/bottom-tabs 7.18.7에서 읽었다. 이 패키지는
 * expo-router의 전이 의존이라 apps/mobile에서 resolve되지 않아 테스트로 못 박지 못한다 — 버전을
 * 올릴 때 아래 두 값을 다시 확인해야 한다):
 *   콘텐츠 칸        = 72 − paddingTop 8 − paddingBottom 10 = 54dp
 *   탭 한 칸 안쪽    = 54 − padding 5 × 2 (`styles.tabVerticalUiKit`) = 44dp
 *   아이콘 래퍼 고정 = 28dp (`TabBarIcon.tsx`의 `ICON_SIZE_TALL`)
 *   라벨에 남는 자리 = 44 − 28 = 16dp
 * 라벨은 fontSize 10에 lineHeight 미지정이라 폰트 기본 줄높이(SF/Roboto 약 1.2배 → 12dp)를 쓰고,
 * 12 × 배율 > 16 즉 **배율 약 1.33**에서 16dp를 넘어선다. 실기기 확인은 아직 없다(이 값은 계산이다).
 */
describe("A11Y-TAB-001: 탭바 높이가 글꼴 배율을 따라간다", () => {
  it("배율 1.0에서 픽셀락 값 72가 한 치도 안 움직인다 (캡처 재대조 불필요)", () => {
    // 세 개의 독립한 리터럴 사실: ① 픽셀락 파일이 72다 ② 함수가 배율 1에서 항등이다 ③ 둘의 합성이 72다.
    const pixelLockSource = readAppSource("src/pixelLock/styles/BottomTabPixelStyles.ts");
    expect(pixelLockSource).toContain('pixelNumber("TAB-001", "height", 72)');
    expect(pixelLockSource).toContain('pixelNumber("TAB-001", "paddingTop", 8)');
    expect(pixelLockSource).toContain('pixelNumber("TAB-001", "paddingBottom", 10)');
    expect(pixelLockSource).toContain('pixelNumber("TAB-001", "iconSize", 19)');
    expect(pixelLockSource).toContain('pixelNumber("TAB-001", "labelSize", 10)');

    expect(adaptiveTabBarHeight(72, 1)).toBe(72);
    // 배율 1은 항등이다 — 기준값이 무엇이든(픽셀락 override가 72를 바꿔도) 캡처는 안 흔들린다.
    expect(adaptiveTabBarHeight(64, 1)).toBe(64);
    expect(adaptiveTabBarHeight(80, 1)).toBe(80);
  });

  it("배율이 오를 때만 자라고 2.0에서 상한(+24)에 닿는다", () => {
    expect(adaptiveTabBarHeight(72, 1.15)).toBeCloseTo(75.6, 10);
    expect(adaptiveTabBarHeight(72, 1.35)).toBeCloseTo(80.4, 10);
    expect(adaptiveTabBarHeight(72, 1.5)).toBe(84);
    expect(adaptiveTabBarHeight(72, 2)).toBe(96);
    expect(adaptiveTabBarHeight(72, 3.12)).toBe(96);
    // 배율 1 미만(축소 설정)에서도 종전보다 작아지지 않는다 — 아이콘 28dp는 배율을 안 타기 때문이다.
    expect(adaptiveTabBarHeight(72, 0.85)).toBe(72);
  });

  it("라벨이 배율 1.33쯤 넘어설 16dp를, 자란 높이가 다시 덮는다", () => {
    // 자란 높이에서 라벨에 남는 자리 = height − 8 − 10 − 5 × 2 − 28.
    function labelHeadroom(fontScale: number) {
      return adaptiveTabBarHeight(72, fontScale) - 8 - 10 - 5 * 2 - 28;
    }
    // 폰트 기본 줄높이 ≈ fontSize 10 × 1.2 = 12dp가 배율을 탄다.
    function labelNeeds(fontScale: number) {
      return 12 * fontScale;
    }
    expect(labelHeadroom(1)).toBe(16);
    expect(labelNeeds(1)).toBe(12);
    for (const fontScale of [1, 1.15, 1.3, 1.5, 1.8, 2, 3.12]) {
      expect(labelHeadroom(fontScale)).toBeGreaterThan(labelNeeds(fontScale));
    }
    // 종전(고정 72)은 배율 1.35부터 이미 모자랐다 — 이 배선이 닫은 구멍이다.
    expect(16).toBeLessThan(labelNeeds(1.35));
  });

  it("탭바가 실제로 그 함수를 통해 높이를 정한다 (형제 함수와 달리 배선이 있다)", () => {
    const layout = readAppSource("app/(tabs)/_layout.tsx");
    expect(layout).toContain('import { adaptiveTabBarHeight } from "../../src/design-system/responsive";');
    expect(layout).toContain('import { useWindowDimensions } from "react-native";');
    expect(layout).toContain("const { fontScale } = useWindowDimensions();");
    expect(layout).toContain("height: adaptiveTabBarHeight(BottomTabPixelStyles.height, fontScale),");
    expect(layout).not.toContain("height: BottomTabPixelStyles.height,");

    // FIX-A: 훅은 early return(Redirect)보다 위다.
    const hookAt = layout.indexOf("const { fontScale } = useWindowDimensions();");
    const firstRedirectAt = layout.indexOf("return <Redirect");
    expect(hookAt).toBeGreaterThan(-1);
    expect(firstRedirectAt).toBeGreaterThan(-1);
    expect(hookAt).toBeLessThan(firstRedirectAt);
  });

  it("아이콘 글리프는 배율을 타지 않는다 — 라벨만 커진다는 전제의 근거", () => {
    const createIconSet = readFileSync(
      require_.resolve("@expo/vector-icons/build/vendor/react-native-vector-icons/lib/create-icon-set.js"),
      "utf8"
    );
    expect(createIconSet).toContain("allowFontScaling: false");
  });
});
