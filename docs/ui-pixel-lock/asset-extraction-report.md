# UI Pixel Lock Asset Extraction Report

Created: 2026-07-06

## Extracted Assets

| Asset | Source Crop | Output | Intended Use |
| --- | --- | --- | --- |
| Baby logo mark | `asset_logo_mark` | `apps/mobile/assets/illustrations/logo_mark.png` | Brand/logo surfaces |
| Family illustration | `asset_family` | `apps/mobile/assets/illustrations/family.png` | Splash, empty state, emotional cards |
| Toddler illustration | `asset_toddler` | `apps/mobile/assets/illustrations/toddler.png` | Home recommendation and stage cards |
| Growth logo | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_logo.png` | Launch animation frame |
| Growth fetus | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_fetus.png` | Launch animation frame |
| Growth baby | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_baby.png` | Launch animation frame |
| Growth toddler | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_toddler.png` | Launch animation frame |
| Growth elementary | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_elementary.png` | Launch animation frame |
| Growth middle school | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_middle.png` | Launch animation frame |
| Growth high school | custom crop from `2.png` | `apps/mobile/assets/illustrations/growth_high.png` | Launch animation frame |
| Product diaper pack | product area from `2_png_product_detail` | `apps/mobile/assets/illustrations/product_diaper_pack.png` | Product detail hero image and commerce comparison context |
| Recommendation baby carrier | product thumbnail from `2_png_recommendation_list` | `apps/mobile/assets/illustrations/recommendation_baby_carrier.png` | Recommendation list first product thumbnail |
| Recommendation diaper | product thumbnail from `2_png_recommendation_list` | `apps/mobile/assets/illustrations/recommendation_diaper.png` | Recommendation list second product thumbnail |
| Recommendation blocks | product thumbnail from `2_png_recommendation_list` | `apps/mobile/assets/illustrations/recommendation_blocks.png` | Recommendation list third product thumbnail |

## Extraction Rules

- Crops are used only as illustration assets.
- No full reference screen is used as a UI background or fake implementation.
- The source crop map is stored in `docs/ui-pixel-lock/reference-crop-map.json`.
- Reference crop PNGs are stored in `docs/ui-pixel-lock/reference-crops/`.

## Current Assessment

The extracted assets are suitable for the first UI Reality Pass, launch animation route, product detail hero, and recommendation list thumbnails. Further refinement may crop additional category icons from the boards if screen-level visual QA shows empty or generic surfaces.
