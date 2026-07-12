"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { adminLogin, AdminApiError } from "../lib/admin-api";
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
  const { token, isReady, isLegacyToken } = useAdminToken();
  const pathname = usePathname();

  if (!isReady) {
    return <div className={styles.loadingScreen}>불러오는 중...</div>;
  }

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>WooriAI 관리자{isLegacyToken ? " (개발용 토큰)" : ""}</span>
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

function LoginScreen() {
  const { setJwtToken, setLegacyToken } = useAdminToken();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyInput, setLegacyInput] = useState("");
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setSubmitError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await adminLogin(email.trim(), password);
      setJwtToken(result.accessToken);
    } catch (error) {
      setSubmitError(error instanceof AdminApiError ? error.message : "로그인하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLegacySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = legacyInput.trim();
    if (!trimmed) {
      setLegacyError("관리자 토큰을 입력해 주세요.");
      return;
    }
    setLegacyError(null);
    setLegacyToken(trimmed);
    setLegacyInput("");
  };

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <h1>WooriAI 관리자</h1>
        <p>관리자 이메일과 비밀번호로 로그인하면 준비템, 상품 링크, 제휴 고지를 관리할 수 있어요.</p>
        <form className={styles.loginForm} onSubmit={handleLogin}>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="관리자 이메일"
            className={styles.tokenInput}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            className={styles.tokenInput}
          />
          {submitError ? <p className={styles.errorText}>{submitError}</p> : null}
          <button type="submit" className={styles.primaryButton} disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <button
          type="button"
          className={styles.legacyToggle}
          onClick={() => setShowLegacy((current) => !current)}
        >
          {showLegacy ? "레거시 토큰 입력 닫기" : "레거시 토큰 입력 (개발용)"}
        </button>

        {showLegacy ? (
          <form className={styles.legacySection} onSubmit={handleLegacySubmit}>
            <p className={styles.legacyHint}>
              개발/테스트 환경에서만 동작하는 x-admin-token 공용 토큰이에요. 운영 환경에서는 사용할 수 없어요.
            </p>
            <input
              type="password"
              autoComplete="off"
              value={legacyInput}
              onChange={(event) => setLegacyInput(event.target.value)}
              placeholder="관리자 토큰"
              className={styles.tokenInput}
            />
            {legacyError ? <p className={styles.errorText}>{legacyError}</p> : null}
            <button type="submit" className={styles.primaryButton}>
              입장
            </button>
          </form>
        ) : null}
      </div>
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
