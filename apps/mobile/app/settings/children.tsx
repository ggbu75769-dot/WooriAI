import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, TextInput, View } from "react-native";
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
  buildCreateChildBody,
  buildUpdateChildBody,
  CHILD_STAGE_LABELS,
  CHILD_STAGE_MODE_OPTIONS,
  isChildFormValid,
  requiredDateFieldLabel,
  validateChildForm,
  type ChildFormValues
} from "../../src/children/child-form";
import { planChildSwitch, CHILD_SCOPED_QUERY_KEY_PREFIXES } from "../../src/children/child-switch";
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

const saveFailedText = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

const emptyForm: ChildFormValues = { nickname: "", dateText: "", manualStage: null };

/**
 * MOB-118 (SET-005 아이 관리): child list with the current selection marked, tap-to-switch
 * (persisted selectedChildId + child-scoped query invalidation), inline edit of
 * 태명/생년월일·예정일/수동 단계 (validation shared with onboarding ONB-002 via
 * src/children/child-form.ts), and 아이 추가 for a second child. Editing/adding is gated to
 * owner/co_parent -- view-only roles (viewer, gift_participant) can only look and switch,
 * matching the server's HouseholdRoleGuard/requireChildAccess(edit) contract.
 */

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
        <View style={{ gap: 6 }}>
          <Text style={fieldLabelStyle}>{dateLabel}</Text>
          <TextInput
            accessibilityLabel={`${dateLabel} 입력`}
            returnKeyType="done"
            onChangeText={(dateText) => onChange({ ...values, dateText })}
            placeholder="YYYY-MM-DD"
            style={[fieldInputStyle, showErrors && errors.dateError ? fieldInputErrorStyle : null]}
            value={values.dateText}
          />
          {showErrors && errors.dateError ? <Text style={fieldErrorStyle}>{errors.dateError}</Text> : null}
        </View>
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

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addStageMode, setAddStageMode] = useState<ChildStageMode>("born");
  const [form, setForm] = useState<ChildFormValues>(emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  // Same timer-in-ref discipline as more.tsx's export toast: never setState after unmount.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const addChild = useMutation({
    mutationFn: (input: { stageMode: ChildStageMode; values: ChildFormValues }) =>
      createChild(authToken!, buildCreateChildBody(householdId!, input.stageMode, input.values)),
    onSuccess: async (created, input) => {
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

  const handleSelect = (child: Child) => {
    const plan = planChildSwitch(selectedChildId, child);
    if (!plan) return;
    setSelectedChildId(plan.childId);
    for (const key of plan.invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: [...key] });
    }
    announceForA11y(plan.announcement);
  };

  const startEdit = (child: Child) => {
    setAddOpen(false);
    setShowErrors(false);
    saveEdit.reset();
    setEditingChildId(child.id);
    setForm(formValuesForChild(child));
  };

  const startAdd = () => {
    setEditingChildId(null);
    setShowErrors(false);
    addChild.reset();
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
    if (!isChildFormValid(errors) || addChild.isPending || !householdId) return;
    addChild.mutate({ stageMode: addStageMode, values: form });
  };

  const childList = children.data?.children ?? [];
  const editingChild = childList.find((child) => child.id === editingChildId) ?? null;

  return (
    <AppScreen>
      <View testID="screen-SET-005" style={{ gap: theme.spacing.section }}>
        <ScreenHeader eyebrow="설정" title="아이 관리" subtitle="아이를 전환하거나 정보를 수정해요" />

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

        {hasSession && canEditChildren && !addOpen ? (
          <SecondaryButton accessibilityLabel="아이 추가" label="아이 추가" onPress={startAdd} />
        ) : null}

        {hasSession && canEditChildren && addOpen ? (
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

const editLinkStyle = {
  color: theme.colors.mainCoral,
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
