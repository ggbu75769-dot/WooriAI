# Release 3 Android 릴리스 런북

상태: 빌드·차단 경로 구현, 승인 package/version/signing key와 Play internal-track 증적 없음.

## 단일 source와 서명

- package, `version`, `android.versionCode`: `apps/mobile/app.json`.
- Gradle은 위 파일을 읽으며 production key를 저장소에 저장하지 않는다.
- key reference: `ANDROID_SIGNING_KEYSTORE_PATH`, `ANDROID_SIGNING_KEY_ALIAS`.
- password는 `ANDROID_SIGNING_STORE_PASSWORD_ENV`, `ANDROID_SIGNING_KEY_PASSWORD_ENV`가 가리키는 외부 환경변수에서만 읽는다.
- Pixel Lock/standalone APK만 `WOORIAI_ALLOW_DEBUG_RELEASE_SIGNING=1`로 debug key를 명시 허용한다. 이는 공개 artifact가 아니다.

## Signed AAB

1. 승인 package/version/versionCode와 HTTPS API URL을 설정한다.
2. 외부 keystore 경로와 password environment reference를 주입한다.
3. `pnpm release:config`를 통과시킨다.
4. `pnpm android:build-aab`를 실행한다.
5. 결과 `artifacts/android/wooriai-<version>-<versionCode>-release.aab`와 JSON SHA-256 report를 source SHA에 연결한다.
6. Play Console internal track에 업로드하고 store가 서명한 설치본을 실제 Android 기기에 설치한다.

현재 `com.anonymous.wooriai`, `0.0.0`, 외부 key 부재 상태에서는 위 명령이 의도적으로 실패한다.

## Upgrade/install 체크리스트

- 이전 internal build 위에 upgrade install, cold start, logout/login, token refresh를 확인한다.
- SQLite/Zustand persisted-state migration, offline outbox 중복·충돌, full resync fallback을 확인한다.
- `wooriai://oauth/kakao` deep link의 success/state mismatch/cancel/cold-start를 확인한다.
- Pixel Lock 9개 화면은 설치 앱 + `adb shell screencap -p`/`adb pull`로 모두 `<=0.0500`인지 확인한다.
- screen reader label, 44dp touch target, large font, safe area, reduce motion을 실제 기기에서 확인한다.
- privacy/support URL, 앱 내 계정 삭제·export 안내, affiliate disclosure를 확인한다.
- test account는 별도 최소권한 계정으로 만들고 credential을 문서/로그에 남기지 않는다.

## 공개 출시 전 필수 증적

Signed AAB checksum, internal-track 설치 화면, upgrade 결과, real Kakao E2E, account deletion/unlink, Data Safety 승인본, adb Pixel Lock, accessibility 결과, crash/metrics 연결, 7일 closed beta, S0/S1 0건이 필요하다.
