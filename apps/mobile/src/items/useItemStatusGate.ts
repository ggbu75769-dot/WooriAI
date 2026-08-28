import { Alert } from "react-native";
import { revalidateHouseholdRoles, useExpenseEntryGate } from "../family/useExpenseEntryGate";
import {
  guardItemStatusChange,
  ITEM_STATUS_VIEW_ONLY_ALERT_TITLE,
  ITEM_STATUS_VIEW_ONLY_MESSAGE
} from "./status-permission";

/**
 * 라운드 51 #8 — 준비 상태 변경 진입점 하나를 감싸는 얇은 배선(문구 근거는 ./status-permission.ts).
 *
 * 판정을 새로 만들지 않고 `useExpenseEntryGate`를 **읽기로 재사용**한다. 서버가 지출 쓰기와
 * 준비 상태 쓰기에 같은 편집 권한을 요구하므로(items-catalog.service.ts / store-shared.ts의
 * `canEdit`), 잠금 판정이 두 벌이 되면 한쪽만 고쳐지는 날 두 화면의 말이 갈린다. 그 훅은
 * 가구 역할 표 해석·아이-가구 해석·자가 치유 재검증까지 이미 한 곳에 모아 두고 있다.
 *
 * 같은 화면이 `useExpenseEntryGate()`를 이미 부르고 있는데 여기서 또 부르는 이유: 두 진입점의
 * **안내 문구가 다르기 때문**이다(지출 기록 vs 준비 상태). 훅을 두 번 불러도 새 요청은 생기지
 * 않는다 — 안쪽 `["children"]` 조회는 같은 쿼리 키를 공유하고(react-query 중복 제거), 자가 치유
 * 재검증은 모듈 지역 래치가 앱 세션당 한 번으로 묶는다.
 *
 * 안내가 곧 역할 재검증 트리거인 것도 지출 쪽과 같다(라운드 40 J-3): 승격(viewer → co_parent)은
 * 이 경로에서만 반영된다. 조회는 백그라운드이고 스로틀이 걸려 있어 안내 자체는 지금 그대로 뜬다.
 */
export type ItemStatusGate = {
  /** 이 세션이 보기 전용이라 준비 상태 변경을 막아야 하는가. 모름·비세션이면 항상 false. */
  locked: boolean;
  /** 안내만 띄운다(자체 확인 Alert를 가진 진입점용 — 상세의 "선물로 받았어요" 등). */
  explain: () => void;
  /** 잠겼으면 안내로, 아니면 원래 동작으로 — onPress를 그대로 감싼다. */
  guard: <TArgs extends unknown[]>(action: (...args: TArgs) => void) => (...args: TArgs) => void;
};

/**
 * 안내를 띄우기만 하는 동작. 잡아 두는 값이 없어 **모듈 스코프**에 둔다 — 훅이 매 렌더 같은
 * 참조를 돌려주므로 이 함수를 의존성에 넣은 콜백이 렌더마다 새로 만들어지지 않는다
 * (explainExpenseViewOnly와 같은 관례).
 */
export function explainItemStatusViewOnly(): void {
  Alert.alert(ITEM_STATUS_VIEW_ONLY_ALERT_TITLE, ITEM_STATUS_VIEW_ONLY_MESSAGE);
  revalidateHouseholdRoles();
}

export function useItemStatusGate(): ItemStatusGate {
  const { locked } = useExpenseEntryGate();
  return {
    locked,
    explain: explainItemStatusViewOnly,
    guard: <TArgs extends unknown[]>(action: (...args: TArgs) => void) =>
      guardItemStatusChange(locked, explainItemStatusViewOnly, action)
  };
}
