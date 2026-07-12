"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAdminToken } from "../lib/admin-token-context";
import styles from "./admin-shell.module.css";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/items", label: "준비템 관리" },
  { href: "/links", label: "상품 링크 관리" },
  { href: "/disclosures", label: "제휴 고지 문구" },
  { href: "/clicks", label: "클릭 통계" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { token, isReady, setToken } = useAdminToken();
  const pathname = usePathname();
  const [inputValue, setInputValue] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isReady) {
    return <div className={styles.loadingScreen}>불러오는 중...</div>;
  }

  if (!token) {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) {
        setSubmitError("관리자 토큰을 입력해 주세요.");
        return;
      }
      setSubmitError(null);
      setToken(trimmed);
      setInputValue("");
    };

    return (
      <div className={styles.loginScreen}>
        <form className={styles.loginCard} onSubmit={handleSubmit}>
          <h1>WooriAI 관리자</h1>
          <p>관리자 토큰(x-admin-token)을 입력하면 준비템, 상품 링크, 제휴 고지를 관리할 수 있어요.</p>
          <input
            type="password"
            autoComplete="off"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="관리자 토큰"
            className={styles.tokenInput}
          />
          {submitError ? <p className={styles.errorText}>{submitError}</p> : null}
          <button type="submit" className={styles.primaryButton}>
            입장
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>WooriAI 관리자</span>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <LogoutButton />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

function LogoutButton() {
  const { clearToken } = useAdminToken();
  return (
    <button type="button" className={styles.logoutButton} onClick={clearToken}>
      로그아웃
    </button>
  );
}
