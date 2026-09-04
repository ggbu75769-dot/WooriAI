import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSeoulToday } from "@wooriai/domain";
import { router, useFocusEffect } from "expo-router";
import { Alert, Platform, Pressable, Text, View, type AccessibilityActionEvent } from "react-native";
import { listChildren, LOCAL_SESSION_TOKEN } from "../src/api/client";
import { applyChildSwitch } from "../src/children/child-switch";
import {
  mergeNewNotificationMarks,
  removeNotificationMark
} from "../src/notifications/new-notification-marks";
import {
  formatNotificationRowTitle,
  resolveNotificationChildLabel
} from "../src/notifications/notification-child-label";
import {
  buildNotificationRowActionSheet,
  buildNotificationRowActions,
  notificationRowAccessibilityActions,
  notificationRowAccessibilityHint,
  notificationRowAccessibilityLabel,
  resolveNotificationRowAction,
  type NotificationRowActionKey
} from "../src/notifications/notification-row-actions";
import {
  nextRecordsViewNonce,
  notificationTapRoute,
  resolveNotificationTapChild
} from "../src/notifications/notification-route";
import {
  selectUnreadNotificationIds,
  useNotificationStore,
  type AppNotification
} from "../src/notifications/notification.store";
import { formatRelativeTime } from "../src/notifications/relative-time";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";
import { announceForA11y, AppScreen, EmptyStateCard, ListRow, ScreenHeader, TextButton } from "../src/ui";

/**
 * NOTI-102 인앱 알림 센터: lists the client-side notifications persisted in
 * src/notifications/notification.store.ts (fed by the home screen's evaluation hook). Opening the
 * screen marks everything read (the home bell badge clears); tapping a row routes to the surface
 * the notification is about; "모두 지우기" empties the list without re-arming dedupe keys.
 *
 * R20-C 다자녀 표시: each entry carries the `childId` R19-D stamps on it, so in a household with
 * 2+ children the row title is prefixed with that child's 태명 ("다온이 · 이번 달 예산의 80%를
 * 사용했어요") -- previously two children produced two identical-looking budget rows in the same
 * month. Names come from the shared `["children"]` query cache (same key as
 * app/settings/children.tsx, so opening this screen usually costs no extra request). All the
 * "don't show it" cases -- one child, a pre-R19-D entry without childId, a child the list can't
 * resolve -- live in src/notifications/notification-child-label.ts and leave the row untouched
 * rather than rendering an empty prefix.
 *
 * 라운드 39 UX-O 두 가지:
 * - 탭 목적지 판정은 src/notifications/notification-route.ts로 옮겼다. weekly_summary가 예산
 *   알림과 묶여 /budget(예산 수정 폼)으로 가던 것을 지출 내역으로 고친다 -- 이유는 그 파일에.
 * - "새 소식" 구분: 이 화면은 포커스와 동시에 전부 읽음 처리하므로 20줄이 전부 같아 보였다.
 *   마운트 시 안읽음 id를 한 번 스냅샷해 그 행에만 좌측 점을 붙인다(읽음 규칙은 그대로).
 *
 * 라운드 52 C-10 한 줄 지우기: 정리 수단이 "모두 지우기"뿐이라, 이미 처리한 알림 하나를 치우려면
 * 아직 안 본 알림까지 통째로 버려야 했다(게다가 dedupe 키가 남아 되돌릴 수 없다). 기록 탭의 행
 * 액션과 **같은 관례**로 롱프레스 액션시트 + 스크린리더 커스텀 액션을 얹는다 -- 항목·문구·버튼
 * 구성은 src/notifications/notification-row-actions.ts에 있고, 이 화면은 그것을 RN Alert과
 * accessibilityActions에 꽂기만 한다. 탭의 기본 동작(읽음 + 목적지 이동)은 그대로다.
 *
 * 라운드 62 트랙 B(#2) 알림의 아이로 데려가기: 착지 화면(/budget · /items/{id} · 두 탭)은 전부
 * **지금 선택된 아이**로 동작하는데, 이 목록은 R20-C 이후 **다른 아이의 태명을 붙여** 행을
 * 그린다 -- "튼튼이 · …"를 눌렀는데 다온이의 예산 수정 화면이 열리고, 그 화면의 저장이 다온이의
 * 예산을 덮었다. 그래서 이동 **전에** 그 알림의 아이로 전환한다. 판정은 순수 모듈이 지고
 * (resolveNotificationTapChild -- 어느 아이인지 모르거나 목록에 없으면 null), 전환 자체는 아이
 * 관리 화면·헤더 전환 시트와 **같은 한 벌**(applyChildSwitch: 스토어 쓰기 → 아이 스코프 캐시
 * 무효화 → 안내)을 그대로 태운다. 이 화면이 그 세 줄을 손으로 다시 적지 않는다(HOME-138).
 * 전환할 아이가 null이면 push만 하므로 이동은 **종전 그대로**다.
 */

