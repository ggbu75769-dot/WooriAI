import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, Switch, Text, View } from "react-native";
import {
  confirmAccountDeletion,
  confirmChildProfileDeletion,
  confirmHouseholdLeave,
  getPrivacySettings,
  listChildren,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  previewAccountDeletion,
  previewChildProfileDeletion,
  previewHouseholdLeave,
  setConsentAccepted,
  upsertConsents,
  type SettingsPreview
} from "../../src/api/client";
import { resetLocalBackend } from "../../src/api/local-backend";
import { CHILD_REMOVAL_INVALIDATE_KEYS, planAfterChildRemoval } from "../../src/children/child-deletion";
// 라운드 63 #2: 아이 이름 판정은 이 화면이 다시 적지 않는다 — 라운드 48 T4의 한 벌을 그대로 쓴다.
import { resolveChildScopeLabel } from "../../src/children/child-switch";
import { usePurchaseFollowupStore } from "../../src/commerce/purchase-followup.store";
// 라운드 63 C(#4): 아이 단위 초안 정리. 모듈은 트랙 C 소유이고 여기서는 **호출만** 한다.
import { clearQuickExpenseDraftForChild } from "../../src/expenses/draft-storage";
import {
  childScopeDeleteConfirmTitle,
  childScopeDeleteNotice,
  collectKnownHouseholdIds,
  describeHouseholdScope,
  HOUSEHOLD_SCOPE_PARAM,
  householdScopeLeaveNotice,
  householdScopePhrase,
  isChildrenSettled,
  parseHouseholdScopeParam,
  resolveManagedHouseholdId
} from "../../src/family/household-scope";
// 라운드 61 #2: 탈퇴 직후 가구 목록·역할 표를 서버 기준으로 다시 받는 그 경로 그대로
// (초대 수락과 같은 단일 소스 — app/family/accept/[token].tsx).
import { revalidateHouseholdRoles } from "../../src/family/useExpenseEntryGate";
// 라운드 65 B(#4·#5): 동의 정의 판정과 약관 링크. 버전 리터럴은 앱에 없다 — 서버 정의를 그대로
// 되돌려주는 것이 이 두 모듈의 계약이다.
import {
  optionalConsents,
  pendingRequiredConsents,
  type ConsentDefinitionView
} from "../../src/consent/consent-definitions";
import { legalDocumentUrls, legalKindForConsentType } from "../../src/consent/legal-links";
import { useNotificationStore } from "../../src/notifications/notification.store";
// 라운드 71 B(#2): 실패한 그 순간의 연결 상태. 폴 한 번이고 새 폴러를 돌리지 않는다
// (가족 화면의 파괴적 동작이 쓰는 그 배선 — src/family/member-mutation-messages.ts).
import { isCurrentlyOnline } from "../../src/offline/connectivity";
import { buildConsentSummaryLines } from "../../src/settings/consent-summary";
// 라운드 71 B(#2): 이 화면의 서버 직행 쓰기 넷이 실패했을 때의 문구 단일 소스(순수 모듈).
import {
  destructiveFlowErrorMessage,
  type DestructiveFlowKind
} from "../../src/settings/destructive-flow-messages";
import { useRecurringExpenseStore } from "../../src/stores/recurring-expense.store";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import {
  announceForA11y,
  AppScreen,
  Card,
  EmptyStateCard,
  ScreenHeader,
  SecondaryButton,
  StatusBadge
} from "../../src/ui";

/**
 * 되돌릴 수 없다는 사실. 파괴 플로우 셋의 마지막 확인 Alert이 공유하던 그 한 문장이다.
 */
const IRREVERSIBLE_NOTICE = "이 작업은 되돌릴 수 없어요.";

/**
 * 라운드 66 트랙 B(#6) — **되돌릴 수 없는 동작 앞에서 앱이 말해 주지 않던 유일한 선택지.**
 *
 * 이 화면은 사실을 정직하게 말해 왔다: 무엇이 삭제되는지(카드 본문), 30일 재가입 제한
 * (`ACCOUNT_DELETE_REJOIN_NOTICE`), 되돌릴 수 없다는 것(위 한 줄). 그런데 **1년치 지출 기록을
 * 꺼낼 수 있었다는 사실**만 아무도 말하지 않았다 — 그것도 그 기능이 이 화면의 **부모 화면 안에**
 * 있는데(app/settings/index.tsx의 `ExpenseCsvExportCard`). 파기 잡이 30일 뒤 물리 삭제하면
 * (`DEFAULT_PURGE_RETENTION_DAYS`) 그 데이터는 정말로 없다.
 *
 * 그래서 확인 Alert의 본문 한 문장을 늘리고, 그 문장이 가리키는 자리로 가는 버튼을 함께 둔다.
 * **카드 렌더는 한 줄도 건드리지 않는다** — 라운드 63·65가 이 화면에 "1아이 계정 결과 불변"을
 * 계약으로 걸어 두었고(그 계약은 실재한다 — 픽셀락 캡처 라우트에 설정 계열은 SET-001뿐이지만),
 * 늘리는 것을 Alert 본문으로 좁히면 그 계약을 깨지 않고도 필요한 말을 다 할 수 있다.
 */
const EXPORT_BEFORE_DELETE_NOTICE = "필요하면 먼저 설정 > 데이터 내보내기로 기록을 저장해 주세요.";
/** 그 문장이 가리키는 자리로 가는 Alert 버튼. 문구는 이 화면이 시키는 행동 그대로다. */
const EXPORT_BEFORE_DELETE_ACTION_LABEL = "내보내기";
/** 내보내기 카드가 있는 화면(설정). 이 화면의 부모라 뒤로 가면 그대로 돌아온다. */
const EXPORT_SCREEN_ROUTE = "/settings";

