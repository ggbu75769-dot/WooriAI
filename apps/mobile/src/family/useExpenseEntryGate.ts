import { useQuery } from "@tanstack/react-query";
import { Alert } from "react-native";
import { listChildren, LOCAL_SESSION_TOKEN } from "../api/client";
import { resolveExpenseHouseholdId } from "../expenses/records-list-view";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import {
  EXPENSE_VIEW_ONLY_ALERT_TITLE,
  EXPENSE_VIEW_ONLY_MESSAGE,
  isExpenseEntryLocked,
  resolveHouseholdRole
} from "./record-permissions";

/**
 * UX-R(M) — 지출 생성·수정·삭제 진입점 하나를 감싸는 얇은 배선.
 *
 * 판정 규칙은 전부 src/family/record-permissions.ts에 있고(vitest 단위 테스트 대상), 이 훅은
 * 스토어에서 값을 모아 그 판정을 부르고, 잠겼으면 안내를 띄우는 일만 한다. 화면마다 조건을
 * 다시 적지 않는 것이 요점이다 — 진입점이 열 곳이 넘고, 그중 하나만 빠져도 "저장했어요"라는
 * 거짓말이 그 자리에서 되살아난다.
 *
 * 잠긴 진입점을 **지우지 않고** 눌렀을 때 안내로 답하는 이유:
 *  - 지우면 화면 구조가 바뀌어 픽셀락 캡처(HOME-001·EXP-001·ITEM-001/002)와 어긋날 위험이
 *    생긴다. 판정 자체가 비세션에서 절대 발동하지 않으므로 캡처는 이미 안전하지만, 노드를
 *    그대로 두면 그 안전이 판정 하나에만 걸리지 않는다;
 *  - 보기 전용 참여자에게 필요한 것은 "버튼이 왜 사라졌지?"가 아니라 "누가 기록할 수 있는가"라는
 *    사실이다. 비난하지 않고 다음 행동을 알려 주는 문구 하나가 그 답이다(DNC-018).
 */
export type ExpenseEntryGate = {
  /** 이 세션이 보기 전용이라 기록 진입을 막아야 하는가. 모름·비세션이면 항상 false. */
  locked: boolean;
  /** 안내만 띄운다(진입점이 자체 확인 Alert를 갖고 있어 guard로 감싸기 어려운 자리용). */
  explain: () => void;
  /** 잠겼으면 안내로, 아니면 원래 동작으로 — 진입점 onPress를 그대로 감싼다. */
  guard: <TArgs extends unknown[]>(action: (...args: TArgs) => void) => (...args: TArgs) => void;
};

/**
 * 안내를 띄우기만 하는 동작. 잡아 두는 값이 없어 **모듈 스코프**에 둔다 — 훅이 매 렌더 같은
 * 참조를 돌려주므로, 이 함수를 의존성에 넣은 useCallback(기록 탭의 행 액션 핸들러)이 렌더마다
 * 새로 만들어져 행 memo를 깨뜨리는 일이 없다.
 */
export function explainExpenseViewOnly(): void {
  Alert.alert(EXPENSE_VIEW_ONLY_ALERT_TITLE, EXPENSE_VIEW_ONLY_MESSAGE);
}

export function useExpenseEntryGate(): ExpenseEntryGate {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdRoles = useSessionStore((state) => state.householdRoles);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const hasSession = Boolean(authToken);

  // 다가구 계정에서만 "지금 보고 있는 아이가 어느 가구인가"를 알아야 한다. 가구가 하나뿐이면
  // resolveHouseholdRole이 그 하나를 쓰므로 아이 목록이 필요 없다 — 그래서 요청도 그때만 켠다
  // (대부분의 계정에서 추가 요청 0건). 키는 아이 관리·설정·리포트·기록 탭과 같은 ["children"]
  // 이라, 그 화면들을 거친 뒤라면 다가구 계정에서도 캐시가 그대로 쓰인다.
  const isMultiHousehold = Object.keys(householdRoles ?? {}).length > 1;
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: hasSession && isMultiHousehold,
    queryFn: () => listChildren(authToken!)
  });
  // 라운드 27 L-4와 같은 판정을 재사용한다 — 아이를 못 찾으면 null(모름)이고, 여기서
  // defaultHouseholdId로 메우지 않는다: 다가구 계정에서 그렇게 메우면 A 가구 owner가 B 가구
  // viewer 역할로 잘못 잠길 수 있다. 모르면 잠그지 않는 쪽이 항상 안전한 실패다.
  const householdId = resolveExpenseHouseholdId({
    children: childrenQuery.data?.children,
    childId: selectedChildId,
    fallbackHouseholdId: null
  });
  const role = resolveHouseholdRole({ householdRoles, householdId });
  const locked = isExpenseEntryLocked({ hasSession, role });

  return {
    locked,
    explain: explainExpenseViewOnly,
    guard:
      <TArgs extends unknown[]>(action: (...args: TArgs) => void) =>
      (...args: TArgs) => {
        if (locked) {
          explainExpenseViewOnly();
          return;
        }
        action(...args);
      }
  };
}
