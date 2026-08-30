import type React from "react";
import { useEffect, useState } from "react";
import type { ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from "react-native";
import { AccessibilityInfo, Image, Pressable, ScrollView, Text, View } from "react-native";
import { lineChartSegmentsFor, normalizeLineChartPoints } from "./lineChartMath";
import { formatKrw } from "./money";
import { computeCategoryShares } from "./reports/category-share";
import type { CategoryShareSlice } from "./reports/category-share";
import type { TrendPointLabels } from "./reports/trend-point-labels";
import { theme } from "./theme";

type ChildrenProps = {
  children: React.ReactNode;
};

/**
 * A11Y-117: contrast token for *small* coral text on light backgrounds. coral[500] (#EF6644) on
 * white is 3.16:1 -- below the WCAG AA 4.5:1 floor for text under 18pt/14pt-bold. coral[700]
 * (#B93E23) reaches 5.56:1 on white, so small coral text (eyebrows, prices, deltas, text buttons,
 * inline banners) uses this instead.
 *
 * Deliberately NOT applied to white-text-on-coral brand surfaces (PrimaryButton,
 * HeroSummaryCard, selected SegmentedControl/CategoryChip fills, FloatingActionButton): darkening
 * those fills changes the brand look across every screen and pixel-lock reference, so that subset
 * is on hold pending a design decision -- see A11Y-117.
 */
const smallCoralText = theme.colors.coral[700];

type PressableProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A11Y-101: override for TalkBack when the visible label alone is not descriptive enough. */
  accessibilityLabel?: string;
};

/**
 * A11Y-115: shared TalkBack/VoiceOver announce helper. AccessibilityInfo can be missing or
 * partially implemented outside a native runtime (web preview, vitest), so failures are
 * swallowed -- announcing is always best-effort and must never break the render path.
 */
export function announceForA11y(message: string) {
  try {
    AccessibilityInfo.announceForAccessibility?.(message);
  } catch {
    // non-native environment -- nothing to announce to
  }
}

const pixelLockWebStyleId = "wooriai-pixel-lock-web-styles";
const webScrollHiddenStyle = {
  msOverflowStyle: "none",
  scrollbarWidth: "none"
} as unknown as ViewStyle;

