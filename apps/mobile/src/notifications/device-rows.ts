/**
 * 라운드 87 트랙 D — 알림 설정(SET-006) 기기 목록에서 **기기 한 대를 가르는 문구**.
 *
 * 종전 이 화면의 기기 행은 제목이 `platformLabel(device.platform)`, 스위치 낭독 라벨이
 * `` `${platformLabel(device.platform)} 알림` `` 이었고, `platformLabel`이 돌려주는 문자열은
 * `"iPhone · iOS"`·`"Android 기기"` 둘뿐이다. 그래서 **안드로이드 기기를 둘 등록한 사람에게는
 * 두 행의 제목도, 두 스위치의 낭독도 글자 하나 다르지 않았다** — 되돌릴 수 있는 스위치이긴 해도
 * 어느 기기의 알림을 껐는지 화면이 말하지 않는 것이다. 목록 행 컨트롤의 낭독 라벨 중 *행마다
 * 갈리는 값*을 끼우지 않은 마지막 한 자리였고(나머지는 이름·닉네임·품목명), 라운드 86 C가
 * 가족 화면의 대기 초대에서 닫은 그 규율의 마지막 자리다.
 *
 * 가를 값은 이미 손에 있다: `UserDeviceSummary.osVersion`은 **앱이 등록할 때 자기 손으로 올린
 * 값**이고(`usePushDeviceRegistration.ts`의 `getCurrentOsVersion`), 응답에 그대로 실려 온다.
 * 화면이 한 번도 읽지 않았을 뿐이라 **서버 변경도, 새 요청도, 등록 인자 변경도 없다.**
 *
 * 규율 셋(전부 라운드 86 C의 `formatInviteCreatedAt`과 같다):
 *
 * 1. **지어내지 않는다.** 마스터 토글이 만드는 등록 경로(`registerDevice`)는 `osVersion`을 보내지
 *    않아서 그 경로로 생긴 행은 값이 `null`이다. 없으면 그 조각을 그리지 않고 **종전 문자열로
 *    그대로 돌아간다**(그때 제목·낭독 라벨은 이 트랙 이전과 바이트가 같다).
 * 2. **원문을 흘리지 않는다.** 값의 모양이 버전이 아니면(빈 문자열·`"Unknown"`·긴 문자열 등)
 *    그리지 않는다 — 사람이 읽을 수 없는 줄을 세우느니 종전 문자열이 낫다.
 * 3. **갈리는 것만 그린다.** `appVersion`은 두 기기가 같은 빌드를 쓰면 갈리지 않고, 푸시 토큰과
 *    기기 id는 애초에 표시 대상이 아니다. 그래서 이 모듈은 그 셋을 인자로도 받지 않는다.
 *
 * ⚠️ 플랫폼 문자열은 **인자로 받는다** — 이 모듈은 새 플랫폼 이름을 짓지 않는다(화면의
 * `platformLabel` 두 문자열이 유일한 소스로 남는다).
 */

/**
 * 화면에 세울 수 있는 OS 버전 조각. 버전 모양이 아니면 `null`(위 규율 2).
 *
 * 받는 값은 등록 시점의 `Platform.Version`이라 iOS는 `"17.5"`·`"17.5.1"`, 안드로이드는 API
 * 레벨 정수의 문자열(`"34"`)이다. 그래서 이 조각은 **뜻을 단정하는 말 없이 숫자만** 잇는다
 * (안드로이드 값은 OS 버전이 아니라 API 레벨이므로 "안드로이드 34"라고 말하면 허위가 된다 —
 * 이 값의 일은 두 행을 가르는 것 하나다).
 *
 * ⚠️ **라운드 87 리뷰 M-4 — 그 수는 사용자가 아는 수와 다르다.** 안드로이드 사용자가 자기 폰
 * 설정에서 보는 것은 `Android 14`인데 이 화면에는 `Android 기기 · 34`가 선다(같은 기기의 다른
 * 축이다). 뜻을 붙이지 않는 것이 허위를 막는 최소 조치이지만, **그 수가 사용자에게 무엇으로
 * 읽히는지**는 소스가 답할 수 없다 — 그 판정은 실기기 확인이 진다
 * (`docs/qa/runtime-verification-required.md` #158 ⓐ). ⚠️ 그러니 그 확인 전에 형식을 바꾸지 않는다.
 *
 * 내보내지 않는다: 화면이 부르는 것은 아래 둘뿐이고, 호출부 없는 export를 새로 만들지 않는다.
 */
function osVersionFragment(osVersion: string | null | undefined): string | null {
  if (typeof osVersion !== "string") return null;
  const trimmed = osVersion.trim();
  // 숫자와 점으로만 이뤄진 버전 모양만 통과시킨다(`"17.5.1"`·`"34"`). 그 밖은 원문을 흘리지 않는다.
  if (!/^\d{1,4}(\.\d{1,4}){0,3}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * 기기 행의 제목. OS 버전이 있으면 구두점 하나로 잇고, 없으면 **종전 제목 그대로**다.
 *
 * @param platformLabel 화면의 `platformLabel(device.platform)` 결과(이 모듈은 짓지 않는다).
 * @param osVersion `UserDeviceSummary.osVersion` — 없거나 버전 모양이 아니면 조각이 서지 않는다.
 */
export function deviceRowTitle(platformLabel: string, osVersion: string | null | undefined): string {
  const fragment = osVersionFragment(osVersion);
  return fragment ? `${platformLabel} · ${fragment}` : platformLabel;
}

/**
 * 기기 알림 스위치의 낭독 라벨 — **제목과 같은 파생값을 읽는다**(두 문장이 갈릴 자리를 만들지
 * 않는다: 이 라벨은 `deviceRowTitle`을 그대로 앞에 세운다).
 *
 * *이 기기*는 오늘 배지에만 있어서 **스위치에 포커스가 선 사람에게는 도달하지 않는다** —
 * 배지의 그 문자열을 라벨 끝에 잇는다(`app/(auth)/login.tsx`의 `` `${label}, ${badge}` `` 관례).
 * 그래서 OS 버전이 둘 다 없는 두 안드로이드 기기라도 *이 기기* 쪽은 다르게 들린다.
 *
 * @param isCurrentDevice 이 행이 지금 이 기기인가(화면의 `isThisDevice` — 배지와 같은 판정).
 */
export function deviceRowSwitchLabel(
  platformLabel: string,
  osVersion: string | null | undefined,
  isCurrentDevice: boolean
): string {
  const label = `${deviceRowTitle(platformLabel, osVersion)} 알림`;
  return isCurrentDevice ? `${label}, 이 기기` : label;
}
