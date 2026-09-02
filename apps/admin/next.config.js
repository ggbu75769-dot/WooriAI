/**
 * SEC-102 §3/§6: the admin web app proxies `/api/v1/*` to the NestJS API as a
 * same-origin rewrite (rather than the browser calling the API cross-origin).
 * This lets the `admin_session` HttpOnly cookie set by POST /admin/auth/login
 * be scoped to the admin app's own origin with a plain `SameSite=Lax` cookie —
 * no cross-site cookie config (`SameSite=None; Secure` + CORS credentials)
 * needed for local HTTP dev. `ADMIN_API_PROXY_TARGET` points at the API's own
 * origin (server-side only; not exposed to the browser).
 */
const API_PROXY_TARGET = process.env.ADMIN_API_PROXY_TARGET ?? "http://localhost:3000";

/**
 * SEC-102 §6 baseline security headers for the admin web app. The
 * Content-Security-Policy header itself is set per-request in middleware.ts
 * instead (it needs a per-request nonce for Next.js App Router's inline RSC
 * hydration scripts to work at all -- see the comment there). Setting a
 * second, non-nonce'd CSP here as well would not "layer" on top of it: when a
 * response carries multiple Content-Security-Policy headers, browsers
 * enforce the *intersection* of all of them, so a plain `script-src 'self'`
 * here would still block the nonce'd scripts middleware.ts allows.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * LP-D: `infra/docker/admin.Dockerfile`이 쓰는 self-contained 서버 번들
   * (`.next/standalone`) 출력. dev(`next dev`)와 일반 `next build` 결과물에는
   * 영향이 없고, 빌드 마지막에 standalone 디렉터리가 추가로 생성될 뿐이다.
   * 주의: standalone 빌드는 next.config.js를 **빌드 시점에** server.js 안으로
   * 직렬화하므로, 위 rewrites의 `ADMIN_API_PROXY_TARGET`은 컨테이너 이미지에는
   * 빌드 타임에 구워진다(admin.Dockerfile의 ARG 참조). 런타임 env로는 못 바꾼다.
   */
  output: "standalone",
  // pnpm 모노레포: 워크스페이스 루트를 명시해 standalone 파일 트레이싱이
  // 루트 node_modules/.pnpm의 실제 의존성까지 포함하도록 한다(자동 감지 경고 억제).
  outputFileTracingRoot: require("node:path").join(__dirname, "../.."),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" }
        ]
      }
    ];
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_PROXY_TARGET}/api/v1/:path*` }];
  }
};

module.exports = nextConfig;
