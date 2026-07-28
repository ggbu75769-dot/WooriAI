# Sprint 0 Android Pixel reference approval evidence

## Provenance

- Product and capture source commit: `0cf1e2189b342ff4a82a24947a9e3e52825a5b39`
- Build generated at: `2026-07-14T11:28:23.889Z`
- Build dirty state: `false`
- Build profile: `pixel-lock`
- APK SHA-256: `9295dfd7268a77210094f7d8750892f26e6d55335a4390e23c151f75e9927cfd`
- Package / version: `com.anonymous.wooriai` / `0.0.0`
- Capture method: installed embedded APK, `adb shell screencap -p`, then `adb pull`
- Full-resolution originals and hashes: `docs/ui-pixel-lock/native-screenshots/sprint0-0cf1e21/manifest.json`

## Fixed capture environment

- Device: `emulator-5554` (`sdk_gphone64_x86_64`), Android 15
- Viewport: `1080x2340`, density `440`, font scale `1.0`
- Navigation mode: `2`; status bar included in originals; comparison content crop: `0,136,1080,2138`
- Locale: `en-US`
- Initial state: app data reset with `adb pm clear` before the full nine-screen run
- Fixture: `EXPO_PUBLIC_PIXEL_LOCK=1`; Expo Router root `apps/mobile/app`

The three candidates below were produced from the recorded adb originals with the same comparison normalization used by the Android Pixel Lock runner. HOME and ITEM use `fill`; EXP uses `tailCropFill`. The other six reference images were not changed.

## HOME-001

- Screen ID: `HOME-001`
- Source commit: `0cf1e2189b342ff4a82a24947a9e3e52825a5b39`
- Old reference hash: `110fdfba97f3bcb96077840fcc82e266dc563b8bb98002bfa734879de110976b`
- New candidate hash: `67549c9961f276ac6f03ef901cf519ac868ecf215e5325585226d1fbffd3bdc5`
- Android device / viewport: `sdk_gphone64_x86_64` / `1080x2340`
- Change reason: approve the redesigned product surface instead of restoring duplicated navigation or demo-first content to match the retired reference.
- Product acceptance: Pixel fixture is isolated; the screen exposes profile and real child-switch entry points; four bottom tabs remain; budget-unset and zero are distinct in runtime logic; dead notification and duplicated shortcut UI are absent; KRW copy is consistent.
- Accessibility acceptance: visible controls retain text labels, selected navigation has both color and label state, and the captured Korean copy remains legible at font scale 1.0. This is project visual QA, not an external accessibility audit.
- Approver: Codex Android visual QA, applying the user's conditional approval direction for the redesigned HOME reference
- Approved at: `2026-07-14T20:37:38.9204453+09:00`

## EXP-001

- Screen ID: `EXP-001`
- Source commit: `0cf1e2189b342ff4a82a24947a9e3e52825a5b39`
- Old reference hash: `4a8ca7bb7832330a0b432c6f409983d6061b780aadbe10940f88afab2d611995`
- New candidate hash: `a8516032c3dc5b948926b6aa4fd106cd78b5ac51fa417c5548d8bf58c826fce7`
- Android device / viewport: `sdk_gphone64_x86_64` / `1080x2340`
- Change reason: approve the redesigned quick-record hierarchy with quick items separated from categories and optional details collapsed.
- Product acceptance: quick items and categories are distinct; invalid mixed categories and the unusable Kakao default are absent; payment defaults to unknown; item and amount are the required save inputs; additional metadata remains optional; save-button readiness is explicit in source and regression tests.
- Accessibility acceptance: item/category buttons use readable labels, selection is not communicated by text omission, and the primary save action remains visually distinct. This is project visual QA, not an external accessibility audit.
- Approver: Codex Android visual QA, applying the user's conditional approval direction for the redesigned EXP reference
- Approved at: `2026-07-14T20:37:38.9204453+09:00`

## ITEM-001

- Screen ID: `ITEM-001`
- Source commit: `0cf1e2189b342ff4a82a24947a9e3e52825a5b39`
- Old reference hash: `15360988530a605fcdee910e45043c6a38e0ee270c95ae95a8d292aa8c1a2c14`
- New candidate hash: `1194dbcc72c9c175264b68a3ecf864c212a5c85f50e597e161ef67161954be6a`
- Android device / viewport: `sdk_gphone64_x86_64` / `1080x2340`
- Change reason: approve the redesigned status-first list that presents necessity and preparation timing before commerce details.
- Product acceptance: status tabs are the primary structure; the real child stage is the production default; age chips are secondary preview filters; fake ratings, review counts, BEST, cart, and heart actions are absent; `필요 없어요` is used; cards lead with necessity, timing, and state.
- Accessibility acceptance: status and stage choices have visible text, active states remain distinguishable, the profile entry is visible, and all four tab labels render in the installed app capture. This is project visual QA, not an external accessibility audit.
- Approver: Codex Android visual QA, applying the user's conditional approval direction for the redesigned ITEM reference
- Approved at: `2026-07-14T20:37:38.9204453+09:00`

## Approval boundary

This record documents Android evidence inspection and the user's stated conditional approval policy. It does not claim an independent named human review. Final approval remains conditional on the post-reference Android Pixel Gate reaching 9/9 at `<= 0.0500`, the Release Gate reaching 11/11, and a clean working tree.
