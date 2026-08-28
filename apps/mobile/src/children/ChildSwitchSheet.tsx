import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { announceForA11y, BottomSheetFrame, StatusBadge, TextButton } from "../ui";
import { theme } from "../theme";
import {
  applyChildSwitch,
  canSwitchChildFromScreen,
  childSwitchOptionAccessibilityLabel,
  CHILD_SWITCH_SHEET_TITLE,
  type ChildScopeRef
} from "./child-switch";

/**
 * 라운드 49 C-09 — 아이 전환 입구를 홈 밖으로.
 *
 * 무엇이 문제였나: 전환 입구가 홈 헤더와 설정 → 아이 관리 두 곳뿐이었다. 둘째의 지출을 보려면
 * 기록 탭 → 홈 → (전환) → 기록 탭으로 세 화면을 돌아야 했고, 리포트도 마찬가지다. 다자녀
 * 가구에서 가장 자주 하는 동작이 가장 먼 길을 걷고 있었다.
 *
 * 왜 모듈로 빼는가: 전환은 **부수효과의 순서**(스토어 쓰기 → 아이 스코프 캐시 전체 무효화 →
 * 안내)가 핵심이고, 그 순서는 이미 applyChildSwitch 한 곳에 모여 있다(HOME-138). 하지만 시트
 * UI와 "열림 상태 + 탭 처리" 배선은 여전히 홈 화면 안에 손으로 적혀 있어서, 기록·리포트가 각자
 * 복사하면 세 벌이 된다 — 한 벌이 무효화를 빠뜨리면 아이 A의 캐시가 아이 B 화면에 남는다
 * (라운드 28의 A→B 캐시 오염). 그래서 시트 JSX와 배선을 여기 한 벌만 둔다.
 *
 * 순수 판정(2명 이상인가 · 무효화 키 · 문구)은 여기가 아니라 ./child-switch.ts에 있다 —
 * 이 파일은 react-native를 import하므로 vitest에서 부를 수 없다(순수 모듈 분리 관례).
 */

/** 시트 한 줄이 필요로 하는 `Child`(src/api/client.ts)의 최소 형태. */
export type ChildSwitchOption = ChildScopeRef;

/**
 * 시트 행 스타일. 홈에 있던 homeChildSwitchStyle.row/rowName을 그대로 옮겨 온 것이라 홈의
 * 시트는 픽셀 단위로 종전과 같다. 행 하나가 44dp 터치 타깃을 지킨다(A11Y).
 */
export const childSwitchSheetStyle = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: theme.touchTarget
  },
  rowName: {
    color: theme.colors.brown,
    flex: 1,
    fontSize: theme.typography.body1.fontSize,
    fontWeight: "700"
  }
});

export type ChildSwitchSheetController = {
  /**
   * 전환 입구를 **띄워도 되는가**. 세션이 있고 아이가 2명 이상일 때만 true다 — 비세션
   * 미리보기(HOME-001·REP-001 픽셀락 캡처)와 아이 1명 가구에서는 화면이 종전 그대로 남는다.
   */
  canSwitch: boolean;
  isOpen: boolean;
  /** 헤더 탭 = 열고 닫기 토글(홈의 종전 동작 그대로). */
  toggle: () => void;
  close: () => void;
  /** 시트가 그릴 목록. 항상 배열이라 호출부가 옵셔널 체이닝을 다시 적지 않는다. */
  options: ReadonlyArray<ChildSwitchOption>;
  /** 시트 한 줄 탭. 시트를 닫고 applyChildSwitch(단일 경로)로 전환한다. */
  switchTo: (child: ChildSwitchOption) => void;
};

/**
 * 전환 입구의 상태 + 부수효과 배선. 화면은 이 훅과 <ChildSwitchSheet />만 쓰면 되고, 스토어
 * 쓰기·캐시 무효화·안내를 손으로 다시 적지 않는다.
 *
 * `children`은 각 화면이 **이미 읽고 있는** ["children"] 캐시를 그대로 넘긴다 — 이 훅은 새
 * 쿼리를 만들지 않는다(전환 입구가 늘어도 요청 수는 그대로).
 */
export function useChildSwitchSheet(input: {
  /** 실세션인가(비세션 미리보기에서는 전환 입구가 아예 없다). */
  hasSession: boolean;
  /** 지금 선택된 아이. 같은 아이를 다시 고르면 applyChildSwitch가 아무 일도 하지 않는다. */
  childId: string | null;
  children: ReadonlyArray<ChildSwitchOption> | null | undefined;
}): ChildSwitchSheetController {
  const { hasSession, childId } = input;
  const [isOpen, setIsOpen] = useState(false);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();
  // 목록 참조가 매 렌더 새로 생겨도 아래 콜백이 흔들리지 않도록 한 번만 정규화한다.
  const options = useMemo(() => input.children ?? [], [input.children]);
  const canSwitch = hasSession && canSwitchChildFromScreen(options);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const switchTo = useCallback(
    (child: ChildSwitchOption) => {
      setIsOpen(false);
      applyChildSwitch(childId, child, {
        setSelectedChildId,
        invalidateQueries: (queryInput) => queryClient.invalidateQueries(queryInput),
        announce: announceForA11y
      });
    },
    [childId, queryClient, setSelectedChildId]
  );

  return { canSwitch, isOpen, toggle, close, options, switchTo };
}

/**
 * 전환 시트 자체. 열림 판정은 호출부가 한다(`canSwitch && isOpen`) — 홈은 정상 홈과 실패 홈이
 * **같은 노드 하나**를 두 자리에 그리기 때문이다(라운드 38 H-9).
 */
export function ChildSwitchSheet({
  testID,
  options,
  currentChildId,
  onSelect,
  onClose
}: {
  testID: string;
  options: ReadonlyArray<ChildSwitchOption>;
  currentChildId: string | null;
  onSelect: (child: ChildSwitchOption) => void;
  onClose: () => void;
}) {
  return (
    <View testID={testID}>
      <BottomSheetFrame title={CHILD_SWITCH_SHEET_TITLE} showHandle={false}>
        {options.map((child) => {
          const isCurrent = child.id === currentChildId;
          return (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
              accessibilityLabel={childSwitchOptionAccessibilityLabel(child.nickname, isCurrent)}
              onPress={() => onSelect(child)}
              style={childSwitchSheetStyle.row}
            >
              <Text style={childSwitchSheetStyle.rowName}>{child.nickname}</Text>
              {isCurrent ? <StatusBadge label="현재 선택" tone="success" /> : null}
            </Pressable>
          );
        })}
        <TextButton label="닫기" onPress={onClose} />
      </BottomSheetFrame>
    </View>
  );
}
