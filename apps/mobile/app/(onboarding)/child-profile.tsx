import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CHILD_STAGE_CODES, getSeoulToday, type ChildStageCode } from "@wooriai/domain";
import { LOCAL_HOUSEHOLD_ID, LOCAL_SESSION_TOKEN, upsertConsents } from "../../src/api/client";
// MOB-118: the date guard (isFutureSeoulDate/isValidCalendarDate wiring), stage labels, and
// date-field label moved verbatim to src/children/child-form.ts so the settings 아이 관리
// screen's edit/add forms reuse exactly this screen's validation -- see that module.
// 라운드 99 트랙 F1(M): 멱등키를 본문에 묶는 지문 — 설정 아이 추가와 같은 한 벌이다.
import { childCreateBodyFingerprint } from "../../src/children/child-create-idempotency";
import {
  buildCreateChildBody,
  childDatePickerDirection,
  childNicknameMaxLength,
  childProfileReassuranceNotes,
  CHILD_STAGE_LABELS,
  requiredDateFieldLabel,
  validateChildForm
} from "../../src/children/child-form";
// A11Y-115(라운드 108-T20 이월 · 과제 1): 검증 오류의 낭독 규율은 한 벌이 소유한다
// (재낭독 금지 · 갈래가 닫히면 기억을 지운다 — src/a11y/use-field-error-announcement.ts).
import { useFieldErrorAnnouncement } from "../../src/a11y/use-field-error-announcement";
import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";
import { createOnboardingChild } from "../../src/onboarding/child-create";
import { saveWithConsentRecovery } from "../../src/onboarding/consent-recovery";
// 라운드 72 트랙 A(#1): 이 기기가 이미 아이를 만들었다는 사실과, 그 아이로 이어가는 길.
import {
  hasLocallyCreatedChild,
  localOnboardingResumeRoute,
  ONBOARDING_CHILD_ALREADY_CREATED_CONTINUE_LABEL,
  ONBOARDING_CHILD_ALREADY_CREATED_NOTICE
} from "../../src/onboarding/local-progress";
import {
  OnboardingSaveErrorCard,
  OnboardingStepProgress,
  useOnboardingStepAnalytics
} from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon } from "../../src/design-system";
import { AppScreen, Card, CategoryChip, PrimaryButton, ScreenHeader, SecondaryButton } from "../../src/ui";
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
  // 라운드 72 트랙 A(#1): 이 화면이 **다시 열린 경우**를 알아보는 로컬 사실 둘.
  const completedStepIds = useOnboardingProgressStore((state) => state.completedStepIds);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const getOrCreateChildCreateIdempotencyKey = useOnboardingProgressStore(
    (state) => state.getOrCreateChildCreateIdempotencyKey
  );
  const clearChildCreateIdempotencyKey = useOnboardingProgressStore((state) => state.clearChildCreateIdempotencyKey);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();

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
  /**
   * A11Y-115(라운드 108-T20 이월) ⚠️ **두 시점** — *종전*: 이 화면의 검증 오류 셋은 전부 맨
   * `<Text>`라 낭독 출구가 **0건**이었다(그때는 참이었다 — 라운드 79·80의 낭독 스윕은
   * `useMutation`/`useQuery`에 닿는 조건 아래 선 실패 문장만 모집단으로 삼는데, 이 셋의 가드는
   * `validateChildForm`이 입력칸 상태에서 파생하는 **순수 계산**이라 그 그물 **밖**이다 —
   * `src/a11y-contract.test.ts`의 `mutationTriggerSitesOf`가 닿지 않는 자리는 아예 버린다).
   * 그래서 태명·날짜·단계를 잘못 친 사람은 포커스가 입력칸(또는 방금 누른 칩)에 남은 채
   * [다음]이 왜 잠겼는지 소리로는 알 수 없었다. *이제*: T20이 지출 수정·예산 여섯 자리에 세운
   * **그 한 벌 그대로** 진다 — 문장 쪽에는 프롭 둘, 낭독은 훅이 소유한다.
   * **새 한국어 문장 0건**이고, 읽히는 것은 화면이 이미 그리고 있는 그 문자열이다.
   *
   * ⚠️ **훅에 넘기는 값은 "오류가 있는가"가 아니라 "화면이 그 줄을 그리는가"다.** 앞의 둘은
   * touched 게이트 뒤에서만 그려지므로(위 `nicknameTouched`/`dateTouched` 주석 — 아직 손대지
   * 않은 칸을 꾸짖지 않는다) 게이트를 그대로 실어 넘긴다. 그러지 않으면 빈 칸으로 시작하는 이
   * 화면이 **첫 렌더에서** "태명 또는 별명을 입력해 주세요."를 낭독한다 — 눈에는 없는 문장을
   * 귀에만 들려주는 것이라, 그 가드가 지키려던 규율을 소리 쪽에서 되돌리는 셈이다.
   * 셋째(`manualStageError`)는 게이트가 필요 없다: 판정 자체가 `stageMode === "manual"`일 때만
   * 문장을 만들고(`src/children/child-form.ts`), 그 조건이 곧 그 줄이 그려지는 조건이다.
   *
   * ⚠️ 훅이므로 조건 밖에서 부른다(FIX-A) — 오류가 없을 때도 `null`을 넘긴다. 조건부 호출은
   * 훅 순서를 깨고, 무엇보다 "갈래가 닫혔다"를 훅이 볼 수 없게 만든다(훅 머리말).
   * 호출 순서는 위 파생(구조 분해) 순서 그대로다.
   */
  useFieldErrorAnnouncement(nicknameTouched ? nicknameError : null);
  useFieldErrorAnnouncement(dateTouched ? dateError : null);
  useFieldErrorAnnouncement(manualStageError);
  const dateLabel = useMemo(() => requiredDateFieldLabel(draft.stageMode), [draft.stageMode]);

  /**
   * 라운드 72 트랙 A(#1) — **중복 생성의 최후 방어.**
   *
   * 서버 진행도가 답하지 않는 콜드 스타트는 이제 로컬 폴백이 받으므로(app/index.tsx) 이 화면이
   * 그 경로로 다시 열리지는 않는다. 그래도 뒤로 가기·딥링크로 다시 열릴 길은 남고, 그때 화면이
   * 아무 말도 하지 않으면 사용자는 어제 만든 아이를 모른 채 같은 태명을 한 번 더 적는다 —
   * 그 제출은 **새 멱등키**를 들고 나가므로(성공 시 키가 지워졌다) 서버가 막지 않는다.
   *
   * **막지 않고 말한다.** 폼도 [다음]도 그대로다 — 둘째 아이를 같은 이름으로 만드는 것은 정당할
   * 수 있고, 그 판정은 서버 쪽이라 DNC-007에 닿는 별도 결정이다(이 트랙은 서버 0건이다).
   * 대신 사실 한 줄과 **이미 만든 아이로 이어가는 길**을 함께 준다. 목적지는 손으로 적지 않고
   * 로컬 목적지 표에서 받는다(라우트 표를 두 벌로 만들지 않는다).
   */
  const alreadyHasLocalChild = hasLocallyCreatedChild({ completedStepIds, selectedChildId });
  const continueHref = localOnboardingResumeRoute({ completedStepIds, selectedChildId });
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
    // 바디 조립은 설정 화면의 아이 추가와 같은 shared 모듈에서 온다(단일 소스).
    const body = buildCreateChildBody(householdId, draft.stageMode, { nickname, dateText, manualStage });
    // MOB-101: reuse the same Idempotency-Key across retries of this submission (network
    // retry, or a resumed app restarting the mutation) so the server never creates a second
    // child for the household -- see round5a-sprint1-plan.md §4.
    //
    // 라운드 99 트랙 F1(M) — ⚠️ 두 시점: 종전에는 인자 없이 불렀다("키가 있으면 무조건 재사용").
    // 응답을 잃은 사람이 입력을 **고쳐** 다시 제출하면 같은 키 + 다른 본문이 나갔고, 서버는
    // 409 IDEMPOTENCY_KEY_CONFLICT(24h)로 영원히 거절했다 — 표에도 없던 코드라 안내마저
    // "네트워크를 확인하라"였다. 이제 본문 지문을 넘겨 **같은 본문일 때만** 키가 재사용된다
    // (판정·지문 계산은 스토어와 공용 모듈에 있다 — 이 화면은 값만 잇는다).
    const idempotencyKey = getOrCreateChildCreateIdempotencyKey(childCreateBodyFingerprint(body));
    return createOnboardingChild(authToken, body, idempotencyKey);
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
      /**
       * 라운드 83 트랙 D(GAP-083 #3) — **방금 만든 아이를 목록 캐시에도 알린다.**
       *
       * `["children"]`을 바꾸는 쓰기 경로 중 이 자리만 성공 뒤 아무것도 무효화하지 않았다
       * (설정 > 아이 관리·아이 삭제·가구 탈퇴·초대 수락은 전부 한다 —
       * src/query/shared-cache-policy.ts의 CHILDREN_WRITE_LEDGER). 이 화면 자신은 그 키를
       * 읽지 않아 증상이 없었고, 전역 기본 30초가 그 뒤를 덮고 있었다. 그래서 **기본값을
       * 늘리려는 사람이 처음 만나는 구멍**이었다 — 같은 트랙이 이 키를 5분으로 올리므로
       * 이 한 줄이 먼저 서야 한다.
       *
       * `await`하지 않는다: 이 화면에는 `["children"]` 활성 관찰자가 없어 기다릴 재조회가
       * 없고, 저장 성공 후의 이동 타이밍(ONB-002 → ONB-003)을 한 틱도 바꾸지 않기 위해서다.
       * 저장·재시도·동의 복구·Idempotency-Key 규칙은 이 줄 위로 한 글자도 달라지지 않았다.
       */
      void queryClient.invalidateQueries({ queryKey: ["children"] });
      router.push("/onboarding/prepared-items");
    }
  });

  return (
    <AppScreen>
      <View testID="screen-ONB-002" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-002" />
        {/**
         * 라운드 108(온보딩 나가는 길) — ⚠️ 두 시점: **이 화면에는 화면 안 뒤로가기가 없었다.**
         *
         * 종전 그 면제의 사유는 `src/screen-header-back.test.ts`의 표에 이렇게 적혀 있었다 —
         * *"선형 온보딩의 첫 입력 걸음이라 되돌아갈 앞 화면이 없다(그 뒤는 로그인·런치
         * 애니메이션이고 돌아가면 계정 흐름으로 떨어진다)"*. ⚠️⚠️ **그 문장은 틀렸다**(그때도
         * 틀렸다 — 사실이 바뀐 것이 아니라 처음부터 이 화면의 사실이 아니었다). 근거 셋:
         *
         *  ① 이 화면에 이르는 길은 오늘 **하나뿐**이고 그것이 `push`다 —
         *     `app/(onboarding)/child-status.tsx`의 `router.push("/onboarding/child-profile")`.
         *     그러므로 앞 화면(ONB-001)은 **언제나 스택에 남아 있다.**
         *  ② 이어하기도 여기로 오지 않는다: `routeForOnboardingNextStep`은 "child-profile"과
         *     "consents"를 둘 다 **ONB-001**로 보낸다(`src/onboarding/resume.ts` — 아이를 아직
         *     만들지 않은 자리라 맨 위에서 다시 시작하는 것이 언제나 안전하다는 그 판단).
         *     즉 이 화면이 `replace`로 열리는 경로 자체가 없다.
         *  ③ 이 저장소는 그 복귀를 **이미 알고 있었다**: ONB-001의 `useFocusEffect`가
         *     *"coming back from ONB-002"*를 받으려고 서 있다(ONB-105 주석). 되돌아오는 사람이
         *     없었다면 그 코드가 있을 이유가 없다.
         *
         * 그래서 없던 것은 *되돌아갈 곳*이 아니라 **되돌아갈 문**이었다 — 상태를 잘못 고른
         * 사람은 안드로이드 하드웨어 뒤로가기를 아는 경우에만 우연히 돌아갔다. 문법은 열둘이
         * 쓰는 그 한 관례 그대로다(새 슬롯·새 라벨·새 한국어 문구 0건 — 라벨 "뒤로가기"는
         * `src/ui.tsx`의 공용 슬롯이 이미 지닌 하나다).
         *
         * ⚠️ 앞 걸음(ONB-001)에는 이 문을 세우지 않는다: 그 화면에 이르는 길은 전부
         * `Redirect`/`replace`라 스택에 앞 화면이 남지 않고, 그 뒤에 있는 것이 정말로 로그인
         * 흐름이다(위 종전 사유가 참인 자리는 이 화면이 아니라 **그 화면**이었다).
         */}
        <ScreenHeader
          eyebrow="아이 프로필"
          title="아이를 소개해 주세요"
          subtitle="태명이나 별명을 알려주시면 앞으로 이렇게 부를게요."
          onBack={() => router.back()}
        />

        {/* 라운드 72 트랙 A(#1): 이 기기가 이미 아이를 만든 상태로 이 화면이 다시 열렸다는 사실.
            안내일 뿐 차단이 아니다 -- 아래 폼과 [다음]은 그대로 쓸 수 있다. */}
        {alreadyHasLocalChild && continueHref ? (
          <View testID="onboarding-child-already-created">
            <Card style={{ gap: theme.spacing.gap }}>
              <Text style={{ color: theme.colors.brown, fontSize: theme.typography.body2.fontSize, lineHeight: 20 }}>
                {ONBOARDING_CHILD_ALREADY_CREATED_NOTICE}
              </Text>
              <SecondaryButton
                accessibilityLabel={ONBOARDING_CHILD_ALREADY_CREATED_CONTINUE_LABEL}
                label={ONBOARDING_CHILD_ALREADY_CREATED_CONTINUE_LABEL}
                onPress={() => router.replace(continueHref)}
              />
            </Card>
          </View>
        ) : null}

        <Card style={{ gap: theme.spacing.gap }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
              태명 / 별명
            </Text>
            {/* 라운드 107 트랙 F: 상한 값을 화면에 다시 적지 않고 단일 소스에서 읽는다 — 61자는
                예전에 DB에서 P2000으로 터져 500이 됐다(child-form.ts의 상한 주석). 판정 자체는
                validateChildForm이 지고 이 속성은 거들기만 한다(붙여넣기·자동완성 경로). */}
            <TextInput
              accessibilityLabel="태명 또는 별명 입력"
              maxLength={childNicknameMaxLength()}
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
              /* A11Y-115(라운드 108-T20 이월): **맨 문장**에 프롭 둘을 건다 — T20이 고른 두 모양
                 가운데 관례의 기본형이다(둘째 모양인 alert 컨테이너는 여는 태그가 소유 밖 계약에
                 바이트로 핀돼 있을 때만 쓴다 — `src/expenses/auto-fill-wiring.test.ts`가 지출 수정
                 화면 넷을 붙드는 그 사정). 이 화면의 세 여는 태그를 붙드는 핀은 오늘 **0건**이라
                 (`nicknameError`·`manualStageError`를 인용하는 테스트 넷은 전부 판정 값이나
                 `"!manualStageError"` 같은 조각을 물지 태그 바이트를 물지 않는다) 기본형이 그대로
                 선다. 프롭 순서는 같은 앱의 예산 화면(app/budget.tsx)과 같다. */
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}
              >
                {nicknameError}
              </Text>
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
                    borderColor: theme.colors.presentation.hairlineStrong,
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
                /* A11Y-115(라운드 108-T20 이월): 태명 오류와 **같은 한 벌**(위 첫 자리의 주석이
                   기본형을 고른 근거다). 갈래의 else(회색 안내 한 줄)는 오류가 아니므로 종전
                   그대로 조용하다 — 예산 화면의 같은 갈래와 같은 판정이다. */
                <Text
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}
                >
                  {dateError}
                </Text>
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
                /* A11Y-115(라운드 108-T20 이월): 태명 오류와 **같은 한 벌**. 이 자리의 포커스는
                   입력칸이 아니라 방금 누른 단계 칩(또는 아직 아무 칩도 아닌 곳)에 남는다 —
                   조건이 같으므로(새 문장이 서는데 포커스가 그리로 가지 않는다) 모양도 같다. */
                <Text
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}
                >
                  {manualStageError}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* T9(토스급 정비) — 안심 문구 두 줄(공개 범위 · 수정/삭제 가능). 첫 실행에서 가장
              민감한 값을 요구하는 화면이 그 값의 운명을 말하지 않고 있었다. 문장은 화면이 짓지
              않는다 — 근거까지 순수 모듈에 있다(src/children/child-form.ts의
              childProfileReassuranceNotes 주석). */}
          <View style={{ gap: 4 }}>
            {childProfileReassuranceNotes().map((note) => (
              <Text
                key={note}
                style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, lineHeight: 18 }}
              >
                {note}
              </Text>
            ))}
          </View>
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