/**
 * D1 후속(실기기 피드백 2): 종류별 아이콘을 텍스트 글리프(▮ ☆ ▣)에서 탭바와 같은 Ionicons
 * 계열로 바꿨다 -- 글리프는 기기 폰트에 따라 네모/빈칸으로 떨어져 "예전 아이콘"처럼 보였다.
 * outlined 변형 + coral 한 가지 색으로 탭바 톤을 그대로 따른다.
 */
const notificationIconByType: Record<AppNotification["type"], keyof typeof Ionicons.glyphMap> = {
  budget_80: "wallet-outline",
  budget_100: "alert-circle-outline",
  stage_transition: "sparkles-outline",
  purchase_pending: "bag-check-outline",
  weekly_summary: "stats-chart-outline",
  // GAP-054 라운드 54 P1-4: 아이콘이 없으면 `ListRow`의 icon prop이 undefined가 되어 그 행만
  // 아이콘 칸 없이 그려진다 — 다른 다섯 종류와 제목 시작 위치가 어긋나 목록이 계단처럼 보인다.
  record_gap: "time-outline",
  // 라운드 66 E(#8): 지난달 정리. 주간 요약(stats-chart)과 구분되도록 달력 계열을 쓴다 — 이
  // 알림이 말하는 단위가 "달"이다.
  monthly_wrapup: "calendar-outline"
};

