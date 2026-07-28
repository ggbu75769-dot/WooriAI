# Release 4C route and accessibility matrix

## Manifest

`apps/mobile/e2e/release4c-route-scenarios.json` contains 37 routes x 9 scenario classes = 333 classified entries.

| Classification | Count |
| --- | ---: |
| Code present, runtime verification required | 116 |
| Runtime verification required | 52 |
| Not applicable with reason | 165 |
| Runtime-passed cells recorded in manifest | 0 |

The layout matrix covers widths 320/360/390/411/430/600/840 dp, font scales 1.0/1.3/1.5 and Android 13/14/15, for 63 combinations. These combinations are declared but not all executed.

## Runtime evidence obtained

- Android 15, 1080x2340, density 440.
- Valid adb Pixel captures for nine locked routes: all PASS <=0.0500.
- Standalone fresh install/test login/onboarding/home/preparation/report and process restart.
- Family interactive control touch area was enlarged with hitSlop; source checks cover labels/roles/states and candidate touch targets.

## Not yet proven

All 37 routes across normal/loading/empty/error/offline/permission/long content/large values/list states; 320-840 dp; font scale 1.3/1.5; TalkBack traversal/focus restore; keyboard/modal overlap; Android 13/14. Therefore full installed-app accessibility acceptance remains open P2.
