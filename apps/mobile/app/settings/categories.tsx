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
  customCategoryListPhase,
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
import { guardExpenseAction, VIEW_ONLY_HEADLINES } from "../../src/family/record-permissions";
import { useExpenseEntryGate } from "../../src/family/useExpenseEntryGate";
import { useLoadErrorCopy, useSaveErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  announceForA11y,
  AppScreen,
  Card,
  LoadErrorCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  TextButton
} from "../../src/ui";
// 라운드 103 리뷰 M-3: 조회 중의 얼굴은 텍스트 카드가 아니라 실루엣이다 — 형제 화면
// (app/settings/children.tsx)이 라운드 96 T6부터 쓰는 D6 프리셋 그대로(분류 카드 자리).
import { SkeletonCard } from "../../src/ui/Skeleton";

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
 * ## 조회의 세 국면 — 빈 목록과 **모르는 목록**을 가른다 (라운드 103 리뷰 M-3)
 *
 * 종전 이 화면은 `["categories"]`의 로딩·실패를 한 갈래도 읽지 않아, 비행기 모드에서도 "아직
 * 직접 추가한 분류가 없어요." 하나만 그렸다(재시도도, 오프라인 인지 문장도 없이). 그 거짓 빈
 * 목록은 중복·상한 판정의 모집단이기도 해서 **이미 있는 이름에도 [분류 추가]가 활성**이었다.
 * 이제 국면 판정 하나(`customCategoryListPhase`)가 그릴 것과 추가를 열지 말지를 함께 정하고,
 * 얼굴은 형제 화면(app/settings/children.tsx)의 스켈레톤 + LoadErrorCard 한 벌 그대로다.
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

  /**
   * 라운드 103 리뷰 M-3 — **조회가 아직 답하지 않았거나 실패한 창을 빈 목록으로 읽지 않는다.**
   *
   * 두 시점: 종전 이 화면은 이 조회의 로딩·실패를 한 갈래도 읽지 않았다. 그래서 비행기 모드에서
   * 열면 분류가 열다섯 있어도 화면은 "아직 직접 추가한 분류가 없어요." 하나만 그렸고, 그 거짓
   * 빈 목록 위에서 중복·상한 판정이 통과해 **이미 있는 이름에도 [분류 추가]가 활성**이었다
   * (막는 것은 서버 400 하나뿐이었다). 게다가 `householdId`는 `["children"]`이 정착하기 전 null
   * 이라 `splitCustomCategories`가 전부 걸러 내므로, **콜드 진입에도** 같은 문장이 스쳤다.
   *
   * 판정은 화면이 짓지 않는다 — 순수 모듈의 `customCategoryListPhase` 하나가 다섯 갈래(세션 ·
   * 실패 · 확정 전 · 데이터 없음 · 가구 미확정)를 접어 그리고, 화면은 그 답으로 **그릴 것**과
   * **추가를 열지 말지**를 함께 정한다. 문구도 화면 밖이다: 실패 문장·재시도 라벨은 조회 실패의
   * 공용 단일 소스(useLoadErrorCopy)에서 오고, 이 화면은 그 값을 얼굴 한 벌(LoadErrorCard)에
   * 넘기기만 한다 — 형제 화면(app/settings/children.tsx)의 그 모양 그대로다.
   */
  const listPhase = customCategoryListPhase({
    hasSession: Boolean(authToken),
    isPending: categories.isPending,
    isError: categories.isError,
    hasData: Boolean(categories.data),
    householdId
  });
  const loadErrorCopy = useLoadErrorCopy(categories.isError);
  /**
   * 중복·상한 판정을 **믿어도 되는 창**. `ready`가 아닌 동안 그 둘의 답은 "없다"가 아니라
   * "모른다"이므로, 그 위에서 [분류 추가]를 열면 사용자가 받는 것은 사전 안내가 아니라 서버
   * 400이다(리뷰 M-3의 그 파생). 빈 상태 문장도 같은 축을 읽는다 — 두 사실이 한 조건이다.
   */
  const populationKnown = listPhase === "ready";

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
  // ⚠️ 첫 절이 리뷰 M-3의 잠금 축이다(위 `populationKnown`) — 모집단을 모르는 창에서 중복·상한이
  // 조용히 통과하던 자리다. 그 창에서 버튼이 왜 잠겼는지는 바로 위 얼굴이 말한다(실패면
  // LoadErrorCard의 문장과 [다시 시도], 조회 중이면 스켈레톤) — 화면이 문장을 하나 더 짓지 않는다.
  const addBlocked =
    !populationKnown || draftNotice !== null || normalizeCustomCategoryName(draftName).length === 0 || limitReached;

  /**
   * 라운드 103 리뷰 M-1 — 종전에는 네 핸들러가 `expenseGate.guard(...)`였다. 그 창구는 **본문을
   * 받지 않아** 기본값 `EXPENSE_VIEW_ONLY_MESSAGE`("…**기록은** 관리자·공동부모가 남길 수
   * 있어요.")를 띄운다. 이 화면에서 막힌 것은 기록이 아니라 분류를 더하고 고치는 일이라,
   * `record-permissions.ts`가 그 이유를 적으며 `VIEW_ONLY_HEADLINES.categories`를 새로 세웠고
   * 짝 테스트는 그 문장에 "기록은"이 없음을 단언했다 — 그런데 사용자가 실제로 문장을 읽는
   * 순간(탭)에는 금지한 쪽이 떴다. 머리말과 안내가 같은 문장을 말하게 한다.
   * 형태는 `app/budget.tsx`가 예산 화면에 대해 이미 쓰는 것 그대로다.
   */
  const guardCategoryAction = <TArgs extends unknown[]>(action: (...args: TArgs) => void) =>
    guardExpenseAction(expenseGate.locked, () => expenseGate.explain(VIEW_ONLY_HEADLINES.categories), action);

  const submitDraft = guardCategoryAction(() => create.mutate());
  const submitRename = guardCategoryAction((categoryId: string, name: string) =>
    rename.mutate({ categoryId, name: normalizeCustomCategoryName(name) })
  );
  const setActive = guardCategoryAction((categoryId: string, active: boolean) =>
    archive.mutate({ categoryId, active })
  );
  // 보관은 되돌릴 수 있는 조작이지만 되돌리는 자리가 다른 구획이라 한 번 묻는다. 문구는 순수
  // 모듈이 짓고(§9.6 확정값), 화면은 그 네 조각을 Alert에 넘기기만 한다.
  const confirmArchive = guardCategoryAction((categoryId: string, name: string) => {
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
              // 종전 gray300(#E5DFDB): 흰 입력칸 위 **1.32:1**로 사실상 보이지 않았다 — 그때는 테두리와
              // 같은 "연한 회색"을 안내문에도 재사용하는 것이 자연스러웠다. → 이제 text.placeholder
              // (#756C66): 흰 배경 5.13:1(AA 통과)이면서 입력값(text.primary)과는 3.23:1로 구별된다.
              // 값의 근거와 두 수치는 src/theme.ts의 그 토큰 주석이 든다(라운드 106 정찰 S2 발견 3).
              placeholderTextColor={theme.colors.text.placeholder}
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

        {/* 라운드 103 리뷰 M-3: 조회 중 · 조회 실패의 두 갈래. 자리·모양은 형제 화면
            (app/settings/children.tsx)이 라운드 96 T6에 세운 그대로다 — 실루엣 두 장이 서고,
            실패는 화면마다 다른 얼굴로 서지 않게 LoadErrorCard 한 벌이 진다. 문구·재시도 라벨은
            공용 단일 소스(useLoadErrorCopy)의 값이라 이 화면이 문장을 짓지 않는다(§9.6). */}
        {listPhase === "loading" ? (
          <View style={{ gap: theme.spacing.gap }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : null}
        {listPhase === "error" ? (
          <LoadErrorCard
            message={loadErrorCopy.title}
            retryLabel={loadErrorCopy.actionLabel}
            onRetry={() => categories.refetch()}
          />
        ) : null}

        <Card style={{ gap: theme.spacing.gap }}>
          <Text accessibilityRole="header" style={sectionTitleStyle}>
            {copy.inUseSectionTitle}
          </Text>
          {/* 라운드 103 리뷰 M-2: 종전에는 이 자리에서 언제나 `emptyStateText`("아직 직접
              추가한 분류가 없어요.")를 그렸다. 판정은 사용 중 구획(`inUse`)인데 문장은 화면
              전체를 말해서, 전부 보관한 상태에서는 **바로 아래 보관 목록과 나란히** 거짓말이
              섰다(15개를 만들고 전부 보관하면 상한 안내와도 동시에 선다 — 상한의 분모는
              보관을 포함한 `total`이기 때문이다). 두 사실을 두 문장으로 가른다. */}
          {/* 라운드 103 리뷰 M-3: 빈 상태 문장은 **아는 창에서만** 선다(`populationKnown`).
              조회가 답하지 않았거나 실패한 창에서 "없어요"는 사실이 아니라 모른다는 뜻이고,
              그 창의 얼굴은 위 스켈레톤·LoadErrorCard가 이미 지고 있다. 실패해도 손에 남은
              옛 목록은 계속 그린다 — 형제 화면이 실패 카드 아래에 아이 목록을 그대로 두는 그
              판단과 같다(실패를 이유로 아는 사실을 지우지 않는다). */}
          {mine.inUse.length > 0 ? (
            mine.inUse.map(renderRow)
          ) : populationKnown ? (
            <Text style={captionStyle}>{mine.total === 0 ? copy.emptyStateText : copy.inUseEmptyText}</Text>
          ) : null}
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
            {/* 라운드 103 리뷰 L-1: [다시 사용]은 보관 구획에 있는데 그 실패 문구는 위 카드에만
                있었다. 보관 행이 많으면 실패 문장이 스크롤 밖에 서서 화면이 침묵한 것처럼
                읽힌다(낭독은 `announceForA11y`가 덮으므로 시각 사용자만의 문제였다). 같은
                뮤테이션을 쓰는 자리 둘이 같은 문구를 그린다. */}
            {archive.isError ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={errorTextStyle}>
                {archiveErrorText}
              </Text>
            ) : null}
            <Text style={captionStyle}>{copy.archivedFootnote}</Text>
          </Card>
        ) : null}

        <Card style={{ gap: theme.spacing.gap }}>
          <TextInput
            accessibilityLabel={copy.addInputLabel}
            maxLength={customCategoryNameMaxLength()}
            onChangeText={setDraftName}
            placeholder={copy.addPlaceholder}
            // 종전 gray300(#E5DFDB) → text/token placeholder 통일(위 첫 자리의 주석이 값의 근거).
            placeholderTextColor={theme.colors.text.placeholder}
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
