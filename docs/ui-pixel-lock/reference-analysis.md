# UI Pixel Lock Reference Analysis

Created: 2026-07-06

## Source Images

All four required reference images were found under `docs/0_원본아이디어`.

| Image | Resolution | Role | Primary Locked Signals |
| --- | ---: | --- | --- |
| `1.png` | 1491x1055 | Main concept board | Brand mark, growth-stage strip, splash, onboarding, home, quick expense, recommendation, report |
| `2.png` | 1491x1055 | Launch animation storyboard | Sequential logo-to-growth animation ending on home |
| `3.png` | 1491x1055 | Service screen lineup | Home, quick expense bottom sheet, recommendation list, product detail, family invite, Excel preview, report detail |
| `4.png` | 1491x1055 | Design system board | Colors, typography, icons, component shapes, bottom nav, toast, empty state, mini samples |

## Visual System

- Background is warm ivory, not pure white or gray.
- Primary action color is coral. The existing Phase 4 token `#FF8A7A` is preserved, and the Pixel Lock layer adds stronger image-derived coral `#FF6B52` for hero/CTA surfaces.
- Cards use white or soft peach/mint surfaces with large 20-24px radii, low-contrast borders, and subtle shadows.
- Typography is clear and rounded in feeling: large numeric values, compact captions, and bold headings.
- The baby-line logo is a coral outline mark inside a rounded white square.
- Illustrations are warm, soft, and family-centered. Cropped reference assets are allowed only as illustrations, not as full-screen background cheats.
- Bottom navigation follows the image-locked visual set: `홈 / 기록 / 추천 / 리포트 / 더보기`. The underlying `items` route and ITEM screen IDs are preserved; the UI label is `추천`.
- The quick expense surface is a bottom-sheet style interaction with a large amount field, rounded category chips, memo/payment rows, and a coral save CTA.
- Product detail must keep purchase CTAs adjacent to affiliate disclosure copy.

## Image-by-Image Notes

### 1.png

The concept board sets the overall product personality: “우리아이” as a warm child-care companion, not a generic ledger. The key screens share a tall mobile card format, ivory background, coral hero CTAs, rounded cards, small line icons, and an emotional family/child illustration layer. Home has the strongest hierarchy: child avatar header, coral monthly-spend card, quick actions, recommendation card, recent expense list, bottom nav, and centered plus button.

### 2.png

The launch storyboard is an 8-frame growth sequence: logo, fetus, baby, toddler, elementary, middle school, high school, home. Motion keywords from the board are soft expansion, shape transition, warm gaze, natural transition, fade, and slide. The implementation should use sequential animation or a frame/asset fallback, with skip available and home/login transition at the end.

### 3.png

This is the closest screen lineup reference. It fixes the “real app” look for home, bottom sheet, recommendation list, product detail, family invite, Excel preview, and report detail. The UI must avoid flat placeholder boxes. Product cards need image areas, price/rating/badges, and CTAs. Report cards need real chart shapes and numeric values.

### 4.png

The design-system board fixes reusable primitives: buttons, inputs, segmented controls, chips, cards, hero card, list rows, chart cards, bottom nav, bottom sheet, toast, and empty state. Inline one-off card styling should be replaced by shared UI primitives as screens are refreshed.

## Crop Inventory

`docs/ui-pixel-lock/reference-crop-map.json` defines 28 crop anchors. Generated crop PNGs are stored in `docs/ui-pixel-lock/reference-crops/`.

Minimum required crop IDs from the prompt are present:

- `1_png_splash`
- `1_png_onboarding`
- `1_png_home`
- `1_png_quick_expense`
- `1_png_recommendation`
- `1_png_report`
- `1_png_growth_strip`
- `2_png_home`
- `2_png_quick_expense_bottom_sheet`
- `2_png_recommendation_list`
- `2_png_product_detail`
- `2_png_family_invite`
- `2_png_excel_preview`
- `2_png_report_detail`
- `3_png_design_system`
- `3_png_components`
- `3_png_mobile_samples`
- `4_png_animation_logo`
- `4_png_animation_fetus`
- `4_png_animation_baby`
- `4_png_animation_toddler`
- `4_png_animation_elementary`
- `4_png_animation_middle`
- `4_png_animation_high`
- `4_png_animation_home`

Additional extracted asset crops:

- `asset_logo_mark`
- `asset_family`
- `asset_toddler`

## Implementation Implications

1. Add a reusable mobile UI layer for Pixel Lock tokens, screen shell, buttons, cards, chips, hero card, bottom sheet frame, list rows, chart cards, and affiliate disclosure.
2. Refresh visible Korean labels to match the boards and remove old “준비템” tab copy from the visual nav.
3. Use extracted illustration assets in splash/home/recommendation surfaces while avoiding full-screen screenshot replacement.
4. Add screenshot and diff commands before claiming visual PASS.

