import { useState } from "react";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { useFieldErrorAnnouncement } from "../../src/a11y/use-field-error-announcement";
import { amountOverLimitMessage, isAmountOverLimit } from "../../src/expenses/amount-limit";
import {
  formatPresetChipLabel,
  resolveAmountPresets,
  sanitizeCustomAmountPresets,
  QUICK_AMOUNT_MAX_KRW,
  QUICK_AMOUNT_PRESETS_KRW
} from "../../src/expenses/amount-presets";
import { amountDigitsOnly, formatAmountDigits } from "../../src/money";
import { useAmountPresetsStore } from "../../src/stores/amount-presets.store";
import { theme } from "../../src/theme";
import { AppScreen, Card, PrimaryButton, ScreenHeader, SecondaryButton, Toast } from "../../src/ui";
import { useTransientNotice } from "../../src/ui/use-transient-notice";

/**
 * 라운드 101 W2 F6a — **지출 입력 금액 버튼(프리셋) 편집** (`/settings/amount-presets`).
 *
 * 지출 입력 시트의 +금액 칩 네 개(기본 +1천/+5천/+1만/+5만)를 이 화면에서 바꾼다. 값은 기기
 * 단위 취향으로 persist 스토어(src/stores/amount-presets.store.ts)에 남고, 판정(sanitize:
 * 정수 · 1원~서버 상한 · 중복 제거 · 4칸 · 오름차순)은 순수 모듈
 * (src/expenses/amount-presets.ts)이 갖는다 — 이 화면은 입력을 모으고 그 판정을 넘길 뿐이다.
 *
 * 금액 입력 관례는 예산 수정 화면(app/budget.tsx)의 그 한 벌을 그대로 쓴다: 숫자만 남기는
 * `amountDigitsOnly` · 콤마 표기 `formatAmountDigits`(₩ 금지, '원'은 옆 Text) · 0 이하 문구
 * ("0보다 큰 금액을 입력해 주세요.") · 상한 문구는 amount-limit.ts 단일 소스
 * (`amountOverLimitMessage`). 상한을 여기 다시 적지 않는다.
 *
 * 세션 게이트가 없는 이유: 이 값은 계정 데이터가 아니라 기기 취향이라(터치 반응 토글과 같은
 * 범주) 로그인 없이 바꿔도 잘못 귀속될 데이터가 없다. 칩 자체는 지출 입력의 authToken 게이트
 * 안에서만 렌더되므로 비세션 화면(EXP-001 캡처)은 이 설정의 영향을 받지 않는다.
 *
 * 하이드레이션 알고 받아들이는 갈래: 입력 칸의 초기값은 첫 렌더의 스토어 값에서 한 번 만든다.
 * persist 하이드레이션 전 찰나에는 기본값이 보이는데, 설정 하위 화면은 최소 두 번의 화면 전환
 * 뒤에야 닿는 자리라 그 창이 사실상 닫혀 있다(app/settings/index.tsx의 S-3과 같은 판단).
 */

const PRESET_FIELD_LABELS = ["첫 번째 금액", "두 번째 금액", "세 번째 금액", "네 번째 금액"] as const;

/** 네 칸의 입력에서 첫 번째 문제 하나를 문장으로. 문제가 없으면 null(저장 가능). */
function presetInputNotice(presetDigits: readonly string[]): string | null {
  if (presetDigits.some((digits) => digits.length === 0)) return "네 칸을 모두 채워 주세요.";
  const values = presetDigits.map((digits) => Number(digits));
  if (values.some((value) => value <= 0)) return "0보다 큰 금액을 입력해 주세요.";
  // 리뷰 M-3: 상한은 서버 int4(EXPENSE_AMOUNT_MAX_KRW)가 아니라 **가산이 실제로 멈추는 값**
  // (QUICK_AMOUNT_MAX_KRW = 1억)이다 — 그보다 큰 프리셋은 sanitize도 이제 기본값으로 떨어뜨리고
  // (라벨 = 효과), 문구는 같은 단일 소스(amountOverLimitMessage)에 그 상한을 넘겨 만든다.
  if (values.some((value) => isAmountOverLimit(value, QUICK_AMOUNT_MAX_KRW)))
    return amountOverLimitMessage(QUICK_AMOUNT_MAX_KRW);
  if (new Set(values).size !== values.length) return "같은 금액이 두 번 있어요. 서로 다른 금액 네 개로 적어 주세요.";
  return null;
}