function ensurePixelLockWebStyles() {
  if (typeof document === "undefined" || document.getElementById(pixelLockWebStyleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = pixelLockWebStyleId;
  style.textContent = `
    html, body, #root {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root::-webkit-scrollbar,
    div::-webkit-scrollbar {
      display: none;
      height: 0;
      width: 0;
    }
  `;
  document.head.appendChild(style);
}

// MOB-117: optional pass-through so screens can attach pull-to-refresh without restructuring
// away from AppScreen (records.tsx is the exception -- its screen scroller is a FlatList per
// PERF-102, so it takes the same element via the FlatList refreshControl prop instead).
/**
 * GAP-065 #6 — `keyboardShouldPersistTaps="handled"`.
 *
 * 이 ScrollView는 앱 거의 전 화면의 스크롤러다. RN 기본값은 `"never"`이고, 그 뜻은 **키보드가
 * 떠 있는 동안의 첫 탭은 자식에게 가지 않고 키보드만 내린다**는 것이다. 그래서 금액을 치고
 * (키보드) 카테고리 타일·칩·체크박스를 누르면 첫 탭이 통째로 먹히고, 사용자에게는 "눌렀는데
 * 반응이 없다"로 보인다. 저장소는 그 비용을 이미 알고 있었다 — 판매처 자동완성 칩을 blur에서
 * 접지 않는 이유가 통째로 그 설명이다(app/expenses/new.tsx의 `merchantFocused` 주석).
 * 이식된 스캐폴드(src/design-system/components/ScreenScaffold.tsx)는 이미 `"handled"`다.
 *
 * `"always"`가 아니라 `"handled"`인 이유: `"always"`면 빈 자리를 눌러도 키보드가 내려가지 않아
 * "닫는 법을 모르겠다"가 새로 생긴다. `"handled"`는 **자식이 처리한 탭만** 통과시키므로 빈
 * 자리를 누르면 종전처럼 키보드가 내려간다.
 *
 * 렌더는 한 픽셀도 바뀌지 않는다 — 레이아웃 속성이 아니라 터치 전달 규칙이므로
 * EXP-001·HOME-001·REP-001·ITEM-001·IMP-003·SET-001 픽셀락 기준선이 이 변경으로 흔들리지 않는다.
 */
export function AppScreen({ children, refreshControl }: ChildrenProps & { refreshControl?: React.ReactElement }) {
  ensurePixelLockWebStyles();

  return (
    <ScrollView
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={[{ backgroundColor: theme.colors.background, flex: 1 }, webScrollHiddenStyle]}
      contentContainerStyle={{
        backgroundColor: theme.colors.background,
        flexGrow: 1,
        gap: theme.spacing.section,
        padding: theme.spacing.screen
      }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * UX-Q(C): `onBack`은 **옵셔널**이다.
 *
 * 앱 전역이 `headerShown: false`라 스택 화면에는 OS 헤더가 없고, ScreenHeader에도 되돌아가는
 * 슬롯이 없었다 — 설정 하위 4화면·지출 수정·가족 초대·가져오기 진행 상황은 안드로이드 시스템
 * 뒤로가기 말고는 나가는 길이 화면 안에 없었다(iOS엔 그것마저 없다).
 *
 * 표기는 새로 만들지 않고 app/family/index.tsx의 기존 관례를 그대로 재사용한다:
 * ‹ 글리프 · 44dp 터치 타깃 · accessibilityLabel "뒤로가기".
 *
 * 픽셀락 주의: `onBack`을 넘기지 않은 화면(HOME/EXP/ITEM/REP/FAM/IMP/SET 캡처가 지나가는 곳들)은
 * 렌더 트리가 예전과 한 노드도 달라지지 않아야 한다. 그래서 "비활성 Pressable을 투명하게
 * 숨겨 두는" 방식이 아니라, 조건부로 **Pressable 자체를 만들지 않는다**(아래 `null` 분기는
 * 이미 같은 자리에 있던 `{action}`과 마찬가지로 노드를 낳지 않는다).
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  onBack
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
      {onBack ? (
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={screenHeaderBackButtonStyle}
        >
          <Text style={screenHeaderBackGlyphStyle}>‹</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text style={[textStyles.caption, { color: smallCoralText }]}>{eyebrow}</Text> : null}
        <Text style={[textStyles.h2, { color: theme.colors.brown }]}>{title}</Text>
        {subtitle ? <Text style={[textStyles.body2, { color: theme.colors.gray600 }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

// 44dp 정사각 터치 타깃(theme.touchTarget). alignSelf로 제목 줄 위쪽에 붙여, 부제까지 있는
// 헤더에서도 화살표가 세로 가운데로 떠내려가지 않게 한다. marginLeft 음수로 화살표의 좌측
// 여백을 상쇄해 글리프가 화면 콘텐츠 왼쪽 정렬선에 맞는다.
const screenHeaderBackButtonStyle = {
  alignItems: "center",
  alignSelf: "flex-start",
  height: theme.touchTarget,
  justifyContent: "center",
  marginLeft: -12,
  width: theme.touchTarget
} as const;

const screenHeaderBackGlyphStyle = {
  color: theme.colors.gray900,
  fontSize: 24,
  fontWeight: "900"
} as const;

// CLN-130: `BrandLogo`는 어느 화면도 렌더하지 않는 죽은 export였다(런치 화면은 자체
// 애니메이션 마크를 그린다 -- ui-pixel-lock-flow.test.ts의 `not.toContain("<BrandLogo")` 참고).

export function Card({ children, style }: ChildrenProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.white,
          borderColor: "rgba(74, 63, 53, 0.08)",
          borderRadius: theme.radii.card,
          borderWidth: 1,
          gap: 10,
          padding: theme.spacing.card,
          ...theme.shadows.card
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, style, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: disabled ? theme.colors.gray300 : theme.colors.mainCoral,
          borderRadius: theme.radii.button,
          height: theme.ctaHeight,
          justifyContent: "center",
          opacity: pressed ? 0.86 : 1
        },
        style
      ]}
    >
      <Text style={{ color: theme.colors.white, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, style, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: "center",
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.primary100,
          borderRadius: theme.radii.button,
          borderWidth: 1,
          minHeight: theme.touchTarget,
          justifyContent: "center",
          opacity: pressed ? 0.82 : 1,
          paddingHorizontal: 16
        },
        style
      ]}
    >
      <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress, disabled, style, accessibilityLabel }: PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[{ minHeight: theme.touchTarget, justifyContent: "center" }, style]}
    >
      <Text style={{ color: disabled ? theme.colors.gray300 : smallCoralText, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

// CLN-130: `InputField`는 값을 표시만 하는 읽기 전용 목업이었고 어느 화면도 쓰지 않았다
// -- 실제 입력은 각 화면이 react-native TextInput을 직접 쓴다.

/**
 * GAP-065 #7 — **공유 프리미티브의 히트 영역**. 라운드 64 #6이 화면 파일 안의 인라인 칩·크롬을
 * 48dp로 올렸지만, 같은 값(44)으로 서 있던 **공유 컴포넌트**는 그 계약이 읽지 않는 자리라
 * 그대로 남아 있었다 — 그래서 새 화면이 하나 생길 때마다 44dp 컨트롤이 자동으로 따라 태어난다.
 *
 * 규율은 라운드 64와 같다.
 *  ① 레이아웃 속성은 **한 개도** 건드리지 않는다(`minHeight`·`padding`·`gap`·`height` 무접촉).
 *     `hitSlop`은 렌더가 아니라 터치 전달 규칙이라 픽셀락 6종이 전부 불변이다.
 *  ② 넓히는 것은 **빈 자리뿐**이다 — 늘린 히트 영역이 이웃 컨트롤의 **몸(보이는 픽셀)**에
 *     닿으면 "옆 것이 눌리는" 오탭을 새로 만든다. 그건 지금보다 나쁘다.
 *  ③ 그래서 축마다 **인접 간격을 실측하고** 그 안에서만 갚는다(아래 각 상수의 근거 참고).
 *
 * 남는 한계도 적어 둔다: `hitSlop`은 **조상 뷰의 경계 안에서만** 유효하다(RN은 부모 바깥의
 * 좌표를 자식에게 내려보내지 않는다). 줄 높이가 칩 높이와 같은 한 줄짜리 칩 행에서는 위아래로
 * 넓힌 만큼이 부모 밖이라 실효가 없을 수 있다 — 근본 해법은 `minHeight`를 48로 올리는 것이고,
 * 그건 승인 디자인(DSN-053) 캡처 재대조를 부르므로 이 라운드 범위 밖이다(변경 요청으로 분리).
 * 실측은 손가락 몫이다(docs/qa/accessibility-offline-checklist.md C-1).
 */

/**
 * 세그먼트 탭: 세로 9 + 9 패딩과 13px 텍스트 줄 상자를 합쳐 대략 36dp다. 다만 **줄 상자 높이는
 * 런타임 폰트 메트릭이라 소스에서 읽을 수 없으므로**, 값은 소스가 보증하는 최소 높이
 * (패딩 18 + fontSize 13 = 31)로 잡는다 — 31 + 9 + 9 = 49로 그 최소치에서도 48을 넘긴다
 * (실제 높이는 더 크다. 실측은 a11y 체크리스트 C-1의 손가락 몫이다).
 *
 * **가로는 0이다.** 탭 셋은 `flex: 1`로 **맞붙어 있고 사이 간격이 0**이다. 종전의 `hitSlop={4}`는
 * 네 변에 똑같이 걸려 있었으므로, 각 탭의 히트 영역이 **옆 탭의 몸 4dp를 덮고 있었다** — 겹치는
 * 자리는 뒤에 그려진 형제가 이기므로(RN 터치 탐색은 자식을 역순으로 훑는다) 첫 탭의 오른쪽
 * 4dp를 누르면 **두 번째 탭이 선택된다**. 위 ②의 규율대로 그 4dp를 돌려주고, 대신 세로로 갚는다.
 * (트랙 안쪽 패딩 4를 덮던 바깥 두 변의 4dp도 함께 사라진다 — 잘못된 탭이 눌리는 쪽이 더 나쁘다.)
 *
 * 세로 여유 실측: 리포트 프레임 gap 18(위쪽 아이 전환 트리거의 hitSlop 8과 합쳐도 13 < 18) ·
 * 기록 탭 spacing.section 20(아래 검색 입력) · 준비템 패리티 gap 14(위아래 칩 줄). 트랙 밖으로
 * 나가는 것은 9-4=5dp뿐이고, 위아래 칩 줄의 세로 5와 겹쳐도 5+5=10 < 14라 어느 자리에서도
 * 이웃의 몸에 닿지 않는다.
 */
const SEGMENTED_TAB_HIT_SLOP = { bottom: 9, left: 0, right: 0, top: 9 } as const;

/**
 * 카테고리 칩: `minHeight: 38` + 세로 5 + 5 = 48. 값은 라운드 64가 입력 보조 칩에 쓴 것과
 * **같은 상자**다(`SUGGEST_CHIP_HIT_SLOP` — 같은 모양의 칩이 자리마다 다른 값을 갖지 않는다).
 *
 * **가로는 3 그대로다.** 칩 사이 간격 실측: 8이 12자리(온보딩·지출 시트·지출 상세·정기 지출·
 * 아이 관리·기록 탭 필터·CSV 내보내기)인데 **준비템 탭 5자리는 6이다**
 * (app/(tabs)/items.tsx의 칩 줄들 — 라운드 64 계약이 가정한 8보다 좁다). 3+3=6이 그 6을 정확히
 * 메우므로 여기가 천장이다 — 더 올리면 두 칩의 히트 영역이 겹치고, 6부터는 이웃 칩의 몸에 닿는다.
 *
 * 세로 5의 근거: 칩 위아래에 다른 칩이 서는 자리는 **줄바꿈(wrap)과 칩 줄이 겹쳐 쌓인 곳**뿐이고
 * 그 간격은 8(온보딩·아이 관리·정기 지출·내보내기)과 6(준비템 탭)이다. 5는 그 6보다 작아
 * **이웃 칩의 몸에는 닿지 않는다** — 겹치는 것은 아무도 갖고 있지 않던 빈 띠뿐이고, 그 띠는
 * 뒤에 그려진 칩이 가져간다(종전에는 그 자리를 누르면 아무 일도 일어나지 않았다).
 */
const CATEGORY_CHIP_HIT_SLOP = { bottom: 5, left: 3, right: 3, top: 5 } as const;

export function SegmentedControl({
  options,
  value,
  onChange
}: {
  options: string[];
  value: string;
  onChange?: (option: string) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ backgroundColor: theme.colors.presentation.segmentedTrack, borderRadius: theme.radii.pill, flexDirection: "row", padding: 4 }}
    >
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityLabel={option}
          accessibilityState={{ selected: option === value }}
          hitSlop={SEGMENTED_TAB_HIT_SLOP}
          onPress={() => onChange?.(option)}
          style={{
            backgroundColor: option === value ? theme.colors.mainCoral : "transparent",
            borderRadius: theme.radii.pill,
            flex: 1,
            paddingVertical: 9
          }}
        >
          <Text
            style={{
              color: option === value ? theme.colors.white : theme.colors.gray600,
              fontSize: 13,
              fontWeight: "700",
              textAlign: "center"
            }}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CategoryChip({
  label,
  selected,
  disabled,
  onPress
}: {
  label: string;
  selected?: boolean;
  /**
   * 라운드 49 QA(P3-3): 지금은 적용되지 않는 칩. **숨기지 않고 비활성으로 둔다** — 사라지면
   * "왜 없어졌지"가 되고, 그대로 누를 수 있게 두면 눌러도 아무 일이 없는 거짓 컨트롤이 된다.
   * 스크린 리더에도 같은 사실(disabled)을 알린다.
   */
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={
        selected === undefined ? (disabled ? { disabled: true } : undefined) : { selected, disabled: Boolean(disabled) }
      }
      disabled={disabled}
      hitSlop={CATEGORY_CHIP_HIT_SLOP}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? theme.colors.mainCoral : theme.colors.white,
        borderColor: selected ? theme.colors.mainCoral : theme.colors.primary100,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        minHeight: 38,
        justifyContent: "center",
        // 비활성은 색을 새로 만들지 않고 같은 칩을 흐리게만 한다(기존 칩 스타일 불변).
        opacity: disabled ? 0.4 : 1,
        paddingHorizontal: 14
      }}
    >
      <Text style={{ color: selected ? theme.colors.white : theme.colors.brown, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  // A11Y-117: warning tone follows the StageBadge recipe (coral[700] on coral[50]) so 11px badge
  // text -- including the DNC-011 광고/스폰서 disclosure badges -- meets WCAG AA contrast.
  const background = tone === "success" ? theme.colors.mint : tone === "warning" ? theme.colors.coral[50] : theme.colors.beige;
  const color = tone === "success" ? theme.colors.success : tone === "warning" ? theme.colors.coral[700] : theme.colors.brown;

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: background, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function BudgetProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={{ backgroundColor: "rgba(255,255,255,0.45)", borderRadius: theme.radii.pill, height: 8, overflow: "hidden" }}>
      <View style={{ backgroundColor: theme.colors.white, borderRadius: theme.radii.pill, height: 8, width: `${clamped}%` }} />
    </View>
  );
}

/**
 * HOME-127: `showProgress`는 **기본값 true**라 기존 호출부(홈 화면의 예산 있는 상태)의 렌더는
 * 한 픽셀도 바뀌지 않는다(HOME-001 픽셀락). false면 퍼센트 텍스트와 프로그레스 바를 함께
 * 감춘다 -- 예산을 설정하지 않은 달에 "0% / 100%"나 빈 막대를 그리면 사용자가 정한 적 없는
 * 진행률을 말하는 허위 표시가 되기 때문이다. 보조 문구(`subtext`)는 그대로 살아 있어 카드가
 * 무엇을 뜻하는지는 항상 글로 전달된다(색·막대 단독 전달 금지).
 */
export function HeroSummaryCard({
  label,
  amount,
  subtext,
  progress,
  showProgress = true
}: {
  label: string;
  amount: string;
  subtext: string;
  progress: number;
  showProgress?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.mainCoral,
        borderRadius: 24,
        gap: 10,
        padding: 18,
        ...theme.shadows.card
      }}
    >
      <Text style={[textStyles.caption, { color: theme.colors.white }]}>{label}</Text>
      <Text style={{ color: theme.colors.white, fontSize: 28, fontWeight: "800" }}>{amount}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {/* UX-J 후속: subtext는 퍼센트와 한 줄(row/space-between)을 나눠 쓴다. 종전 문구
            ("예산 1,600,000원")는 짧아 문제가 없었지만, 세션 홈의 "남은 예산 N원 · 예산 M원"은
            두 배 가까이 길어 좁은 기기에서 퍼센트를 밀어내거나 잘릴 수 있다. flexShrink로
            **긴 경우에만** 줄어들게 한다 -- 짧은 문구는 폭이 그대로라 HOME-001 픽셀락 캡처
            (비세션 미리보기)는 한 픽셀도 바뀌지 않는다. */}
        <Text style={[textStyles.caption, { color: theme.colors.white, flexShrink: 1 }]}>{subtext}</Text>
        {showProgress ? (
          <Text style={[textStyles.caption, { color: theme.colors.white, fontWeight: "700" }]}>{progress}%</Text>
        ) : null}
      </View>
      {showProgress ? <BudgetProgressBar value={progress} /> : null}
    </View>
  );
}

/**
 * D1 후속(실기기 피드백 2): `icon`은 이제 문자열 글리프뿐 아니라 노드(Ionicons 등)도 받는다.
 * 문자열이면 예전 그대로 Text로 그리므로 기존 호출부·픽셀 락 캡처는 바뀌지 않는다.
 */
export function QuickActionIconButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ alignItems: "center", flex: 1, gap: 6, minHeight: 68 }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.white,
          borderRadius: 18,
          height: 42,
          justifyContent: "center",
          width: 42,
          ...theme.shadows.card
        }}
      >
        {typeof icon === "string" ? <Text style={{ color: theme.colors.brown, fontSize: 18 }}>{icon}</Text> : icon}
      </View>
      <Text style={[textStyles.caption, { color: theme.colors.brown, fontWeight: "700", textAlign: "center" }]}>{label}</Text>
    </Pressable>
  );
}

