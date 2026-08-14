import {
  CHILD_STAGE_CODES,
  getSeoulToday,
  isFutureSeoulDate,
  isValidCalendarDate,
  type ChildStageCode,
  type ChildStageMode
} from "@wooriai/domain";
import { useEffect, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import { dateOnlyToLocalDate } from "@wooriai/domain/money-date";
import { DateField } from "../design-system";
import { theme } from "../theme";
import { Card, CategoryChip, PrimaryButton, Toast } from "../ui";

export type ChildProfileDraft = {
  nickname: string;
  stageMode: ChildStageMode;
  dueDate: string;
  birthDate: string;
  manualStage: ChildStageCode | null;
  gender: string;
};

const stageModeOptions: Array<{ value: ChildStageMode; label: string }> = [
  { value: "pregnant", label: "출산 예정" },
  { value: "born", label: "태어났어요" },
  { value: "manual", label: "단계 직접 선택" }
];

const stageLabels: Record<ChildStageCode, string> = {
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  newborn_0_3: "신생아 0-3개월",
  infant_4_6: "영아 4-6개월",
  infant_7_12: "영아 7-12개월",
  toddler_1_3: "유아 1-3세",
  kid_4_7: "유아 4-7세",
  elementary: "초등학생",
  middle_school: "중학생"
};

function dateError(label: string, value: string, rejectFuture: boolean) {
  if (!value.trim()) return `${label}을 입력해 주세요.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValidCalendarDate(value)) {
    return "YYYY-MM-DD 형식의 실제 날짜를 입력해 주세요.";
  }
  if (rejectFuture && isFutureSeoulDate(value)) return "출생일은 오늘보다 미래일 수 없어요.";
  return null;
}

export function ChildProfileFields({
  initialValue,
  pending,
  failed,
  submitLabel,
  submitOnlyWhenChanged = false,
  showValidationInitially = true,
  onDirtyChange,
  onSubmit
}: {
  initialValue: ChildProfileDraft;
  pending: boolean;
  failed: boolean;
  submitLabel: string;
  submitOnlyWhenChanged?: boolean;
  showValidationInitially?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (draft: ChildProfileDraft) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [hasInteracted, setHasInteracted] = useState(false);
  const isCustomGender = Boolean(
    draft.gender && !["female", "male", "unknown"].includes(draft.gender)
  );
  const validation = useMemo(() => {
    const nickname = draft.nickname.trim() ? null : "아이 이름이나 별명을 입력해 주세요.";
    const stage =
      draft.stageMode === "pregnant"
        ? dateError("출산 예정일", draft.dueDate, false)
        : draft.stageMode === "born"
          ? dateError("출생일", draft.birthDate, true)
          : !draft.manualStage
            ? "현재 아이 단계를 선택해 주세요."
            : null;
    const gender = draft.gender === "custom" ? "성별을 직접 입력해 주세요." : null;
    return { gender, nickname, stage };
  }, [draft]);
  const validationMessage = validation.nickname ?? validation.stage ?? validation.gender;
  const hasChanges = useMemo(
    () =>
      draft.nickname !== initialValue.nickname ||
      draft.stageMode !== initialValue.stageMode ||
      draft.dueDate !== initialValue.dueDate ||
      draft.birthDate !== initialValue.birthDate ||
      draft.manualStage !== initialValue.manualStage ||
      draft.gender !== initialValue.gender,
    [draft, initialValue]
  );
  const showValidation = showValidationInitially || hasInteracted;

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const updateDraft = (update: (value: ChildProfileDraft) => ChildProfileDraft) => {
    setHasInteracted(true);
    setDraft(update);
  };

  const fieldStyle = (hasError: boolean) => ({
    backgroundColor: theme.colors.beige,
    borderColor: showValidation && hasError ? theme.colors.primary100 : "transparent",
    borderRadius: theme.radii.small,
    borderWidth: 1,
    color: theme.colors.brown,
    fontSize: theme.typography.body1.fontSize,
    minHeight: theme.touchTarget,
    paddingHorizontal: 14
  } as const);
  const errorText = (message: string | null) =>
    showValidation && message ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{message}</Text> : null;

  return (
    <View style={{ gap: theme.spacing.section }}>
      <Card style={{ gap: theme.spacing.gap }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>아이 이름 / 별명</Text>
          <TextInput
            accessibilityLabel="아이 이름"
            maxLength={60}
            onChangeText={(nickname) => updateDraft((value) => ({ ...value, nickname }))}
            placeholder="예: 하늘이"
            style={fieldStyle(Boolean(validation.nickname))}
            value={draft.nickname}
          />
          {errorText(validation.nickname)}
        </View>

        <View accessibilityLabel="PROFILE-GENDER-001" testID="evidence-PROFILE-GENDER-001" style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>성별 (선택)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <CategoryChip label="입력하지 않음" selected={!draft.gender} onPress={() => updateDraft((value) => ({ ...value, gender: "" }))} />
            <CategoryChip label="여자아이" selected={draft.gender === "female"} onPress={() => updateDraft((value) => ({ ...value, gender: "female" }))} />
            <CategoryChip label="남자아이" selected={draft.gender === "male"} onPress={() => updateDraft((value) => ({ ...value, gender: "male" }))} />
            <CategoryChip label="아직 몰라요" selected={draft.gender === "unknown"} onPress={() => updateDraft((value) => ({ ...value, gender: "unknown" }))} />
            <CategoryChip label="직접 입력" selected={isCustomGender} onPress={() => updateDraft((value) => ({ ...value, gender: "custom" }))} />
          </View>
          {isCustomGender ? (
            <TextInput
              accessibilityLabel="성별 직접 입력"
              maxLength={20}
              onChangeText={(gender) => updateDraft((value) => ({ ...value, gender }))}
              placeholder="직접 입력"
              style={fieldStyle(Boolean(validation.gender))}
              value={draft.gender === "custom" ? "" : draft.gender}
            />
          ) : null}
          {errorText(validation.gender)}
          <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>추천 순위에는 성별을 사용하지 않아요.</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>아이 상태</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {stageModeOptions.map((option) => (
              <CategoryChip
                key={option.value}
                label={option.label}
                selected={draft.stageMode === option.value}
                onPress={() => updateDraft((value) => ({ ...value, stageMode: option.value }))}
              />
            ))}
          </View>
        </View>

        {draft.stageMode === "pregnant" ? (
          <DateField
            error={showValidation ? validation.stage : null}
            label="출산 예정일"
            onChange={(dueDate) => updateDraft((value) => ({ ...value, dueDate: dueDate ?? "" }))}
            value={draft.dueDate || null}
          />
        ) : null}

        {draft.stageMode === "born" ? (
          <DateField
            error={showValidation ? validation.stage : null}
            label="출생일"
            maximumDate={dateOnlyToLocalDate(getSeoulToday())}
            onChange={(birthDate) => updateDraft((value) => ({ ...value, birthDate: birthDate ?? "" }))}
            value={draft.birthDate || null}
          />
        ) : null}

        {draft.stageMode === "manual" ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>현재 단계</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CHILD_STAGE_CODES.map((stage) => (
                <CategoryChip
                  key={stage}
                  label={stageLabels[stage]}
                  selected={draft.manualStage === stage}
                  onPress={() => updateDraft((value) => ({ ...value, manualStage: stage }))}
                />
              ))}
            </View>
            {errorText(validation.stage)}
          </View>
        ) : null}
      </Card>

      {failed ? <Toast message="아이 프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}
      <PrimaryButton
        disabled={Boolean(validationMessage) || pending || (submitOnlyWhenChanged && !hasChanges)}
        label={pending ? "저장 중..." : submitOnlyWhenChanged && !hasChanges ? "변경 없음" : submitLabel}
        onPress={() => onSubmit(draft)}
      />
    </View>
  );
}
