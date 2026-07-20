# SI-001 Baseline Evidence

- captured: 2026-07-20 01:00 KST
- branch / HEAD: `codex/sprint2-catalog-payments` / `db7a7a455afec892b8fa1205e477dbe507a5931d`
- starting dirty: 929; staged 0; all preserved
- baseline code result: existing mobile suite PASS, 79 files / 450 tests
- verified gap: existing slow-create interleaving test requires an explicit later `flushOutbox()` after the concurrent edit; the actual concurrent second caller shares the first fixed-snapshot Promise and does not drain the appended update.
- expected red test: exactly two concurrent caller invocations should finish with create + appended update both sent, but current code will report one synced mutation and leave one update queued.
