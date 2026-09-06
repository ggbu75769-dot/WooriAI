import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import type { NecessityLevel } from "@wooriai/domain";
import {
  createCustomItem,
  deleteCustomItem,
  updateCustomItem,
  type CreateCustomItemBody,
  type ItemSummary
} from "../api/client";
import { useSaveErrorCopy } from "../offline/use-load-error-copy";
import { theme } from "../theme";
import {
  BottomSheetFrame,
  CategoryChip,
  PrimaryButton,
  SecondaryButton,
  SheetMountTransition,
  TextButton,
  Toast
} from "../ui";
import { useTransientNotice } from "../ui/use-transient-notice";
import {
  coerceStageBandLabel,
  customItemBodyFingerprint,
  customItemDeleteAccessibilityLabel,
  customItemDeleteConfirmCopy,
  customItemDeleteEntryLabel,
  customItemEditAccessibilityLabel,
  customItemEditEntryLabel,
  customItemMutationErrorMessage,
  customItemNameMaxLength,
  customItemNecessityOptions,
  customItemSaveAccessibilityLabel,
  customItemSheetCopy,
  customItemStageBandOptions,
  customItemUpdatedNotice,
  getOrCreateCustomItemKey,
  initialCustomItemDraft,
  normalizeCustomItemName,
  rotateCustomItemKey,
  validateCustomItemName
} from "./custom-item-form";
import type { StageBandLabel } from "./stage-bands";
import { useItemStatusGate } from "./useItemStatusGate";

/**
 * 라운드 100 T3 — **커스텀 품목 입력 시트 + 상세의 수정/삭제 갈래** (설계 문서
 * docs/5차/round100-custom-items-design.md §4.2 · §4.4).
 *
 * 시트 JSX·배선을 화면 밖 한 벌로 두는 이유는 아이 전환 시트(src/children/ChildSwitchSheet.tsx)와
 * 같다 — 목록(추가)과 상세(수정)가 같은 시트를 쓰므로 화면마다 복사하면 두 벌이 된다. 판정·문구·
 * 기본값은 전부 순수 모듈(./custom-item-form.ts)에 있고 이 파일은 그린다(순수 모듈 분리 관례).
 *
 * ## 왜 뮤테이션이 화면(app/**)이 아니라 이 파일에 사는가
 *
 * ① 상세 화면은 뮤테이션 하나(clickLink)로 못 박혀 있다(src/mutation-press-guard.test.ts의
 *    "이 화면의 뮤테이션 수도 종전 그대로" — 그 핀은 연타 가드 계약의 일부라 옮길 일이 아니다).
 * ② 상세 화면의 한국어 리터럴 수도 같은 계약이 등호로 문다 — 새 문장이 이 파일과 순수 모듈에만
 *    살면 그 핀들이 구조적으로 불변이다(ITEM-002 픽셀락 무접촉과 같은 방향).
 *
 * ## 스윕 준수(§6.3)
 *
 * - 신규 뮤테이션 전부 `disabled={….isPending}`(mutation-press-guard의 control-blocks).
 * - 오프라인/한도/이름 실패는 정직 문구 — `useSaveErrorCopy`(표 코드 소비) 위에 커스텀 전용
 *   코드 두 개만 모듈이 얹는다(customItemMutationErrorMessage 머리말).
 * - 이 파일에 스크롤러 여는 태그 0건 — 입력칸과 칩은 바깥 AppScreen 스크롤러(`"handled"` 선언,
 *   src/ui.tsx)의 안에서만 선다(keyboard-tap-guard: 가장 안쪽 스크롤러가 기본값이면 그 자리가
 *   첫 탭을 가로챈다 — 안쪽 스크롤러를 만들지 않는 것이 가장 확실한 준수다).
 * - 색 리터럴 0건(DNC-017) — theme 토큰만 쓴다.
 * - 생성 멱등 키는 시트 초안 단위 홀더(온보딩 관례 §2.3 · 본문 지문 묶음은 라운드 99 F1 형식).
 */

