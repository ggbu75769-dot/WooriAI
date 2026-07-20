# Start diff-stat evidence

## Start boundary

- Branch: `codex/sprint2-catalog-payments`
- HEAD: `db7a7a455afec892b8fa1205e477dbe507a5931d`
- Dirty status entries: `550`
- Full initial raw `git diff --stat`: `NOT_CAPTURED`

The missing raw start stat is not inferred from the final worktree. The shared tree already contained broad admin, API, mobile, infra, docs, asset, and release work, including untracked files that `git diff --stat` would not cover.

## Closeout comparison, not a start substitute

- Closeout status entries before this evidence set: `565`
- Closeout tracked diff: `164 files changed, 10222 insertions(+), 1904 deletions(-)`
- `git diff --check`: exit `0`; line-ending conversion warnings only.

These closeout numbers include pre-existing user changes and must not be treated as the onboarding patch size or as ownership evidence.
