import {
  CHILD_STAGE_CODES,
  isFutureSeoulDate,
  isValidCalendarDate,
  type ChildStageCode,
  type ChildStageMode
} from "@wooriai/domain";
import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { theme } from "../theme";
import { Card, CategoryChip, PrimaryButton, Toast } from "../ui";

export type ChildProfileDraft = {
  nickname: string;
  stageMode: ChildStageMode;
  dueDate: string;
  birthDate: string;
  manualStage: ChildStageCode | null;
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
  onSubmit
}: {
  initialValue: ChildProfileDraft;
  pending: boolean;
  failed: boolean;
  submitLabel: string;
  onSubmit: (draft: ChildProfileDraft) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const validationMessage = useMemo(() => {
    if (!draft.nickname.trim()) return "아이 이름이나 별명을 입력해 주세요.";
    if (draft.stageMode === "pregnant") return dateError("출산 예정일", draft.dueDate, false);
    if (draft.stageMode === "born") return dateError("출생일", draft.birthDate, true);
    if (!draft.manualStage) return "현재 아이 단계를 선택해 주세요.";
    return null;
  }, [draft]);

  const fieldStyle = {
    backgroundColor: theme.colors.beige,
    borderColor: validationMessage ? theme.colors.primary100 : "transparent",
    borderRadius: theme.radii.small,
    borderWidth: 1,
    color: theme.colors.brown,
    fontSize: theme.typography.body1.fontSize,
    minHeight: theme.touchTarget,
    paddingHorizontal: 14
  } as const;

  return (
    <View style={{ gap: theme.spacing.section }}>
      <Card style={{ gap: theme.spacing.gap }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>아이 이름 / 별명</Text>
          <TextInput
            accessibilityLabel="아이 이름"
            maxLength={60}
            onChangeText={(nickname) => setDraft((value) => ({ ...value, nickname }))}
            placeholder="예: 다온이"
            style={fieldStyle}
            value={draft.nickname}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>아이 상태</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {stageModeOptions.map((option) => (
              <CategoryChip
                key={option.value}
                label={option.label}
                selected={draft.stageMode === option.value}
                onPress={() => setDraft((value) => ({ ...value, stageMode: option.value }))}
              />
            ))}
          </View>
        </View>

        {draft.stageMode === "pregnant" ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>출산 예정일</Text>
            <TextInput
              accessibilityLabel="출산 예정일"
              onChangeText={(dueDate) => setDraft((value) => ({ ...value, dueDate }))}
              placeholder="YYYY-MM-DD"
              style={fieldStyle}
              value={draft.dueDate}
            />
          </View>
        ) : null}

        {draft.stageMode === "born" ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>출생일</Text>
            <TextInput
              accessibilityLabel="출생일"
              onChangeText={(birthDate) => setDraft((value) => ({ ...value, birthDate }))}
              placeholder="YYYY-MM-DD"
              style={fieldStyle}
              value={draft.birthDate}
            />
          </View>
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
                  onPress={() => setDraft((value) => ({ ...value, manualStage: stage }))}
                />
              ))}
            </View>
          </View>
        ) : null}

        {validationMessage ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{validationMessage}</Text> : null}
      </Card>

      {failed ? <Toast message="아이 프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." tone="error" /> : null}
      <PrimaryButton
        disabled={Boolean(validationMessage) || pending}
        label={pending ? "저장 중..." : submitLabel}
        onPress={() => onSubmit(draft)}
      />
    </View>
  );
}
