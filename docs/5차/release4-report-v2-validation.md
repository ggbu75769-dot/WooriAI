# Release 4 Report V2 validation

## Contract

- Server owns month, quarter, year and explicit-range boundaries.
- Date contract is KST (`Asia/Seoul`), KRW, `periodStart` inclusive and
  `periodEndExclusive` exclusive.
- Expense, refund, gift and support are distinct. Net household outflow counts
  expense positively, refund/support negatively, and gift as zero household
  outflow.
- Summary, category breakdown and chart series derive from the same scoped
  ledger query (`spentOn >= start AND spentOn < endExclusive`).
- Month/explicit ranges use daily series; quarter/year use monthly series.
- Category percentages are calculated from non-negative category net outflow and
  close to 100% through deterministic remainder handling.
- Empty/sparse/category/trend/recurring/member/annual visibility is driven by the
  returned `dataMaturity`; unverified insight copy is not generated.

## Evidence

The shared contract exposes `periodStart`, `periodEndExclusive`, `timezone`,
`currency`, `expenseTotal`, `refundTotal`, `giftTotal`, `supportTotal`,
`netOutflow`, `categoryBreakdown`, `series`, and `dataMaturity`. The API E2E suite
passes calendar month, quarter, leap-year and year boundary cases, aggregation
parity, access/range rejection and canonical preparation linkage. API, contracts,
mobile type checks and the full release gate pass.

## Remaining validation gap

No real multi-user staging ledger, production timezone telemetry or production
large-history performance run was available. This is a local contract/E2E pass,
not production validation.

