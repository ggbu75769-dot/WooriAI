# Release 4 responsive and accessibility evidence

## Android evidence matrix

The report route was captured from the installed standalone APK with ADB shell
`screencap` at logical widths 320, 360, 390, 411, 430, 600, and 840 dp. Font-scale
captures were made at 1.3 and 1.5. Each matching UI hierarchy contains the report
title, period controls, empty-state CTA, and four-tab navigation.

| Matrix | Result | Evidence |
| --- | --- | --- |
| Widths 320-840 | PASS for report; no observed clipping, overlap, or horizontal overflow | `artifacts/pixel-lock/android/report-responsive-matrix/report-w*.png/xml` |
| Font 1.3/1.5 | PASS for report core flow | `report-font-1_3.*`, `report-font-1_5.*` |
| Android 15 installed core flows | PASS | `artifacts/android/release4-installed/` |
| Nine reference screens | 9/9 valid PASS; worst 0.048747 | `artifacts/pixel-lock/android/reports/latest.json` |
| Vector navigation/category icons | PASS source contract, Unicode literals 0 | `release4-ui-route-inventory.json` |
| Core controls >=48dp | PASS source contract | same inventory |
| Color-only core states | Status chips pair label and color | source tests/inventory |

The 320 and 840 captures and both large-font captures were visually inspected.
The matrix does not prove every state of every route, screen-reader traversal on
physical hardware, or tablet multitasking. The source scanner lists 35 possible
sub-48 numeric candidates; these include non-interactive spacing/decoration and
must be manually classified before claiming exhaustive zero across the whole app.
