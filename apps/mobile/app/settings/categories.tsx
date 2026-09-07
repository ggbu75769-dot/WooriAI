import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Alert, Text, TextInput, View } from "react-native";
import { apiErrorMessageForCode } from "../../src/api/api-error";
import {
  createCustomCategory,
  listCategories,
  listChildren,
  updateCustomCategory,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN
} from "../../src/api/client";
import {
  customCategoryArchiveAccessibilityLabel,
  customCategoryArchiveConfirmCopy,
  customCategoryIdempotencyKey,
  customCategoryLimitExceededMessage,
  customCategoryMutationErrorMessage,
  customCategoryNameMaxLength,
  customCategoryNameNotice,
  customCategoryNamePopulation,
  customCategoryRenameAccessibilityLabel,
  customCategoryRestoreAccessibilityLabel,
  customCategoryRowAccessibilityLabel,
  customCategoryScreenCopy,
  isCustomCategoryLimitReached,
  normalizeCustomCategoryName,
  rotateCustomCategoryIdempotencyKey,
  splitCustomCategories,
  type CustomCategoryKeyHolder,
  type CustomCategoryListRow
} from "../../src/categories/custom-category-form";
import { isChildrenSettled, resolveManagedHouseholdId } from "../../src/family/household-scope";
import { VIEW_ONLY_HEADLINES } from "../../src/family/record-permissions";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { useSaveErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  announceForA11y,
  AppScreen,
  Card,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  TextButton
} from "../../src/ui";

/**
 * 라운드 103 T3 — **지출 분류 관리**(`/settings/categories`).
 * 계약 원문: docs/5차/round103-custom-expense-category-design.md §4.1 · §9.6.
 *
 * 선례는 `app/settings/amount-presets.tsx`(라운드 101 W2 F6a) — 사용자 데이터 편집을 설정 하위
 * 화면으로 세운 최근 자리이고, 라우트 대장(src/route-surface.test.ts)에 한 줄을 더하는 형식까지
 * 그대로다. 다른 점 셋: 이 화면의 값은 **기기 취향이 아니라 가구 데이터**라 ① 서버 쓰기(뮤테이션
 * 셋)를 갖고 ② 역할 게이트(`useExpenseEntryGate`)를 지나며 ③ `["categories"]` 공유 캐시를 채운다.
 *
 * ## 이 화면이 하지 않는 것
 *
 * - **문장을 짓지 않는다.** 판정·문구·중복·상한·a11y 라벨은 전부 순수 모듈
 *   (src/categories/custom-category-form.ts)이 소유하고, 잠금 머리말은
 *   src/family/record-permissions.ts의 표가 소유한다(§4.1의 그 규율).
 * - **"삭제"를 말하지 않는다.** 지출의 `category_id`가 NOT NULL FK라 하드 삭제 경로가 아예
 *   없고(설계 §1.6), 이 화면의 조작은 `active:false`(보관)다 — 그 분류로 기록한 지출은 한
 *   바이트도 움직이지 않는다. 그래서 버튼은 "보관"이고, 확인 문구가 그 사실을 그대로 말한다.
 * - **시드 분류를 그리지 않는다.** 사용자가 어쩔 수 없는 행을 목록에 두면 "왜 이건 못 지우지"만
 *   남는다(§4.1).
 *
 * ## ⚠️ 목록의 모집단은 `householdId`가 정한다 — `isSystem`이 아니다
 *
 * 설계 §2.2와 client.ts의 `CategoryListItem.householdId` 주석은 *"커스텀의 표식은
 * `isSystem === false`"* 라고 적었는데 **dev DB 실측이 그 전제를 뒤집었다**: `is_system = false`인
 * **시드** 행이 아홉이다(모바일 퀵타일 별칭 8 + 가져오기 스텁 1 — prisma/seed.ts가 그렇게
 * 시드한다). 그 하나로 걸렀다면 사용자가 만들지도 않은 아홉 행이 이 목록에 서고, 보관을 누르는
 * 순간 404가 났을 것이다. 판정은 순수 모듈의 `isCustomCategoryRow`(= 소유자 칸이 지금 이 가구)
 * 하나이고, 그 사실은 그 모듈의 옆 테스트가 별칭 픽스처로 물고 있다.
 *
 * ## 캐시 규약
 *
 * `["categories"]`는 **전역 단일 키**이고 채우는 자리는 반드시 `includeAll: true`다
 * (src/categories-cache-contract.test.ts의 전역 스윕 — 기본 목록으로 채우면 다른 소비처의 별칭
 * 라벨이 조용히 "기타"로 무너진다). 이 화면은 보관 행까지 그려야 하므로 그 규약이 곧 요구사항과
 * 같다. 성공 뒤 무효화는 **그 키 하나뿐**이다(§4.1: 추가 키 0건) — 이름 변경·보관이 기록 칩·
 * 리포트 범례·CSV에 곧바로 반영되는 것은 그 셋이 같은 캐시를 읽기 때문이다.
 *
 * ## 화면을 잠그지 않는다
 *
 * 보기 전용 참여자에게도 목록은 끝까지 보인다(읽기는 구성원 전원 — §2.4). 잠긴 세션에서 달라지는
 * 것은 **머리말 한 줄과, 눌렀을 때 사실을 말하는 컨트롤들**이다(useExpenseEntryGate의 확립 규율:
 * 컨트롤을 지우는 대신 눌렀을 때 답한다). 훅은 전부 조기 반환보다 위에 있고(FIX-A), 이 화면에는
 * 조기 반환 자체가 없다.
 */
