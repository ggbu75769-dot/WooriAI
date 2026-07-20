# SI-006 baseline — Android cold-start module evaluation

## Installed runtime

- Device: isolated `wooriai_pixel_5_api35`, Android 15 / API 35 / x86_64
- Package: `com.anonymous.wooriai`
- Installed APK SHA-256: `3554C7CAF44A42BCB25133B38AAEBEFCBDFC4472944137B9F9F688D2522703F0`
- Source snapshot SHA-256: `71FBB8E043E862ABE7AB1387474BFF742780B8A21EB492BD8CB71452A7150D17`
- Qualification class: internal standalone test; not production/store evidence

## Reproduction

1. Clear logcat and force-stop the package.
2. Start `MainActivity` with `adb shell am start -W`.
3. Capture app-owned frames every two seconds with `adb shell screencap -p` plus `adb pull`.
4. Correlate `ReactNativeJS`, `ActivityTaskManager`, and native-library load timestamps.

Observed on 2026-07-20 KST:

- Activity displayed: 1.489 s
- `ReactNativeJS Running "main"`: about 1.4 s after process start
- elapsed 1.81–13.73 s: native splash mark only
- elapsed 16.56 s: RN `시작 화면을 준비하고 있어요` state becomes visible
- `libexpo-sqlite.so` loads at about 15.0 s, after the long native-splash interval
- fatal/JS exception matches: 0

Frames: `artifacts/self-implement/20260720-si006/baseline-frames/frame-{0,2,4,6,8,10}.png`.

## Source ownership

- `apps/mobile/metro.config.js` has no `transformer.getTransformOptions` and therefore does not enable Metro `inlineRequires`.
- Expo Router native production uses synchronous route imports. The root route statically reaches the API client, fixture backend, offline controller, and persisted stores before the first useful RN paint.
- Current release sourcemap contains 1,270 sources / 5,681,494 source bytes. Two app-owned startup-reachable modules alone are `local-backend.ts` 136,482 bytes and `client.ts` 79,820 bytes.
- SQLite is a downstream symptom: the offline lifecycle can load it only after the root route and session gate mount.

## Initial hypothesis and final disposition

The baseline proposed `inlineRequires=true` as a regression target. A clean source-bound installed experiment later disproved that hypothesis: five starts worsened to 15.24–24.60 seconds. The transform was removed. The confirmed source defect was instead the native Gradle build running outside the mobile project that owns `metro.config.js`; see `SI-006-completion.md`.
