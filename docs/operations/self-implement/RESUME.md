# WooriAI Local Self-Implement Resume

갱신: 2026-07-27

## 완료된 내부 상태

- Release Gate: isolated catalog audit 포함 16/16 PASS
- Android Pixel Lock: 설치 앱 adb screencap 9/9 PASS
- 일반 standalone 준비템·지출 흐름: 설치 검증 완료
- 카탈로그 fresh/upgrade DB: 41 migrations PASS
- 기본 `pnpm catalog:audit`: 격리 DB 생성·감사·정리 PASS
- 저위험 12개 파일럿 계획과 승인·manifest·transactional publish 경로 구현
- production config와 external readiness는 fail-closed 진단 완료

## 다음 실행에 필요한 외부 입력

1. Android application ID, semver/versionCode
2. 조직 소유 release keystore/alias와 secret 주입 경로
3. production API/PostgreSQL/Redis/object storage
4. Kakao OAuth, push, recall, merchant provider 자격증명
5. privacy/terms/support/status URL과 법적 운영자 정보
6. 파일럿 작성자, editorial reviewer, domain reviewer, publisher 계정
7. 물리 Android/TalkBack 및 iOS build/install 환경

## 입력 제공 후 순서

`pnpm release:config` PASS → `pnpm release5:external-readiness` READY → signed AAB → catalog 12개 독립 승인·게시 → staging smoke/restore drill → 물리기기 회귀 → store internal track

## 보존 규칙

- 현재 작업 트리는 staged 0이며 커밋·푸시되지 않았다.
- 최종 APK는 `F:/WooriAI` 루트에만 둔다.
- fixture/Pixel 통과를 일반 사용자 흐름 통과로 대신하지 않는다.
- 운영값이나 독립 승인을 임의 생성하지 않는다.
