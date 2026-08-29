# APK / AAB 빌드 가이드 (EAS 클라우드 · 로컬)

작성일: 2026-08-27 · 대상: `apps/mobile` (Expo SDK 52 + expo-router, CNG/prebuild 파이프라인)

폰에 깔아볼 **APK**를 가장 빨리 얻는 길과, 스토어에 낼 **AAB**를 만드는 길을 정리했어요.
이 레포에는 두 갈래가 있어요.

| | ① EAS 클라우드 빌드 | ② 로컬 빌드 |
|---|---|---|
| 내 PC 준비물 | Node + `eas-cli` **만** | JDK 17 + Android SDK (수 GB 설치) |
| 명령 | `eas build -p android --profile preview` | `pnpm android:build-apk` |
| 소요 | 대기열 포함 10분~수 시간(무료 플랜) | 첫 빌드 10~30분, 이후 수 분 |
| 결과 받는 법 | 웹 링크 / QR → 폰에서 바로 설치 | `artifacts/android/*.apk` 파일 |
| 비용 | 무료 플랜 있음(대기열 있음) | 무료 |
| 서명 | EAS가 관리하는 keystore | debug 서명(APK) / 업로드 keystore(AAB) |

**Android SDK를 깔 수 없거나 지금 당장 폰에 넣어보고 싶다면 ① EAS**를 쓰세요. 아래 §1이 전부예요.

---

## 1. 가장 빠른 길 — EAS로 데모 APK 만들기

계정 생성과 로그인은 본인만 할 수 있어요. 나머지 설정(`apps/mobile/eas.json`)은 이미 레포에 들어 있어요.

### 1-1. 준비 (한 번만)

1. **Expo 계정 무료 생성**: <https://expo.dev/signup>
2. **CLI 설치**
   ```bash
   npm i -g eas-cli
   eas login          # 방금 만든 계정으로 로그인
   eas whoami         # 로그인 확인
   ```
3. **프로젝트 연결** — `apps/mobile`에서 실행해요.
   ```bash
   cd apps/mobile
   eas init
   ```
   이 레포는 동적 설정(`app.config.js`)을 쓰기 때문에 eas-cli가 프로젝트 ID를 자동으로 써 넣지 못하고
   **"add this to your app config"** 안내와 함께 UUID를 출력해요. 그 값을 `apps/mobile/app.json`의
   `expo` 안에 이렇게 붙여 넣어 주세요(기존 값은 그대로 두고 `extra`만 추가).

   ```jsonc
   {
     "expo": {
       "name": "우리아이",
       // ...기존 값 유지...
       "extra": {
         "eas": { "projectId": "여기에-eas-init이-출력한-UUID" }
       }
     }
   }
   ```

   조직(팀) 계정 아래에 만들었다면 `"owner": "조직-계정명"`도 같은 `expo` 블록에 추가해요.
   `app.config.js`가 `app.json`을 그대로 펼쳐 쓰기 때문에 이 한 줄이면 로컬·클라우드 양쪽에 반영돼요.

### 1-2. 빌드 (매번)

```bash
cd apps/mobile
eas build -p android --profile preview
```

- 첫 빌드에서 **"Generate a new Android Keystore?"** 를 물으면 **Yes**를 고르세요.
  EAS가 keystore를 만들어 보관해요(내려받기·교체는 `eas credentials`에서 가능).
- 커밋 안 된 변경이 있으면 eas-cli가 어떻게 할지 물어봐요. `eas.json`·`app.json` 변경은 **커밋해 두는 게 좋아요**
  (클라우드에 올라가는 소스는 git이 아는 파일 기준이에요).
- 진행 상황은 터미널의 빌드 URL에서 볼 수 있어요. 창을 닫아도 빌드는 계속 돌아가고,
  나중에 `eas build:list` → `eas build:view <id>` 로 다시 찾을 수 있어요.

### 1-3. 폰에 설치

빌드가 끝나면 터미널과 웹 페이지에 **QR 코드와 다운로드 링크**가 떠요.

