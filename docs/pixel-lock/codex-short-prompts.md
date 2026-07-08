# Pixel Lock Short Prompts

## Tune One Screen
Run Android pixel tuning for IMP-003 only. Use adb screenshots. Protect SET-001. Accept only if score improves by >=0.0030 or crosses <=0.0500. Update progress doc.

## Run Full Android Gate
Run the full Android-native pixel lock gate. Use installed app plus adb screencap only. Update latest JSON/MD reports and summarize the score table.

## Fix Failed Screen
Fix SPL-001 using only real React Native/Expo components. Do not use screenshot backgrounds. Run target + SET-001 guard. Revert if worse.

## Revert Last Candidate
Revert the last unaccepted pixel-lock candidate. Preserve baseline and progress docs. Run target + SET-001 guard after revert.

## Final Release Check
Run Android full pixel lock and release:gate. Final answer must confirm adb screencap evidence, no browser final evidence, no screenshot-background cheating, and release:gate PASS.
