import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { listChildren, LOCAL_SESSION_TOKEN } from "../src/api/client";
import {
  formatNotificationRowTitle,
  resolveNotificationChildLabel
} from "../src/notifications/notification-child-label";
import { notificationTapRoute } from "../src/notifications/notification-route";
import {
  selectUnreadNotificationIds,
  useNotificationStore,
  type AppNotification
} from "../src/notifications/notification.store";
import { formatRelativeTime } from "../src/notifications/relative-time";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";
import { AppScreen, EmptyStateCard, ListRow, ScreenHeader } from "../src/ui";

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
 */

const notificationIconByType: Record<AppNotification["type"], string> = {
  budget_80: "▮",
  budget_100: "▮",
  stage_transition: "☆",
  purchase_pending: "▣",
  weekly_summary: "▮"
};

export default function NotificationsScreen() {
  const entries = useNotificationStore((state) => state.entries);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const markRead = useNotificationStore((state) => state.markRead);
  const clearAll = useNotificationStore((state) => state.clearAll);

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
   * 라운드 39 UX-O "새 소식" 스냅샷: 읽음 처리 **직전의** 안읽음 id를 떠 둔다. 포커스와 동시에
   * 모든 항목의 readAt이 채워지므로, 이 스냅샷이 없으면 "이번에 새로 들어온 것"이라는 정보는
   * 그 자리에서 영영 사라진다. 화면 상태로만 살아 있고, 스토어의 dedupe·readAt 규칙은 그대로다
   * -- selector는 읽기 전용이다.
   *
   * 라운드 39 I-7: 그 스냅샷을 **마운트 1회가 아니라 포커스마다** 다시 뜬다. 알림을 눌러 예산
   * 화면으로 갔다가 돌아오는 흔한 경로는 같은 화면 인스턴스의 재포커스라, 마운트 스냅샷은 그때
   * 이미 낡아 있다(방금 보고 온 항목에 계속 점이 붙어 있고, 화면을 떠 있는 동안 새로 들어온
   * 항목에는 붙지 않는다). 포커스마다 "이번 포커스 직전의 안읽음"을 다시 잡으면 두 경우가 모두
   * 맞는다 -- 방금 읽은 항목은 이미 readAt이 있어 빠지고, 새로 온 항목만 새 스냅샷에 들어온다.
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
        setNewNotificationIds(selectUnreadNotificationIds(useNotificationStore.getState().entries));
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

  const now = Date.now();

  return (
    <AppScreen>
      <View testID="screen-notifications" style={{ gap: theme.spacing.section }}>
        {/* 라운드 39 UX-O: 뒤로가기는 빈 상태 카드에만 있어서, 알림이 한 줄이라도 있으면 이
            화면을 벗어날 방법이 화면 안에 없었다(전역 headerShown:false라 OS 헤더도 없다).
            UX-Q(C)가 ScreenHeader에 낸 `onBack` 슬롯을 그대로 쓴다 -- 가족 화면의 ‹ 표기와
            44dp 타깃을 한 곳에서 재사용하므로 화면마다 다른 화살표가 생기지 않는다. */}
        <ScreenHeader
          eyebrow="알림"
          title="알림"
          subtitle="예산과 아이 성장 소식을 모아 보여드려요"
          onBack={() => router.back()}
          action={
            entries.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="알림 모두 지우기" hitSlop={12} onPress={confirmClearAll}>
                <Text style={{ color: theme.colors.gray600, fontSize: 12, fontWeight: "700" }}>모두 지우기</Text>
              </Pressable>
            ) : undefined
          }
        />
        {entries.length === 0 ? (
          <EmptyStateCard
            title="아직 알림이 없어요. 예산과 아이 성장, 구매 확인 소식이 여기에 따뜻하게 모일 거예요."
            actionLabel="뒤로가기"
            onPress={() => router.back()}
          />
        ) : (
          entries.map((entry) => {
            const childLabel = resolveNotificationChildLabel(entry.childId, householdChildren);
            const isNew = newNotificationIds.includes(entry.id);
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
                <View style={{ flex: 1 }}>
                  <ListRow
                    icon={notificationIconByType[entry.type]}
                    // The 태명 prefix is part of the title text, so it is announced as part of the
                    // row's accessibility label too (ListRow reads its Text children).
                    title={formatNotificationRowTitle(entry.title, childLabel)}
                    subtitle={entry.body}
                    value={formatRelativeTime(entry.createdAt, now)}
                    onPress={() => {
                      markRead(entry.id);
                      router.push(notificationTapRoute(entry));
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>
    </AppScreen>
  );
}

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
