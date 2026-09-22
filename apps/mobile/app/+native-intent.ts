/**
 * OAuth codes belong to the pending Linking listener, never to a screen route.
 * Keep the existing login screen mounted while it exchanges the code. A cold
 * launch returns to login to restart, since its PKCE verifier was only in memory.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  const destination = path.split(/[?#]/)[0];
  if (destination === "wooriai://oauth/kakao" || destination === "/oauth/kakao") {
    // Expo Router skips an empty rewritten href; its separate Linking subscriber
    // still receives the original event, so the pending login never unmounts.
    return initial ? "/(auth)/login" : "";
  }
  return path;
}