const flowCopy = {
  child_profile_delete: {
    title: "아이 프로필 삭제",
    description: "이 아이의 지출 기록과 준비 목록이 함께 삭제돼요.",
    previewLabel: "삭제 전 확인하기",
    confirmLabel: "아이 프로필 삭제하기",
    /** 사라지는 것이 **자기 기록**이라 먼저 꺼내 둘 수 있다. */
    exportNotice: EXPORT_BEFORE_DELETE_NOTICE
  },
  household_leave: {
    title: "가구 탈퇴",
    description: "가구에서 나가면 공유 데이터에 더 이상 접근할 수 없어요.",
    previewLabel: "탈퇴 전 확인하기",
    confirmLabel: "가구 탈퇴하기",
    /**
     * ⚠️ 탈퇴에는 **붙이지 않는다.** 나가는 사람이 잃는 것은 자기 기록이 아니라 **남의 가구
     * 데이터에 대한 접근**이고, 그것을 내보내라고 권하는 것은 나가는 사람에게 남의 집 데이터를
     * 복사해 가라는 말이 된다. 아이 삭제·계정 삭제 둘만이다.
     */
    exportNotice: null
  },
  account_delete: {
    title: "계정 삭제",
    description: "계정과 모든 데이터가 영구적으로 삭제돼요.",
    previewLabel: "삭제 전 확인하기",
    confirmLabel: "계정 삭제하기",
    exportNotice: EXPORT_BEFORE_DELETE_NOTICE
  }
} as const;

/**
 * 마지막 확인 Alert의 본문. 내보내기를 권하지 않는 갈래(가구 탈퇴)에서는 **종전 한 문장 그대로**다.
 */
function destructiveAlertMessage(exportNotice: string | null): string {
  return exportNotice ? `${IRREVERSIBLE_NOTICE} ${exportNotice}` : IRREVERSIBLE_NOTICE;
}

/**
 * 라운드 45 UX-AA(후보 8ⓐ): 되돌릴 수 없는 결정 앞에서 사용자가 가장 자주 하는 질문("다시 가입하면
 * 되지 않나?")에 대한 사실 한 줄.
 *
 * 근거: 탈퇴는 users.status를 withdrawn으로 바꾸고(households/household-runtime.service.ts의
 * withdrawUser), 카카오 로그인은 그 상태를 USER_WITHDRAWN으로 거절한다(auth/kakao/
 * kakao-auth.service.ts). 그 행은 파기 작업(worker/jobs/data-retention-purge.job.ts,
 * DEFAULT_PURGE_RETENTION_DAYS = 30)이 물리 삭제하기 전까지 남아 있으므로 30일은 **하한**이다
 * -- 그래서 "30일 동안은 …할 수 없어요"까지만 말하고, 30일이 지나면 된다고는 약속하지 않는다.
 */
const ACCOUNT_DELETE_REJOIN_NOTICE = "삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요.";

const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 라운드 71 B(#2) — **실패한 그 순간의 연결 상태로 문구를 고르는 얇은 배선.**
 *
 * 판정과 문장은 전부 순수 모듈에 있다(src/settings/destructive-flow-messages.ts). 여기 남는
 * 것은 "에러로 **전환되는 순간에만** 연결을 한 번 확인한다"는 배선 하나이고, 형태는 라운드 52
 * QA P3-1이 조회·저장 실패 훅에 세운 그 cancelled 패턴 그대로다
 * (src/offline/use-load-error-copy.ts의 `useErrorTimeConnectivity`):
 *   - 에러가 풀리면 초깃값으로 되돌린다(다음 실패는 그때의 연결 상태로 다시 판정한다),
 *   - effect가 정리되면 이전 폴의 결과를 버린다(언마운트 뒤 setState 금지 · 늦게 도착한 옛
 *     판정이 최신 판정을 덮어쓰지 않게).
 *
 * 그 훅을 그대로 부르지 않고 여기 한 벌을 두는 이유: 그쪽은 조회/저장 문구(`resolveLoadErrorCopy`
 * ·`resolveSaveErrorCopy`)에 묶여 있고 연결 판정만 따로 내주지 않는다. 되돌릴 수 없는 확정의
 * 문장은 그 두 표가 아니라 이 화면의 표에서 와야 하므로(모듈 머리말), 배선만 같은 모양으로 둔다.
 *
 * 기본값이 `true`(온라인)인 이유도 같다 — 폴이 끝나기 전 첫 프레임과 연결 상태를 보고할 수 없는
 * 플랫폼에서는 **종전 문장 그대로**이고, 새 문장은 "오프라인이라고 확인된" 경우에만 대체한다.
 */
function useFlowFailureText(kind: DestructiveFlowKind, isError: boolean, error: unknown): string {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!isError) {
      setIsOnline(true);
      return;
    }
    let cancelled = false;
    void isCurrentlyOnline().then((online) => {
      if (!cancelled) setIsOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, [isError]);

  return destructiveFlowErrorMessage(kind, error, { isOnline });
}

/**
 * 라운드 65 B(#4ⓑ) — **되돌아올 길.**
 *
 * 서버는 type + version이 정확히 일치하는 행만 동의로 인정하므로(apps/api
 * onboarding-core.service.ts), 약관을 개정해 버전이 오르면 기존 사용자 전원의 필수 동의가
 * "동의 안 함"으로 뒤집힌다. 이 화면은 그 상태를 **읽기 전용으로 보여 주기만** 했다 -- 다시
 * 동의할 컨트롤이 앱 어디에도 없었다. 버튼은 필수 항목 중 미동의가 하나라도 있을 때만 뜨므로,
 * 정상 상태의 화면은 종전과 한 글자도 다르지 않다.
 *
 * 미동의 상태에서 앱을 계속 쓰게 둘 것인가(차단 게이트)는 이번 범위 밖이다 -- PM·법무 판단이
 * 선행이고, 여기서 만드는 것은 되돌아올 길까지다.
 */
const CONSENT_REQUIRED_NOTICE = "필수 항목에 동의가 필요해요. 약관이 개정되면 다시 동의를 받아요.";
const CONSENT_REQUIRED_ACTION_LABEL = "필수 항목 다시 동의하기";
const CONSENT_REQUIRED_DONE_NOTICE = "필수 항목에 다시 동의했어요.";

/**
 * 선택 동의 스위치가 **약속하지 않는 것**: 이 스위치를 켠다고 알림이 오지는 않는다. 푸시는
 * 자산 3종 부재로 no-op이고(known-limitations A절), 이 값은 **동의 기록**일 뿐이다 -- 없는
 * 기능을 있는 척하지 않는다(DNC-018 톤).
 */
const OPTIONAL_CONSENT_NOTICE = "지금은 동의 기록만 저장돼요. 알림 보내기가 준비되면 이 동의를 기준으로 보내드려요.";

/** 라운드 65 B(#5): 열지 못한 링크는 조용히 실패하지 않는다. */
const LEGAL_LINK_FAILED_TITLE = "링크를 열지 못했어요";
const LEGAL_LINK_FAILED_MESSAGE = "잠시 후 다시 시도해 주세요.";

function DangerButton({
  label,
  onPress,
  disabled
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        dangerButtonStyle,
        disabled ? dangerButtonDisabledStyle : null,
        pressed && !disabled ? { opacity: 0.86 } : null
      ]}
    >
      <Text style={dangerButtonTextStyle}>{label}</Text>
    </Pressable>
  );
}

