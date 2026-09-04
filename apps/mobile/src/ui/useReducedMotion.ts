import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * T1(디자인 시스템) — **reduce-motion 조회의 공용 훅.**
 *
 * 같은 조회(비동기 1회 읽기 + 언마운트 가드 + 실패 무시)가 `src/ui/Skeleton.tsx`와
 * `app/launch-animation.tsx`에 복붙으로 서 있었고, 새 애니메이션이 생길 때마다 세 번째 복사가
 * 태어날 참이었다. 이 훅은 그 관례를 **그대로** 한 벌로 옮긴 것이다 — 기존 두 자리는 저마다의
 * 픽셀락·라운드 계약이 소스 문자열을 물고 있어 이번 라운드에서는 무접촉으로 남는다(재개 조건:
 * 그 파일들을 축으로 하는 라운드가 서는 날 이 훅으로 갈아탄다).
 *
 * 판정 방향은 Skeleton과 같다: **알 수 없으면 false**(애니메이션 쪽 폴백). AccessibilityInfo가
 * 없거나 부분 구현인 환경(웹 미리보기·vitest)에서 렌더가 깨지면 안 되기 때문이다. 변경 구독
 * (`addEventListener("reduceMotionChanged")`)도 같은 이유로 옵셔널 체이닝으로 감싼다.
 *
 * 시계 주입 규율과의 관계: 이 훅은 시각을 읽지 않는다 — OS 설정 하나를 읽을 뿐이다.
 */
export function useReducedMotion(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (isMounted) setReduceMotionEnabled(Boolean(enabled));
      })
      .catch(() => {
        // 비네이티브 환경 -- 애니메이션 폴백(false) 그대로 둔다.
      });

    // 화면이 살아 있는 동안 설정이 바뀌면 따라간다. RN 웹 등 일부 구현은 이 API가 없어서
    // 옵셔널이다 -- 그 경우 최초 1회 판정만 쓰는 Skeleton과 같은 동작이 된다.
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (enabled) => {
      setReduceMotionEnabled(Boolean(enabled));
    });

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotionEnabled;
}
