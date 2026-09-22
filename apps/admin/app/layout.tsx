import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "../src/components/AdminShell";
import { AdminTokenProvider } from "../src/lib/admin-token-context";

export const metadata: Metadata = {
  title: "WooriAI Admin CMS"
};

// The CSP nonce is generated for each request. Prerendered HTML has no matching
// nonce, so production browsers block every script and leave the login loading.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AdminTokenProvider>
          <AdminShell>{children}</AdminShell>
        </AdminTokenProvider>
      </body>
    </html>
  );
}
