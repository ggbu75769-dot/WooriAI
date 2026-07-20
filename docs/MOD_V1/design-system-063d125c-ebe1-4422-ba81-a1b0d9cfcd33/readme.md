# 우리아이 (WooriAI) Design System

**우리아이** is a Korean family-life operations app: from pregnancy planning through school age, it helps guardians manage preparation items, purchases, ownership status, and family spending in one flow. Bottom tabs: **홈 / 기록 / 준비템 / 리포트**. Mobile-first (Expo/React Native), with an Admin surface and a public privacy web page.

**Design North Star:** 지금 무엇을 준비하고, 얼마를 썼으며, 다음에 무엇을 해야 하는지 한눈에 알게 한다.

## Sources
- GitHub: https://github.com/ggbu75769-dot/WooriAI (private; branch `master`) — mobile app `apps/mobile/` (theme.ts, ui.tsx, src/ui/*, app routes), API, docs. Explore it further to design against real screens.
- `uploads/wooriai-design-tokens-seed-v1.0.json` — v1.0 seed tokens (THE token source of this system)
- `uploads/WooriAI_Service_UX_DesignSystem_Blueprint_v1.0.md` / `.docx` — master blueprint: IA, lifecycle stages, P0 component inventory (§11), accessibility rules
- `uploads/WooriAI_Codex_AIM_Onboarding_Hardening_20260718.md` — onboarding 6-step contracts (12 prepared items, 3/4-col grid, ₩500,000 default budget)

Token values follow the **v1.0 seed** (brand `#C94627` Woori Coral primary action). The shipping code (`apps/mobile/src/theme.ts`) still uses a lighter coral scale (`#EF6644`, cream bg `#FFF8F1`) — kept as `--legacy-*` aliases. The user approved a light design refresh; the seed is the forward direction.

## CONTENT FUNDAMENTALS
- Language: Korean, polite **해요체** ("~해요", "~해 주세요"). Never formal 습니다체, never casual 반말.
- Warm, encouraging, family voice — "우리 아이에게 해준 것을 따뜻하게 기록해요.", "이번 달도 잘 관리하고 있어요 👏"
- Errors are apologetic + actionable, always preserve user input: "완료하지 못했어요. 입력은 보존되었으니 다시 시도해 주세요."
- Money: ALWAYS "1,234,000원" — comma-grouped, `원` suffix (no ₩), tabular numerals, `원` rendered one size step smaller. Income/refund only gets `+` prefix + success color.
- Emoji: sparingly, in friendly nudge copy only (👏 😥 🔔) — never as functional icons.
- No fake data: 0-record states get explanation + CTA, never fake charts or insights ("가짜 데이터 0").
- Clear state language: 알아보기→예정→주문→보유→대여→선물→교체→종료.
- Buttons are verb-first: "저장하고 계속", "이대로 시작하기", "다시 시도".

## VISUAL FOUNDATIONS
- **Color:** warm and calm, not childish. Canvas `--bg-canvas` #FFFDFC (warm off-white), white surface cards. One coral brand hue (#C94627 action / #E85F3B mid scale) + Care Sage support green. Status colors (info/success/warning/danger/review) always pair a `-50` surface with a `-600/700` content color; color is never the only state signal.
- **Type:** Pretendard Variable (CDN substitute — no binaries in repo; supply woff2 to replace). Single family, weight-driven hierarchy (700 headings, 400 body, 600–700 labels). Negative letter-spacing on large sizes. Korean text, generous line-heights (~1.45).
- **Spacing:** strict 4pt grid; screen padding 20/24/32dp by width; max content 720dp; card padding 16, gap 12.
- **Radii:** generous — sm 8 / md 12 / lg 16(cards) / xl 20 / 2xl 24, pill 999 for chips/badges. Code uses up to 22–28 (cards/sheets); stay in the 16–24 band.
- **Elevation:** LOW. Cards = white + 1px warm border + `--shadow-1` at most; overlays get `--shadow-overlay`. Shadows are warm-tinted rgba(33,30,28).
- **Backgrounds:** flat warm tints only — no gradients, no patterns, no full-bleed photos. Hero summary card is solid coral with white text + white progress bar on rgba-white track.
- **Illustration:** soft coral line/flat illustrations (baby, growth stages, family) in `assets/` — warm, rounded, minimal.
- **Motion:** fast and quiet — 120/180/240ms, cubic-bezier(0.2,0,0,1); crossfade-only under reduce-motion. No bounces.
- **Hover/press:** pressed = opacity ~0.85 or `-pressed` (darker) color token; disabled = `--action-disabled-bg` + `--action-disabled-text`. No scale transforms.
- **Touch targets:** ≥48dp always (blueprint; legacy code 44). Inputs 52, buttons 48/52, app bar 56, bottom nav 64.
- **Cards:** white surface, radius-lg 16, 1px `--border-default`, shadow-1, padding 16, inner gap 12.
- **Data viz:** chart series `--chart-1..6`; charts must ship with a same-source accessible table; data-maturity gating (no chart below 3 records).

## ICONOGRAPHY
- Official direction (blueprint §8): **MaterialCommunityIcons, single family** — linked via CDN (`@mdi/font`) in cards/kits. FLAGGED: the shipping code currently uses interim unicode glyphs (○□☆◇△, ▣▤▥) and two emoji; treat those as debt, use MDI names going forward.
- Category rows use a 40px circular tinted slot: `--cat-n` pastel background + darker glyph.
- Logo: `assets/logo_mark.png` (coral baby-face mark, from the repo) + typographic wordmark "우리아이" in Pretendard 800 coral. App icon `assets/app_icon.png` (heart-in-circle). No other marks exist; don't invent new imagery.

## Component inventory (from Blueprint §11 — P0/P1)
Shell: ScreenScaffold, TopAppBar, BottomNavigation, ChildContextSwitcher · Actions: Button, IconButton · Forms: TextField, MoneyField, DateField · Selection: RadioCard, CheckCard, FilterChip, StatusChip, SegmentedTabs · Content: Card, ListRow · Domain: MoneyText, BudgetSummary, PreparationItemCard, ItemStatusControl · Feedback: Skeleton, EmptyState, ErrorState, OfflineState, SyncStatusBar, Snackbar · Overlay: BottomSheet, Dialog · Data viz: PeriodNavigator, ChartContainer, AccessibleDataTable

## Index
- `styles.css` → `tokens/` (colors, typography, spacing, elevation, fonts)
- `assets/` — logo mark, app icon, growth/family illustrations, product illustrations
- `components/<group>/` — the inventory above, one `.jsx` + `.d.ts` + `.prompt.md` each
- `guidelines/` — specimen cards for the Design System tab
- `ui_kits/mobile/` — 우리아이 mobile app screens (login → onboarding → home → 준비템 → 리포트)
- `SKILL.md` — agent skill entry point
