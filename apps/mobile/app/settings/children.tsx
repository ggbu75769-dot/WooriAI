import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { CHILD_STAGE_CODES, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";
import {
  createChild,
  listChildren,
  listHouseholdMembers,
  updateChild,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  LOCAL_USER_ID,
  type Child
} from "../../src/api/client";
import {
  BORN_TRANSITION_ACTION_LABEL,
  BORN_TRANSITION_CONFIRM_CTA,
  BORN_TRANSITION_CONFIRM_MESSAGE,
  BORN_TRANSITION_CONFIRM_TITLE,
  buildCreateChildBody,
  buildUpdateChildBody,
  canTransitionStageMode,
  CHILD_STAGE_LABELS,
  CHILD_STAGE_MODE_OPTIONS,
  isChildFormValid,
  requiredDateFieldLabel,
  validateChildForm,
  type ChildFormValues
} from "../../src/children/child-form";
import { getOrCreateChildCreateKey, rotateChildCreateKey } from "../../src/children/child-create-idempotency";
import { applyChildSwitch, CHILD_SCOPED_QUERY_KEY_PREFIXES } from "../../src/children/child-switch";
import { useSaveErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  announceForA11y,
  AppScreen,
  Card,
  CategoryChip,
  EmptyStateCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  StatusBadge,
  Toast
} from "../../src/ui";

const emptyForm: ChildFormValues = { nickname: "", dateText: "", manualStage: null };

/**
 * MOB-118 (SET-005 아이 관리): child list with the current selection marked, tap-to-switch
 * (persisted selectedChildId + child-scoped query invalidation), inline edit of
 * 태명/생년월일·예정일/수동 단계 (validation shared with onboarding ONB-002 via
 * src/children/child-form.ts), and 아이 추가 for a second child. Editing/adding is gated to
 * owner/co_parent -- view-only roles (viewer, gift_participant) can only look and switch,
 * matching the server's HouseholdRoleGuard/requireChildAccess(edit) contract.
 *
 * FIX-118B(F2): 아이 추가 carries an Idempotency-Key (src/children/child-create-idempotency.ts),
 * so a lost response cannot turn a user retry into two children -- the same protection onboarding
 * (ONB-002/MOB-101) already had, with a settings-scoped key.
 *
 * FIX-118B(F3): 아이 추가 is hidden entirely in the demo (local-backend) session. The demo backend
 * keeps exactly ONE child record -- localBackend.createChild() *renames* the seeded fixture child
 * and returns LOCAL_CHILD_ID -- so the old flow reported "추가했어요" for something that never
 * happened (a false success). The demo session gets an explicit 안내 instead.
 */

/**
 * CHILD-127: the labeled YYYY-MM-DD input, lifted out of ChildFormFields so the
 * "아이가 태어났어요" 전환 카드 reuses the exact same field (label, a11y label, error styling)
 * instead of growing a second, drifting date input.
 */
function ChildDateField({
  dateLabel,
  value,
  error,
  showErrors,
  onChange
}: {
  dateLabel: string;
  value: string;
  error: string | null;
  showErrors: boolean;
  onChange: (dateText: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={fieldLabelStyle}>{dateLabel}</Text>
      <TextInput
        accessibilityLabel={`${dateLabel} 입력`}
        // 라운드 45 UX-Y(S): ONB-002와 같은 키보드 값 + YYYY-MM-DD 10자 제한.
        // 라운드 45 O-7(주석 정정): numbers-and-punctuation은 iOS 숫자·기호 키보드이고,
        // Android는 기본 키보드 + maxLength만 적용된다. 검증은 기존
        // validateChildForm/computeDateError 그대로.
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        returnKeyType="done"
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        style={[fieldInputStyle, showErrors && error ? fieldInputErrorStyle : null]}
        value={value}
      />
      {showErrors && error ? <Text style={fieldErrorStyle}>{error}</Text> : null}
    </View>
  );
}

/** Shared form fields (nickname + mode-appropriate date + manual stage chips) for edit/add. */
function ChildFormFields({
  stageMode,
  values,
  onChange,
  showErrors
}: {
  stageMode: ChildStageMode;
  values: ChildFormValues;
  onChange: (values: ChildFormValues) => void;
  showErrors: boolean;
}) {
  const errors = validateChildForm(stageMode, values, { requireDate: true });
  const dateLabel = requiredDateFieldLabel(stageMode);
  return (
    <View style={{ gap: theme.spacing.gap }}>
      <View style={{ gap: 6 }}>
        <Text style={fieldLabelStyle}>태명 / 별명</Text>
        <TextInput
          accessibilityLabel="태명 또는 별명 입력"
          returnKeyType="done"
          onChangeText={(nickname) => onChange({ ...values, nickname })}
          placeholder="예) 튼튼이"
          style={[fieldInputStyle, showErrors && errors.nicknameError ? fieldInputErrorStyle : null]}
          value={values.nickname}
        />
        {showErrors && errors.nicknameError ? <Text style={fieldErrorStyle}>{errors.nicknameError}</Text> : null}
      </View>

      {dateLabel ? (
        <ChildDateField
          dateLabel={dateLabel}
          value={values.dateText}
          error={errors.dateError}
          showErrors={showErrors}
          onChange={(dateText) => onChange({ ...values, dateText })}
        />
      ) : null}

      {stageMode === "manual" ? (
        <View style={{ gap: 6 }}>
          <Text style={fieldLabelStyle}>아이 단계 선택</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CHILD_STAGE_CODES.map((code) => (
              <CategoryChip
                key={code}
                label={CHILD_STAGE_LABELS[code]}
                selected={values.manualStage === code}
                onPress={() => onChange({ ...values, manualStage: code })}
              />
            ))}
          </View>
          {showErrors && errors.manualStageError ? <Text style={fieldErrorStyle}>{errors.manualStageError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function formValuesForChild(child: Child): ChildFormValues {
  return {
    nickname: child.nickname,
    dateText: child.stageMode === "pregnant" ? (child.dueDate ?? "") : child.stageMode === "born" ? (child.birthDate ?? "") : "",
    manualStage: child.manualStage
  };
}

export default function ManageChildrenScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionUserId = useSessionStore((state) => state.userId);
  const userId = sessionUserId ?? (isTestSession ? LOCAL_USER_ID : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const householdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();

  // FIX-118B(F3): the demo session talks to the in-memory local backend, whose createChild only
  // renames the single fixture child -- 아이 추가 cannot honestly succeed there.
  const isDemoSession = authToken === LOCAL_SESSION_TOKEN;

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  // CHILD-127: the 아이가 태어났어요 전환 카드 (birth-date entry) is its own open/error state so it
  // never fights the edit form for `form`/`showErrors`.
  const [bornChildId, setBornChildId] = useState<string | null>(null);
  const [bornDateText, setBornDateText] = useState("");
  const [bornShowErrors, setBornShowErrors] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addStageMode, setAddStageMode] = useState<ChildStageMode>("born");
  const [form, setForm] = useState<ChildFormValues>(emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  /**
   * 라운드 52 C-07: 아이 프로필 저장/추가는 아웃박스를 거치지 않는 서버 직행 쓰기라 오프라인에서는
   * 그냥 실패한다. 그때 "잠시 후 다시 시도해 주세요"는 기다릴 대상이 있다는 뜻이라 사실과
   * 어긋난다 -- 실패한 그 순간에 연결을 한 번 확인해 문구를 고른다(src/offline/messages.ts).
   * 세 뮤테이션(편집·출생 전환·추가)이 같은 자리 문구를 쓰므로 판정도 하나다.
   *
   * 라운드 52 QA P3-1: 그 확인은 조회 실패 카드와 **같은 공용 훅**이 한다(useSaveErrorCopy).
   * 예전에는 각 뮤테이션의 onError가 직접 폴을 띄워, 저장 실패 직후 화면을 떠나면 사라진
   * 화면에 setState가 걸렸다 -- 이 화면이 토스트 타이머에 대해 지키는 "never setState after
   * unmount" 규율을 문구 쪽만 지키지 않고 있던 셈이다. 훅의 cancelled 패턴이 그 자리를 덮고,
   * 세 뮤테이션이 모두 성공/초기 상태로 돌아가면 문구도 기본값으로 복원된다.
   *
   * 세 상태의 OR을 넘기는 이유: 실패한 뮤테이션이 무엇이든 사용자가 보는 문장은 아래 한
   * 자리이므로(각 카드의 danger 텍스트), 판정도 하나면 된다.
   */
  // Same timer-in-ref discipline as more.tsx's export toast: never setState after unmount.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX-118B(F2): Idempotency-Key holder for 아이 추가 -- see child-create-idempotency.ts.
  const addIdempotencyKeyRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);
  const showToast = (message: string, tone: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  };

  const hasSession = Boolean(authToken);
  const children = useQuery({
    queryKey: ["children"],
    enabled: hasSession,
    queryFn: () => listChildren(authToken!)
  });
  // Role gate (same lookup convention as app/family/index.tsx): editing is owner/co_parent
  // only; while members are still loading we default to view-only rather than flashing edit
  // controls a viewer must not use.
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const myRole = members.data?.members.find((member) => member.userId === userId)?.role;
  const canEditChildren = myRole === "owner" || myRole === "co_parent";

  const invalidateChildScopedQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["children"] });
    await Promise.all(
      CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
    );
  };

  const saveEdit = useMutation({
    mutationFn: (input: { child: Child; values: ChildFormValues }) =>
      updateChild(authToken!, input.child.id, buildUpdateChildBody(input.child.stageMode, input.values)),
    onSuccess: async (updated) => {
      setEditingChildId(null);
      setShowErrors(false);
      // A birth/due-date change moves the server-computed stage, which drives 준비템 추천
      // 밴드와 홈/리포트 -- refresh everything child-scoped, not just the list.
      await invalidateChildScopedQueries();
      showToast(`${updated.nickname} 정보를 저장했어요.`, "success");
    }
  });

  /**
   * CHILD-127: 임신 → 출생 전환. 서버는 stageMode와 birthDate를 한 요청에 함께 받아야 하고
   * (CHILD_STAGE_INPUT_REQUIRED), 되돌릴 수 없다. 전환은 currentStage/준비템 밴드/홈/리포트를
   * 전부 바꾸므로 편집과 똑같이 아이 스코프 캐시를 모두 무효화한다.
   */
  const markChildBorn = useMutation({
    mutationFn: (input: { child: Child; values: ChildFormValues }) =>
      updateChild(
        authToken!,
        input.child.id,
        buildUpdateChildBody(input.child.stageMode, input.values, { transitionToStageMode: "born" })
      ),
    onSuccess: async (updated) => {
      setBornChildId(null);
      setBornDateText("");
      setBornShowErrors(false);
      await invalidateChildScopedQueries();
      showToast(`${updated.nickname} 정보를 출생일 기준으로 바꿨어요.`, "success");
      announceForA11y(`${updated.nickname} 화면이 출생일 기준으로 바뀌었어요.`);
    }
  });

  const addChild = useMutation({
    mutationFn: (input: { stageMode: ChildStageMode; values: ChildFormValues }) =>
      createChild(
        authToken!,
        buildCreateChildBody(householdId!, input.stageMode, input.values),
        // FIX-118B(F2): one key per input session, reused by every retry of THIS submission --
        // a lost response can no longer be retried into a second child.
        getOrCreateChildCreateKey(addIdempotencyKeyRef)
      ),
    onSuccess: async (created, input) => {
      // 성공 시 회전: the next 아이 추가 must be a genuinely new creation, not a replay of this one.
      rotateChildCreateKey(addIdempotencyKeyRef);
      setAddOpen(false);
      setShowErrors(false);
      setForm(emptyForm);
      // Select the newly added child right away (same behavior as onboarding ONB-002).
      setSelectedChildId(created.id);
      await invalidateChildScopedQueries();
      showToast(`${input.values.nickname.trim()}를 추가했어요.`, "success");
      announceForA11y(`${input.values.nickname.trim()}를 추가하고 선택했어요.`);
    }
  });

  // C-07/QA P3-1: 세 뮤테이션이 함께 쓰는 저장 실패 문구(위 주석 참고).
  const saveFailedText = useSaveErrorCopy(saveEdit.isError || markChildBorn.isError || addChild.isError);

  // HOME-138: 전환의 부수효과 순서(스토어 쓰기 → 아이 스코프 캐시 무효화 → 안내)는
  // applyChildSwitch 한 곳에만 있다 -- 홈 헤더 1탭 전환이 같은 함수를 부른다.
  const handleSelect = (child: Child) => {
    applyChildSwitch(selectedChildId, child, {
      setSelectedChildId,
      invalidateQueries: (input) => queryClient.invalidateQueries(input),
      announce: announceForA11y
    });
  };

  const startEdit = (child: Child) => {
    setAddOpen(false);
    setShowErrors(false);
    setBornChildId(null);
    saveEdit.reset();
    setEditingChildId(child.id);
    setForm(formValuesForChild(child));
  };

  const startBornTransition = (child: Child) => {
    setAddOpen(false);
    setEditingChildId(null);
    setBornShowErrors(false);
    setBornDateText("");
    markChildBorn.reset();
    setBornChildId(child.id);
  };

  const bornTransitionValues = (child: Child): ChildFormValues => ({
    nickname: child.nickname,
    dateText: bornDateText,
    manualStage: null
  });

  const submitBornTransition = (child: Child) => {
    setBornShowErrors(true);
    const values = bornTransitionValues(child);
    // 출생일은 편집 폼과 같은 규칙으로 검증한다 (형식·실재하는 날짜·미래 금지, 빈 값 금지).
    const errors = validateChildForm("born", values, { requireDate: true });
    if (!isChildFormValid(errors) || markChildBorn.isPending) return;
    if (!canTransitionStageMode(child.stageMode, "born")) return;
    Alert.alert(BORN_TRANSITION_CONFIRM_TITLE, BORN_TRANSITION_CONFIRM_MESSAGE, [
      { text: "취소", style: "cancel" },
      { text: BORN_TRANSITION_CONFIRM_CTA, onPress: () => markChildBorn.mutate({ child, values }) }
    ]);
  };

  const startAdd = () => {
    setEditingChildId(null);
    setBornChildId(null);
    setShowErrors(false);
    addChild.reset();
    // 입력 세션당 1키: opening the form starts a new idempotency scope (a previous session's
    // key must never dedupe this one away).
    rotateChildCreateKey(addIdempotencyKeyRef);
    setAddOpen(true);
    setAddStageMode("born");
    setForm(emptyForm);
  };

  const submitEdit = (child: Child) => {
    setShowErrors(true);
    const errors = validateChildForm(child.stageMode, form, { requireDate: true });
    if (!isChildFormValid(errors) || saveEdit.isPending) return;
    saveEdit.mutate({ child, values: form });
  };

  const submitAdd = () => {
    setShowErrors(true);
    const errors = validateChildForm(addStageMode, form, { requireDate: true });
    // isDemoSession도 방어적으로 막는다: 데모에서는 폼 자체가 열리지 않지만(F3),
    // 어떤 경로로든 여기 도달해도 허위 성공 토스트를 만들지 않게 한다.
    if (!isChildFormValid(errors) || addChild.isPending || !householdId || isDemoSession) return;
    addChild.mutate({ stageMode: addStageMode, values: form });
  };

  const childList = children.data?.children ?? [];
  const editingChild = childList.find((child) => child.id === editingChildId) ?? null;

  return (
    <AppScreen>
      <View testID="screen-SET-005" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="설정" title="아이 관리" subtitle="아이를 전환하거나 정보를 수정해요" onBack={() => router.back()} />

        {!hasSession ? <EmptyStateCard title="로그인 후 이용할 수 있어요." actionLabel="확인" /> : null}

        {hasSession && children.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {hasSession && children.isError ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
            <SecondaryButton label="다시 시도" onPress={() => children.refetch()} />
          </Card>
        ) : null}

        {hasSession && children.isSuccess && childList.length === 0 ? (
          <EmptyStateCard title="등록된 아이가 없어요" actionLabel="새로고침" onPress={() => children.refetch()} />
        ) : null}

        <View style={{ gap: theme.spacing.gap }}>
          {childList.map((child) => {
            const selected = child.id === selectedChildId;
            return (
              <Card key={child.id} style={{ gap: 10 }}>
                <View style={childRowStyle}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={selected ? `${child.nickname}, 현재 선택된 아이` : `${child.nickname}(으)로 전환`}
                    hitSlop={8}
                    onPress={() => handleSelect(child)}
                    style={{ flex: 1, gap: 2 }}
                  >
                    <Text style={childNameStyle}>{child.nickname}</Text>
                    <Text style={childStageStyle}>{child.stageLabel}</Text>
                  </Pressable>
                  {selected ? <StatusBadge label="현재 선택" tone="success" /> : null}
                  {canEditChildren ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${child.nickname} 정보 편집`}
                      hitSlop={8}
                      onPress={() => (editingChildId === child.id ? setEditingChildId(null) : startEdit(child))}
                    >
                      <Text style={editLinkStyle}>{editingChildId === child.id ? "닫기" : "편집"}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* CHILD-127: 임신 중으로 가입한 아이만 노출되는 단방향 전환 액션. */}
                {canEditChildren && canTransitionStageMode(child.stageMode, "born") && bornChildId !== child.id ? (
                  <SecondaryButton
                    accessibilityLabel={`${child.nickname} 출생일을 입력하고 출생일 기준으로 바꾸기`}
                    label={BORN_TRANSITION_ACTION_LABEL}
                    onPress={() => startBornTransition(child)}
                  />
                ) : null}

                {canEditChildren && bornChildId === child.id ? (
                  <View style={{ gap: theme.spacing.gap }}>
                    <Text style={mutedTextStyle}>
                      출생일을 입력하면 지금부터 출생일 기준으로 단계와 준비템을 보여드려요. 저장한 출산 예정일은 그대로
                      남아 있어요.
                    </Text>
                    <ChildDateField
                      dateLabel={requiredDateFieldLabel("born")!}
                      value={bornDateText}
                      error={validateChildForm("born", bornTransitionValues(child), { requireDate: true }).dateError}
                      showErrors={bornShowErrors}
                      onChange={setBornDateText}
                    />
                    {markChildBorn.isError ? <Text style={{ color: theme.colors.danger }}>{saveFailedText}</Text> : null}
                    <PrimaryButton
                      disabled={markChildBorn.isPending}
                      label={markChildBorn.isPending ? "바꾸는 중" : "출생일로 바꾸기"}
                      onPress={() => submitBornTransition(child)}
                    />
                    <SecondaryButton label="취소" onPress={() => setBornChildId(null)} />
                  </View>
                ) : null}

                {editingChild && editingChild.id === child.id ? (
                  <View style={{ gap: theme.spacing.gap }}>
                    <ChildFormFields
                      stageMode={editingChild.stageMode}
                      values={form}
                      onChange={setForm}
                      showErrors={showErrors}
                    />
                    {saveEdit.isError ? <Text style={{ color: theme.colors.danger }}>{saveFailedText}</Text> : null}
                    <PrimaryButton
                      disabled={saveEdit.isPending}
                      label={saveEdit.isPending ? "저장하는 중" : "저장"}
                      onPress={() => submitEdit(editingChild)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>

        {hasSession && !canEditChildren && members.isSuccess ? (
          <Card>
            <Text style={mutedTextStyle}>보기 전용 멤버는 아이 정보를 수정할 수 없어요.</Text>
          </Card>
        ) : null}

        {/* FIX-118B(F3): 데모 세션에서는 추가가 실제로 일어나지 않으므로 버튼 대신 안내만 둔다. */}
        {hasSession && canEditChildren && isDemoSession ? (
          <Card>
            <Text style={mutedTextStyle}>데모에서는 아이를 추가할 수 없어요. 로그인하면 아이를 추가할 수 있어요.</Text>
          </Card>
        ) : null}

        {hasSession && canEditChildren && !isDemoSession && !addOpen ? (
          <SecondaryButton accessibilityLabel="아이 추가" label="아이 추가" onPress={startAdd} />
        ) : null}

        {hasSession && canEditChildren && !isDemoSession && addOpen ? (
          <Card style={{ gap: theme.spacing.gap }}>
            <Text style={addTitleStyle}>새 아이 추가</Text>
            <View style={{ gap: 6 }}>
              <Text style={fieldLabelStyle}>지금 상황</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CHILD_STAGE_MODE_OPTIONS.map((option) => (
                  <CategoryChip
                    key={option.mode}
                    label={option.label}
                    selected={addStageMode === option.mode}
                    onPress={() => {
                      setAddStageMode(option.mode);
                      setForm((current) => ({ ...current, dateText: "", manualStage: null }));
                    }}
                  />
                ))}
              </View>
            </View>
            <ChildFormFields stageMode={addStageMode} values={form} onChange={setForm} showErrors={showErrors} />
            {addChild.isError ? <Text style={{ color: theme.colors.danger }}>{saveFailedText}</Text> : null}
            <PrimaryButton
              disabled={addChild.isPending}
              label={addChild.isPending ? "추가하는 중" : "추가하기"}
              onPress={submitAdd}
            />
            <SecondaryButton label="취소" onPress={() => setAddOpen(false)} />
          </Card>
        ) : null}

        {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
      </View>
    </AppScreen>
  );
}

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 19
} as const;

const childRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

const childNameStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800"
} as const;

const childStageStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700"
} as const;

// FIX-118B(F4): coral[500] on cream at 13px is 3.16:1 -- below A11Y-117's own small-coral-text
// rule. coral[700] is the contrast-safe token the shared kit already uses (ui.tsx smallCoralText).
const editLinkStyle = {
  color: theme.colors.coral[700],
  fontSize: 13,
  fontWeight: "700"
} as const;

const addTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800"
} as const;

const fieldLabelStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700"
} as const;

const fieldInputStyle = {
  backgroundColor: theme.colors.beige,
  borderColor: "transparent",
  borderRadius: theme.radii.small,
  borderWidth: 1,
  color: theme.colors.brown,
  fontSize: theme.typography.body1.fontSize,
  minHeight: theme.touchTarget,
  paddingHorizontal: 14
} as const;

const fieldInputErrorStyle = {
  borderColor: theme.colors.danger
} as const;

const fieldErrorStyle = {
  color: theme.colors.danger,
  fontSize: theme.typography.caption.fontSize
} as const;