export type CustomItemSheetMode =
  | { kind: "create"; defaultStageBand: StageBandLabel }
  | {
      kind: "edit";
      customItemId: string;
      initial: { name: string; stageBand: StageBandLabel; necessityLevel: NecessityLevel };
    };

const customItemSheetSectionLabelStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700"
} as const;

// 입력 칸 관례: 준비템 상세의 품목 메모 입력(app/items/[itemTemplateId].tsx)과 같은 흰 배경 +
// 얇은 테두리. 테두리 색만 그 자리의 rgba 리터럴 대신 기존 토큰(gray300 — 상세 탭 밴드의 그
// 선)으로 쓴다: 신규 색 리터럴 0건(DNC-017).
const customItemNameInputStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: 14,
  borderWidth: 1,
  color: theme.colors.brown,
  minHeight: theme.touchTarget,
  paddingHorizontal: 14,
  paddingVertical: 12
} as const;

export function CustomItemSheet({
  testID,
  authToken,
  childId,
  mode,
  onClose,
  onSaved
}: {
  testID: string;
  authToken: string;
  childId: string;
  mode: CustomItemSheetMode;
  onClose: () => void;
  /** 저장이 서버(또는 로컬 대역)에 실제로 반영된 뒤에만 불린다 — 시트 닫기·토스트는 호출부 몫. */
  onSaved: (saved: ItemSummary) => void;
}) {
  const queryClient = useQueryClient();
  const copy = customItemSheetCopy(mode.kind);
  const [draft, setDraft] = useState(() =>
    mode.kind === "edit"
      ? initialCustomItemDraft(mode.initial)
      : initialCustomItemDraft({ stageBand: mode.defaultStageBand })
  );
  // 저장을 누르기 전의 사전 판정(이름 트림·80자 — "이미 들어 있는 값"도 잡는다). 입력이
  // 바뀌면 걷는다 — 고친 뒤에도 옛 문장이 남아 있으면 그 문장이 거짓이 된다.
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  /**
   * 생성 멱등 키 홀더 — 시트가 열려 있는 동안(초안 단위) 하나. 같은 본문의 재시도는 같은 키,
   * 입력을 고친 재제출은 새 키다(본문 지문 묶음 — custom-item-form.ts의 라운드 99 F1 인용).
   */
  const keyHolder = useRef<{ key: string; bodyFingerprint: string } | null>(null);
  const save = useMutation({
    mutationFn: (body: CreateCustomItemBody) =>
      mode.kind === "edit"
        ? updateCustomItem(authToken, childId, mode.customItemId, body)
        : createCustomItem(
            authToken,
            childId,
            body,
            getOrCreateCustomItemKey(keyHolder, customItemBodyFingerprint(body))
          ),
    onSuccess: async (saved) => {
      if (mode.kind === "create") rotateCustomItemKey(keyHolder);
      // §4.2: 성공 시 ["items", childId] 무효화 한 번 — 목록·준비율·패리티 그룹이 같은
      // 스냅샷 하나에서 다시 선다. 수정이면 열려 있는 상세 캐시도 함께 갈아 끼운다.
      await queryClient.invalidateQueries({ queryKey: ["items", childId] });
      if (mode.kind === "edit") {
        await queryClient.invalidateQueries({ queryKey: ["item-detail", childId, mode.customItemId] });
      }
      onSaved(saved);
    }
  });
  // 실패 문구: 표 코드(useSaveErrorCopy → api-error 표) + 커스텀 전용 코드/로컬 문장은 모듈이
  // 얹는다. 오프라인이면 오프라인이라고 말한다(OFFLINE_SAVE_NOTICE — use-load-error-copy 관례).
  const saveErrorFallback = useSaveErrorCopy(save.isError, save.error);
  const failureText =
    validationMessage ?? (save.isError ? customItemMutationErrorMessage(save.error, saveErrorFallback) : null);

  const handleSave = () => {
    const validation = validateCustomItemName(draft.name);
    if (validation) {
      setValidationMessage(validation);
      return;
    }
    setValidationMessage(null);
    save.mutate({
      name: normalizeCustomItemName(draft.name),
      stageBand: draft.stageBand,
      necessityLevel: draft.necessityLevel
    });
  };

  return (
    <View testID={testID}>
      <SheetMountTransition>
        <BottomSheetFrame title={copy.title} showHandle={false}>
          <TextInput
            accessibilityLabel={copy.nameLabel}
            // 상한은 순수 모듈 값 하나(= 계약 CUSTOM_ITEM_NAME_MAX_LENGTH의 사본 — 대조는
            // custom-item-form.test.ts). maxLength는 새 타이핑만 막으므로 저장 직전의
            // validateCustomItemName이 들어 있는 값까지 한 번 더 판정한다.
            maxLength={customItemNameMaxLength()}
            onChangeText={(text) => {
              setDraft((current) => ({ ...current, name: text }));
              setValidationMessage(null);
            }}
            placeholder={copy.namePlaceholder}
            style={customItemNameInputStyle}
            value={draft.name}
          />
          <Text style={customItemSheetSectionLabelStyle}>{copy.stageSectionLabel}</Text>
          {/* 칩 라벨 = 서버로 나가는 stageBand 값(§1.3). 기본 선택은 지금 보고 있는 칩이다. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {customItemStageBandOptions().map((option) => (
              <CategoryChip
                key={option}
                label={option}
                selected={option === draft.stageBand}
                onPress={() => setDraft((current) => ({ ...current, stageBand: option }))}
              />
            ))}
          </View>
          <Text style={customItemSheetSectionLabelStyle}>{copy.necessitySectionLabel}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {customItemNecessityOptions().map((option) => (
              <CategoryChip
                key={option.value}
                label={option.label}
                selected={option.value === draft.necessityLevel}
                onPress={() => setDraft((current) => ({ ...current, necessityLevel: option.value }))}
              />
            ))}
          </View>
          {/* 실패는 이 자리 하나에서만 말한다 — 사전 판정과 저장 실패가 같은 칸을 쓴다
              (Toast tone="error"가 스스로 낭독한다, A11Y-115). */}
          {failureText ? <Toast message={failureText} tone="error" /> : null}
          <PrimaryButton
            accessibilityLabel={customItemSaveAccessibilityLabel(mode.kind)}
            // mutation-press-guard(control-blocks): 왕복이 끝나기 전의 두 번째 탭은 눌림
            // 자체가 서지 않는다.
            disabled={save.isPending}
            label={copy.saveLabel}
            onPress={handleSave}
          />
          <TextButton label={copy.cancelLabel} onPress={onClose} />
        </BottomSheetFrame>
      </SheetMountTransition>
    </View>
  );
}