// CLN-130: `BottomTabBar`는 죽은 export였다 -- 탭 바는 expo-router/@react-navigation의
// bottom-tabs가 app/(tabs)/_layout.tsx에서 그린다.

export function FloatingActionButton({ onPress, accessibilityLabel = "지출 기록하기" }: { onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        alignItems: "center",
        alignSelf: "center",
        backgroundColor: theme.colors.mainCoral,
        borderRadius: 28,
        height: 56,
        justifyContent: "center",
        width: 56,
        ...theme.shadows.card
      }}
    >
      <Text style={{ color: theme.colors.white, fontSize: 30, lineHeight: 32 }}>+</Text>
    </Pressable>
  );
}

export function BottomSheetFrame({
  title,
  children,
  showHandle = true,
  style
}: ChildrenProps & { title: string; showHandle?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.white,
          borderTopLeftRadius: theme.radii.sheet,
          borderTopRightRadius: theme.radii.sheet,
          gap: 16,
          padding: 22,
          ...theme.shadows.card
        },
        style
      ]}
    >
      {showHandle ? (
        <View style={{ alignSelf: "center", backgroundColor: theme.colors.gray300, borderRadius: theme.radii.pill, height: 4, width: 42 }} />
      ) : null}
      {title ? <Text style={[textStyles.h3, { color: theme.colors.brown }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress
}: {
  /**
   * D1 후속(실기기 피드백 2): 문자열 글리프 외에 노드(Ionicons 등)도 받는다. 문자열이면
   * 예전 그대로 coral Text로 그리므로 남아 있는 문자열 호출부는 그대로 동작한다.
   * 여전히 선택 항목이라 알 수 없는 알림 종류처럼 undefined가 와도 안전하게 비운다.
   *
   * 라운드 49 QA(P3-8): **빈 문자열도 "아이콘 없음"이다.** 노드 지원을 넣으면서 이 방어가
   * 빠져, `icon=""`이면 글자 없는 Text가 그려져 행마다 20px짜리 빈 칸이 생기고(제목 정렬이
   * 어긋난다) 접근성 트리에도 빈 요소가 하나 늘었다.
   */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress}>
      <Card style={{ alignItems: "center", flexDirection: "row", gap: 12, paddingVertical: 12 }}>
        {typeof icon === "string" ? (
          icon ? (
            <Text style={{ color: theme.colors.mainCoral, fontSize: 20 }}>{icon}</Text>
          ) : null
        ) : (
          icon
        )}
        <View style={{ flex: 1 }}>
          <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          {subtitle ? <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{value}</Text> : null}
      </Card>
    </Pressable>
  );
}