function PreviewSummary({ preview }: { preview?: SettingsPreview }) {
  if (!preview) return null;
  return (
    <View style={previewBoxStyle}>
      <Text style={previewTitleStyle}>진행하면 이렇게 돼요</Text>
      {preview.impact.map((line) => (
        <Text key={line} style={previewLineStyle}>
          · {line}
        </Text>
      ))}
      {preview.requiresSecondStep ? (
        <Text style={previewNoticeStyle}>한 번 더 확인한 다음에 진행할 수 있어요.</Text>
      ) : null}
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const knownHouseholdIds = useSessionStore((state) => state.householdIds);
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const clearSession = useSessionStore((state) => state.clearSession);
  const childId = useSelectedChildStore((state) => state.selectedChildId);
  const clearChild = useSelectedChildStore((state) => state.clearSelectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();
  const isDemoSession = authToken === LOCAL_SESSION_TOKEN;

  /**
   * R19-C(F2): 아이가 사라지는 두 경로(아이 삭제 · 가구 탈퇴)의 공통 뒤처리.
   * 1) 선택 아이를 비우고, 2) 아이 스코프 캐시를 전부 무효화한 뒤, 3) 남은 아이가 있으면 그중
   *    첫째를 골라 홈으로, 없으면 예전처럼 온보딩으로 보낸다.
   * 예전에는 남은 아이가 있든 없든 무조건 온보딩으로 보내고(둘째를 지운 사용자까지 튕겼다)
   * ["children"]/["home"] 두 키만 지워서 지출·준비템·리포트 캐시가 삭제된 아이 데이터로 남았다.
   */
  const finishChildRemoval = async (doneMessage: string) => {
    clearChild();
    // 데모(local-backend) 세션은 "가구 탈퇴 후 아이 접근 상실"을 모사하지 않아 목록이 실제와
    // 다르다(FIX-118B(F3)와 같은 정직성 규칙) -- 알 수 없음으로 두고 기존 데모 동작을 유지한다.
    const remaining = isDemoSession
      ? null
      : await listChildren(authToken!)
          .then((response) => response.children)
          .catch(() => null);
    await Promise.all(
      CHILD_REMOVAL_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
    );
    const plan = planAfterChildRemoval(remaining);
    if (plan.kind === "select") {
      setSelectedChildId(plan.childId);
      Alert.alert("완료됐어요", `${doneMessage}\n${plan.notice}`);
      announceForA11y(plan.notice);
      router.replace("/(tabs)");
      return;
    }
    Alert.alert("완료됐어요", doneMessage);
    router.replace("/onboarding/child-status");
  };

  const privacy = useQuery({
    queryKey: ["privacy-settings"],
    enabled: Boolean(authToken),
    queryFn: () => getPrivacySettings(authToken!)
  });

  /**
   * 라운드 60 A — **어느 가구를 나가는가.**
   *
   * 탈퇴 대상은 세션의 `defaultHouseholdId`였다. 그 값은 다른 가구 초대를 수락하는 순간 영구히
   * 바뀌므로, 수락한 사용자가 "가구 탈퇴"를 누르면 자기 본가구가 아니라 **방금 들어간 가구**를
   * 나가게 되고(또는 그 반대), 화면 어디에도 어느 가구인지 적혀 있지 않았다. 이제 대상은 보고
   * 있는 아이의 가구이고, 그 가구를 가리킬 수 있으면 아래 한 줄로 말한다. 아이 목록은 다른
   * 화면들과 같은 `["children"]` 캐시다(대개 이미 채워져 있다).
   */
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const scopedHouseholdId = resolveManagedHouseholdId({
    children: childrenQuery.data?.children,
    childId,
    fallbackHouseholdId,
    // 세션이 없으면 기다릴 조회 자체가 없다(쿼리가 disabled라 영원히 pending이다).
    childrenSettled: isChildrenSettled({ authToken, isSuccess: childrenQuery.isSuccess, isError: childrenQuery.isError })
  });
  /**
   * 라운드 62 #4 — 가족 화면이 **가구를 전환한 채로** 보냈다면 그 가구를 나간다.
   *
   * 위 판정만으로는 **아이가 하나도 없는 가구를 영영 가리킬 수 없다**(1단계는 선택 아이의 가구,
   * 3단계는 기본 가구). 그래서 초대를 수락해 들어간 빈 가구는 가족 화면에서 "다른 가구 보기"로
   * 볼 수만 있고 앱 안에서 나갈 방법이 없었다 — 계정에 영구히 붙어 있는 가구가 생긴다. 전환은
   * 가족 화면의 지역 상태라(app/family/index.tsx의 `viewedHouseholdId`) 이 화면에서는 보이지
   * 않으므로, 초대 화면과 **같은 관례**로 파라미터를 받는다(라운드 61 #3).
   *
   * 파라미터는 **아는 가구일 때만** 통과한다(collectKnownHouseholdIds 화이트리스트 —
   * 아이의 가구 · 서버가 말한 목록 · 기본 가구). 모르는 값은 조용히 무시하고 종전의 아이 기준
   * 판정으로 떨어진다: 되돌릴 수 없는 화면이라 **검증 실패가 차단이면 안 된다** — 모르는 값 하나
   * 때문에 화면을 잠그면 정작 나갈 수 있어야 할 사람이 못 나간다. 매 렌더에서 다시 검증하므로
   * (effect로 상태를 만들지 않는다 — 가족 화면·초대 화면의 검증과 같은 형태다) 아이 목록이 늦게
   * 도착해 화이트리스트가 넓어지면 그때 통과하고, 탈퇴가 끝나 목록에서 사라지면 즉시 되돌아간다.
   *
   * 1가구 계정에서는 가족 화면이 전환 자체를 못 하므로 **파라미터가 생기지 않고**, 이 화면은
   * 종전과 한 글자도 달라지지 않는다(SET-003의 1가구 문자열 불변 계약 — **캡처 아님**.
   * 라운드 66 F 정정: 픽셀락 캡처 라우트에 설정 계열은 SET-001뿐이다 — app/pixel-lock.tsx.
   * 이 불변을 잠그는 것은 캡처가 아니라 src/family/household-scope.test.ts의 단언이다).
   */
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const requestedHouseholdId = parseHouseholdScopeParam(
    params[HOUSEHOLD_SCOPE_PARAM],
    collectKnownHouseholdIds({
      children: childrenQuery.data?.children,
      knownHouseholdIds,
      fallbackHouseholdId
    })
  );
  const householdId = requestedHouseholdId ?? scopedHouseholdId;
  /**
   * 되돌릴 수 없는 동작이 무엇을 대상으로 하는지 말하는 한 줄. 서버가 내려주는 영향 목록
   * (preview.impact)은 가구를 특정하지 않으므로 클라이언트 라벨로 보완한다 -- 서버 API는
   * 건드리지 않는다. 1가구 계정에서는 null이라 카드가 종전과 한 글자도 달라지지 않는다.
   *
   * 라운드 62 #4: 대상이 파라미터로 왔다면 이 라벨도 **그 가구**를 가리킨다(같은 `householdId`를
   * 읽으므로 자동으로 그렇다) -- 자기가 어느 가구를 나가는지 화면이 정직하게 말하는 것이 이 줄이
   * 존재하는 이유이고, 대상만 옮겨 가고 라벨이 남으면 그 줄이 곧 거짓말이 된다.
   */
  const householdLeaveNotice = householdScopeLeaveNotice(
    householdScopePhrase(
      describeHouseholdScope({
        householdId,
        children: childrenQuery.data?.children,
        knownHouseholdIds,
        fallbackHouseholdId
      })
    )
  );

  /**
   * 라운드 63 #2 — **어느 아이를 지우는가.**
   *
   * 종전에는 세 단계 어디에도 이름이 없었다: 카드 본문이 "이 아이의 …"이고(그 "이 아이"가 누구인지
   * 화면에 없다), 서버 미리보기는 고정 문자열 목록이라 이름도 건수도 없으며
   * (apps/api onboarding-core.service.ts의 `childProfileDeleteImpact`), 확인 Alert도 "정말
   * 삭제할까요?"뿐이었다. 대상은 전역 선택 아이(`childId`)인데, 라운드 62 #2가 알림함에도 아이
   * 전환 입구를 열면서 **선택 아이가 조용히 바뀌는 순간**이 늘었다 — 그 전환은 이 화면에 아무
   * 흔적도 남기지 않으므로, 둘째를 지우러 들어와 첫째를 지우고도 화면상 아무것도 다르지 않다.
   * 결과는 아이 + 그 아이의 비삭제 지출 전량의 soft delete이고 앱 안에 복구 경로가 없다.
   *
   * 그래서 카드·확인 Alert 두 자리에 같은 이름을 싣는다(서버 미리보기 문구는 서버 몫이라 그대로
   * 두고, 그 목록이 뜨는 자리가 이 카드 안이라 같은 한 줄이 함께 읽힌다). **서버는 건드리지 않는다.**
   *
   * 이름 판정은 `resolveChildScopeLabel` 한 벌이다(라운드 48 T4) — 아이가 2명 이상일 때만 값을
   * 내고, 캐시가 아직 없거나 목록에 없는 childId면 null이다. null이면 카드도 Alert도 종전 문구
   * 그대로다: **모르면 지어내지 않는다.** 목록은 이 화면이 이미 물고 있는 `["children"]`이라
   * 새 요청이 나가지 않는다.
   */
  const childDeleteLabel = resolveChildScopeLabel(childId, childrenQuery.data?.children);
  const childDeleteNotice = childScopeDeleteNotice(childDeleteLabel);

  const childPreview = useMutation({
    mutationFn: () => previewChildProfileDeletion(authToken!, childId!)
  });
  const childDelete = useMutation({
    mutationFn: () => confirmChildProfileDeletion(authToken!, childId!, childPreview.data?.confirmationText ?? ""),
    /**
     * 라운드 62 #5 — **삭제한 아이의 기기 잔재를 지운다.**
     *
     * 종전 뒤처리는 쿼리 캐시뿐이었다(finishChildRemoval의 CHILD_REMOVAL_INVALIDATE_KEYS).
     * 그런데 기기에 persist되는 아이 단위 상태가 셋 더 있다 -- 정기 지출 템플릿·알림 줄·구매
     * 대기(`template.childId` · `entry.childId`). 삭제한 아이의 알림은 이름을 해석할 수 없어
     * 태명 접두도 붙지 않은 채 알림함에 계속 서 있고(눌리면 지금 아이의 화면이 열린다),
     * 템플릿은 아이별 상한 20칸을 차지한 채 남는다.
     *
     * 세 스토어의 `clearForChild`는 **아이 단위 정리 전용** 액션이다 -- PRIV-104 teardown
     * (`resetAll`, 정체성 전환에만 발화)과 섞지 않는다.
     *
     * **가구 탈퇴 경로에서는 부르지 않는다.** 그쪽은 어느 아이가 사라졌는지 모르기 때문이고
     * (아래 householdLeave의 P3 주석), 여기서는 childId를 손에 쥐고 있다는 것이 차이의 전부다.
     * 그래서 호출도 공통 뒤처리(finishChildRemoval)가 아니라 **이 자리**에 둔다.
     */
    onSuccess: async () => {
      childPreview.reset();
      const removedChildId = childId;
      if (removedChildId) {
        useNotificationStore.getState().clearForChild(removedChildId);
        usePurchaseFollowupStore.getState().clearForChild(removedChildId);
        useRecurringExpenseStore.getState().clearForChild(removedChildId);
        /**
         * 라운드 63 C(#4) — 네 번째 잔재: **기록 시트의 오프라인 초안.**
         *
         * 세 스토어는 깨끗해졌는데 초안만 살아남으면, 존재하지 않는 아이를 위해 치던 금액이
         * 다음 진입에서 **남은 아이에게** 프리필처럼 붙는다(그대로 저장하면 남은 아이의
         * 지출이 된다). 무엇을 지우는지는 모듈이 진다 — 그 아이의 초안이거나 주인을 말하지
         * 않는 초안일 때만 지우고, 다른 아이의 초안은 그대로 둔다
         * (src/expenses/draft-storage.ts의 `clearQuickExpenseDraftForChild`).
         *
         * 위 셋과 달리 비동기라 await한다: 뒤이어 화면이 이동하므로(finishChildRemoval)
         * 붙들지 않으면 지우기 전에 이 컴포넌트가 사라질 수 있다.
         */
        await clearQuickExpenseDraftForChild(removedChildId);
      }
      await finishChildRemoval("아이 프로필을 삭제했어요.");
    }
  });

  const householdPreview = useMutation({
    mutationFn: () => previewHouseholdLeave(authToken!, householdId!)
  });
  const householdLeave = useMutation({
    mutationFn: () => confirmHouseholdLeave(authToken!, householdId!, householdPreview.data?.confirmationText ?? ""),
    /**
     * 라운드 61 #2 — **나간 가구를 세션에서도 내보낸다.**
     *
     * 종전에는 성공 뒤 캐시만 무효화했다. 그런데 이 계정이 아는 가구는 캐시가 아니라 세션
     * 스토어에 있다(`householdIds` · `householdRoles` · `defaultHouseholdId` — persist라 앱을
     * 다시 켜도 남는다). 그래서 방금 나온 가구가
     *   - 가족 화면의 "다른 가구 보기" 후보로 계속 서 있고(고르면 403/404뿐이다),
     *   - 다가구 표기·역할 판정의 근거로 계속 세어지고,
     *   - `defaultHouseholdId`였다면 **다음 탈퇴의 대상**으로까지 남았다(아이가 없는 계정에서
     *     대상 가구는 그 값이다 — resolveManagedHouseholdId의 3단계 폴백).
     *
     * 두 줄로 정리한다. 새 스토어 API도, 새 요청 경로도 만들지 않는다.
     */
    onSuccess: async () => {
      householdPreview.reset();
      const leftHouseholdId = householdId;
      // 탈퇴한 가구의 아이만 접근을 잃는다 -- 다른 가구에 아이가 남아 있으면 그쪽으로 이어간다.
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
      /**
       * ① 기본 가구가 방금 나온 그 가구면 **비운다**.
       *
       * 라운드 60의 "덮어쓰기 금지" 계약(app/family/accept/[token].tsx)과 충돌하지 않는다 --
       * 그 계약이 막는 것은 **살아 있는 사실을 다른 살아 있는 사실로 갈아 끼우는 일**이다
       * (초대를 수락했다는 이유로 원래 가구를 가리키던 유일한 값을 잃는 것). 여기서 지우는
       * 값은 서버가 방금 "당신은 이 가구의 구성원이 아니다"라고 답한 **죽은 값**이고, 죽은
       * 값을 붙들고 있으면 그것이 곧 다음 화면의 거짓말이 된다. 그래서 규칙은 이렇게 갈린다:
       *   - 살아 있는 값은 덮어쓰지 않는다(수락);
       *   - 죽은 값은 붙들지 않는다(탈퇴).
       * 대신 **다른 가구를 골라 채우지도 않는다** -- null은 "모름"이고, 모름이면 판정은
       * 아이 기준으로 돌아간다(그게 우리가 아는 유일한 사실이다). 남은 가구 중 하나를
       * 기본으로 지어내는 것은 사용자가 고른 적 없는 선택이다.
       */
      if (leftHouseholdId && useSessionStore.getState().defaultHouseholdId === leftHouseholdId) {
        useSessionStore.setState({ defaultHouseholdId: null });
      }
      /**
       * ② 가구 목록·역할 표를 **서버 기준으로** 다시 받는다(초대 수락과 같은 관례 —
       * app/family/accept/[token].tsx). 표가 방금 바뀐 것을 아는 순간이라 스로틀의 전제
       * ("같은 사실을 반복해 묻는다")가 성립하지 않으므로 `force`다.
       *
       * 마지막 가구에서 나온 사람은 서버가 `households: []`로 답한다 -- 그 빈 목록은
       * `setHouseholdRoles`를 지나 표·목록을 **둘 다 null(모름)**로 만든다(세션 스토어의
       * 빈 목록 경로 주석 그대로). 모름은 아무 진입점도 잠그지 않으므로, 가구가 하나도 없는
       * 계정이 자기 아이 기록에서 잠기는 일은 생기지 않는다.
       *
       * 조회는 백그라운드다. 응답이 늦게 도착했는데 그사이 세션이 끝났다면(로그아웃 →
       * userId null) `setHouseholdRoles`가 그대로 빠져나가므로 떠난 계정의 표가 되살아나지
       * 않는다. 만료(`clearSession("expired")`)는 정체성을 남기므로 갱신이 그대로 착지하고,
       * 그게 맞다 -- 사람도 계정도 그대로이고 방금 탈퇴한 사실도 그대로다.
       */
      revalidateHouseholdRoles({ force: true });
      /**
       * P3(라운드 61 정찰) — 여기서 **정리되지 않는 것**을 적어 둔다(이번 라운드 범위 밖).
       *
       * 정기 지출 템플릿(src/stores/recurring-expense.store.ts)과 알림 목록
       * (src/notifications/notification.store.ts)은 가구가 아니라 **아이 단위**로 쌓인다
       * (`template.childId` · `entry.childId`). 탈퇴로 접근을 잃는 것은 그 가구의 아이들이므로,
       * 그 아이들의 템플릿·알림은 기기에 그대로 남아 이번 달 리마인더로 다시 뜬다 -- 사용자는
       * 더 이상 볼 수 없는 아이의 "기저귀 살 때예요"를 계속 받는다. PRIV-104의 teardown은
       * 정체성 전환(userId·isTestSession)에만 걸리는데(src/offline/session-teardown.ts) 탈퇴는
       * 같은 사람이 계속 로그인해 있는 상태라 발화하지 않는다. 아래 `finishChildRemoval`이
       * 지우는 것은 쿼리 캐시뿐이다(CHILD_REMOVAL_INVALIDATE_KEYS).
       *
       * 고치려면 "어느 아이가 사라졌는가"를 알아야 하는데, 탈퇴 응답도 이후 목록 조회도 그것을
       * 말해 주지 않는다(남은 아이만 온다). 탈퇴 직전 목록과의 차집합을 뜨는 설계가 필요하고,
       * 그건 이 라운드의 "세션 잔재" 한 줄과는 범위가 다르다 -- 근거만 남긴다.
       *
       * 라운드 62 #5: **아이 삭제 쪽만** 고쳐졌다(위 childDelete의 clearForChild 세 줄). 그쪽은
       * 사라지는 아이의 id를 손에 쥐고 있어 정확히 그 아이의 것만 지울 수 있다. 여기서 같은
       * 액션을 부르지 않는 이유는 위 문단 그대로다 -- 집합을 모르는 채로 부르면 지울 대상을
       * 지어내는 일이 된다.
       */
      await finishChildRemoval("가구에서 나갔어요.");
    }
  });

  const accountPreview = useMutation({
    mutationFn: () => previewAccountDeletion(authToken!)
  });
  const accountDelete = useMutation({
    mutationFn: () => confirmAccountDeletion(authToken!, accountPreview.data?.confirmationText ?? ""),
    onSuccess: () => {
      Alert.alert("완료됐어요", "계정을 삭제했어요.");
      if (isTestSession) {
        resetLocalBackend();
      }
      clearSession();
      clearChild();
      router.replace("/launch-animation");
    }
  });

  /**
   * 라운드 66 트랙 B(#6) — Alert 본문이 가리킨 자리로 **실제로 갈 수 있게** 하는 버튼.
   *
   * 문장만 두면 "설정 > 데이터 내보내기"를 사용자가 직접 찾아 들어가야 하고, 그 사이 이 화면은
   * 닫힌다(Alert은 어떤 버튼을 눌러도 닫힌다). 그래서 그 버튼이 곧 이동이다 — 목적지는 이
   * 화면의 부모라 뒤로 가면 그대로 돌아온다. **삭제는 일어나지 않는다**: 취소와 같은 자리에서
   * 흐름을 빠져나가는 선택지이고, 미리보기 상태는 그대로 남아 돌아와 이어서 진행할 수 있다.
   */
  const goToExportScreen = () => router.push(EXPORT_SCREEN_ROUTE);

  const confirmChildDelete = () => {
    if (!childPreview.data || childDelete.isPending) return;
    // 라운드 63 #2: 이름을 알면 제목이 대상을 말하고, 모르면 종전 제목 그대로다.
    Alert.alert(
      childScopeDeleteConfirmTitle(childDeleteLabel) ?? "정말 삭제할까요?",
      destructiveAlertMessage(flowCopy.child_profile_delete.exportNotice),
      [
        { text: "취소", style: "cancel" },
        { text: EXPORT_BEFORE_DELETE_ACTION_LABEL, onPress: goToExportScreen },
        { text: "삭제", style: "destructive", onPress: () => childDelete.mutate() }
      ]
    );
  };

  const confirmHouseholdLeaveAction = () => {
    if (!householdPreview.data || householdLeave.isPending) return;
    // 탈퇴에는 내보내기 안내도 버튼도 붙지 않는다(위 flowCopy.household_leave.exportNotice 주석).
    Alert.alert("정말 나갈까요?", destructiveAlertMessage(flowCopy.household_leave.exportNotice), [
      { text: "취소", style: "cancel" },
      { text: "나가기", style: "destructive", onPress: () => householdLeave.mutate() }
    ]);
  };

  const confirmAccountDelete = () => {
    if (!accountPreview.data || accountDelete.isPending) return;
    Alert.alert("정말 삭제할까요?", destructiveAlertMessage(flowCopy.account_delete.exportNotice), [
      { text: "취소", style: "cancel" },
      { text: EXPORT_BEFORE_DELETE_ACTION_LABEL, onPress: goToExportScreen },
      { text: "삭제", style: "destructive", onPress: () => accountDelete.mutate() }
    ]);
  };

  const flows = privacy.data?.flows ?? [];
  /**
   * 라운드 45 UX-AA(후보 3): 화면 부제는 "동의 내역과 삭제 · 탈퇴를 관리해요"인데 동의 내역이
   * 어디에도 없었다. 서버 GET /settings/privacy가 이미 함께 내려주는 값이라 **새 요청 없이**
   * 그린다. 응답에 없거나(구 서버) 불러오기에 실패하면 빈 배열 -> 카드를 아예 그리지 않는다.
   *
   * 라운드 65 B(#4): 같은 응답이 type·version·필수 여부까지 싣고 있으므로, 재동의와 선택 동의
   * 스위치도 **이 값 하나**로 판정한다(추가 조회 0건, 버전 리터럴 0벌).
   */
  const consentDefinitions = privacy.data?.consents ?? [];
  const consentToggles = optionalConsents(consentDefinitions);
  const pendingRequired = pendingRequiredConsents(consentDefinitions);
  const consentLines = buildConsentSummaryLines(privacy.data?.consents, {
    // 스위치로 그리는 항목은 상태 줄을 만들지 않는다(같은 사실을 두 번 말하지 않는다).
    excludeTypes: consentToggles.map((definition) => definition.type)
  });
  const showConsentCard = consentLines.length > 0 || consentToggles.length > 0;
  /** 라운드 65 B(#5): 주입된 빌드에서만 [보기] 링크가 생긴다(값이 없으면 카드가 종전 그대로다). */
  const legalUrls = legalDocumentUrls();

  /** 필수 동의 재제출 — 로그인이 쓰는 그 경로 그대로다(서버가 준 버전을 그대로 되돌려준다). */
  const reconsent = useMutation({
    mutationFn: () => upsertConsents(authToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["privacy-settings"] });
      announceForA11y(CONSENT_REQUIRED_DONE_NOTICE);
    }
  });

  /** 선택 동의 켜기/끄기 — 버전은 위 응답이 준 정의에서 온다. */
  const consentToggle = useMutation({
    mutationFn: (input: { definition: ConsentDefinitionView; accepted: boolean }) =>
      setConsentAccepted(authToken!, input.definition, input.accepted),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["privacy-settings"] });
    }
  });
  /**
   * 저장이 끝나 목록이 갱신되기 전까지는 **방금 고른 값**을 보여준다. 그러지 않으면 스위치가
   * 눌린 직후 원래 자리로 튀었다가 잠시 뒤 다시 넘어간다.
   */
  const consentToggleValue = (definition: ConsentDefinitionView) => {
    const inFlight = consentToggle.isPending ? consentToggle.variables : undefined;
    return inFlight && inFlight.definition.type === definition.type ? inFlight.accepted : definition.accepted;
  };

  /**
   * 라운드 71 B(#2) — 실패한 흐름마다 **그 실패가 무엇이었는지**를 말하는 한 줄.
   *
   * 셋은 되돌릴 수 없는 확정이고 넷째는 되돌아올 길이다(동의 재동의·선택 동의 스위치는 한 자리에
   * 문장을 그리므로 두 뮤테이션의 OR을 넘기고, `error`도 같은 순서로 고른다 — 아이 관리 화면이
   * 세운 관례 그대로다: app/settings/children.tsx).
   */
  const childDeleteFailureText = useFlowFailureText("child_profile_delete", childDelete.isError, childDelete.error);
  const householdLeaveFailureText = useFlowFailureText("household_leave", householdLeave.isError, householdLeave.error);
  const accountDeleteFailureText = useFlowFailureText("account_delete", accountDelete.isError, accountDelete.error);
  const consentUpdateFailureText = useFlowFailureText(
    "consent_update",
    reconsent.isError || consentToggle.isError,
    reconsent.error ?? consentToggle.error
  );

  const openLegalDocument = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("cannot-open-url");
      await Linking.openURL(url);
    } catch {
      Alert.alert(LEGAL_LINK_FAILED_TITLE, LEGAL_LINK_FAILED_MESSAGE);
    }
  };

  return (
    <AppScreen>
      <View testID="screen-SET-003" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="설정"
          title="약관 및 개인정보"
          subtitle="동의 내역과 삭제 · 탈퇴를 관리해요"
          onBack={() => router.back()}
        />

        {privacy.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {privacy.isError ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>
            <SecondaryButton label="다시 시도" onPress={() => privacy.refetch()} />
          </Card>
        ) : null}

        {showConsentCard ? (
          <Card style={{ gap: 8 }}>
            <Text style={cardTitleStyle}>동의 내역</Text>
            {consentLines.map((line) => {
              // 라운드 65 B(#5): 문서가 있는 항목(terms · privacy)에만, URL이 주입된 빌드에만.
              const legalKind = legalKindForConsentType(line.type);
              const documentUrl = legalKind ? legalUrls[legalKind] : null;
              return (
                <View key={line.title} style={rowHeaderStyle}>
                  <Text style={consentTitleStyle}>{line.title}</Text>
                  {documentUrl ? (
                    <Pressable
                      accessibilityLabel={`${line.title} 전문 보기`}
                      accessibilityRole="link"
                      onPress={() => void openLegalDocument(documentUrl)}
                      style={legalLinkStyle}
                    >
                      <Text style={legalLinkTextStyle}>보기</Text>
                    </Pressable>
                  ) : null}
                  <Text style={mutedTextStyle}>{line.statusText}</Text>
                </View>
              );
            })}

            {/* 라운드 65 B(#4ⓑ): 필수인데 미동의인 항목이 하나라도 있을 때만 나타난다. */}
            {pendingRequired.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={mutedTextStyle}>{CONSENT_REQUIRED_NOTICE}</Text>
                <SecondaryButton
                  label={reconsent.isPending ? "저장하는 중..." : CONSENT_REQUIRED_ACTION_LABEL}
                  disabled={!authToken || reconsent.isPending}
                  onPress={() => reconsent.mutate()}
                />
              </View>
            ) : null}

            {/* 라운드 65 B(#4ⓑ): 화면에 뜨는데 켤 수 없던 선택 동의(소식 알림)를 여기서 켜고 끈다. */}
            {consentToggles.map((definition) => (
              <View key={definition.type} style={{ gap: 4 }}>
                <View style={rowHeaderStyle}>
                  <Text style={consentTitleStyle}>{definition.title}</Text>
                  <Switch
                    accessibilityLabel={definition.title}
                    accessibilityRole="switch"
                    disabled={!authToken || consentToggle.isPending}
                    onValueChange={(accepted) => consentToggle.mutate({ definition, accepted })}
                    thumbColor={theme.colors.white}
                    trackColor={{ false: theme.colors.gray300, true: theme.colors.mainCoral }}
                    value={consentToggleValue(definition)}
                  />
                </View>
                <Text style={mutedTextStyle}>{OPTIONAL_CONSENT_NOTICE}</Text>
              </View>
            ))}

            {reconsent.isError || consentToggle.isError ? (
              <Text style={{ color: theme.colors.danger }}>{consentUpdateFailureText}</Text>
            ) : null}
          </Card>
        ) : null}

        {!privacy.isLoading && !privacy.isError && flows.length === 0 ? (
          <EmptyStateCard title="표시할 항목이 없어요" actionLabel="새로고침" onPress={() => privacy.refetch()} />
        ) : null}
      </View>

      <View testID="screen-SET-004" style={{ gap: theme.spacing.gap }}>
        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={cardTitleStyle}>{flowCopy.child_profile_delete.title}</Text>
            <StatusBadge label="위험" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.child_profile_delete.description}</Text>
          {/* 라운드 63 #2: 다자녀 계정에서만 나타나는 대상 표기(어느 아이를 삭제하는지).
              가구 탈퇴 카드의 같은 자리와 짝이다 -- 한 화면의 파괴적 카드가 같은 규율로 대상을 말한다. */}
          {childDeleteNotice ? <Text style={mutedTextStyle}>{childDeleteNotice}</Text> : null}
          <SecondaryButton
            label={childPreview.isPending ? "확인하는 중..." : flowCopy.child_profile_delete.previewLabel}
            disabled={!authToken || !childId || childPreview.isPending}
            onPress={() => childPreview.mutate()}
          />
          {childPreview.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
          <PreviewSummary preview={childPreview.data} />
          {childPreview.data ? (
            <DangerButton
              label={childDelete.isPending ? "삭제하는 중..." : flowCopy.child_profile_delete.confirmLabel}
              disabled={childDelete.isPending}
              onPress={confirmChildDelete}
            />
          ) : null}
          {childDelete.isError ? (
            <Text style={{ color: theme.colors.danger }}>{childDeleteFailureText}</Text>
          ) : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={cardTitleStyle}>{flowCopy.household_leave.title}</Text>
            <StatusBadge label="주의" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.household_leave.description}</Text>
          {/* 라운드 60 A: 다가구 계정에서만 나타나는 대상 표기(어느 가구를 나가는지). */}
          {householdLeaveNotice ? <Text style={mutedTextStyle}>{householdLeaveNotice}</Text> : null}
          <SecondaryButton
            label={householdPreview.isPending ? "확인하는 중..." : flowCopy.household_leave.previewLabel}
            disabled={!authToken || !householdId || householdPreview.isPending}
            onPress={() => householdPreview.mutate()}
          />
          {householdPreview.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
          <PreviewSummary preview={householdPreview.data} />
          {householdPreview.data ? (
            <DangerButton
              label={householdLeave.isPending ? "나가는 중..." : flowCopy.household_leave.confirmLabel}
              disabled={householdLeave.isPending}
              onPress={confirmHouseholdLeaveAction}
            />
          ) : null}
          {householdLeave.isError ? (
            <Text style={{ color: theme.colors.danger }}>{householdLeaveFailureText}</Text>
          ) : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={rowHeaderStyle}>
            <Text style={cardTitleStyle}>{flowCopy.account_delete.title}</Text>
            <StatusBadge label="위험" tone="warning" />
          </View>
          <Text style={mutedTextStyle}>{flowCopy.account_delete.description}</Text>
          <Text style={mutedTextStyle}>{ACCOUNT_DELETE_REJOIN_NOTICE}</Text>
          <SecondaryButton
            label={accountPreview.isPending ? "확인하는 중..." : flowCopy.account_delete.previewLabel}
            disabled={!authToken || accountPreview.isPending}
            onPress={() => accountPreview.mutate()}
          />
          {accountPreview.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}
          <PreviewSummary preview={accountPreview.data} />
          {accountPreview.data ? (
            <DangerButton
              label={accountDelete.isPending ? "삭제하는 중..." : flowCopy.account_delete.confirmLabel}
              disabled={accountDelete.isPending}
              onPress={confirmAccountDelete}
            />
          ) : null}
          {accountDelete.isError ? (
            <Text style={{ color: theme.colors.danger }}>{accountDeleteFailureText}</Text>
          ) : null}
        </Card>
      </View>
    </AppScreen>
  );
}

const rowHeaderStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 8,
  justifyContent: "space-between"
} as const;

