# Release 4C local staging evidence

## Classification

Result: **LOCAL_STAGING_PARITY**, not external staging.

## Topology

- PostgreSQL 15 on 55432
- Redis 7 on 56379
- MinIO on 59000/59001
- API replicas on 53100 and 53101
- Worker replicas: 2
- Publisher: 1
- Admin on 53102
- mock OAuth and mock notification provider

Final API image: `sha256:e2a910e2207b3445edbf1b5d8bbab07425b4abe5e98b292a5326ed2c97ffd175`. Both API replicas, both workers and the publisher were recreated from this image.

## Verified behavior

- API replicas 53100/53101 both returned HTTP 200, `X-Config-Source: database`, configVersion 1 and the same updatedAt value.
- Mock OAuth replay/nonce behavior and cross-replica session flow passed automated/local integration checks.
- Distributed rate limit, outbox duplicate delivery/DLQ, worker kill/restart and scheduled catalog publish race were exercised.
- Due catalog publishing revalidated revision/hash/role/approvals and produced one publish event in the isolated local staging database.
- Production user catalog endpoints remained published-only; internal preview was explicit and non-production.

## Backup/restore drill

- Backup: `artifacts/db-backups/release4c-local-staging-31-migrations.sql`
- SHA-256: `5B25EDE91379ABB849A361821F76B34C1EADD92316A2144455E93ACE9412BEA6`
- Size: 2,629,924 bytes
- Restored to a new database after representative source mutations.
- Restored checks: expense total 123,456; plan budget 150,000; published item 1; approvals 2; outbox rows 2; migration count 31.

The source staging database was deliberately mutated after backup to distinguish restore truth from current source state.

After evidence capture, only the isolated `wooriai-release4c` stack was brought down without `-v`; its named volumes were not deleted. The separate `wooriai-local` stack was left running.