1. 폰 카메라로 QR을 찍거나 링크를 폰 브라우저로 열어요.
2. `.apk`를 받고 **"출처를 알 수 없는 앱 설치"** 를 허용해요(안드로이드가 알아서 물어봐요).
3. 설치 후 로그인 화면에서 **"테스트 계정으로 시작하기"** 로 바로 들어갈 수 있어요.
   `preview` 프로필은 서버 없이 도는 데모 빌드예요(§2 참고).

> **이미 같은 앱이 깔려 있다면** 먼저 지우고 설치하세요. 예전 로컬 APK는 debug 키로,
> EAS APK는 EAS keystore로 서명돼 서명이 달라 덮어쓰기 설치가 실패해요("앱이 설치되지 않았습니다").

### 1-4. 무료 플랜 주의

- 무료 플랜은 **동시 빌드 1개 + 대기열 우선순위 낮음**이에요. 붐비는 시간대엔 시작까지 수십 분~수 시간 기다릴 수 있어요.
  (한도·대기 시간은 <https://expo.dev/pricing> 과 빌드 페이지에서 확인해요.)
- 대기열을 아끼려면 여러 번 실패시키지 말고, 로컬에서 `pnpm --filter mobile test`·`typecheck`를 먼저 통과시키고 올리세요.
- `eas build --local` 옵션도 있지만 **내 PC에 Android SDK가 있어야** 해서, SDK를 피하려는 목적에는 맞지 않아요.

---

## 2. 프로필 3종 — 무엇이 어떻게 다른가

`apps/mobile/eas.json`에 정의돼 있어요. 값은 로컬 스크립트(`scripts/build-android-apk.ts`,
`scripts/build-android-aab.ts`)가 강제하는 규칙과 같게 맞췄어요.

| 프로필 | 산출물 | 테스트 로그인 | 용도 |
|---|---|---|---|
| `preview` | APK (내부 배포) | **켬** (`EXPO_PUBLIC_TEST_LOGIN=1`) | 서버 없이 도는 데모. 폰에서 화면·흐름 확인용 |
| `production-apk` | APK (내부 배포) | 끔 | 실 API를 보는 실기기 스모크 테스트용 |
| `production` | **AAB** (스토어) | 끔 | Play Console 업로드용 |

세 프로필 모두 `EXPO_PUBLIC_PIXEL_LOCK=0`(픽셀락 계측 끔)이고,
`preview`는 백엔드가 없으므로 카카오 로그인·푸시도 꺼진 채로 나가요(`EXPO_PUBLIC_KAKAO_ENABLED=0`, `EXPO_PUBLIC_PUSH_ENABLED=0`).

로컬 대응 관계:

- `preview` ↔ `pnpm android:build-apk` (= `--profile standalone`, 기본값)
- `production-apk` ↔ `pnpm android:build-apk --profile production`
- `production` ↔ `pnpm android:build-aab`

---

## 3. 실 API를 보는 빌드에 API 주소 넣기

`eas.json`에는 **API 주소를 적어 두지 않았어요.** 가짜 플레이스홀더가 커밋돼 있으면
"동작하는 것처럼 보이는" 빌드가 나가버리기 때문이에요. 실 주소는 EAS 환경변수로만 넣어요.

```bash
cd apps/mobile
eas env:create
# 대화형으로 물어봐요:
#   Environment      : production        (production-apk / production 프로필이 쓰는 환경)
#   Name             : EXPO_PUBLIC_API_BASE_URL
#   Value            : https://api.내도메인.kr/api/v1     ← 끝의 /api/v1 까지 포함
#   Visibility       : Plain text
```

확인·수정은 `eas env:list --environment production`, `eas env:update`, 웹에서는 프로젝트 → Environment variables 예요.

- **`preview` 프로필은 `preview` 환경**을 봐요. 데모 APK엔 API 주소가 필요 없으니 보통 아무것도 안 넣어요.
- `EXPO_PUBLIC_*` 값은 어차피 앱 번들 안에 그대로 박혀요. **비밀이 아닙니다** — Plain으로 두고,
  진짜 비밀(서비스 계정 키 등)만 Secret으로 넣으세요.
- 로컬 `--profile production` 빌드는 `EXPO_PUBLIC_API_BASE_URL`이 없으면 **빌드를 거부**하지만,
  EAS에는 그 게이트가 없어요. 값을 안 넣으면 앱이 조용히 `http://localhost:3000/api/v1`을 보게 되니
  **빌드 전에 `eas env:list`로 반드시 확인**하세요. (AAB는 `https://`만 써야 해요 — cleartext는
  `network_security_config`가 막습니다.)

버전(AAB용)도 같은 방식으로 `production` 환경에 넣어요. 이 값들은 `expo-config.shared.js`가 읽어요.

| 이름 | 예시 | 설명 |
|---|---|---|
| `WOORIAI_APP_VERSION` | `1.0.0` | 스토어 표기 버전 |
| `WOORIAI_ANDROID_VERSION_CODE` | `1` | **업로드마다 +1** (안 올리면 Play가 거부) |
| `WOORIAI_ANDROID_PACKAGE` | `kr.wooriai.app` | 생략 시 `app.json` 값 사용 |

> `eas.json`의 `cli.appVersionSource`는 `local`이에요. 버전은 위 env → config plugin이 정하고,
> EAS가 임의로 증가시키지 않아요(로컬 AAB 빌드와 값이 어긋나지 않게).

### 3-1. 실사용자 빌드가 요구하는 `EXPO_PUBLIC_*` — 클라우드에는 관문이 없어요

로컬 AAB 빌드(`pnpm android:build-aab`)는 아래 키가 없으면 **빌드를 거부**해요
(`scripts/build-android-aab.ts`의 `RELEASE_REQUIRED_PUBLIC_ENV` — 키마다 "없으면 사용자가 무엇을
잃는가"가 한 줄씩 붙어 있고, 그 줄이 곧 거부 메시지예요). **EAS 클라우드 빌드는 그 스크립트를
거치지 않으므로 이 관문이 아예 없어요.** `eas.json`의 `env`도 이 값들을 담지 않아요 — 실 키·실
주소를 저장소에 커밋하지 않기 때문이에요(§7). 그래서 클라우드로 실사용자 빌드(`production`,
`production-apk`)를 낼 때는 **아래를 EAS 환경변수(`production` 환경)로 직접 넣고, 빌드 전에 눈으로
확인**해야 해요.

| 키 | 없으면 벌어지는 일 |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | 앱이 조용히 `http://localhost:3000/api/v1`을 봐요 (§3) |
| `EXPO_PUBLIC_KAKAO_ENABLED` | `"1"`이 아니면 실 카카오 대신 개발 스텁 경로로 로그인해요 — 실사용자는 서버의 501만 받고 가입 자체를 못 해요 |
| `EXPO_PUBLIC_KAKAO_CLIENT_ID` | 위와 같은 결과 — 실 카카오 로그인이 켜지지 않아요 |
| `EXPO_PUBLIC_KAKAO_REDIRECT_URI` | 위와 같은 결과. 카카오 콘솔과 서버 `OAUTH_KAKAO_REDIRECT_URIS` 양쪽에 등록된 값이어야 해요 |
| `EXPO_PUBLIC_TERMS_URL` | 로그인 화면의 이용약관 [보기] 링크가 서지 않아요 — 읽지 못한 문서에 필수 동의하게 돼요 |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | 개인정보처리방침 [보기] 링크가 서지 않아요. Play 등록 URL과 같은 값이어야 해요 |
| `EXPO_PUBLIC_SUPPORT_URL` · `EXPO_PUBLIC_FAQ_URL` | 더보기·설정의 도움 행이 서지 않아요(앱 안에 도움으로 가는 길이 0건). 로컬 관문은 `WOORIAI_ALLOW_MISSING_SUPPORT_LINKS=1`로 **명시**해야 지나가요 |

빌드 직전 확인:

```bash
cd apps/mobile
eas env:list --environment production   # 위 표의 키가 전부 있는지 눈으로 대조
```

- URL 키들(`TERMS`·`PRIVACY_POLICY`·`SUPPORT`·`FAQ`)은 앱이 `http(s)://`만 링크로 인정해요.
  그 밖의 값은 **주입되지 않은 것과 같이** 취급돼서 링크가 그냥 사라져요.
- 레포 쪽 드리프트(코드가 읽는데 카탈로그·`.env.example` 어디에도 없는 키)는
  `pnpm check:env --scope=mobile`이 잡아요. 이 명령은 **EAS 서버의 값을 보지 못하므로** 위
  `eas env:list` 대조를 대신하지 못해요 — 둘 다 하세요.
- ⚠️ **`eas.json`에 검증 훅을 넣을 수는 없어요.** 빌드 프로필의 `prebuildCommand`는 임의 명령이
  아니라 `npx expo <여기>`의 **인자**로 쓰여요(`@expo/build-tools`의 `getPrebuildCommandArgs`가
  `npx `/`expo ` 접두를 떼고 `--platform`을 덧붙여 `expo prebuild`에 넘겨요 — 그 파일에는
  "deprecate prebuildCommand" TODO도 붙어 있어요). 검증 스크립트를 적으면 prebuild 자체가
  깨지므로 넣지 않았어요. 클라우드 경로의 방어선은 **이 표 + 위 대조 + 회귀 테스트**(§6)예요.

---

## 4. 로컬에서 빌드하기 (Android SDK가 있을 때)

준비물: **JDK 17** (그 이상 버전은 RN gradle plugin이 거부해요) + **Android SDK** (`ANDROID_HOME`).
자세한 설치는 `docs/operations/environment-setup.md` 참고.

```bash
# 데모 APK (테스트 로그인 켬) — 기본 프로필
pnpm android:build-apk
#   → artifacts/android/wooriai-0.0.0-release-standalone.apk

# 실 API APK
EXPO_PUBLIC_API_BASE_URL="https://api.내도메인.kr/api/v1" pnpm android:build-apk --profile production
#   → artifacts/android/wooriai-0.0.0-release-production.apk
```

- `android/` 디렉터리는 gitignore예요. 없으면 `npx expo prebuild --platform android`로 먼저 생성하세요.
  생성물을 손으로 고치지 마세요 — config plugin이 자동으로 패치해요(CLAUDE.md 규칙).
- 이 APK들은 **debug 키로 서명**돼요. 스토어에는 못 올리고, 실기기 확인용이에요.

---

## 5. 스토어용 AAB — 두 경로 비교

| | EAS `production` 프로필 | 로컬 `pnpm android:build-aab` |
|---|---|---|
| 명령 | `eas build -p android --profile production` | `WOORIAI_UPLOAD_KEYSTORE=... pnpm android:build-aab` |
| 서명 키 | **EAS가 생성·보관** (권장) 또는 내 keystore 업로드 | 내 keystore 파일 (env로 경로·비밀번호 전달) |
| 키 분실 위험 | 낮음(EAS 서버에 보관, 내려받기 가능) | 내가 백업 안 하면 **앱 영구 업데이트 불가** |
| 필요한 env | `WOORIAI_APP_VERSION`, `WOORIAI_ANDROID_VERSION_CODE`, `EXPO_PUBLIC_API_BASE_URL` (EAS 환경변수) | 위 3개 + `WOORIAI_UPLOAD_KEYSTORE(_PASSWORD)`, `WOORIAI_UPLOAD_KEY_ALIAS`, `WOORIAI_UPLOAD_KEY_PASSWORD` |
| 사전 검증 | **fail-closed 관문 없음** — §3-1의 키 표를 `eas env:list --environment production`으로 대조하고, 레포 쪽은 `pnpm check:env --scope=mobile`로 점검 | `pnpm android:build-aab -- --check` 로 env·prebuild·서명 주입까지 검사 (없는 키가 있으면 빌드 거부) |
| PC 준비물 | 없음 | JDK 17 + Android SDK |
| 업로드 | `eas submit -p android --profile production` 또는 파일 수동 업로드 | Play Console에 파일 수동 업로드 |

**서명 키를 어떻게 할까요?**

- *처음 출시라면* → EAS가 만들어 주는 키를 쓰는 게 제일 안전해요. `eas credentials`에서 언제든 내려받아 백업하세요.
- *이미 `$HOME/wooriai-release.keystore`를 만들어 뒀다면* → `eas credentials` → Android → *Keystore: Manage everything* →
  **Upload a keystore**로 올리면 EAS가 그 키로 서명해요.
  ⚠️ `WOORIAI_UPLOAD_*` env를 EAS 환경변수에 넣는 방식은 **동작하지 않아요.** EAS는 빌드 막바지에
  자체 자격증명 gradle 파일을 `app/build.gradle` 끝에 붙여 release 서명을 덮어쓰기 때문이에요(§6).
- Play App Signing을 쓰면 여기서 다루는 키는 "업로드 키"예요. 분실해도 Google에 재등록 요청이 가능하지만,
  그래도 **서로 다른 두 곳에 백업**해 두세요.

제출 절차(내부 테스트 → 심사)는 `docs/5차/launch-72h-plan.md` §4를 그대로 따르면 돼요.

---

## 6. 이 레포와 EAS의 정합 (확인한 내용)

`eas.json`을 이렇게 쓴 근거예요. 나중에 빌드가 깨졌을 때 어디를 보면 되는지 남겨 둬요.

- **prebuild는 EAS가 돌려요.** `android/`가 gitignore라 클라우드에 올라가지 않고, EAS는 그 경우
  `expo prebuild --no-install --platform android`를 실행해요. 즉 `apps/mobile/app.config.js` →
  `expo-config.shared.js` → `plugins/with-wooriai-android-release.js`가 그대로 타요.
  (네트워크 보안 설정, 모노레포용 `extraPackagerArgs --entry-file` 패치가 자동 적용돼요.)
  → `android/`를 실수로 커밋하면 EAS가 prebuild를 건너뛰고 이 패치들이 빠진 채 빌드돼요. 커밋 금지.
- **서명은 EAS가 마지막에 덮어써요.** EAS는 `android/app/eas-build-inject-android-credentials.gradle`을 만들어
  `build.gradle` 끝에서 `apply from:` 하고, `signingConfigs.release`와 `buildTypes.release/debug`의 서명을
  자기 자격증명으로 지정해요. 그래서 plugin이 넣는 `WOORIAI_UPLOAD_*` 기반 서명은 클라우드에선 무시돼요(§5).
- **프로젝트 루트는 `apps/mobile`이에요.** 그래서 expo-router의 앱 디렉터리는 기본값 `app/`으로 올바르게 잡혀요.
  루트 `app.config.js`의 `extra.router.root = "apps/mobile/app"`은 **모노레포 루트에서 돌리는 로컬 스크립트 전용**이라
  EAS 빌드에는 관여하지 않아요.
- **`EXPO_ROUTER_APP_ROOT`는 일부러 안 넣었어요.** `babel-preset-expo`가 번들 시점에 상수로 인라인하기 때문에
  env로 주는 값은 무시돼요(로컬 스크립트가 넘기는 값도 사실상 no-op이에요).
- **`NODE_ENV`도 일부러 안 넣었어요.** `eas.json`의 `env`는 의존성 설치 단계에도 적용돼서
  `NODE_ENV=production`을 넣으면 devDependencies가 빠져 빌드가 깨질 수 있어요. 릴리즈 빌드의 프로덕션 모드는
  gradle release variant가 알아서 잡아요.
- **패키지 매니저**: 루트 `package.json`의 `packageManager: pnpm@11.7.0` + lockfile v9를 EAS가 인식해요.
  혹시 pnpm 버전 때문에 설치가 깨지면 프로필에 `"pnpm": "11.7.0"` 또는 `"corepack": true`를 추가하면 돼요.
- **스키마 검증**: `eas.json`은 eas-cli가 쓰는 것과 같은 `@expo/eas-json`(22.0.0) joi 스키마
  (`allowUnknown: false`)로 통과를 확인했어요. 필드를 추가할 땐 같은 방식으로 검증하세요.
- **회귀 방지 테스트**: `apps/mobile/src/eas-cloud-build-profiles.test.ts` — 실사용자 프로필에 테스트 로그인이
  켜지지 않는지, APK/AAB 산출물 종류, API 주소·비밀값이 `eas.json`에 박히지 않았는지를 잠가 둬요.
  라운드 73 후속으로 하나가 더 붙었어요: `scripts/build-android-aab.ts`의 `RELEASE_REQUIRED_PUBLIC_ENV`를
  **소스에서 읽어**, 실사용자 프로필의 `env`가 덮지 않는 키마다 §3-1이 그 키를 **이름으로** 적고 있는지
  대조해요. 로컬 관문에 키가 늘면 이 문서가 먼저 빨개져요.
  (`pnpm --filter mobile test`에 포함돼요.)

---

## 7. 비밀값 취급 (필수)

- **레포에 커밋 금지**: keystore(`*.keystore`, `*.jks`), keystore 비밀번호, Play 서비스 계정 JSON, 카카오 시크릿.
  `.gitignore`가 `*.keystore`/`.env`를 막고 있지만, 최종 책임은 커밋하는 사람이에요.
- **keystore는 레포 밖**(`$HOME/wooriai-release.keystore`)에 두고 **두 곳 이상 백업**하세요.
- 진짜 비밀은 **EAS Secret**(`eas env:create` → Visibility: Secret) 또는 **`eas credentials`** 로만 넣어요.
  값을 이 문서나 커밋 메시지, 이슈에 붙여 넣지 마세요.
- `EXPO_PUBLIC_*`는 번들에 그대로 들어가요. **비밀을 `EXPO_PUBLIC_*`에 넣지 마세요.**
- 빌드 로그도 공유 전에 한 번 훑어보세요(URL·키가 찍혀 있을 수 있어요).

---

## 8. 자주 막히는 곳

| 증상 | 원인 / 해결 |
|---|---|
| `eas init`이 projectId를 못 써 넣어요 | 동적 설정(`app.config.js`) 때문이에요. §1-1처럼 `app.json`에 손으로 붙여 넣으면 끝이에요 |
| 빌드가 계속 대기 중이에요 | 무료 플랜 대기열이에요. 웹 빌드 페이지에서 순번을 확인하고 기다리세요 |
| APK 설치가 "앱이 설치되지 않았습니다"로 실패해요 | 서명이 다른 같은 패키지 앱이 이미 깔려 있어요. 기존 앱 삭제 후 설치 |
| 앱은 켜지는데 데이터가 안 나와요(무한 로딩) | `production-apk`인데 `EXPO_PUBLIC_API_BASE_URL`을 안 넣었어요(→ localhost). §3 |
| Play가 versionCode 중복이라고 거부해요 | `WOORIAI_ANDROID_VERSION_CODE`를 올리고 다시 빌드하세요 |
| 로컬 빌드가 `ANDROID_SDK_NOT_FOUND` / `JAVA_HOME_NOT_FOUND` | SDK·JDK 17 설치 후 `ANDROID_HOME`/`JAVA_HOME` 설정. 못 깔겠으면 §1(EAS)로 |
| prebuild 단계에서 gradle 앵커를 못 찾는다는 에러 | Expo/RN 템플릿이 바뀐 거예요. `plugins/with-wooriai-android-release.js`의 앵커 문자열을 맞춰야 해요 |

---

### 요약 (복붙용)

```bash
npm i -g eas-cli && eas login
cd apps/mobile && eas init          # 출력된 projectId를 app.json expo.extra.eas.projectId에 붙여넣기
eas build -p android --profile preview   # → 링크/QR로 APK 설치
```