// 카드 제목(동의 내역 · 삭제/탈퇴 세 카드가 공유). 예전 이름은 dangerTitleStyle이었는데,
// 위험 카드 전용이 아니게 되어(동의 내역 카드도 같은 제목 크기) 이름만 사실에 맞췄다 -- 값은 그대로다.
const cardTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 15,
  fontWeight: "800"
} as const;

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 20
} as const;

// 라운드 65 B(#5): 동의 줄의 [보기] 링크. 48dp 최소 터치 타깃(theme.touchTarget)을 숫자로 다시
// 박지 않는다. 색은 12px 코랄 본문의 A11Y-117 규칙(coral[700]) -- 아래 previewNoticeStyle과 같다.
const legalLinkStyle = {
  alignItems: "center",
  justifyContent: "center",
  minHeight: theme.touchTarget,
  paddingHorizontal: 6
} as const;

const legalLinkTextStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  fontWeight: "700",
  textDecorationLine: "underline"
} as const;

// 동의 항목 이름: 오른쪽 상태 문구(mutedTextStyle)와 같은 크기로 두되, 이름 쪽이 앞선다.
const consentTitleStyle = {
  color: theme.colors.brown,
  flex: 1,
  fontSize: 13,
  fontWeight: "700",
  lineHeight: 20
} as const;

const previewBoxStyle = {
  backgroundColor: theme.colors.peach,
  borderRadius: theme.radii.small,
  gap: 4,
  padding: 12
} as const;

const previewTitleStyle = {
  color: theme.colors.brown,
  fontSize: 13,
  fontWeight: "800"
} as const;

const previewLineStyle = {
  color: theme.colors.brown,
  fontSize: 12,
  lineHeight: 18
} as const;

// FIX-118B(F4): same A11Y-117 small-coral-text rule as app/settings/children.tsx's 편집 link --
// coral[500] at 12px is 3.16:1 on cream, coral[700] clears the 4.5:1 bar.
const previewNoticeStyle = {
  color: theme.colors.coral[700],
  fontSize: 12,
  fontWeight: "700",
  marginTop: 4
} as const;

const dangerButtonStyle = {
  alignItems: "center",
  backgroundColor: theme.colors.danger,
  borderRadius: theme.radii.button,
  height: theme.ctaHeight,
  justifyContent: "center"
} as const;

const dangerButtonDisabledStyle = {
  backgroundColor: theme.colors.gray300
} as const;

const dangerButtonTextStyle = {
  color: theme.colors.white,
  fontSize: 15,
  fontWeight: "700"
} as const;
