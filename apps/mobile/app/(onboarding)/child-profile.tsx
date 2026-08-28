import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CHILD_STAGE_CODES, getSeoulToday, type ChildStageCode } from "@wooriai/domain";
import { LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN, upsertConsents } from "../../src/api/client";
// MOB-118: the date guard (isFutureSeoulDate/isValidCalendarDate wiring), stage labels, and
// date-field label moved verbatim to src/children/child-form.ts so the settings 아이 관리
// screen's edit/add forms reuse exactly this screen's validation -- see that module.
import {
  buildCreateChildBody,
  childDatePickerDirection,
  CHILD_STAGE_LABELS,
  requiredDateFieldLabel,
  validateChildForm
} from "../../src/children/child-form";
import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";
import { createOnboardingChild } from "../../src/onboarding/child-create";
import { saveWithConsentRecovery } from "../../src/onboarding/consent-recovery";
import {
  OnboardingSaveErrorCard,
  OnboardingStepProgress,
  useOnboardingStepAnalytics
} from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon } from "../../src/design-system";
import { AppScreen, Card, CategoryChip, PrimaryButton, ScreenHeader } from "../../src/ui";
import { theme } from "../../src/theme";

export default function ChildProfileScreen() {
  // 실기기 피드백 1: 예전에는 "튼튼이"가 미리 채워져 있어, 아무것도 입력하지 않아도 남의
  // 이름으로 아이가 만들어졌다. 빈 칸에서 시작하고 예시는 placeholder로만 보여 준다.
  const [nickname, setNickname] = useState("");
  const [dateText, setDateText] = useState("");
  // 아직 손대지 않은 칸을 빨갛게 꾸짖지 않는다 -- 빈 칸에서 시작하는 화면이라(위 주석) 두 칸이
  // 처음부터 오류로 보이면 아무것도 하기 전에 혼나는 인상이 된다. 저장 버튼은 어차피 비활성이라
  // 진행을 잘못 허용할 위험도 없다. 설정 화면의 같은 폼도 제출 시점까지 오류를 숨긴다
  // (app/settings/children.tsx의 showErrors).
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const [manualStage, setManualStage] = useState<ChildStageCode | null>(null);
  /**
   * 라운드 65 D — 날짜 칸의 달력. 기본은 닫혀 있고 달력 버튼으로 연다.
   *
   * 손타이핑 칸은 **그대로 남는다**: 이미 손에 익은 사람과, 달력 격자를 훑는 것보다 열 글자를
   * 치는 편이 빠른 스크린리더 사용자의 경로를 달력이 대체할 이유가 없다(지출 화면이 14일 칩·
   * 직접 입력을 남겨 둔 것과 같은 판단).
   */
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // 달력이 열려 있는 동안 "오늘"은 한 값이어야 한다(렌더마다 다시 물으면 자정을 넘길 때 격자와
  // 판정이 갈린다). 지출 화면도 화면이 계산해 둔 todayIso 한 값을 픽커에 넘긴다.
  const todayIso = useMemo(() => getSeoulToday(), []);
  const session = useSessionStore();
  const authToken = session.accessToken ?? (session.isTestSession ? LOCAL_SESSION_TOKEN : null);
  const householdId = session.defaultHouseholdId ?? (session.isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const draft = useOnboardingProgressStore((state) => state.childDraft);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  const getOrCreateChildCreateIdempotencyKey = useOnboardingProgressStore(
    (state) => state.getOrCreateChildCreateIdempotencyKey
  );
  const clearChildCreateIdempotencyKey = useOnboardingProgressStore((state) => state.clearChildCreateIdempotencyKey);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);

  // 라운드 60 #9: 단계 진입 계측(onboarding_step_viewed). 동의 OFF면 완전한 no-op이다.
  useOnboardingStepAnalytics("ONB-002");

  // 실기기 피드백 1: 날짜를 **필수**로 받는다(requireDate). 예전에는 "날짜 없이 태명만으로도
  // 계속할 수 있어요"라고 안내했지만, 서버 normalizeChildInput은 pregnant/born에 날짜가 없으면
  // CHILD_STAGE_INPUT_REQUIRED(400)로 거절한다 -- 안내대로 비워 두고 누르면 저장에 실패했다.
  // 게다가 시기별 준비물·리포트가 전부 이 날짜에서 나오므로, 아이 정보를 제대로 받는 것이
  // 이 화면의 일이다. 검증은 설정 화면과 같은 shared 모듈 한 곳(child-form.ts)에서 온다.
  const { nicknameError, dateError, manualStageError } = useMemo(
    () =>
      validateChildForm(
        draft.stageMode,
        { nickname, dateText, manualStage },
        { requireDate: true }
      ),
    [draft.stageMode, nickname, dateText, manualStage]
  );
  const dateLabel = useMemo(() => requiredDateFieldLabel(draft.stageMode), [draft.stageMode]);
  const canSave =
    !nicknameError &&
    !dateError &&
    !manualStageError &&
    Boolean(authToken && householdId && draft.stageMode);

  /** 저장 본체. 자동 복구 경로도 **이 함수 그대로**를 다시 부른다(바디도 키도 한 벌뿐이다). */
  const submitChild = useCallback(async () => {
    if (!authToken || !householdId || !draft.stageMode) {
      throw new Error("missing onboarding context");
    }
    if (draft.stageMode === "manual" && !manualStage) {
      throw new Error("missing manual stage selection");
    }
    // MOB-101: reuse the same Idempotency-Key across retries of this submission (network
    // retry, or a resumed app restarting the mutation) so the server never creates a second
    // child for the household -- see round5a-sprint1-plan.md §4.
    const idempotencyKey = getOrCreateChildCreateIdempotencyKey();
    // 바디 조립은 설정 화면의 아이 추가와 같은 shared 모듈에서 온다(단일 소스).
    return createOnboardingChild(
      authToken,
      buildCreateChildBody(householdId, draft.stageMode, { nickname, dateText, manualStage }),
      idempotencyKey
    );
  }, [authToken, dateText, draft.stageMode, getOrCreateChildCreateIdempotencyKey, householdId, manualStage, nickname]);

  const save = useMutation({
    /**
     * 라운드 65 후속(#1) — **필수 동의 미저장으로 막힌 저장의 1회 자동 복구.**
     *
     * 로그인 화면은 동의 저장(PUT /consents) 실패를 삼키고 이 화면으로 보낸다
     * (app/(auth)/login.tsx — 로그인 자체는 성공했으므로 로그인 실패로 승격하지 않는다).
     * 그때 서버에는 동의 기록이 없고, `POST /children`은 `CONSENT_REQUIRED`(403)로 막힌다.
     * 종전에는 그 실패가 일반 저장 실패 문구 + 무한 [재시도]로 끝나 **온보딩이 막다른 길**이
     * 됐다 — 앱에 다른 재제출 경로가 없었기 때문이다(ONB-006은 `consentsAccepted`가 참일 때만
     * 뜨고, SET-003의 재동의 버튼은 온보딩을 마쳐야 닿는 탭 안에 있다).
     *
     * 그래서 여기서 **한 번만** 스스로 푼다: 동의를 다시 올린 뒤 같은 저장을 한 번 재시도한다.
     * 같은 Idempotency-Key를 그대로 쓰므로(위 submitChild) 재시도가 아이를 두 번 만들 수 없다.
     * 규칙(1회 한정, 재동의 실패 시 원래 오류 유지)은 순수 모듈 한 곳에 있고 거기서 테스트된다
     * (src/onboarding/consent-recovery.ts).
     */
    mutationFn: () => saveWithConsentRecovery(submitChild, () => upsertConsents(authToken!)),
    onSuccess: (child) => {
      setSelectedChildId(child.id);
      completeStep("ONB-002");
      clearChildCreateIdempotencyKey();
      router.push("/onboarding/prepared-items");
    }
  });

  return (
    <AppScreen>
      <View testID="screen-ONB-002" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-002" />
        <ScreenHeader eyebrow="아이 프로필" title="아이를 소개해 주세요" subtitle="태명이나 별명을 알려주시면 앞으로 이렇게 부를게요." />

        <Card style={{ gap: theme.spacing.gap }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
              태명 / 별명
            </Text>
            <TextInput
              accessibilityLabel="태명 또는 별명 입력"
              returnKeyType="done"
              onChangeText={(value) => {
                setNickname(value);
                setNicknameTouched(true);
              }}
              placeholder="예) 튼튼이"
              style={{
                backgroundColor: theme.colors.beige,
                borderColor: nicknameTouched && nicknameError ? theme.colors.danger : "transparent",
                borderRadius: theme.radii.small,
                borderWidth: 1,
                color: theme.colors.brown,
                fontSize: theme.typography.body1.fontSize,
                minHeight: theme.touchTarget,
                paddingHorizontal: 14
              }}
              value={nickname}
            />
            {nicknameTouched && nicknameError ? (
              <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{nicknameError}</Text>
            ) : null}
          </View>

          {dateLabel ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                {dateLabel}
              </Text>
              {/* 라운드 65 D: 손타이핑 칸 + 달력 버튼(48dp)이 한 줄에 선다 — 지출 입력 시트의
                  날짜 줄과 같은 문법이다(같은 아이콘·같은 크기·같은 테두리). */}
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <TextInput
                  accessibilityLabel={`${dateLabel} 입력`}
                  // 라운드 45 UX-Y(S): 예정일/생년월일은 숫자와 하이픈만 쓰는 입력이라 지출 화면의
                  // 날짜 직접 입력(app/expenses/[expenseId].tsx)과 **같은 값**을 쓴다.
                  // 라운드 45 O-7(주석 정정): numbers-and-punctuation은 iOS 전용 값이다 — iOS에서는
                  // 숫자·기호 키보드가 뜨고, Android는 이 값을 모르므로 기본 키보드가 그대로 뜬다
                  // (거기서는 maxLength 10자만 오타를 줄인다). 지출 화면과 값을 맞추는 것이 목적이라
                  // 동작은 그대로 두고, 형식/달력 검증은 종전대로 computeDateError가 한다.
                  // 라운드 65 D: 안드로이드에서 하이픈을 찾아 열 글자를 치던 그 경로의 **대안**이
                  // 옆 달력 버튼이다. 이 칸은 그대로 남는다.
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  returnKeyType="done"
                  onChangeText={(value) => {
                    setDateText(value);
                    setDateTouched(true);
                  }}
                  placeholder="YYYY-MM-DD"
                  style={{
                    backgroundColor: theme.colors.beige,
                    borderColor: dateTouched && dateError ? theme.colors.danger : "transparent",
                    borderRadius: theme.radii.small,
                    borderWidth: 1,
                    color: theme.colors.brown,
                    flex: 1,
                    fontSize: theme.typography.body1.fontSize,
                    minHeight: theme.touchTarget,
                    paddingHorizontal: 14
                  }}
                  value={dateText}
                />
                <Pressable
                  accessibilityLabel={`${dateLabel} 달력에서 고르기`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: datePickerOpen }}
                  onPress={() => setDatePickerOpen((value) => !value)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: theme.colors.white,
                    borderColor: "rgba(74, 63, 53, 0.10)",
                    borderRadius: 14,
                    borderWidth: 1,
                    height: 48,
                    justifyContent: "center",
                    opacity: pressed ? 0.76 : 1,
                    width: 48
                  })}
                >
                  <AppIcon color={theme.colors.mainCoral} name="calendar-blank-outline" size={22} />
                </Pressable>
              </View>
              {/* 지출 화면과 **같은 픽커**다(src/expenses/ExpenseDatePicker.tsx). 예정일만
                  미래 쪽이 만삭까지 열리고(direction), 그 상한은 도메인의 임신 주차 규칙에서
                  온다 — 화면은 어느 날짜가 되는지 스스로 판정하지 않는다. */}
              {datePickerOpen ? (
                <ExpenseDatePicker
                  direction={childDatePickerDirection(draft.stageMode)}
                  onSelectDate={(dateIso) => {
                    // 손타이핑 칸과 **같은 상태**를 갱신한다 — 저장 payload가 보는 값은
                    // dateText 하나뿐이라(buildCreateChildBody) 두 경로가 갈릴 자리가 없다.
                    setDateText(dateIso);
                    setDateTouched(true);
                    setDatePickerOpen(false);
                  }}
                  selectedIso={dateText}
                  todayIso={todayIso}
                />
              ) : null}
              {dateTouched && dateError ? (
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{dateError}</Text>
              ) : (
                <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
                  시기에 맞는 준비물과 리포트를 보여드리는 데 써요. 나중에 설정에서 바꿀 수 있어요.
                </Text>
              )}
            </View>
          ) : null}

          {draft.stageMode === "manual" ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                아이 단계 선택
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CHILD_STAGE_CODES.map((code) => (
                  <CategoryChip
                    key={code}
                    label={CHILD_STAGE_LABELS[code]}
                    selected={manualStage === code}
                    onPress={() => setManualStage(code)}
                  />
                ))}
              </View>
              {manualStageError ? (
                <Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{manualStageError}</Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {/* 라운드 65 후속(#1): CONSENT_REQUIRED에는 [다시 동의하고 저장]이 선다. 핸들러가
            같은 mutate인 이유는 mutationFn이 이미 "재동의 → 저장 1회"를 하기 때문이다 —
            버튼이 말하는 일과 실제로 일어나는 일이 한 자리에서 같다. */}
        {save.isError ? (
          <OnboardingSaveErrorCard
            error={save.error}
            onReconsent={() => save.mutate()}
            onRetry={() => save.mutate()}
          />
        ) : null}

        <PrimaryButton
          disabled={!canSave || save.isPending}
          label={save.isPending ? "저장하는 중" : "다음"}
          onPress={() => save.mutate()}
        />
      </View>
    </AppScreen>
  );
}
