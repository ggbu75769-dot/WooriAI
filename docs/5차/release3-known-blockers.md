# Release 3 Known Blockers

Updated: 2026-07-15 (Asia/Seoul)

| Blocker | Current evidence | Required external action | Release impact |
| --- | --- | --- | --- |
| Production Android identity | `com.anonymous.wooriai`, version `0.0.0` | approve final package, semantic version, and version code | blocks Android public release |
| Android signing | no production keystore/signing secret | release owner provisions signing material outside Git | blocks signed AAB/store upload |
| Real Kakao OAuth | only local/mock credentials and callback contract | configure production app, exact redirect/deep links, keys and unlink permissions | blocks real OAuth E2E and M4 |
| Legal operator content | operator identity, final terms/privacy text and retention policy not approved | legal/operations owner supplies approved content and dates | blocks consent/legal release gate |
| Production URLs | privacy, terms, support, status and OAuth callback domains not approved | provision and verify HTTPS endpoints | blocks release gate/store listing |
| Cloud topology | provider and production PostgreSQL/Redis/object storage are undecided | choose infrastructure and inject secrets/config | blocks staging/production E2E |
| Backup/restore targets | no approved RPO/RTO or production backup target | operations owner approves targets and performs drill | blocks production release |
| Monitoring/alerts | no production vendor/collector/alert destinations | connect metrics/logs/crash adapter and verify alerts | blocks production observability proof |
| Android store track | fresh Android 15 AVD adb proof passes 9/9, but no Play access or store-delivered artifact exists | upload signed AAB to internal track and install that exact artifact | blocks M4/store provenance; local visual M3 is proven |
| Closed beta | no 7-day beta telemetry | run approved closed beta after staging gates | blocks public launch |
| Docker daemon | CLI present, daemon unavailable | optional: start Docker Desktop for container/Redis integration; portable PostgreSQL works locally | blocks Docker-local integration until recovered |
| Real Redis integration | publisher/worker and distributed controls are implemented, but no Redis instance was available | provision Redis and run crash/retry/dedupe/DLQ integration | blocks worker/runtime M3+ |
| External processors | S3 export, OAuth unlink, notification and crash/alert providers are adapters only | provision approved providers and staging secrets | blocks privacy/operations M4 |

No blocker above permits substituting placeholder values and claiming production readiness.