export function ProductCard({
  title,
  price,
  badge,
  image,
  caption,
  onPress
}: {
  title: string;
  price: string;
  badge?: string;
  image?: ImageSourcePropType;
  caption?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress}>
      <Card style={{ borderRadius: 18, flexDirection: "row", gap: 10, padding: 12 }}>
        <View style={{ backgroundColor: theme.colors.beige, borderRadius: 14, height: 64, overflow: "hidden", width: 64 }}>
          {image ? <Image source={image} style={{ height: "100%", width: "100%" }} resizeMode="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          {badge ? <StatusBadge label={badge} tone="warning" /> : null}
          <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          <Text style={[textStyles.body2, { color: smallCoralText, fontWeight: "800" }]}>{price}</Text>
          {caption ? <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{caption}</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * 라운드 43 UX-V (C3): `caption`은 판매처 이름 아래 한 줄. 기본값 "무료배송"은 ITEM-002
 * 픽셀 락 기준 이미지(비세션 프리뷰)를 그대로 두기 위한 값이고, 실제 데이터를 그리는
 * 세션 경로는 API가 주는 값에서 뽑은 문구(src/items/link-marker.ts의 플랫폼 라벨)를
 * 넘긴다 — 배송 조건은 어떤 응답에도 없어서 근거 없는 주장이었다.
 */
export function ProductComparisonRow({
  seller,
  price,
  caption = "무료배송",
  primaryAction = false,
  onPress
}: {
  seller: string;
  price: string;
  caption?: string;
  /**
   * DSN-053 P1: 승인 캡처(ITEM-002)의 판매처 행은 **한 줄만** 채워진 "구매하기" 버튼
   * (최소 폭 72)이고 나머지는 외곽선 "구매"(최소 폭 62)다. 기본값 false라 이 prop을
   * 넘기지 않는 기존 호출부의 렌더는 바뀌지 않는다.
   *
   * 채움 색은 `PrimaryButton` 기본값(mainCoral #C94627)을 그대로 쓴다. 캡처 이식 때는
   * coral[400](#F98060)을 덮어씌웠는데, 그 위의 흰 15/700 라벨은 명암비 2.54:1로 WCAG AA
   * (소형 텍스트 4.5:1)에 한참 못 미쳤다 — 핵심 루프의 구매 CTA가 가장 안 읽히는 버튼이
   * 되는 셈이라 색 오버라이드를 걷어냈다(기본값은 4.76:1).
   */
  primaryAction?: boolean;
  onPress?: () => void;
}) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{seller}</Text>
        {caption ? <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{caption}</Text> : null}
      </View>
      {price ? <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "800" }]}>{price}</Text> : null}
      {primaryAction ? (
        <PrimaryButton
          label="구매하기"
          accessibilityLabel={`${seller}에서 구매하기`}
          onPress={onPress}
          style={{ minWidth: 72 }}
        />
      ) : (
        <SecondaryButton
          label="구매"
          accessibilityLabel={`${seller}에서 구매하기`}
          onPress={onPress}
          style={{ minWidth: 62 }}
        />
      )}
    </View>
  );
}

