# Release 3 iOS 후속 범위

Android 우선 상태다. schema의 `OAuthIdentity`와 provider enum은 Apple을 수용하지만 실제 Sign in with Apple adapter, bundle id, iOS deep link/associated domains, signing/provisioning, App Store privacy manifest, TestFlight 검증은 없다.

후속 작업은 provider adapter 구현 → account deletion/unlink 공통 worker 검증 → iOS env release gate → bundle/signing → deep link/cold start → TestFlight real credential E2E 순서로 진행한다. Apple credential과 TestFlight 증적 전에는 iOS readiness를 미완료로 보고한다.