export default function AmountPresetsSettingsScreen() {
  const customPresets = useAmountPresetsStore((state) => state.customPresets);
  const setCustomPresets = useAmountPresetsStore((state) => state.setCustomPresets);
  // 초기값은 지금 칩이 실제로 그리는 그 네 칸이다(사용자 값이 없으면 기본값).
  const [presetDigits, setPresetDigits] = useState<string[]>(() => resolveAmountPresets(customPresets).map(String));
  const { notice: savedNotice, show: showSavedNotice } = useTransientNotice();

  const inputNotice = presetInputNotice(presetDigits);
  // 저장될(=오름차순으로 정렬된) 모양의 미리보기. 문제가 있으면 만들지 않는다(0을 지어내지 않는다).
  const previewValues = inputNotice === null ? sanitizeCustomAmountPresets(presetDigits.map(Number)) : null;

  /**
   * A11Y-115(이월 한 자리) ⚠️ **두 시점** — *종전*: 이 화면의 오류 한 줄에는 낭독 출구가 전혀
   * 없었다(그때는 참이었다 — 이 화면은 라운드 101에 태어났고, 라운드 109가 A11Y-115 이월을
   * 닫을 때의 모집단은 지출 수정·예산·온보딩이라 여기가 그 그물 **밖**이었다. 라운드 79·80의
   * 낭독 스윕도 서버 호출(뮤테이션·쿼리) 바인딩에 닿는 갈래만 자리로 세는데, 아래 `inputNotice`는
   * 네 칸의 입력에서 파생한 **순수 계산**이라 마찬가지로 밖이다 — 이 화면에는 그 바인딩 자체가
   * 없다(로컬 스토어 저장 하나다). 그래서 소리로만 쓰는 사람은
   * [저장]이 비활성이라는 **사실만** 듣고 **왜인지는 끝내 듣지 못했다** — 그 버튼은 바로 이
   * `inputNotice`로 잠기는데(`disabled={inputNotice !== null}`), 포커스는 방금 친 입력칸에
   * 남으므로 그 아래 한 줄을 만나러 갈 이유가 없다.
   * *이제*: 아래 오류 줄에 프롭 둘을 걸고(안드로이드의 답), 크로스플랫폼 낭독은 저장소의 그
   * 한 벌이 소유한다(`src/a11y/use-field-error-announcement.ts`). 배선의 모양·순서는 이 화면이
   * 금액 입력 관례를 그대로 가져온 **예산 수정 화면**(app/budget.tsx의 `amountError`)과 같다 —
   * 새 관례를 만들지 않는다. **새 한국어 문장 0건**: 읽히는 것은 화면이 이미 그리는 그 문자열
   * 그대로다(문구의 단일 소스는 위 `presetInputNotice`와 `src/expenses/amount-limit.ts`).
   *
   * ⚠️ **버튼에 힌트를 달지 않는 이유.** "비활성"이라는 사실은 이미 소리에 있다 — RN Pressable이
   * `disabled` 프롭을 `accessibilityState.disabled`로 넘기기 때문이다. 빠진 것은 **이유**이고,
   * 이유는 이 문장이다. 이유를 버튼 쪽에 `accessibilityHint`로 붙이려면 `src/ui.tsx`의
   * `PressableProps`(label·onPress·disabled·style·accessibilityLabel)를 넓혀야 하는데, 그건
   * 공용 버튼의 계약을 이 화면 하나 때문에 바꾸는 일이고 무엇보다 **비활성 요소의 힌트는 읽히지
   * 않을 수 있다**(포커스가 그 버튼에 닿아야 비로소 들리는 것도 늦다 — 오류는 타이핑하는 순간
   * 생긴다). 그래서 저장소의 답은 **오류가 생기는 그 순간 그 자리에서 읽는 것**이고, 예산 화면이
   * 같은 판단을 같은 모양으로 이미 지고 있다(그 화면의 [저장]도 힌트 없이 잠긴다).
   *
   * ⚠️ 훅은 조기 반환보다 위에서 부른다(FIX-A). 오류가 없으면 `null`이 가고, 그 걸음이 훅의
   * 기억을 지워 같은 오류가 다시 열릴 때 다시 읽힌다.
   */
  useFieldErrorAnnouncement(inputNotice);

  const handleSave = () => {
    // 버튼이 inputNotice로 이미 잠겨 있어 정상 경로에서는 null이 오지 않는다(방어 갈래).
    const sanitized = sanitizeCustomAmountPresets(presetDigits.map(Number));
    if (sanitized === null) return;
    setCustomPresets(sanitized);
    // 저장된 모양(오름차순)을 입력 칸에도 그대로 보여 준다 — 저장본과 화면이 갈리지 않는다.
    setPresetDigits(sanitized.map(String));
    showSavedNotice("금액 버튼을 저장했어요.");
  };

  const handleReset = () => {
    setCustomPresets(null);
    setPresetDigits(QUICK_AMOUNT_PRESETS_KRW.map(String));
    showSavedNotice("기본값으로 되돌렸어요.");
  };

  return (
    <AppScreen>
      <View testID="screen-amount-presets" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="설정"
          title="빠른 금액 버튼"
          subtitle="지출을 기록할 때 금액에 더해지는 버튼 네 개를 바꿔요"
          onBack={() => router.back()}
        />

        <Card style={{ gap: 12 }}>
          <Text style={captionStyle}>
            버튼을 누를 때마다 그 금액이 현재 금액에 더해져요. 자주 만드는 금액 단위로 바꿔 두면 탭 수가 줄어요.
          </Text>
          {PRESET_FIELD_LABELS.map((label, index) => (
            <View key={label} style={{ gap: 4 }}>
              <Text style={fieldLabelStyle}>{label}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="number-pad"
                  onChangeText={(value) =>
                    setPresetDigits((current) => current.map((digits, at) => (at === index ? amountDigitsOnly(value) : digits)))
                  }
                  placeholder="금액을 입력해 주세요"
                  // 종전 gray300(#E5DFDB): 흰 입력칸 위 **1.32:1**로 사실상 보이지 않았다 — 그때는 테두리와
                  // 같은 "연한 회색"을 안내문에도 재사용하는 것이 자연스러웠다. → 이제 text.placeholder
                  // (#756C66): 흰 배경 5.13:1(AA 통과)이면서 입력값(text.primary)과는 3.23:1로 구별된다.
                  // 값의 근거와 두 수치는 src/theme.ts의 그 토큰 주석이 든다(라운드 106 정찰 S2 발견 3).
                  placeholderTextColor={theme.colors.text.placeholder}
                  style={amountInputStyle}
                  value={formatAmountDigits(presetDigits[index] ?? "")}
                />
                <Text style={wonSuffixStyle}>원</Text>
              </View>
            </View>
          ))}
          {inputNotice ? (
            /* A11Y-115(이월 한 자리): 프롭 조합·순서는 예산 수정 화면(app/budget.tsx)의 총액 오류
               줄과 **같은 한 벌**이다 — 저장을 잠그는 오류이고 포커스가 방금 친 입력칸에 남는다는
               판정도 같다. 갈래의 else(회색 미리보기 한 줄)는 오류가 아니므로 종전 그대로 조용하다. */
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
              {inputNotice}
            </Text>
          ) : (
            // 저장 시 오름차순으로 정렬된다는 사실을 미리 보여 준다(칩에 보일 표기 그대로).
            <Text style={captionStyle}>
              {`지출 입력에는 ${previewValues?.map(formatPresetChipLabel).join(" · ") ?? ""} 순서로 보여요.`}
            </Text>
          )}
        </Card>

        {savedNotice ? <Toast message={savedNotice.message} tone={savedNotice.tone} /> : null}

        <View style={{ gap: theme.spacing.gap }}>
          <PrimaryButton disabled={inputNotice !== null} label="저장" onPress={handleSave} />
          <SecondaryButton label="기본값으로" onPress={handleReset} />
        </View>
      </View>
    </AppScreen>
  );
}

const captionStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;

const fieldLabelStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "700"
} as const;

const errorTextStyle = {
  color: theme.colors.danger,
  fontSize: 12,
  lineHeight: 17
} as const;

const wonSuffixStyle = {
  color: theme.colors.gray600,
  fontSize: 15,
  fontWeight: "700"
} as const;

const amountInputStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  paddingHorizontal: 12,
  paddingVertical: 8
} as const;
