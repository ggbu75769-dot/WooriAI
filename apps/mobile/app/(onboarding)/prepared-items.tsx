import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { listItems, LOCAL_SESSION_TOKEN, setPreparedItems } from "../../src/api/client";
// 라운드 86 트랙 B(#2): 조회 실패 문구의 공용 단일 소스. 이 화면이 읽는 것은 **오프라인 갈래인지
// 묻는 값 하나와 판정 훅 하나**뿐이고, 문장은 한 글자도 이 화면이 짓지 않는다
// (settings/notifications.tsx가 먼저 지나간 그 관례 — 주어 한 조각만 온라인 갈래에 얹는다).
import { OFFLINE_LOAD_NOTICE } from "../../src/offline/messages";
import { useLoadErrorCopy } from "../../src/offline/use-load-error-copy";
// 라운드 72 트랙 A(#1): "이 단계를 로컬로 통과할 수 있는가"의 순수 판정 + 그 버튼의 라벨.
import { canPassPreparedItemsLocally, PREPARED_ITEMS_LOCAL_PASS_LABEL } from "../../src/onboarding/local-progress";
import {
  PREPARED_ITEMS_PARTIAL_ALERT_TITLE,
  preparedIdsToSubmit,
  preparedItemsPartialNotice,
  selectPreparedItemOptions,
  togglePreparedItemId
} from "../../src/onboarding/prepared-items-selection";
import {
  OnboardingSaveErrorCard,
  OnboardingStepProgress,
  useOnboardingStepAnalytics
} from "../../src/onboarding/step-ui";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppScreen, Card, PrimaryButton, ScreenHeader, TextButton } from "../../src/ui";
import { SkeletonRow } from "../../src/ui/Skeleton";
import { theme } from "../../src/theme";

