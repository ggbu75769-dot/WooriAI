import { useState } from "react";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
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
                  placeholderTextColor={theme.colors.gray300}
                  style={amountInputStyle}
                  value={formatAmountDigits(presetDigits[index] ?? "")}
                />
                <Text style={wonSuffixStyle}>원</Text>
              </View>
            </View>
          ))}
          {inputNotice ? (
            <Text style={errorTextStyle}>{inputNotice}</Text>
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