export function FamilyAvatarGroup({ names }: { names: string[] }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {names.map((name, index) => (
        <View
          key={name}
          style={{
            alignItems: "center",
            backgroundColor: [theme.colors.peach, theme.colors.mint, theme.colors.sky, theme.colors.beige][index % 4],
            borderColor: theme.colors.white,
            borderRadius: 18,
            borderWidth: 2,
            height: 36,
            justifyContent: "center",
            marginLeft: index === 0 ? 0 : -8,
            width: 36
          }}
        >
          <Text style={{ color: theme.colors.brown, fontSize: 12, fontWeight: "700" }}>{name.slice(0, 1)}</Text>
        </View>
      ))}
    </View>
  );
}

const lineChartPoints = [
  { x: 8, y: 76 },
  { x: 46, y: 58 },
  { x: 78, y: 66 },
  { x: 112, y: 52 },
  { x: 150, y: 34 },
  { x: 186, y: 45 },
  { x: 228, y: 24 },
  { x: 268, y: 10 }
];

const lineChartSegments = lineChartPoints.slice(1).map((point, index) => {
  const previous = lineChartPoints[index];
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;

  return {
    angle: `${Math.atan2(dy, dx) * (180 / Math.PI)}deg`,
    length: Math.hypot(dx, dy),
    x: (previous.x + point.x) / 2,
    y: (previous.y + point.y) / 2
  };
});

const lineChartHeight = 104;
const lineChartPaddingTop = 10;
const lineChartPaddingBottom = 20;
const lineChartFallbackWidth = 280;

const reportCategoryLegend = [
  ["기저귀/위생", "34%"],
  ["식비/간식", "24%"],
  ["분유/유제품", "17%"],
  ["의류/잡화", "13%"],
  ["장난감/도서", "7%"],
  ["기타", "5%"]
] as const;

const donutSegmentPalette = [
  theme.colors.mainCoral,
  theme.colors.subCoral,
  theme.colors.warning,
  theme.colors.mint,
  theme.colors.sky,
  theme.colors.gray300
] as const;

/**
 * 라운드 52 QA P2-3 — `chartNotice`.
 *
 * 이 카드는 `points`가 2개 미만이면 **장식용 고정 좌표**로 폴백한다(비세션 픽셀락 캡처를 위한
 * 설계). 세션 경로에서도 그 폴백이 일어나서, 실제로는 점 하나뿐인 달에 그럴듯한 우상향 선이
 * 사용자의 기록인 척 그려졌다. `chartNotice`를 넘기면 그 자리에 선 대신 사실 한 줄을 그린다 —
 * 판정과 문구는 호출부의 순수 모듈(src/reports/period-trend-points.ts)에 있다.
 *
 * 이 prop을 **넘기지 않으면 종전 렌더 그대로**다: 비세션 미리보기(REP-001 픽셀락)와 월간 탭은
 * 이 분기에 닿지 않는다.
 */