export default function NotificationsScreen() {
  const entries = useNotificationStore((state) => state.entries);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const markRead = useNotificationStore((state) => state.markRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  // C-10: 한 줄 지우기. dedupe 키 유지 규칙은 clearAll과 같다(notification.store.ts).
  const removeNotificationEntry = useNotificationStore((state) => state.remove);

  // R20-C: child names for the multi-child row prefix. Shares the ["children"] query key with
  // app/settings/children.tsx / the onboarding recovery path, so this reads the cache instead of
  // refetching in the common case, and stays disabled (data undefined -> no prefix) in the
  // logged-out preview.
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: Boolean(authToken),
    queryFn: () => listChildren(authToken!)
  });
  const householdChildren = childrenQuery.data?.children;

  /**
   * 라운드 62 B(#2) 전환 한 벌의 바깥 세계. 목록·선택 상태는 이 화면이 이미 들고 있고
   * (`householdChildren`은 태명 접두가 쓰던 바로 그 캐시다), 새 쿼리는 만들지 않는다 --
   * 전환 입구가 하나 늘어도 요청 수는 그대로다(ChildSwitchSheet와 같은 규율).
   */
  const queryClient = useQueryClient();
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  /**
   * 알림 한 줄이 데려갈 아이로 전환한다(전환할 아이가 없으면 아무 일도 하지 않는다).
   *
   * `applyChildSwitch`를 그대로 쓰는 것이 요점이다: 무효화 키 목록도, 안내 문구도 이 화면에
   * 없다. 같은 아이를 가리키는 알림이면 그 함수가 null을 돌려주고 따뜻한 캐시도 안내도
   * 건드리지 않는다(planChildSwitch).
   *
   * 라운드 62 #7 — **왜 이 화면에는 눈에 보이는 전환 피드백이 없나.** 전환이 일어난 사실은
   * `applyChildSwitch`의 `announce`(screen reader 전용)로만 나간다. 눈으로 볼 한 줄을 여기
   * 세울 수 없는 이유는 렌더 순서가 아니라 **이 화면이 곧바로 사라지기 때문**이다: 바로 다음
   * 줄에서 `router.push`가 일어나 목록은 착지 화면에 덮이고, 뒤로 돌아왔을 때 그때의 전환을
   * 다시 알리는 것은 사실도 아니다(이미 지난 일이다). 그래서 "지금 누구를 보고 있는가"는
   * **착지 화면이 스스로 말한다** — 최악의 목적지였던 준비템 상세에 아이 스코프 라벨을 붙였다
   * (app/items/[itemTemplateId].tsx: 거기서 누르는 지출 기록이 그 아이 밑으로 들어간다).
   * 예산·두 탭은 이미 헤더가 그 이름을 달고 있다(라운드 49·51·60의 같은 어휘).
   */
  const switchToNotificationChild = (entry: AppNotification) => {
    const child = resolveNotificationTapChild(entry, householdChildren);
    if (!child) return;
    applyChildSwitch(selectedChildId, child, {
      setSelectedChildId,
      invalidateQueries: (input) => queryClient.invalidateQueries(input),
      announce: announceForA11y
    });
  };

  /**
   * 라운드 39 UX-O "새 소식" 스냅샷: 읽음 처리 **직전의** 안읽음 id를 떠 둔다. 포커스와 동시에
   * 모든 항목의 readAt이 채워지므로, 이 스냅샷이 없으면 "이번에 새로 들어온 것"이라는 정보는
   * 그 자리에서 영영 사라진다. 화면 상태로만 살아 있고, 스토어의 dedupe·readAt 규칙은 그대로다
   * -- selector는 읽기 전용이다.
   *
   * 라운드 39 I-7: 그 스냅샷을 **마운트 1회가 아니라 포커스마다** 다시 뜬다. 알림을 눌러 예산
   * 화면으로 갔다가 돌아오는 흔한 경로는 같은 화면 인스턴스의 재포커스라, 마운트 스냅샷은 그때
   * 이미 낡아 있다(방금 보고 온 항목에 계속 점이 붙어 있고, 화면을 떠 있는 동안 새로 들어온
   * 항목에는 붙지 않는다).
   *
   * 라운드 40 J-7: 다만 그 재스냅샷은 **교체**라, 3건 중 1건만 보고 돌아오면 나머지 2건의 점까지
   * 함께 사라졌다(돌아온 순간의 안읽음은 0건이다 — 첫 포커스가 이미 전부 읽음 처리했다).
   * 이제 규칙은 "직전 스냅샷 ∪ 이번 포커스 직전의 안읽음 − 사용자가 실제로 탭한 항목"이다
   * (판정은 src/notifications/new-notification-marks.ts, 탭 제거는 아래 행 onPress).
   *
   * 스토어가 아직 rehydrate되지 않은 채 마운트될 수 있어서(콜드 스타트 직후 딥링크 등)
   * 그때는 복구가 끝나는 시점에 한 번 더 잡는다. 못 잡으면 표시가 없을 뿐, 잘못된 표시는
   * 만들지 않는다.
   */
  const [newNotificationIds, setNewNotificationIds] = useState<string[]>(() =>
    useNotificationStore.persist.hasHydrated()
      ? selectUnreadNotificationIds(useNotificationStore.getState().entries)
      : []
  );
  const newIdsSnapshotTaken = useRef(useNotificationStore.persist.hasHydrated());
  useEffect(() => {
    if (newIdsSnapshotTaken.current) return;
    return useNotificationStore.persist.onFinishHydration((state) => {
      if (newIdsSnapshotTaken.current) return;
      newIdsSnapshotTaken.current = true;
      setNewNotificationIds(selectUnreadNotificationIds(state.entries));
    });
  }, []);

  // Read marks on open: whenever this screen gains focus, everything becomes read (no-op when
  // nothing is unread -- markAllNotificationsRead returns the same array then). 순서가 중요하다:
  // 읽음 처리 **전에** 스냅샷을 떠야 이번 포커스의 "새 소식"이 남는다(I-7).
  useFocusEffect(
    useCallback(() => {
      if (useNotificationStore.persist.hasHydrated()) {
        newIdsSnapshotTaken.current = true;
        const stored = useNotificationStore.getState().entries;
        // J-7: 교체가 아니라 합집합이다 -- 이번 포커스 직전의 안읽음(= 떠 있는 동안 새로 온
        // 항목)을 더하고, 지금 목록에 없는 항목만 떨군다. 사용자가 탭한 항목은 그 순간
        // 행 onPress에서 이미 빠져 있다.
        setNewNotificationIds((previous) =>
          mergeNewNotificationMarks(
            previous,
            selectUnreadNotificationIds(stored),
            stored.map((entry) => entry.id)
          )
        );
      }
      markAllRead();
    }, [markAllRead])
  );

  // A11Y-117: 모두 지우기는 되돌릴 수 없는 파괴적 동작(dedupe 키가 유지되어 지운 알림은 다시
  // 오지 않는다) -- family/index.tsx의 구성원 삭제와 같은 관례대로 즉시 실행 대신 확인
  // Alert를 거친다.
  const confirmClearAll = () => {
    Alert.alert("알림을 모두 지울까요?", "지운 알림은 다시 볼 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "모두 지우기", style: "destructive", onPress: () => clearAll() }
    ]);
  };

  /**
   * C-10: 행 하나의 액션시트. 이 화면의 행이 내놓는 동작은 한 줄 지우기 하나뿐이라
   * 목록은 행마다 같지만, 구성은 순수 모듈에 두어 액션시트와 스크린리더 액션 메뉴가 갈릴 수
   * 없게 한다(기록 탭 관례).
   *
   * 지운 뒤에는 "새 소식" 점 목록에서도 그 id를 뺀다 -- 남겨 두면 같은 id의 알림이 다시 올 수
   * 없는데도(dedupe 키가 유지된다) 목록에 흔적이 남는다.
   */
  const rowActions = buildNotificationRowActions();
  const deleteNotification = (entry: AppNotification) => {
    removeNotificationEntry(entry.id);
    setNewNotificationIds((previous) => removeNotificationMark(previous, entry.id));
    // 라운드 96 T7: 파괴적 동작의 성공을 말한다 -- 지운 행은 화면에서 사라질 뿐이라 스크린리더
    // 사용자에게는 실행됐는지 아무 신호가 없었다(확인 액션시트는 "지울까요?"까지만 말한다).
    // 문장은 액션시트가 이미 말한 사실("다시 볼 수 없어요")을 반복하지 않고 결과 하나만 남긴다.
    announceForA11y("알림을 지웠어요.");
  };
  const runRowAction = (actionKey: NotificationRowActionKey, entry: AppNotification) => {
    switch (actionKey) {
      case "delete":
        deleteNotification(entry);
        return;
      default:
        // 알 수 없는 키는 아무것도 하지 않는다 -- 파괴적 동작을 기본값으로 두지 않는다.
        return;
    }
  };
  const openRowActionSheet = (entry: AppNotification, rowTitle: string) => {
    const sheet = buildNotificationRowActionSheet({ title: rowTitle, platform: Platform.OS });
    Alert.alert(
      sheet.title,
      sheet.message,
      sheet.buttons.map((button) => ({
        text: button.label,
        style: button.style,
        // 라운드 52 QA P3-2: 버튼 → 동작 매핑은 **액션 키로** 한다. 예전에는 `actionKey`가
        // 있기만 하면 삭제를 실행했다 -- 지금은 동작이 하나뿐이라 결과가 같지만, 항목이
        // 늘어나는 순간(액션시트 구성은 순수 모듈이 만든다) 취소가 아닌 **모든** 버튼이
        // 삭제를 실행하는 잠재 오동작이었다. switch는 새 키를 더할 때 여기서 걸린다.
        ...(button.actionKey ? { onPress: () => runRowAction(button.actionKey!, entry) } : {})
      })),
      { cancelable: sheet.cancelable }
    );
  };
  /**
   * 라운드 52 QA P3-3 — 스크린리더 커스텀 액션도 **확인 단계를 지난다.**
   *
   * 눈으로 쓰는 경로에서 한 줄 지우기는 롱프레스로 액션시트를 열고 그 안의 destructive 버튼을
   * 누르는 두 단계다(액션시트 자체가 확인 단계라, 그래서 Alert을 한 번 더 겹치지 않는다 --
   * src/notifications/notification-row-actions.ts). 그런데 커스텀 액션 메뉴에서 "이 알림
   * 지우기"를 고르면 그 자리에서 **즉시** 지워졌다: 되돌릴 수 없는 동작(dedupe 키가 남아 같은
   * 알림은 다시 오지 않는다)에서 시각 사용자에게만 안전장치가 있고 비시각 사용자에게는
   * 없었다는 뜻이다.
   *
   * 그래서 같은 액션시트를 연다 -- 별도의 확인 Alert을 새로 만들면 두 경로의 문구가 갈릴 수
   * 있고(이 화면이 액션 구성을 순수 모듈 한 곳에 두는 이유가 바로 그것이다), 액션시트는 이미
   * "지운 알림은 다시 볼 수 없어요"를 말하고 취소 버튼을 내준다.
   */
  const handleRowAccessibilityAction = (
    event: AccessibilityActionEvent,
    entry: AppNotification,
    rowTitle: string
  ) => {
    // 이 행이 내놓지 않은 액션 이름(다른 화면의 액션, OS 표준 액션)은 무시한다.
    if (!resolveNotificationRowAction(event.nativeEvent.actionName, rowActions)) return;
    openRowActionSheet(entry, rowTitle);
  };

  const now = Date.now();

  return (
    <AppScreen>
      <View testID="screen-notifications" style={{ gap: theme.spacing.section }}>
        {/* 라운드 39 UX-O: 뒤로가기는 빈 상태 카드에만 있어서, 알림이 한 줄이라도 있으면 이
            화면을 벗어날 방법이 화면 안에 없었다(전역 headerShown:false라 OS 헤더도 없다).
            UX-Q(C)가 ScreenHeader에 낸 `onBack` 슬롯을 그대로 쓴다 -- 가족 화면의 ‹ 표기와
            44dp 타깃을 한 곳에서 재사용하므로 화면마다 다른 화살표가 생기지 않는다. */}
        {/* 라운드 96 T7: 제목을 "알림함"으로 통일한다 -- 이 화면으로 오는 두 입구(더보기 메뉴 행
            more-menu.ts · 홈 종 아이콘)가 전부 "알림함"이라 부르는데 착지 화면만 "알림"이었고,
            설정 안의 "알림 설정"(푸시 관리)과도 한 글자 차이로 헷갈렸다. eyebrow는 제목과 같은
            낱말("알림")을 반복할 뿐이라 지운다 -- 정보가 늘 때만 두 층을 쓴다. */}
        <ScreenHeader
          title="알림함"
          subtitle="예산과 아이 성장 소식을 모아 보여드려요"
          onBack={() => router.back()}
          action={
            entries.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="알림 모두 지우기"
                hitSlop={12}
                onPress={confirmClearAll}
                // T7: 인라인 Pressable 눌림 피드백 -- 공용 TextButton과 같은 축(opacity 0.6).
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>모두 지우기</Text>
              </Pressable>
            ) : undefined
          }
        />
        {entries.length === 0 ? (
          // 라운드 96 T7: 제목/설명을 두 층으로 가른다(T1이 EmptyStateCard에 낸 description 슬롯).
          // CTA는 "뒤로가기"에서 "알림 설정 보기"로 -- 나가는 길은 헤더의 ‹가 이미 지고 있고,
          // 빈 알림함에서 실제로 할 수 있는 다음 행동은 어떤 소식을 받을지 고르는 것이다.
          <EmptyStateCard
            title="아직 알림이 없어요"
            description="예산과 아이 성장, 구매 확인 소식이 여기에 따뜻하게 모일 거예요."
            actionLabel="알림 설정 보기"
            onPress={() => router.push("/settings/notifications")}
          />
        ) : (
          entries.map((entry) => {
            const childLabel = resolveNotificationChildLabel(entry.childId, householdChildren);
            const isNew = newNotificationIds.includes(entry.id);
            // 알 수 없는 종류(옛 저장본 등)는 조회가 undefined -- ListRow의 icon은 선택 항목이라
            // 아이콘 자리만 비고 나머지 줄은 그대로 그려진다.
            const iconName = notificationIconByType[entry.type];
            // 아래 ListRow에 넘기는 **바로 그 세 문자열**로 스크린리더 라벨을 만든다
            // (보이는 것과 읽히는 것이 갈릴 수 없다).
            const rowTitle = formatNotificationRowTitle(entry.title, childLabel);
            const timeLabel = formatRelativeTime(entry.createdAt, now);
            return (
              // 점 자리는 새 소식이 아닐 때도 그대로 비워 둔다 -- 자리 폭이 오가면 카드 왼쪽이
              // 줄마다 어긋난다.
              <View key={entry.id} style={notificationRowStyle}>
                <View style={notificationNewDotSlotStyle}>
                  {isNew ? (
                    // ui.tsx의 ListRow는 accessibilityLabel prop을 받지 않고(다른 트랙 소유)
                    // 자식 Text로 라벨을 만든다. 그래서 "새 소식"은 행 바로 앞의 독립
                    // 접근성 요소로 둔다 -- 스크린 리더에서 행보다 먼저 읽혀 접두처럼 들린다.
                    <View accessible accessibilityLabel="새 소식" style={notificationNewDotStyle} />
                  ) : null}
                </View>
                {/* C-10: 탭(읽음 + 이동)은 그대로, 롱프레스로 액션시트를 연다. 바깥 Pressable
                    하나가 이 행의 접근성 요소가 되어 커스텀 액션을 갖는다 -- 기록 탭
                    ServerExpenseListRow와 같은 구조·같은 이유다. */}
                <Pressable
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={notificationRowAccessibilityLabel({
                    title: rowTitle,
                    body: entry.body,
                    timeLabel
                  })}
                  accessibilityActions={notificationRowAccessibilityActions(rowActions)}
                  accessibilityHint={notificationRowAccessibilityHint(rowActions)}
                  onAccessibilityAction={(event) => handleRowAccessibilityAction(event, entry, rowTitle)}
                  onLongPress={() => openRowActionSheet(entry, rowTitle)}
                  onPress={() => {
                    markRead(entry.id);
                    // J-7: 점을 지우는 유일한 근거는 "이 줄을 열어 봤다"는 사실이다.
                    // 나머지 줄의 점은 다음 포커스에서도 그대로 남는다.
                    setNewNotificationIds((previous) => removeNotificationMark(previous, entry.id));
                    // 라운드 62 B(#2): **이동보다 먼저** 그 알림의 아이로 전환한다. 착지 화면은
                    // 전부 지금 선택된 아이로 그려지므로, push 뒤에 전환하면 그 화면은 한 번
                    // 잘못된 아이로 렌더된 뒤 바뀐다. 전환할 아이를 모르면(구 blob·삭제된 아이)
                    // 이 호출은 아무 일도 하지 않고 아래 이동만 종전 그대로 일어난다.
                    switchToNotificationChild(entry);
                    // 라운드 57 QA(P1-1): 이번 탭의 회차를 함께 넘긴다. 기록 탭은 착지
                    // 파라미터를 회차 단위로 적용하므로, 회차가 없으면 두 번째 탭부터
                    // "지난번과 같은 값"으로 걸러져 달력으로 가지 않는다. 카운터가 이 화면의
                    // state가 아닌 이유는 notification-route.ts의 nextRecordsViewNonce 주석 참고
                    // (이 화면은 뒤로가기로 언마운트된다).
                    //
                    // 라운드 66 E(#8): 서울 오늘을 함께 넘긴다. 지난달 정리의 **달 착지**가
                    // "고를 수 있는 달인가"를 그 값으로 판정하기 때문이다(판정 자체는 트랙 A의
                    // 규약 모듈에 있고, 이 화면은 시각만 준다 — 목적지 함수는 순수하게 남는다).
                    router.push(notificationTapRoute(entry, nextRecordsViewNonce(), getSeoulToday()));
                  }}
                  // T7: 행 눌림 피드백(공용 ListRow의 0.82와 같은 축). 휴지 상태는 opacity 1이라
                  // 렌더는 종전과 같다.
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.82 : 1 })}
                >
                  {/* 안쪽을 잠그는 두 가지 이유는 기록 탭과 같다: (1) 공용 ListRow의 루트
                      Pressable이 responder를 가져가면 바깥 롱프레스가 오지 않는다,
                      (2) 감추지 않으면 행 안에 접근성 초점이 둘 생긴다. 그려지는 모양은
                      예전과 같은 ListRow 그대로다. */}
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
                    <ListRow
                      icon={iconName ? <Ionicons name={iconName} size={20} color={theme.colors.mainCoral} /> : undefined}
                      // The 태명 prefix is part of the title text, so it is announced as part of the
                      // row's accessibility label too (the outer Pressable builds its label from it).
                      title={rowTitle}
                      subtitle={entry.body}
                      value={timeLabel}
                    />
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
        {/* 라운드 96 T7: 알림함 안에서 알림 설정으로 가는 길. 종전에는 이 화면에서 "어떤 소식을
            받을지"를 바꾸러 가려면 더보기 → 설정 → 알림 설정 세 단계를 거슬러야 했다. 빈 상태는
            위 카드의 CTA가 같은 목적지를 이미 지므로 목록이 있을 때만 그린다(중복 입구 금지).
            공용 TextButton이라 44dp 타깃·눌림 피드백·coral[700] 대비가 한 곳에서 온다. */}
        {entries.length > 0 ? (
          <TextButton
            label="알림 설정"
            onPress={() => router.push("/settings/notifications")}
            style={notificationSettingsLinkStyle}
          />
        ) : null}
      </View>
    </AppScreen>
  );
}

/** T7: 목록 아래 "알림 설정" 링크 자리(가운데 정렬만 더한다 -- 색·크기는 TextButton의 것). */
const notificationSettingsLinkStyle = {
  alignSelf: "center"
} as const;

const notificationRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 6
} as const;

/** 새 소식 점이 들어갈 고정 폭 자리(점이 없을 때도 유지되어 카드 왼쪽 선이 흔들리지 않는다). */
const notificationNewDotSlotStyle = {
  alignItems: "center",
  width: 8
} as const;

/** 홈 벨 배지와 같은 토큰(mainCoral) -- 새 hex 없음. */
const notificationNewDotStyle = {
  backgroundColor: theme.colors.mainCoral,
  borderRadius: theme.radii.pill,
  height: 8,
  width: 8
} as const;
