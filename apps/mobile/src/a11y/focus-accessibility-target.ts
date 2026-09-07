import { AccessibilityInfo, findNodeHandle } from "react-native";
import type { Text as NativeText, View } from "react-native";
import type { RefObject } from "react";

/**
 * 낭독 포커스를 그 노드로 옮긴다.
 *
 * ## 왜 잎 모듈인가 (라운드 108 T19 후속 — 실측으로 옮겼다)
 *
 * ⚠️ 두 시점. **종전**: 이 헬퍼는 `design-system/components/ModV1Primitives.tsx` 안에 있었고,
 * 그 파일 안에서만 쓰였으므로 그 자리가 옳았다(그때는 참). → **이제**: `src/ui.tsx`의
 * `BottomSheetFrame`도 같은 헬퍼를 부른다. 그런데 `ui.tsx`가 그 `.tsx`를 import 하는 순간
 * **아이콘 체인이 딸려 온다**(ModV1Primitives → 디자인 시스템 컴포넌트 → `@expo/vector-icons`),
 * 그리고 그 패키지는 vitest의 ESM 해석에서 확장자 없는 내부 import(`./createIconSet`)로 깨진다.
 *
 * 실측: 배터리에서 `src/preparation/preparation-restore.test.ts`가 그것으로 죽었다
 * (`Cannot find module …/build/createIconSet`). 그 스위트는 디자인 시스템 **배럴**을
 * `vi.mock` 하지만 컴포넌트 파일 경로를 직접 무는 새 사슬은 그 그물 밖이다. 워크트리 대조로
 * 확인했다 — 그 사슬이 생긴 커밋 직전까지는 초록이었다.
 *
 * 그래서 헬퍼를 **react-native 하나만 의존하는 잎**으로 내렸다. `ui.tsx`도 ModV1Primitives 도
 * 여기서 가져가므로 **한 벌은 그대로 한 벌**이고, 화면 컴포넌트를 지나지 않으므로 어떤
 * 스위트의 그물에도 새 사슬을 만들지 않는다.
 *
 * ⚠️ 이 파일은 `.ts`다 — `.tsx`에 `export function` 을 더하면 사문 대장의 tsx 축 실측
 * (`tsxExportFunctionCount`, 오늘 149)이 움직이는데, 여기서 태어난 컴포넌트·훅은 없다.
 */
export function focusAccessibilityTarget(target: RefObject<View | NativeText | null>) {
  const handle = findNodeHandle(target.current);
  if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
}
