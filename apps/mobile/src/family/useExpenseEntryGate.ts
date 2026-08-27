import { useQuery } from "@tanstack/react-query";
import { Alert } from "react-native";
import { getMe, listChildren, LOCAL_SESSION_TOKEN } from "../api/client";
import { resolveExpenseHouseholdId } from "../expenses/records-list-view";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import {
  EXPENSE_VIEW_ONLY_ALERT_TITLE,
  EXPENSE_VIEW_ONLY_MESSAGE,
  guardExpenseAction,
  isExpenseEntryLocked,
  needsChildHouseholdResolution,
  resolveHouseholdRole
} from "./record-permissions";
import { createHouseholdRoleRevalidator } from "./role-revalidation";

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
 *
 * 라운드 40 J-1: 진입점만이 아니라 **목적지 화면의 저장 실행**(app/expenses/new.tsx)도 같은
 * 훅을 지난다 — 딥링크나 아직 잠기지 않은 새 진입점 하나로 시트에 도달해도 저장은 막힌다.
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
 * 라운드 40 J-3: 잠금 안내를 띄우는 순간의 역할 재검증 스로틀. **모듈 지역**이라 화면
 * 리마운트에는 살아남고 콜드 스타트에는 비워진다(규칙과 근거는 role-revalidation.ts).
 */
const householdRoleRevalidator = createHouseholdRoleRevalidator();

/**
 * 라운드 40 J-3: 서버가 지금 말하는 역할 표로 갱신한다 — 승격(viewer → co_parent)이나 기본
 * 가구가 아닌 가구의 역할 변경은 이 경로에서만 반영된다. 스토어를 훅이 아니라 `getState`로
 * 읽는 이유는 아래 `explainExpenseViewOnly`가 모듈 스코프여야 하기 때문이다(참조 안정성).
 *
 * 데모(테스트) 세션은 실토큰이 없어 그대로 지나간다 — 데모에는 서버 가구가 없고, 역할 표도
 * 애초에 null(모름)이라 잠기지 않으므로 이 경로에 오지도 않는다.
 */
function revalidateHouseholdRoles(): void {
  const { accessToken, setHouseholdRoles } = useSessionStore.getState();
  if (!accessToken) return;
  householdRoleRevalidator.request({
    now: Date.now(),
    fetchHouseholds: () => getMe(accessToken).then((result) => result.households ?? []),
    applyHouseholds: setHouseholdRoles
  });
}

/**
 * 안내를 띄우기만 하는 동작. 잡아 두는 값이 없어 **모듈 스코프**에 둔다 — 훅이 매 렌더 같은
 * 참조를 돌려주므로, 이 함수를 의존성에 넣은 useCallback(기록 탭의 행 액션 핸들러)이 렌더마다
 * 새로 만들어져 행 memo를 깨뜨리는 일이 없다.
 *
 * 라운드 40 J-3: 이 안내가 곧 재검증 트리거다. 조회는 백그라운드이고 스로틀이 걸려 있어
 * 안내 자체는 지금 그대로 뜬다.
 */
export function explainExpenseViewOnly(): void {
  Alert.alert(EXPENSE_VIEW_ONLY_ALERT_TITLE, EXPENSE_VIEW_ONLY_MESSAGE);
  revalidateHouseholdRoles();
}

export function useExpenseEntryGate(): ExpenseEntryGate {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const householdRoles = useSessionStore((state) => state.householdRoles);
  const knownHouseholdIds = useSessionStore((state) => state.householdIds);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const hasSession = Boolean(authToken);

  // "지금 보고 있는 아이가 어느 가구인가"는 판정이 실제로 그것을 필요로 할 때만 알아낸다.
  // 표가 비었으면(모름) 어차피 잠기지 않고, 서버가 가구가 하나뿐이라고 말했으면 그 하나를
  // 쓰면 된다 — 그래서 요청도 그 밖의 경우(다가구 · 부분 표)에만 켠다. 판정은 순수 모듈에
  // 있다(라운드 40 J-2의 needsChildHouseholdResolution). 키는 아이 관리·설정·리포트·기록
  // 탭과 같은 ["children"]이라, 그 화면들을 거친 뒤라면 캐시가 그대로 쓰인다.
  const needsHouseholdLookup = needsChildHouseholdResolution({ householdRoles, knownHouseholdIds });
  const childrenQuery = useQuery({
    queryKey: ["children"],
    enabled: hasSession && needsHouseholdLookup,
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
  const role = resolveHouseholdRole({ householdRoles, householdId, knownHouseholdIds });
  const locked = isExpenseEntryLocked({ hasSession, role });

  return {
    locked,
    explain: explainExpenseViewOnly,
    guard: <TArgs extends unknown[]>(action: (...args: TArgs) => void) =>
      guardExpenseAction(locked, explainExpenseViewOnly, action)
  };
}
