// Type surface for with-wooriai-android-release.js (plain CJS expo config plugin) so
// TypeScript consumers — currently only src/android-release-aab.test.ts — typecheck
// without enabling checkJs. (expo-config.shared.d.ts와 같은 방식.)

/** REL-011: app/build.gradle 문자열에 업로드 서명(signingConfigs.release)을 주입한다(멱등). */
export function injectUploadSigning(gradle: string): string;

/** REL-011: prebuild 시점 env로 서명 주입 여부를 결정한다. */
export function shouldInjectUploadSigning(env?: Record<string, string | undefined>): boolean;

export function injectPackagerArgs(gradle: string): string;
export function applyNetworkSecurityManifest<T extends { application?: Array<{ $: Record<string, string> }> }>(
  manifest: T
): T;
export const NETWORK_SECURITY_CONFIG: string;

/** REL-009/REL-011 안드로이드 릴리즈 config plugin 본체. */
export default function withWooriaiAndroidRelease(config: unknown): unknown;
