import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "../src/components/AdminShell";
import { AdminTokenProvider } from "../src/lib/admin-token-context";

export const metadata: Metadata = {
  title: "WooriAI Admin CMS"
};

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