export default function CategoriesSettingsScreen() {
  const copy = customCategoryScreenCopy();
  const queryClient = useQueryClient();
  const expenseGate = useExpenseEntryGate();
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const [draftName, setDraftName] = useState("");
  const [renameDraft, setRenameDraft] = useState<{ id: string; name: string } | null>(null);
  // 초안 단위 멱등 키 한 칸(§2.4) — 같은 이름의 재시도에만 재사용하고 성공하면 폐기한다.
  const createKeyRef: CustomCategoryKeyHolder = useRef<{ key: string; name: string } | null>(null);

  /**
   * 쓰기 대상 가구는 **보고 있는 아이의 가구**다(라운드 60 A의 `resolveManagedHouseholdId` —
   * 세션의 기본 가구를 그대로 쓰면 다른 가구 초대를 수락한 뒤 남의 가구에 분류가 생긴다).
   * 조회가 끝나기 전에는 null이고, 그동안 쓰기 컨트롤이 비활성이다(그 함수 주석의 그 창).
   */
  const children = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const householdId = resolveManagedHouseholdId({
    children: children.data?.children,
    childId,
    fallbackHouseholdId,
    childrenSettled: isChildrenSettled({ authToken, isSuccess: children.isSuccess, isError: children.isError })
  });

  // ⚠️ `includeAll: true` — 전역 규약이자 이 화면의 요구사항이다(보관 행을 그려야 한다).
  const categories = useQuery({
    queryKey: ["categories"],
    enabled: Boolean(authToken),
    queryFn: () => listCategories(authToken!, { includeAll: true }),
    staleTime: 5 * 60 * 1000
  });

  const rows: CustomCategoryListRow[] = categories.data?.categories ?? [];
  const mine = splitCustomCategories(rows, householdId);
  const population = customCategoryNamePopulation(rows, householdId);
  const limitReached = isCustomCategoryLimitReached(mine.total);
  const draftNotice = draftName.trim().length > 0 ? customCategoryNameNotice({ raw: draftName, population }) : null;
  const renameNotice =
    renameDraft === null
      ? null
      : customCategoryNameNotice({ raw: renameDraft.name, population, exceptCategoryId: renameDraft.id });

  const create = useMutation({
    mutationFn: () =>
      createCustomCategory(
        authToken!,
        householdId!,
        normalizeCustomCategoryName(draftName),
        customCategoryIdempotencyKey(createKeyRef, draftName)
      ),
    onSuccess: async () => {
      rotateCustomCategoryIdempotencyKey(createKeyRef);
      setDraftName("");
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const rename = useMutation({
    mutationFn: (input: { categoryId: string; name: string }) =>
      updateCustomCategory(authToken!, householdId!, input.categoryId, { name: input.name }),
    onSuccess: async () => {
      setRenameDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const archive = useMutation({
    mutationFn: (input: { categoryId: string; active: boolean }) =>
      updateCustomCategory(authToken!, householdId!, input.categoryId, { active: input.active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  // 실패 문구: 표 코드(useSaveErrorCopy → api-error 표의 CUSTOM_CATEGORY_* 셋)가 먼저 답하고,
  // 로컬 대역(데모 세션)의 코드 없는 Error 한 겹만 순수 모듈이 얹는다. 자리마다 **자기 뮤테이션**을
  // 묻는다 — 셋이 동시에 떠 있을 수 있어 `??` 체인은 남의 사유를 그리는 자리가 된다(라운드 70 M-2).
  const createErrorFallback = useSaveErrorCopy(create.isError, create.error);
  const renameErrorFallback = useSaveErrorCopy(rename.isError, rename.error);
  const archiveErrorFallback = useSaveErrorCopy(archive.isError, archive.error);
  const createErrorText = customCategoryMutationErrorMessage(create.error, createErrorFallback);
  const renameErrorText = customCategoryMutationErrorMessage(rename.error, renameErrorFallback);
  const archiveErrorText = customCategoryMutationErrorMessage(archive.error, archiveErrorFallback);

  /**
   * 라운드 79 리뷰(M-1)의 그 관례 — **프롭 둘만으로는 iOS에서 아무 소리도 나지 않는다.**
   *
   * 세 자리에 걸린 조합(`accessibilityLiveRegion="polite"` + `accessibilityRole="alert"`)은
   * 안드로이드에서만 자동 낭독을 만든다. 크로스플랫폼의 답은 `announceForA11y`이고
   * (app/settings/children.tsx의 저장 실패 셋이 **같은 이유로** 같은 모양을 쓴다), 여기 셋도
   * [분류 추가]·[저장]·[보관] 버튼 바로 곁이라 같은 자리다 — 프롭은 그대로 두고 그 위에 얹는다.
   */
  useEffect(() => {
    if (create.isError) announceForA11y(createErrorText);
  }, [create.isError, createErrorText]);
  useEffect(() => {
    if (rename.isError) announceForA11y(renameErrorText);
  }, [rename.isError, renameErrorText]);
  useEffect(() => {
    if (archive.isError) announceForA11y(archiveErrorText);
  }, [archive.isError, archiveErrorText]);

  const canWrite = Boolean(authToken && householdId);
  /**
   * 상한에 닿았을 때의 한 줄 — **`api-error` 표의 그 문장 그대로**다(§9.6: 상한 문구는 화면이
   * 짓지 않는다). 표를 지나는 이유는 서버 400과 사전 안내가 같은 실패를 다른 말로 부르지 않게
   * 하기 위해서이고, 표에 없을 리 없는 코드라 `??`는 방어 갈래다(그 자리에서도 문장은 같은
   * 순수 모듈의 것이다 — 표의 그 줄이 이 함수를 부른다).
   */
  const limitText = apiErrorMessageForCode("CUSTOM_CATEGORY_LIMIT_EXCEEDED") ?? customCategoryLimitExceededMessage();
  const addBlocked = draftNotice !== null || normalizeCustomCategoryName(draftName).length === 0 || limitReached;

  const submitDraft = expenseGate.guard(() => create.mutate());
  const submitRename = expenseGate.guard((categoryId: string, name: string) =>
    rename.mutate({ categoryId, name: normalizeCustomCategoryName(name) })
  );
  const setActive = expenseGate.guard((categoryId: string, active: boolean) =>
    archive.mutate({ categoryId, active })
  );
  // 보관은 되돌릴 수 있는 조작이지만 되돌리는 자리가 다른 구획이라 한 번 묻는다. 문구는 순수
  // 모듈이 짓고(§9.6 확정값), 화면은 그 네 조각을 Alert에 넘기기만 한다.
  const confirmArchive = expenseGate.guard((categoryId: string, name: string) => {
    const confirm = customCategoryArchiveConfirmCopy(name);
    Alert.alert(confirm.title, confirm.message, [
      { text: confirm.cancelLabel, style: "cancel" },
      { text: confirm.confirmLabel, onPress: () => archive.mutate({ categoryId, active: false }) }
    ]);
  });

  const renderRow = (row: CustomCategoryListRow) => {
    const editing = renameDraft?.id === row.id;
    return (
      /* ⚠️ 라벨은 **행 컨테이너가 아니라 이름 글자**가 진다(아래). 컨테이너에 `accessible`을
         걸면 iOS가 그 아래 버튼들을 하나로 접어 [이름 바꾸기]·[보관]에 초점이 서지 않는다 —
         행이 무엇인지 말하려다 그 행에서 할 수 있는 일을 지우는 거래가 된다. */
      <View key={row.id} style={rowStyle}>
        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              accessibilityLabel={customCategoryRenameAccessibilityLabel(row.name)}
              autoFocus
              maxLength={customCategoryNameMaxLength()}
              onChangeText={(value) => setRenameDraft({ id: row.id, name: value })}
              placeholder={copy.addPlaceholder}
              placeholderTextColor={theme.colors.gray300}
              style={inputStyle}
              value={renameDraft?.name ?? ""}
            />
            {renameNotice ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {renameNotice}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PrimaryButton
                disabled={!canWrite || renameNotice !== null || rename.isPending}
                label={copy.saveLabel}
                onPress={() => submitRename(row.id, renameDraft?.name ?? "")}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                disabled={rename.isPending}
                label={copy.cancelLabel}
                onPress={() => setRenameDraft(null)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text accessibilityLabel={customCategoryRowAccessibilityLabel(row.name)} style={rowNameStyle}>
              {row.name}
            </Text>
            <TextButton
              accessibilityLabel={customCategoryRenameAccessibilityLabel(row.name)}
              disabled={rename.isPending}
              label={copy.renameLabel}
              onPress={() => setRenameDraft({ id: row.id, name: row.name })}
            />
            {row.active ? (
              <TextButton
                accessibilityLabel={customCategoryArchiveAccessibilityLabel(row.name)}
                disabled={archive.isPending}
                label={copy.archiveLabel}
                onPress={() => confirmArchive(row.id, row.name)}
              />
            ) : (
              <TextButton
                accessibilityLabel={customCategoryRestoreAccessibilityLabel(row.name)}
                disabled={archive.isPending}
                label={copy.restoreLabel}
                onPress={() => setActive(row.id, true)}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <AppScreen>
      <View testID="screen-custom-categories" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={expenseGate.locked ? VIEW_ONLY_HEADLINES.categories : copy.subtitle}
          onBack={() => router.back()}
        />

        <Card style={{ gap: theme.spacing.gap }}>
          <Text accessibilityRole="header" style={sectionTitleStyle}>
            {copy.inUseSectionTitle}
          </Text>
          {mine.inUse.length > 0 ? (
            mine.inUse.map(renderRow)
          ) : (
            <Text style={captionStyle}>{copy.emptyStateText}</Text>
          )}
          {rename.isError ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
              {renameErrorText}
            </Text>
          ) : null}
          {archive.isError ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
              {archiveErrorText}
            </Text>
          ) : null}
        </Card>

        {mine.archived.length > 0 ? (
          <Card style={{ gap: theme.spacing.gap }}>
            <Text accessibilityRole="header" style={sectionTitleStyle}>
              {copy.archivedSectionTitle}
            </Text>
            {mine.archived.map(renderRow)}
            <Text style={captionStyle}>{copy.archivedFootnote}</Text>
          </Card>
        ) : null}

        <Card style={{ gap: theme.spacing.gap }}>
          <TextInput
            accessibilityLabel={copy.addButtonLabel}
            maxLength={customCategoryNameMaxLength()}
            onChangeText={setDraftName}
            placeholder={copy.addPlaceholder}
            placeholderTextColor={theme.colors.gray300}
            style={inputStyle}
            value={draftName}
          />
          {/* 상한·중복 문구는 화면이 짓지 않는다(§9.6) — 순수 모듈과 api-error 표가 단일 소스다. */}
          {limitReached || draftNotice ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
              {limitReached ? limitText : draftNotice}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={!canWrite || addBlocked || create.isPending}
            label={copy.addButtonLabel}
            onPress={submitDraft}
          />
          {create.isError ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
              {createErrorText}
            </Text>
          ) : null}
        </Card>
      </View>
    </AppScreen>
  );
}

const sectionTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "700"
} as const;

const rowStyle = {
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.small,
  borderWidth: 1,
  gap: 8,
  padding: 12
} as const;

const rowNameStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  fontWeight: "600"
} as const;

const captionStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  lineHeight: 17
} as const;

const errorTextStyle = {
  color: theme.colors.danger,
  fontSize: 12,
  lineHeight: 17
} as const;

const inputStyle = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.gray300,
  borderRadius: theme.radii.card,
  borderWidth: 1,
  color: theme.colors.brown,
  fontSize: 15,
  paddingHorizontal: 12,
  paddingVertical: 8
} as const;
