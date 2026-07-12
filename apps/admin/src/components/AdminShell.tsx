"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AdminApiError,
  adminLogin,
  adminLogout,
  adminMfaSetupStart,
  adminMfaSetupVerify,
  adminVerifyMfaLogin
} from "../lib/admin-api";
import { useAdminSession } from "../lib/admin-token-context";
import styles from "./admin-shell.module.css";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/items", label: "준비템 관리" },
  { href: "/links", label: "상품 링크 관리" },
  { href: "/disclosures", label: "제휴 고지 문구" },
  { href: "/reviews", label: "콘텐츠 검토" },
  { href: "/clicks", label: "클릭 통계" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { session, isReady } = useAdminSession();
  const pathname = usePathname();

  if (!isReady) {
    return <div className={styles.loadingScreen}>불러오는 중...</div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  // SEC-101 §9: every admin must finish MFA registration before reaching the
  // rest of the CMS -- the API itself 403s any non-MFA route for an
  // unregistered admin, so the frontend routes straight to enrollment instead
  // of letting the admin hit that 403 on every click.
  if (!session.mfaEnabled) {
    return <MfaSetupScreen />;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>WooriAI 관리자 ({session.admin.email})</span>
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
  const { setSession, refresh } = useAdminSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Two-step login: password first, then (if the account has MFA enrolled) a
  // TOTP/recovery code using the short-lived `mfaToken` from step 1.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setSubmitError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await adminLogin(email.trim(), password);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        return;
      }
      setSession({ admin: result.admin, mfaEnabled: result.mfaEnabled });
    } catch (error) {
      setSubmitError(error instanceof AdminApiError ? error.message : "로그인하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mfaToken) return;
    if (!mfaCode.trim()) {
      setMfaError("인증 코드를 입력해 주세요.");
      return;
    }
    setMfaError(null);
    setMfaSubmitting(true);
    try {
      const result = await adminVerifyMfaLogin(mfaToken, mfaCode.trim());
      setSession({ admin: result.admin, mfaEnabled: result.mfaEnabled });
    } catch (error) {
      setMfaError(error instanceof AdminApiError ? error.message : "인증하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setMfaSubmitting(false);
    }
  };

  const backToPasswordStep = () => {
    setMfaToken(null);
    setMfaCode("");
    setMfaError(null);
    void refresh();
  };

  if (mfaToken) {
    return (
      <div className={styles.loginScreen}>
        <div className={styles.loginCard}>
          <h1>2단계 인증</h1>
          <p>인증 앱의 6자리 코드 또는 복구 코드를 입력해 주세요.</p>
          <form className={styles.loginForm} onSubmit={handleMfaSubmit}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="인증 코드 또는 복구 코드"
              className={styles.tokenInput}
            />
            {mfaError ? <p className={styles.errorText}>{mfaError}</p> : null}
            <button type="submit" className={styles.primaryButton} disabled={mfaSubmitting}>
              {mfaSubmitting ? "확인 중..." : "확인"}
            </button>
          </form>
          <button type="button" className={styles.legacyToggle} onClick={backToPasswordStep}>
            다시 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <h1>WooriAI 관리자</h1>
        <p>관리자 이메일과 비밀번호로 로그인하면 준비템, 상품 링크, 제휴 고지를 관리할 수 있어요.</p>
        <form className={styles.loginForm} onSubmit={handlePasswordSubmit}>
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
      </div>
    </div>
  );
}

/** SEC-101: forced enrollment screen shown whenever `session.mfaEnabled` is false. */
function MfaSetupScreen() {
  const { session, setSession, clearSession } = useAdminSession();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await adminMfaSetupStart();
        if (cancelled) return;
        setOtpauthUrl(result.otpauthUrl);
        setSecret(result.secret);
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(result.otpauthUrl);
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof AdminApiError ? error.message : "MFA 등록 정보를 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) {
      setVerifyError("인증 코드를 입력해 주세요.");
      return;
    }
    setVerifyError(null);
    setVerifying(true);
    try {
      const result = await adminMfaSetupVerify(code.trim());
      setRecoveryCodes(result.recoveryCodes);
    } catch (error) {
      setVerifyError(error instanceof AdminApiError ? error.message : "인증 코드를 확인하지 못했어요.");
    } finally {
      setVerifying(false);
    }
  };

  const finishSetup = () => {
    if (!session) return;
    setSession({ admin: session.admin, mfaEnabled: true });
  };

  const switchAccount = async () => {
    try {
      await adminLogout();
    } catch {
      // Best-effort: still clear client-side session state below even if the
      // logout call itself fails, so the admin isn't stuck here.
    } finally {
      clearSession();
    }
  };

  if (recoveryCodes) {
    return (
      <div className={styles.loginScreen}>
        <div className={styles.loginCard}>
          <h1>복구 코드를 저장해 주세요</h1>
          <p>인증 앱을 사용할 수 없을 때 로그인에 사용해요. 각 코드는 한 번만 사용할 수 있고, 이 화면을 벗어나면 다시 볼 수 없어요.</p>
          <ul className={styles.recoveryList}>
            {recoveryCodes.map((entry) => (
              <li key={entry} className={styles.recoveryCode}>
                {entry}
              </li>
            ))}
          </ul>
          <button type="button" className={styles.primaryButton} onClick={finishSetup}>
            저장했어요, 계속하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <h1>2단계 인증(MFA) 등록</h1>
        <p>처음 로그인한 관리자는 계속 진행하기 전에 2단계 인증을 등록해야 해요.</p>
        {loading ? <p className={styles.hint}>불러오는 중...</p> : null}
        {loadError ? <p className={styles.errorText}>{loadError}</p> : null}
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="MFA 등록 QR 코드" width={200} height={200} />
        ) : null}
        {secret ? (
          <p className={styles.hint}>
            QR을 스캔할 수 없다면 인증 앱에 수동 키를 입력해 주세요: <code>{secret}</code>
          </p>
        ) : null}
        <form className={styles.loginForm} onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="인증 앱의 6자리 코드"
            className={styles.tokenInput}
          />
          {verifyError ? <p className={styles.errorText}>{verifyError}</p> : null}
          <button type="submit" className={styles.primaryButton} disabled={verifying || !secret}>
            {verifying ? "확인 중..." : "등록 완료"}
          </button>
        </form>
        <button type="button" className={styles.legacyToggle} onClick={() => void switchAccount()}>
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

function LogoutButton() {
  const { clearSession } = useAdminSession();

  const handleLogout = async () => {
    try {
      await adminLogout();
    } catch {
      // Best-effort: clear the client-side session state either way so the
      // admin isn't stuck on a broken screen if the logout call itself fails.
    } finally {
      clearSession();
    }
  };

  return (
    <button type="button" className={styles.logoutButton} onClick={handleLogout}>
      로그아웃
    </button>
  );
}