/**
 * 상세 화면(app/items/[itemTemplateId].tsx)의 커스텀 전용 갈래 — 수정(위 시트 재사용)·삭제.
 *
 * 출처 한 줄은 따로 세우지 않는다: 커스텀 상세의 reasonText가 이미 그 문구다
 * ("직접 추가한 준비물이에요." — §2.5, "왜 필요해요?" 카드가 그린다). 편집 게이트는 준비 상태
 * 변경과 같은 판정(useItemStatusGate — 서버가 같은 편집 권한을 요구한다, §2.6)을 재사용한다.
 */
export function CustomItemDetailActions({
  authToken,
  childId,
  item
}: {
  authToken: string;
  childId: string;
  item: { id: string; name: string; timingLabel?: string; necessityLevel: NecessityLevel };
}) {
  const queryClient = useQueryClient();
  const itemStatusGate = useItemStatusGate();
  const [isEditSheetOpen, setEditSheetOpen] = useState(false);
  // 수정 성공 토스트의 수명 한 벌(3200ms) — use-transient-notice 관례.
  const { notice: updatedNotice, show: showUpdatedNotice } = useTransientNotice();
  const remove = useMutation({
    mutationFn: () => deleteCustomItem(authToken, childId, item.id),
    onSuccess: async () => {
      // §4.4: 삭제 성공 시 목록 복귀 + 무효화. 뒤로 먼저 — 이 화면의 상세 쿼리가 지워진 행을
      // 다시 묻고 404 카드를 한 프레임 세우는 일이 없게 하고, 캐시 정리는 떠난 뒤에 한다.
      router.back();
      await queryClient.invalidateQueries({ queryKey: ["items", childId] });
      queryClient.removeQueries({ queryKey: ["item-detail", childId, item.id] });
    }
  });
  const removeErrorFallback = useSaveErrorCopy(remove.isError, remove.error);
  const removeFailureText = remove.isError
    ? customItemMutationErrorMessage(remove.error, removeErrorFallback)
    : null;

  const handleEditPress = () => {
    // 게이트 판정이 시트보다 먼저다(라운드 99 F2 L-1의 순서 — 열어 놓고 되돌리지 않는다).
    if (itemStatusGate.locked) {
      itemStatusGate.explain();
      return;
    }
    setEditSheetOpen(true);
  };

  const handleDeletePress = () => {
    if (itemStatusGate.locked) {
      itemStatusGate.explain();
      return;
    }
    const confirmCopy = customItemDeleteConfirmCopy(item.name);
    // 파괴 동작 확인 관례(질문형 제목 + "취소" cancel + 실행 버튼 — GIFTED_RESET 형식).
    Alert.alert(confirmCopy.title, confirmCopy.message, [
      { text: confirmCopy.cancelLabel, style: "cancel" },
      { text: confirmCopy.confirmLabel, onPress: () => remove.mutate() }
    ]);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SecondaryButton
          accessibilityLabel={customItemEditAccessibilityLabel(item.name)}
          disabled={remove.isPending}
          label={customItemEditEntryLabel()}
          onPress={handleEditPress}
          style={{ flex: 1 }}
        />
        <SecondaryButton
          accessibilityLabel={customItemDeleteAccessibilityLabel(item.name)}
          // mutation-press-guard(control-blocks): 확인 Alert를 지나 도는 삭제 왕복 동안
          // 두 입구가 함께 잠긴다.
          // R100-R ④ 삭제/수정 상호 배제: 수정 시트가 서 있는 동안(수정 save.isPending은 시트
          // mount 수명의 부분집합이다 — save는 시트 안에 산다) 같은 행의 삭제가 동시에 나가지
          // 않게 잠근다. 반대 방향(삭제 중 수정 진입)은 위 버튼의 remove.isPending이 이미 잠갔다.
          disabled={remove.isPending || isEditSheetOpen}
          label={customItemDeleteEntryLabel()}
          onPress={handleDeletePress}
          style={{ flex: 1 }}
        />
      </View>
      {removeFailureText ? <Toast message={removeFailureText} tone="error" /> : null}
      {updatedNotice ? <Toast message={updatedNotice.message} /> : null}
      {isEditSheetOpen ? (
        <CustomItemSheet
          testID="item-detail-custom-item-edit-sheet"
          authToken={authToken}
          childId={childId}
          mode={{
            kind: "edit",
            customItemId: item.id,
            initial: {
              name: item.name,
              // 커스텀의 timingLabel은 저장된 밴드 라벨 원문(§9.2)이다 — 밴드가 아니면 첫 칩
              // 폴백(coerceStageBandLabel 머리말: 지어낸 값이 조용히 저장되는 경로는 없다).
              stageBand: coerceStageBandLabel(item.timingLabel, customItemStageBandOptions()[0]),
              necessityLevel: item.necessityLevel
            }
          }}
          onClose={() => setEditSheetOpen(false)}
          onSaved={(saved) => {
            setEditSheetOpen(false);
            showUpdatedNotice(customItemUpdatedNotice(saved.name));
          }}
        />
      ) : null}
    </View>
  );
}