export function LineChartCard({
  title,
  value,
  deltaLabel,
  points,
  chartNotice,
  pointLabels
}: {
  title: string;
  value: string;
  deltaLabel?: string | null;
  points?: number[];
  /** 차트 자리에 선 대신 그릴 한 줄. 없으면(undefined/null) 종전 그대로 선을 그린다. */
  chartNotice?: string | null;
  /**
   * 라운드 85 트랙 C: 점마다의 달 라벨과 낭독 계열(src/reports/trend-point-labels.ts).
   * 넘기지 않으면(undefined/null) **종전 렌더 그대로**다 — 비세션 미리보기(REP-001 픽셀락)와
   * 점 2개 미만의 장식 폴백은 이 값에 닿지 않는다.
   */
  pointLabels?: TrendPointLabels | null;
}) {
  const showDelta = deltaLabel !== null;
  // deltaLabel undefined means no real comparison data -- the visible "+12.5%" is preview-only
  // decoration and must stay out of anything TalkBack announces (A11Y-117).
  const hasRealDelta = typeof deltaLabel === "string";
  const deltaText = deltaLabel ?? "+12.5%";

  // Only draw real geometry once real data (2+ amounts) is supplied — otherwise fall back to
  // the fixed decorative points/segments untouched so the no-session preview render (pixel-lock
  // capture) stays byte-for-byte identical to before.
  const hasRealData = Array.isArray(points) && points.length >= 2;
  // QA P2-3: 빈 상태 한 줄이 오면 선(실데이터든 장식이든)을 아예 그리지 않는다.
  const noticeText = typeof chartNotice === "string" && chartNotice.trim().length > 0 ? chartNotice : null;
  const [measuredWidth, setMeasuredWidth] = useState(lineChartFallbackWidth);
  const drawnPoints = hasRealData
    ? normalizeLineChartPoints(points!, measuredWidth, lineChartHeight, lineChartPaddingTop, lineChartPaddingBottom)
    : lineChartPoints;
  // QA P2-3: 빈 상태에서는 격자·선·점을 통째로 비운다(장식선이 남아 있으면 고친 것이 없다).
  const activePoints = noticeText ? [] : drawnPoints;
  const activeSegments = noticeText ? [] : hasRealData ? lineChartSegmentsFor(drawnPoints) : lineChartSegments;
  const gridLineTops = noticeText ? [] : [25, 50, 75];
  // 라운드 85 트랙 C: 축 라벨은 **실데이터 갈래에만** 선다. 장식 폴백(점 2개 미만·비세션)과
  // 빈 상태는 이 값이 null이라 렌더가 종전과 바이트 단위로 같다. 수가 어긋나면 그리지 않는다 --
  // 조립기가 이미 같은 판정을 하지만, 어느 점이 어느 달인지 틀리게 말하는 축은 여기서도 막는다.
  const axisLabels =
    !noticeText && hasRealData && pointLabels && pointLabels.labels && pointLabels.labels.length === drawnPoints.length
      ? pointLabels.labels
      : null;
  const seriesText = axisLabels ? pointLabels?.accessibilitySeries ?? null : null;

  return (
    <Card style={{ gap: 8 }}>
      <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{title}</Text>
      <Text style={{ color: theme.colors.gray900, fontSize: 28, fontWeight: "800", lineHeight: 34 }}>{value}</Text>
      {showDelta ? (
        // Preview-only fake delta stays visible but out of the accessibility tree (A11Y-117):
        // no-hide-descendants covers Android (TalkBack), accessibilityElementsHidden covers iOS.
        <View
          accessibilityElementsHidden={hasRealDelta ? undefined : true}
          importantForAccessibility={hasRealDelta ? undefined : "no-hide-descendants"}
          style={{ flexDirection: "row", gap: 5 }}
        >
          <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>지난 달 대비</Text>
          <Text style={[textStyles.caption, { color: smallCoralText, fontWeight: "800" }]}>{deltaText}</Text>
        </View>
      ) : null}
      <View
        // A11Y-117: the trend geometry (absolute-positioned line segments/dots) is meaningless
        // when read element-by-element -- accessible groups the decorative internals into one
        // element that announces a Korean summary (total + real delta only; the preview-only
        // fake delta never enters the label).
        accessible
        // QA P2-3: 선을 그리지 않는 카드는 "추이 차트"라고 읽히면 안 된다 -- 보이는 것과 읽히는
        // 것이 갈리지 않게, 빈 상태에서는 그 자리에 실제로 쓰인 문장을 그대로 읽는다.
        accessibilityLabel={
          noticeText
            ? `${title} 합계 ${value}, ${noticeText}`
            : // 라운드 85 트랙 C: 실데이터 갈래에서는 각 점의 **달과 값**까지 읽는다 -- 종전에는
              // 합계에서 멈춰, 눈으로 보이는 추이를 소리로는 들을 수 없었다. 미리보기 전용 가짜
              // 델타는 여전히 이 문장에 들어오지 않는다(A11Y-117).
              `${title} 추이 차트, 합계 ${value}${hasRealDelta ? `, 지난 달 대비 ${deltaText}` : ""}${seriesText ? `, ${seriesText}` : ""}`
        }
        onLayout={!noticeText && hasRealData ? (event) => setMeasuredWidth(event.nativeEvent.layout.width) : undefined}
        style={
          noticeText
            ? {
                alignItems: "center",
                backgroundColor: theme.colors.presentation.chartPlot,
                borderRadius: 14,
                height: 104,
                justifyContent: "center",
                marginTop: 2,
                overflow: "hidden",
                paddingHorizontal: 16
              }
            : { backgroundColor: theme.colors.presentation.chartPlot, borderRadius: 14, height: 104, marginTop: 2, overflow: "hidden" }
        }
        testID={noticeText ? "line-chart-empty-notice" : undefined}
      >
        {noticeText ? (
          <Text style={[textStyles.caption, { color: theme.colors.gray600, textAlign: "center" }]}>{noticeText}</Text>
        ) : null}
        {gridLineTops.map((top) => (
          <View key={top} style={{ backgroundColor: "rgba(255, 107, 82, 0.08)", height: 1, left: 0, position: "absolute", right: 0, top }} />
        ))}
        {activeSegments.map((segment, index) => (
          <View
            key={`${segment.x}-${segment.y}-${index}`}
            style={{
              backgroundColor: theme.colors.mainCoral,
              borderRadius: 3,
              height: 3,
              left: segment.x - segment.length / 2,
              position: "absolute",
              top: segment.y,
              transform: [{ rotate: segment.angle }],
              width: segment.length
            }}
          />
        ))}
        {activePoints.map((point, index) => {
          const dotSize = index === activePoints.length - 1 ? 12 : 9;
          // Real data: center the dot on its coordinate so the edge inset from
          // normalizeLineChartPoints keeps the whole dot inside the clipped card.
          // Decorative fallback keeps the original -4 offset (pixel-lock preview).
          const dotOffset = hasRealData ? dotSize / 2 : 4;
          return (
            <View
              key={`${point.x}-${point.y}-${index}`}
              style={{
                backgroundColor: theme.colors.mainCoral,
                borderColor: theme.colors.white,
                borderRadius: 5,
                borderWidth: 2,
                height: dotSize,
                left: point.x - dotOffset,
                position: "absolute",
                top: point.y - dotOffset,
                width: dotSize
              }}
            />
          );
        })}
        {/* 라운드 85 트랙 C: 점이 어느 달인지 축이 말한다. 카드 높이·격자선·점 크기는 그대로다 --
            라벨은 플롯 영역의 **이미 비어 있는 아래 여백**(lineChartPaddingBottom 20)에 절대
            배치로 들어가므로 선/점 좌표에 닿지 않는다. 이 줄은 실데이터 갈래에만 서고
            (axisLabels === null이면 렌더 0건), 바깥 View가 accessible이라 라벨 하나하나가 따로
            읽히지 않는다 -- 소리로는 위 accessibilityLabel의 계열 한 조각이 대신 말한다. */}
        {axisLabels ? (
          <View
            style={{ bottom: 0, flexDirection: "row", justifyContent: "space-between", left: 0, position: "absolute", right: 0 }}
          >
            {axisLabels.map((label, index) => (
              <Text
                key={`${label}-${index}`}
                numberOfLines={1}
                style={{ color: theme.colors.gray600, fontSize: 9, lineHeight: 12 }}
              >
                {label}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const categoryShareBarHeight = 14;

/**
 * 카테고리 비중 카드.
 *
 * R20-A: with real `segments` this draws a **proportional stacked share bar** -- each category's
 * width is its actual share of the total (`computeCategoryShares`). It used to draw a donut arc
 * via the border-quadrant trick (four border colors on a rounded View), which can only ever
 * express four fixed 90° wedges: the angles were pure decoration and a 60% category looked
 * identical to a 5% one. No SVG/conic-gradient dependency exists in this app (adding one is out of
 * scope) and the same border trick cannot produce an arbitrary sweep, so the honest fix is a bar
 * whose widths *are* the proportions rather than a circle whose angles lie.
 *
 * Without `segments` (the logged-out preview / pixel-lock capture) the original decorative donut
 * is rendered byte-for-byte unchanged -- same convention as LineChartCard's placeholder line.
 *
 * 라운드 52 C-03: `onSelect`를 넘기면 **범례 줄이 눌리는 버튼**이 된다(리포트 → 기록 드릴다운).
 * 넘기지 않으면 줄은 종전과 똑같은 정적 View이고, 위 **비세션 장식 분기는 어느 쪽이든 한 글자도
 * 닿지 않는다**(REP-001 픽셀락). 선택 가능한 줄만 44dp 터치 타깃으로 키운다 — 캡션 한 줄 높이의
 * 버튼은 손가락으로 정확히 누를 수 없고, hitSlop으로 늘리면 이웃 줄의 영역과 겹친다.
 */
export function DonutChartCard({
  title,
  segments,
  onSelect,
  selectHint
}: {
  title: string;
  segments?: Array<{ label: string; amountKrw: number; categoryId?: string }>;
  /** 범례 줄을 눌렀을 때. 조각은 자기 `categoryId`를 들고 있다(인덱스로 되짚지 않는다). */
  onSelect?: (slice: CategoryShareSlice, index: number) => void;
  /** 누르기 전에 어디로 가는지 말해 주는 접근성 힌트. */
  selectHint?: string | null;
}) {
  if (segments) {
    const shares = computeCategoryShares(segments);

    // Real data that adds up to nothing (every amount 0) must not fall through to the decorative
    // preview legend -- that would show invented percentages as if they were this child's.
    if (shares.length === 0) {
      return (
        <Card style={{ gap: 8 }}>
          <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
          <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>아직 비중을 보여줄 지출이 없어요.</Text>
        </Card>
      );
    }

    return (
      <Card style={{ gap: 10 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
        {/* A11Y-117: the bar is decorative -- every slice's name, amount and percent is read from
            the legend rows below it, so the bar itself stays out of TalkBack/VoiceOver. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            backgroundColor: theme.colors.gray300,
            borderRadius: categoryShareBarHeight / 2,
            flexDirection: "row",
            height: categoryShareBarHeight,
            overflow: "hidden"
          }}
        >
          {shares.map((slice, index) => (
            <View
              key={`${slice.label}-${index}`}
              style={{
                backgroundColor: donutSegmentPalette[index % donutSegmentPalette.length],
                flexBasis: 0,
                flexGrow: slice.widthPercent
              }}
            />
          ))}
        </View>
        <View style={{ gap: onSelect ? 0 : 5 }}>
          {shares.map((slice, index) => {
            // 줄 안쪽은 두 분기가 **같은 조각**을 쓴다 -- 눌리는 줄과 눌리지 않는 줄이 다르게
            // 보이면 같은 데이터가 세션마다 다른 카드로 읽힌다.
            const row = (
              <>
                <View
                  style={{ backgroundColor: donutSegmentPalette[index % donutSegmentPalette.length], borderRadius: 4, height: 8, width: 8 }}
                />
                <Text style={[textStyles.caption, { color: theme.colors.gray600, flex: 1 }]}>{slice.label}</Text>
                <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{formatKrw(slice.amountKrw)}</Text>
                <Text style={[textStyles.caption, { color: theme.colors.brown, fontWeight: "700", minWidth: 34, textAlign: "right" }]}>
                  {slice.percentLabel}
                </Text>
                {onSelect ? (
                  // 누를 수 있다는 것을 보이게 하는 표식. 소리로는 accessibilityRole="button"이
                  // 같은 사실을 말하므로 글리프는 라벨에 넣지 않는다.
                  <Text style={[textStyles.caption, { color: theme.colors.gray300, fontWeight: "800" }]}>›</Text>
                ) : null}
              </>
            );

            // A11Y-117: one element per legend row so TalkBack announces "기저귀/위생, 34%,
            // 340,000원" instead of three disconnected fragments.
            return onSelect ? (
              <Pressable
                accessible
                accessibilityHint={selectHint ?? undefined}
                accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}
                accessibilityRole="button"
                key={`${slice.label}-${index}`}
                onPress={() => onSelect(slice, index)}
                style={{ alignItems: "center", flexDirection: "row", gap: 6, minHeight: 44 }}
              >
                {row}
              </Pressable>
            ) : (
              <View
                accessible
                accessibilityLabel={`${slice.label}, ${slice.percentLabel}, ${formatKrw(slice.amountKrw)}`}
                key={`${slice.label}-${index}`}
                style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
              >
                {row}
              </View>
            );
          })}
        </View>
      </Card>
    );
  }

  const legendItems = reportCategoryLegend.map(([label, percent]) => ({ label, percent }));
  const arcColors = [donutSegmentPalette[0], donutSegmentPalette[2], donutSegmentPalette[3], donutSegmentPalette[4]];

  return (
    <Card style={{ flexDirection: "row", gap: 14 }}>
      {/* A11Y-117: the border-trick arc is decorative -- the legend rows beside it carry the
          same data as text, so the arc is hidden from TalkBack/VoiceOver. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ alignItems: "center", height: 96, justifyContent: "center", width: 96 }}
      >
        <View
          style={{
            borderBottomColor: arcColors[2],
            borderColor: arcColors[0],
            borderLeftColor: arcColors[3],
            borderRadius: 48,
            borderRightColor: arcColors[1],
            borderWidth: 16,
            height: 96,
            transform: [{ rotate: "-22deg" }],
            width: 96
          }}
        />
        <View style={{ backgroundColor: theme.colors.white, borderRadius: 28, height: 56, position: "absolute", width: 56 }} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[textStyles.body2, { color: theme.colors.brown, fontWeight: "700" }]}>{title}</Text>
        {legendItems.map((item, index) => (
          <View key={`${item.label}-${index}`} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <View style={{ backgroundColor: donutSegmentPalette[index % donutSegmentPalette.length], borderRadius: 4, height: 8, width: 8 }} />
            <Text style={[textStyles.caption, { color: theme.colors.gray600, flex: 1 }]}>{item.label}</Text>
            <Text style={[textStyles.caption, { color: theme.colors.gray600, fontWeight: "700" }]}>{item.percent}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/**
 * 라운드 71 트랙 E — **`actionLabel`과 `onPress`는 한 짝이다.**
 *
 * 예전 시그니처는 `actionLabel: string` + `onPress?: () => void`였고, 렌더는 `onPress`가 없어도
 * `SecondaryButton`을 **언제나** 그렸다. 그래서 `accessibilityRole="button"`으로 낭독되고 눌리는데
 * 아무 일도 일어나지 않는 **가짜 버튼**이 만들어졌다 — 소리로만 앱을 쓰는 사람에게는 "버튼"이라는
 * 낭독 자체가 약속이고, 그 약속이 지켜지지 않는다.
 *
 * 라운드마다 그런 호출부를 한두 자리씩 손으로 걷어내 왔지만(MOB-119 · UX-Q(B) — 그 주석은 자기가
 * 마지막이라고 적었는데 넷이 더 살아 있었다) **컴포넌트가 허용하는 한 계속 생긴다.** 그래서 고칠
 * 자리는 호출부가 아니라 타입이다: `AffiliateDisclosure`의 `text`를 필수로 만든 라운드 43 리뷰
 * M-1이 같은 판단이었다.
 *
 * 고정하는 것 둘.
 *  1) **타입** — 액션은 둘 다 있거나 둘 다 없다(판별 합집합). 라벨만 넘기면 컴파일이 깨진다.
 *  2) **렌더** — 그래도 `onPress`가 없으면 버튼을 **그리지 않는다**. 타입을 우회하는 경로(any·
 *     스프레드)에서도 낭독되는 가짜 버튼이 서지 않게, 안전이 판정 하나에만 걸리지 않는다.
 *
 * 액션이 없는 카드는 제목 한 줄짜리 안내가 된다(제목은 종전 그대로 보이는 Text다 — 색·배지 톤이
 * 아니라 문장으로 상태를 말한다는 A-1 Error text의 그 규율).
 */
export type EmptyStateCardProps = { title: string } & (
  | { actionLabel: string; onPress: () => void }
  | { actionLabel?: undefined; onPress?: undefined }
);

export function EmptyStateCard({ title, actionLabel, onPress }: EmptyStateCardProps) {
  return (
    <Card style={{ alignItems: "center", backgroundColor: theme.colors.beige }}>
      <Text style={[textStyles.body1, { color: theme.colors.brown, fontWeight: "700", textAlign: "center" }]}>{title}</Text>
      {onPress && actionLabel ? <SecondaryButton label={actionLabel} onPress={onPress} /> : null}
    </Card>
  );
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  const isError = tone === "error";
  // A11Y-115: every Toast (저장 성공/실패, CSV 내보내기, 오프라인 저장 등) announces its message
  // when shown or when the message changes -- the live region backs this up on Android when the
  // subtree re-renders in place.
  useEffect(() => {
    announceForA11y(message);
  }, [message]);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: theme.colors.white, borderRadius: 18, flexDirection: "row", gap: 10, padding: 14, ...theme.shadows.card }}
    >
      <Text accessible={false} style={{ color: isError ? theme.colors.danger : theme.colors.success }}>{isError ? "⚠" : "✓"}</Text>
      <Text style={[textStyles.body2, { color: theme.colors.brown }]}>{message}</Text>
    </View>
  );
}

/**
 * 라운드 43 리뷰 M-1: `text`는 **필수**다. 예전에는 선택 인자였고 값이 없으면 컴포넌트가
 * "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."를 스스로 그렸는데, 제휴도 스폰서도
 * 아닌 일반 링크뿐인 화면까지 그 문장을 말하게 만드는 자리였다(허위 고지).
 *
 * 이제 "무엇을 고지할지"는 링크 집합을 보는 순수 함수가 정하고
 * (src/items/link-marker.ts의 `productLinksDisclosureText`), 이 컴포넌트는 받은 문장을
 * 구매 CTA 인접 위치에 그리기만 한다(DNC-010의 위치·문구 계약은 그대로).
 */
export function AffiliateDisclosure({ text }: { text: string }) {
  return <Text style={[textStyles.caption, { color: theme.colors.gray600 }]}>{text}</Text>;
}

const textStyles = {
  h2: theme.typography.headline2 as TextStyle,
  h3: theme.typography.headline3 as TextStyle,
  body1: theme.typography.body1 as TextStyle,
  body2: theme.typography.body2 as TextStyle,
  caption: theme.typography.caption as TextStyle
};
