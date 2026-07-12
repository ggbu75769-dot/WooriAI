# Round 5A APK 빌드 노트 (Sprint 1+2 반영본)

작성: 2026-07-13 · 브랜치: codex/source-audit-standalone-apk (Sprint 2 커밋 82567d0 기준)

## 산출물

| 항목 | 값 |
|---|---|
| APK | `artifacts/android/wooriai-0.0.0-release-standalone.apk` |
| SHA-256 | `e0b2fabb654c9f23bc1140f522de2a9460c0f9a9c5a96ffab27bbe8b0e515816` |
| 크기 | 75,308,956 B (라운드4 64.7MB → expo-sqlite/expo-network/신규 화면 추가로 증가) |
| 프로파일 | standalone (`EXPO_PUBLIC_TEST_LOGIN=1`, `EXPO_PUBLIC_PIXEL_LOCK=0`, `NODE_ENV=production`) |
| 서명 | debug keystore — 테스트 설치 전용, 스토어 배포 불가 (REL-002에서 교체) |
| 빌드 | `assembleRelease`, JDK 17.0.19, Gradle 8.10.2 |

## 이번에 수정한 빌드 구성 (중요 — android/는 gitignore라 재적용 필요)

`apps/mobile/android/`는 prebuild 산출물로 git 미추적이다. `expo prebuild --clean` 후에는 아래 두 가지를 다시 적용해야 한다.

### 1. `apps/mobile/android/app/build.gradle`의 react 블록
라운드4 구성(root=workspaceRoot)은 expo config plugin(expo-router)을 저장소 루트에서 해석하다 실패한다
(당시엔 루트 node_modules 잔재 덕에 우연히 동작). 올바른 구성:

```groovy
react {
    root = file(projectRoot)                    // 앱 루트 = expo config 위치
    entryFile = file("${projectRoot}/index.js")
    ...
    // RN gradle plugin은 entry를 root 기준 상대경로(./index.js)로 넘기는데,
    // expo/metro는 모노레포 serverRoot(저장소 루트) 기준으로 해석해 실패한다.
    // expo CLI는 중복 옵션에서 마지막 값을 쓰므로 절대경로로 덮어쓴다.
    extraPackagerArgs = ["--max-workers", "1", "--entry-file", "${projectRoot}/index.js"]
}
```

### 2. `.gradle-home/gradle.properties` (메모리 16GB 미만 빌더 안정화)
```properties
org.gradle.daemon=false
org.gradle.workers.max=1
org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=384m
kotlin.daemon.jvmargs=-Xmx768m
```
데몬 크래시(errno 1455, 페이징 파일 부족) 재발 방지. 잔여 kotlin 데몬 java 프로세스가 있으면 종료 후 빌드.

### 3. 알려진 함정
- `pnpm install --filter <pkg>`는 다른 워크스페이스의 호이스트 링크를 정리할 수 있다. 빌드 전 루트에서 전체 `pnpm install` 권장.
- `scripts/build-android-apk.ts`의 spawnSync timeout은 20분 — 데몬 미사용 저메모리 빌드는 이를 초과할 수 있어 이번엔 gradlew 직접 실행으로 우회했다. 스크립트 timeout 상향은 후속 정리 대상.

## 포함된 변경 (라운드4 APK 대비)
Sprint 1: 아이템 상세 이유/스킵 노출, 온보딩 이어하기(ONB-006), 오프라인 outbox·동기화 상태(EXP-005)·충돌 해결 UI, 지출 version 낙관적 동시성.
Sprint 2: 링크 열기 실패 공유/재시도 폴백, 분석 클라이언트(opt-in 기본 OFF — 동작 없음).
서버 의존 기능(카카오 OIDC, CMS, redirect)은 standalone 프로파일의 로컬 데모 백엔드 범위 밖.
