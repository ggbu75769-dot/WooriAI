# UI Pixel Lock Mismatch Log

- Status: VISUAL QA NOT PROVEN
- Live browser screenshots compared: 9/9
- Reason: current diff artifacts still show material visual mismatch against the locked reference crops.

| Screen | Reference | Screenshot | Live proof | Diff | Iterations | Status | Remaining mismatch |
|---|---|---|---|---|---:|---|---|
| Splash / launch | 1_png_splash.png | splash.png (live-browser) | image-390x843; 390x843; http://localhost:8102/launch-animation | splash.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.0645 |
| Home | 1_png_home.png | home.png (live-browser) | image-430x798; 430x798; http://localhost:8102/(tabs) | home.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.1382 |
| Quick expense | 1_png_quick_expense.png | quick-expense.png (live-browser) | image-430x842; 430x842; http://localhost:8102/expenses/new | quick-expense.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.0899 |
| Recommendation | 2_png_recommendation_list.png | recommendation.png (live-browser) | image-390x842; 390x842; http://localhost:8102/items | recommendation.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.1217 |
| Product detail | 2_png_product_detail.png | product-detail-hero-flat.png (live-browser) | image-430x958; 430x958; http://localhost:8102/items/preview-diaper-party-pack?candidate=hero-flat | product-detail.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.1443 |
| Family | 2_png_family_invite.png | family.png (live-browser) | image-390x842; 390x842; http://localhost:8102/family | family.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.1139 |
| Excel preview | 2_png_excel_preview.png | excel-preview.png (live-browser) | image-390x1062; 390x1062; http://localhost:8102/import | excel-preview.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.0834 |
| Report | 2_png_report_detail.png | report.png (live-browser) | image-430x842; 430x842; http://localhost:8102/reports | report.png | 1 | VISUAL QA NOT PROVEN | Live browser screenshot still differs from reference crop; visual iteration required. pixelMismatchRatio=0.1185 |
| More / settings | 3_png_more_menu.png | more.png (live-browser) | image-390x842; 390x842; http://localhost:8102/more | more.png | 1 | PASS | Live browser screenshot is within the strict pixel-lock threshold. pixelMismatchRatio=0.0499 |

## Required next loop
- Capture live rendered Expo screenshots for each target route.
- Replace generated screenshots in docs/ui-pixel-lock/app-screenshots.
- Rerun pnpm ui:visual-diff and close critical/high mismatches.