export default function PreparedItemsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const completeStep = useOnboardingProgressStore((state) => state.completeStep);
  // 기본값은 전체 해제 — 사용자가 직접 고른 것만 "이미 준비했다"고 선언한다(라운드 45 UX-Y).
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  // 라운드 60 #9: 단계 진입 계측(onboarding_step_viewed). 동의 OFF면 완전한 no-op이다.
  useOnboardingStepAnalytics("ONB-003");

  /**
   * 라운드 49 QA(P2-2): 데모 세션도 **같은 조회, 같은 판정**을 쓴다.
   *
   * 예전에는 데모만 걸음마기 픽스처 2종(기저귀·아기띠)을 고정으로 그렸다. 테스트 로그인이
   * 0에서 시작하면서 아이의 시기도 사용자가 고르게 됐는데, 임신 중을 고른 사람에게 걸음마기
   * 물건을 내밀고 "체크한 항목은 준비물 목록에서 완료로 표시할게요"라고 약속하는 셈이었다 --
   * 그 약속은 지켜지지 않는다(그 아이의 준비템 탭에는 없는 항목이다).
   *
   * 데모 토큰(`LOCAL_SESSION_TOKEN`)의 listItems는 client.ts의 isLocalToken 분기가 로컬 백엔드로
   * 돌리므로 네트워크 요청이 나가지 않는다(준비템 탭이 이미 같은 경로를 쓴다). 로컬 백엔드는
   * localItemTemplateFixtures를 **선택된 아이의 단계**로 걸러 주므로, 후보 계산은 실세션과
   * 한 줄도 다르지 않다.
   */
  const isItemsQueryEnabled = Boolean(authToken && selectedChildId);
  const itemsQuery = useQuery({
    queryKey: ["onboarding-prepared-items", selectedChildId],
    enabled: isItemsQueryEnabled,
    queryFn: () => listItems(authToken!, selectedChildId!, "now")
  });

  const options = selectPreparedItemOptions(itemsQuery.data?.items ?? []);
  // 비활성 쿼리도 react-query에서는 isPending이라, 로딩 판정에는 "실제로 조회 중"인지를 함께 본다.
  const isLoadingOptions = isItemsQueryEnabled && itemsQuery.isPending;
  const hasOptions = options.length > 0;
  const idsToSubmit = preparedIdsToSubmit(checkedIds, options);

  /**
   * 라운드 86 트랙 B(GAP-086 #2) — **조회가 실패했을 때 이 자리가 연결을 말한다.**
   *
   * 이 화면은 앱에서 **마지막으로** 남아 있던, 오프라인을 말하지 않는 조회 자리였다: 지하철에서
   * 온보딩을 하던 사람이 다른 화면 열넷에서 "지금은 오프라인이에요"를 읽다가 여기서만
   * "불러오지 못했어요. 잠시 후"를 읽었다(그 목록·이유는 src/offline/offline-aware-screens.ts).
   *
   * 배선을 미뤄 온 근거는 *"공용 문장은 [다시 시도]를 가리키는데 이 자리에는 그 버튼이 없다"*
   * 였는데, ⚠️ **그 전제는 오늘 거짓이다** — 조회가 실패하면 이 화면은 이미 [목록 다시 불러오기]
   * (itemsQuery.refetch)를 세운다. 그래서 공용 문장이 가리키는 행동이 실제로 그 자리에 있다.
   *
   * ⚠️ **얹되 지우지 않는다.** 이 화면 고유의 더 구체적인 탈출구 안내("이 단계는 건너뛰고 나중에
   * 준비템 탭에서 체크해도 돼요")는 그대로 아래 줄에 선다 — 제외 사유가 지키려던 것이 그 문장
   * 이었으므로, 공용 문장으로 **후퇴**시키지 않고 그 위에 한 줄을 얹는다(새 한국어 문장 0건).
   *
   * 접두("준비물 목록을")를 오프라인 갈래에 붙이지 않는 이유도 그 화면과 같다: "준비물 목록을
   * 지금은 오프라인이에요…"는 문장이 아니고, 오프라인은 이 목록만의 사실이 아니다. 온라인
   * 갈래는 접두 + 공용 문장이라 종전과 같은 뜻이고, 뒷문장이 가리키는 버튼도 그 자리에 있다.
   *
   * 새 쿼리·새 키·폴러는 0건이다 — 훅은 **에러로 전환되는 순간에 한 번** 연결을 확인한다.
   */
  const itemsLoadErrorCopy = useLoadErrorCopy(itemsQuery.isError);
  const itemsLoadErrorText =
    itemsLoadErrorCopy.title === OFFLINE_LOAD_NOTICE
      ? itemsLoadErrorCopy.title
      : `준비물 목록을 ${itemsLoadErrorCopy.title}`;

  const save = useMutation({
    mutationFn: () => {
      if (!authToken || !selectedChildId) {
        throw new Error("missing onboarding context");
      }
      return setPreparedItems(authToken, selectedChildId, idsToSubmit);
    },
    // 서버가 돌려준 `updatedCount`는 **실제로 반영된 건수**다. 보낸 개수보다 작으면(목록이
    // 갱신되며 사라진 항목을 체크해 둔 경우) 저장은 성공이지만 화면이 아는 수와 다르다 —
    // 진행을 막지 않고 중립 안내 한 줄만 남긴다(preparedItemsPartialNotice 주석 참고).
    //
    // 라운드 46 Q-2: 안내를 fire-and-forget으로 띄우고 바로 push하면, Alert가 이미 넘어간
    // 다음 화면(예산 입력) 위에 떠서 무엇에 대한 안내인지 알 수 없다. 가족 초대 수락
    // (app/family/accept/[token].tsx)의 관례대로 **확인 버튼을 누른 뒤** 단계 완료·이동을
    // 실행한다. 안내가 없을 때는 종전대로 즉시 진행한다(불필요한 탭 한 번을 만들지 않는다).
    onSuccess: (result) => {
      const notice = preparedItemsPartialNotice(idsToSubmit.length, result?.updatedCount);
      const proceed = () => {
        completeStep("ONB-003");
        router.push("/onboarding/budget");
      };
      if (!notice) {
        proceed();
        return;
      }
      Alert.alert(PREPARED_ITEMS_PARTIAL_ALERT_TITLE, notice, [{ text: "확인", onPress: proceed }]);
    }
  });

  // 목록을 못 받았거나(오프라인·서버 오류) 지금 시기에 보여줄 준비템이 없을 때는 이 단계를
  // 건너뛸 수 있어야 한다. 건너뛰기도 같은 저장(빈 목록 = 0건)을 태운다 — 서버가 단계 완료
  // 표시(preparedItemsSetAt)를 남겨야 다음 실행의 이어하기가 이 화면으로 되돌아오지 않고,
  // 요약에도 "0개"라는 사실 그대로가 남는다.
  const canSkip = !isLoadingOptions && !hasOptions;

  /**
   * 라운드 72 트랙 A(#1) — **로컬 탈출구.**
   *
   * 위 저장이 이 화면의 **유일한 전진 경로**였다: 하나도 체크하지 않은 사람이 누르는
   * "건너뛰고 계속"도 같은 서버 쓰기라, 연결이 없으면 0건조차 보내지 못해 온보딩이 여기서
   * 멈췄다. 바로 다음 화면(ONB-004)의 건너뛰기는 순수 로컬이라 오프라인에서도 통과되는데,
   * 같은 온보딩 안에서 두 화면의 규율이 달랐다.
   *
   * 열리는 조건은 **저장이 실패했고 체크가 0건일 때뿐**이다(판정은 순수 모듈 —
   * src/onboarding/local-progress.ts의 `canPassPreparedItemsLocally` 머리말에 근거가 있다).
   * 체크한 항목이 있으면 이 길은 열리지 않는다: 그 체크는 서버에 있어야 의미가 있는 사실이라,
   * 로컬로 넘겨 보내면 앱이 저장한 척하게 된다.
   */
  const canPassLocally = canPassPreparedItemsLocally({ checkedCount: checkedIds.length, saveFailed: save.isError });

  /**
   * ONB-004의 `skip()`과 **같은 모양**이다 — 단계 완료 표시를 남기고 다음 화면으로 보낸다.
   * 다른 점은 하나뿐: 여기서는 `markHomeReached()`를 하지 않는다(온보딩이 끝난 것이 아니다).
   * 성공 경로의 `proceed()`와 같은 두 줄이라 목적지가 갈릴 자리가 없다.
   *
   * ## 라운드 72 리뷰 S-5 — **이 길로 지난 사람은 다음 온라인 콜드 스타트에 여기로 돌아온다**
   *
   * 이 통과는 **로컬 표시만** 남긴다. 서버에는 `preparedItemsSetAt`이 서지 않으므로, 다음 실행에서
   * 진행도 조회가 **성공하면** 서버의 이어하기 대상이 다시 이 화면(ONB-003)이다(위 저장 머리말이
   * 적어 둔 그 이유 — `app/index.tsx`는 서버가 답하면 로컬 폴백을 보지 않는다). 즉 오프라인
   * 탈출구는 여정을 끝내 주는 것이 아니라 **그 자리에서 멈추지 않게** 해 준다.
   *
   * 그래도 막다른 길이 아니다: 그때는 연결이 있으므로 이 화면의 기본 버튼([건너뛰고 계속] —
   * 체크가 0건이라 그 라벨이다)이 0건 저장을 실제로 보내고 한 번에 지나간다. 체크한 항목이
   * 있으면 이 탈출구는 애초에 열리지 않으므로(`canPassPreparedItemsLocally`), 되돌아온 화면에서
   * 사용자가 잃는 선택도 없다. UI는 이 사실 때문에 한 글자도 바뀌지 않는다 — 여기서 안내를
   * 더하면 아직 일어나지 않은(그리고 대개 일어나지 않을) 일을 미리 말하게 된다.
   */
  function passLocally() {
    completeStep("ONB-003");
    router.push("/onboarding/budget");
  }

  return (
    <AppScreen>
      <View testID="screen-ONB-003" style={{ gap: theme.spacing.section }}>
        <OnboardingStepProgress screenId="ONB-003" />
        <ScreenHeader
          eyebrow="출산 준비물"
          title="이미 준비한 물건이 있나요?"
          subtitle="체크한 항목은 준비물 목록에서 완료로 표시할게요."
        />

        <Card style={{ gap: 4 }}>
          {isLoadingOptions ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : null}

          {/* 라운드 87 트랙 B(#2) — **실패 두 줄의 조건은 조회 실패 하나다.**

              라운드 86이 이 두 줄을 세울 때는 0건 갈래(`!isLoadingOptions && !hasOptions`) **안**의
              삼항이었다. 그래서 옛 목록이 그려진 채 다시 불러오기가 실패한 창
              (`isError && hasOptions`)에서는 화면이 실패를 한 글자도 말하지 않고, 맨 아래의
              [목록 다시 불러오기]만 맥락 없이 남았다. 조건을 이 자리로 올려 그 창에서도 문장과
              버튼이 **함께** 서게 한다(그 버튼의 조건과 같은 하나다).

              문구는 한 글자도 바뀌지 않는다: 공용 문장 한 줄(온라인 갈래만 주어 접두 — 위
              `itemsLoadErrorText` 머리말)과 이 화면 고유의 탈출구 안내 한 줄이 종전 그대로
              같은 순서로 선다(얹되 지우지 않는다). */}
          {itemsQuery.isError ? (
            <>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body2.fontSize }}>
                {itemsLoadErrorText}
              </Text>
              <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body2.fontSize }}>
                이 단계는 건너뛰고 나중에 준비템 탭에서 체크해도 돼요.
              </Text>
            </>
          ) : null}

          {/* 0건 갈래는 **실패가 아닐 때만** 선다(종전에는 실패가 이 갈래 안의 삼항이었다).
              문구는 바이트 불변이고, 실패 문장도 오프라인 문장도 [목록 다시 불러오기]도 붙지
              않는다 — "지금 시기에 없다"와 "못 불러왔다"는 다른 사실이라 두 갈래를 더 벌린다. */}
          {!isLoadingOptions && !hasOptions && !itemsQuery.isError ? (
            <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.body2.fontSize }}>
              {"지금 시기에 보여드릴 준비물이 아직 없어요. 이 단계는 건너뛰어도 괜찮아요."}
            </Text>
          ) : null}

          {options.map((item, index) => {
            const checked = checkedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityLabel={item.label}
                accessibilityState={{ checked }}
                onPress={() => setCheckedIds((current) => togglePreparedItemId(current, item.id))}
                style={{
                  alignItems: "center",
                  borderTopColor: theme.colors.gray300,
                  borderTopWidth: index === 0 ? 0 : 1,
                  flexDirection: "row",
                  gap: theme.spacing.gap,
                  minHeight: theme.touchTarget,
                  paddingVertical: 10
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: checked ? theme.colors.mainCoral : theme.colors.beige,
                    borderColor: checked ? theme.colors.mainCoral : theme.colors.gray300,
                    borderRadius: 8,
                    borderWidth: 1,
                    height: 26,
                    justifyContent: "center",
                    width: 26
                  }}
                >
                  {checked ? <Text style={{ color: theme.colors.white, fontSize: 14, fontWeight: "800" }}>✓</Text> : null}
                </View>
                <Text style={{ color: theme.colors.brown, flex: 1, fontSize: theme.typography.body1.fontSize, fontWeight: "700" }}>
                  {item.label}
                </Text>
                {item.essential ? (
                  <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize, fontWeight: "700" }}>
                    필수
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </Card>

        <Text style={{ color: theme.colors.gray600, fontSize: theme.typography.caption.fontSize }}>
          나중에 준비템 탭에서 언제든 다시 체크할 수 있어요.
        </Text>

        {save.isError ? <OnboardingSaveErrorCard error={save.error} onRetry={() => save.mutate()} /> : null}

        <PrimaryButton
          disabled={save.isPending || isLoadingOptions || !authToken || !selectedChildId}
          label={save.isPending ? "저장하는 중" : canSkip ? "건너뛰고 계속" : "저장하고 계속"}
          onPress={() => save.mutate()}
        />
        {canPassLocally ? (
          <TextButton
            disabled={save.isPending}
            label={PREPARED_ITEMS_LOCAL_PASS_LABEL}
            onPress={passLocally}
            style={{ alignSelf: "center" }}
          />
        ) : null}
        {/*
          라운드 86 트랙 B(GAP-086 #2) — 위 실패 문장이 가리키는 **탈출구**다(새 쿼리·새 키 0건 ·
          있는 조회를 사용자가 누를 때만 다시 부른다 · 폴러 0건).

          ⚠️⚠️ **라운드 86 리뷰 L-10 — 이 버튼이 어디 서는지를 정직하게 적는다.** 문장과 버튼은
          **한 화면 안에** 있지 문장 **옆에** 있지 않다: 문장은 위 Card 안 한 줄이고, 이 버튼은
          화면 맨 아래(안내 한 줄 · 저장 실패 카드 · [저장하고 계속] · 로컬 통과 버튼 **다음**)에
          선다. 그래서 이 트랙이 만족시킨 제외 사유 ③(*"공용 문장이 가리키는 행동이 이 자리에
          있다"*)의 참값도 **화면 단위**다 — 스크롤·낭독 순서에서 둘 사이에 최대 네 요소가 낀다.
          그 짝이 실제로 한 짝으로 읽히는지는 코드가 답할 수 없어 기기 확인이 진다
          (`docs/qa/runtime-verification-required.md` #153 ⓑ · 접근성 표 A-27 #99 ⓑ).

          ⚠️ 이 버튼의 조건은 **조회 실패 하나**다 — 0건 갈래에는 붙지 않는다(다시 부를 것이 없다).
          그래서 이 자리를 위 0건 갈래 **안으로** 옮기지 않는다: 옛 목록이 그려진 채 다시 불러오기가
          실패한 창(`isError && hasOptions`)에서는 그 갈래가 서지 않으므로, 안으로 넣으면 다시 해 볼
          길이 그 창에서만 사라진다.

          ⚠️ **라운드 87 트랙 B — 그 창에서 문장과 버튼이 함께 선다.** 라운드 86까지는 실패 문장
          두 줄이 0건 갈래 안에 묶여 있어 이 버튼만 목록 아래에 맥락 없이 남았다. 오늘은 위 실패
          두 줄의 조건이 이 버튼과 **같은 하나**(`itemsQuery.isError`)라, 그 창에서도 무엇이
          실패했는지가 화면 안에 남는다.
        */}
        {itemsQuery.isError ? (
          <TextButton
            disabled={itemsQuery.isFetching}
            label="목록 다시 불러오기"
            onPress={() => void itemsQuery.refetch()}
            style={{ alignItems: "center" }}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}
