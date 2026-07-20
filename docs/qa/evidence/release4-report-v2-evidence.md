# Release 4 Report V2 evidence

## Correctness contract

- The API derives month, quarter, and year boundaries in `Asia/Seoul` and returns
  explicit `periodStart`/`periodEnd`.
- Overview, category table/chart, trend, contributors, and preparation cost use
  the same filtered ledger and period.
- Expense, refund, gift, and support/subsidy totals are distinct; `netOutflow` is
  derived rather than copied from a decorative metric.
- Zero records render an actionable empty state and no chart. One or two records
  show totals/recent data; distributions and trends appear only at their stated
  maturity thresholds.
- The chart model and accessible table/list consume the same response arrays.
- Money uses the shared `1,234,000원` formatter.

## Verification

| Check | Result |
| --- | --- |
| KST month/quarter/year including month/year boundary and leap-year cases | PASS automated |
| Refund/gift/support separation | PASS API E2E |
| Category sum and overview ledger consistency | PASS API E2E |
| Chart model equals table model | PASS contracts/mobile tests |
| Empty/1/2/3+ maturity behavior | PASS source/component tests; empty and one-record installed captures |
| Production report root transform/scale | 0; Pixel-only style is harness isolated |
| Android widths 320/360/390/411/430/600/840 | PASS report captures; no observed overflow/clipping |
| Font scale 1.3/1.5 | PASS report captures; controls and CTA remained reachable |
| Pixel `REP-001` | PASS, score 0.046080 |

Installed standalone captures include month, quarter, year, and empty report under
`artifacts/android/release4-installed/`. Responsive captures are under
`artifacts/pixel-lock/android/report-responsive-matrix/`.

The margin/overflow conclusion is based on the common full-width scaffold, equal
horizontal padding source contract, UI hierarchy bounds, and visual inspection of
the installed ADB captures. It is not a browser screenshot claim.
