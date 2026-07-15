# Release 3 External Actions

Generated: 2026-07-15 (Asia/Seoul)

| Owner action | Required input | Blocks | Verification after completion |
| --- | --- | --- | --- |
| approve Android identity | final package, version, monotonically increasing versionCode | production config/AAB | `pnpm release:config`; `pnpm android:build-aab` |
| provision signing | external keystore, alias, password secret references | signed AAB/store | AAB checksum/signature verification |
| configure Kakao | production client, exact callbacks/deep link, unlink permission | real OAuth/unlink E2E | staging login/replay/unlink tests |
| approve legal content | operator identity, terms/privacy versions, retention/deletion/export text | legal/store gate | public URLs and consent hash smoke |
| provision HTTPS endpoints | API, privacy, terms, support, status, OAuth callback | production config/store listing | TLS/route smoke and mobile deep link |
| choose infrastructure | PostgreSQL, Redis, S3-compatible storage, secrets, egress policy | worker/privacy/staging | provider integration and failover tests |
| connect notification/crash/metrics | provider credentials and alert destinations | operational readiness | synthetic delivery/crash/alert test |
| approve backup objectives | RPO/RTO, backup target, incident owners | M6/release | isolated restore and rollback drills |
| provide Play access | internal track and tester group | store provenance | install Play-delivered signed AAB |
| run closed beta | at least seven days with S0/S1=0 and monitored metrics | public launch | signed beta report and go/no-go review |

No credential, legal text, production topology, or signing material should be committed to this repository. Inject secrets through the approved production secret manager and keep only variable names/references in source control.
