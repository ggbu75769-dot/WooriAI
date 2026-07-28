# WooriAI Local Self-Implement Blockers

갱신: 2026-07-27

## BLK-001 / Production Android identity·signing

- 분류: `EXTERNAL_DEPENDENCY`
- 현재: `com.anonymous.wooriai`, `0.0.0`, 내부 debug signing
- 영향: production AAB, Play internal track, store 판정 불가
- 해제: 승인된 application ID/versionCode/semver와 조직 소유 keystore/secret 경로

## BLK-002 / Pixel reference governance — 해결

- 분류: `RESOLVED`
- 현재 계약: 5탭 `홈 / 기록 / 준비템 / 리포트 / 더보기`
- 증거: 설치 Android 앱 adb screencap 9/9, 모든 점수 `<= 0.0500`
- 잔여: 물리기기 회귀는 별도 외부 gate

## BLK-003 / Physical Android·iOS qualification

- 분류: `EXTERNAL_DEPENDENCY`
- 현재: Android emulator 내부 증거만 존재, iOS native build/install 없음
- 영향: 실제 startup, TalkBack, safe area, 큰 글꼴, 실제 GPU 성능과 iOS 핵심 loop 미확정
- 해제: 지원 물리 Android/TalkBack 기기와 iOS signing/build 환경

## BLK-004 / Production services

- 분류: `EXTERNAL_DEPENDENCY`
- 현재: `pnpm release:config` 46개 차단, external readiness 6영역 `EXTERNAL_BLOCKED`
- 필요: production DB/Redis/storage, OAuth, push, recall, merchant, monitoring, legal URL/사업자 정보
- 원칙: credential 값은 증거에 기록하지 않고 secret storage로 주입

## BLK-005 / Catalog authorization

- 분류: `EXTERNAL_APPROVAL`
- 현재: 409개 `in_review`, 485개 evidence 모두 `draft`, 독립 검토 0, 게시 0
- 내부 완료: 12개 결정적 저위험 파일럿 큐, 승인자 분리, manifest 무결성, 발행 시 재검증
- 해제: 실제 작성자·editorial/domain 검토자·publisher와 고위험 전문 검토 근거
