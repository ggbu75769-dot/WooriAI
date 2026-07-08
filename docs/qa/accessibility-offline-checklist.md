# Accessibility And Offline Checklist

Batch: 11 - QA Release Hardening

## Accessibility

| Area | Check | Expected |
| --- | --- | --- |
| Touch targets | Buttons, toggles, and row actions are at least 44px high/wide. | No primary action is smaller than 44px. |
| Contrast | Primary text, secondary text, warnings, and danger actions are readable on the configured surfaces. | No critical copy relies on low contrast alone. |
| Screen-reader labels | Icon-only or terse actions have accessible labels in production UI passes. | Login, expense save, delete, purchase CTA, import confirm, settings delete are understandable. |
| Numeric alternatives | Report totals, budget amounts, and chart-like summaries have visible numeric text. | Users can understand totals without color or graph interpretation. |
| Error text | Validation and network failures provide direct action guidance. | Users know whether to retry, edit input, or contact support. |
| Destructive actions | Child delete, household leave, account delete use preview and second-step confirmation. | User sees impact scope before confirming. |

## Offline And Error States

| Area | Check | Expected |
| --- | --- | --- |
| Home | Disable network after loading home. | Cached data remains or a clear retry state appears. |
| Expense entry | Disable network before save. | Input is not silently lost; retry or error state appears. |
| Item detail | Disable network before product-link click. | User sees failure and purchase CTA disclosure is not hidden. |
| Import | Force upload/confirm failure. | Preview rows stay outside expenses until confirm succeeds. |
| Settings | Force delete-confirm failure. | Preview state remains and account/child is not deleted. |
| Admin CMS | Force admin write failure. | Admin surface shows failure; app runtime keeps prior item/link/disclosure value. |

## Manual Evidence Required

- Device screenshots or video for `QR-13` offline behavior.
- Device screenshots or accessibility audit notes for `QR-14`.
- Confirmation that destructive settings flows are separated from normal settings/profile editing.
