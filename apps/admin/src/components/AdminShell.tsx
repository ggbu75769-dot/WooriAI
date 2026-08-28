"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AdminApiError,
  adminChangePassword,
  adminLogin,
  adminLogout,
  adminMfaDisable,
  adminMfaSetupStart,
  adminMfaSetupVerify,
  adminVerifyMfaLogin,
  type AdminRole
} from "../lib/admin-api";
import { useAdminSession } from "../lib/admin-token-context";
import styles from "./admin-shell.module.css";

// `roles` omitted = visible to every signed-in role. ADM-006: the admin-account
// page is admin-only, so it's hidden from editor/analyst sessions here (the
// page itself also renders an access notice, and the API enforces the role).
const NAV_ITEMS: Array<{ href: string; label: string; roles?: AdminRole[] }> = [
  { href: "/", label: "홈" },
  { href: "/items", label: "준비템 관리" },
  { href: "/links", label: "상품 링크 관리" },
  { href: "/disclosures", label: "제휴 고지 문구" },
  { href: "/reviews", label: "콘텐츠 검토" },
  { href: "/clicks", label: "클릭 통계" },
  { href: "/analytics", label: "분석" },
  // ADM-127: 카테고리 관리는 조회가 모든 역할에 열려 있어(수정만 admin) 메뉴도 전원에게 보인다.
  { href: "/categories", label: "카테고리 관리" },
  // ADM-127: 사용자 조회는 개인정보를 다뤄 API가 admin 전용이라 나머지 역할에는 숨긴다.
  { href: "/users-lookup", label: "사용자 조회", roles: ["admin"] },
  { href: "/users", label: "관리자 계정", roles: ["admin"] },
  // ADM-113: 감사 로그 뷰어 — API가 admin 전용이라 나머지 역할에는 숨긴다.
  { href: "/audit-logs", label: "감사 로그", roles: ["admin"] }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { session, isReady } = useAdminSession();
  const pathname = usePathname();
  // ADM-007: 계정 영역(헤더)에서 여는 폼 토글. GAP-063 #3이 "인증 앱 다시 등록"을 같은
  // 자리에 더하면서, 두 폼이 동시에 열리지 않도록 하나의 상태로 합쳤다.
  const [accountPanel, setAccountPanel] = useState<"password" | "mfa" | null>(null);
  const togglePanel = (panel: "password" | "mfa") => setAccountPanel((open) => (open === panel ? null : panel));

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
          {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(session.admin.role)).map((item) => {
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
        <button type="button" className={styles.logoutButton} onClick={() => togglePanel("password")}>
          비밀번호 변경
        </button>
        {/* GAP-063 #3: 인증 앱을 잃었을 때의 유일한 복구 입구. 비밀번호 변경과 같은 모양·같은 자리. */}
        <button type="button" className={styles.logoutButton} onClick={() => togglePanel("mfa")}>
          인증 앱 다시 등록
        </button>
        <LogoutButton />
      </header>
      <main className={styles.main}>
        {accountPanel === "password" ? (
          <div className={styles.loginCard}>
            <h1>비밀번호 변경</h1>
            <ChangePasswordForm onDone={() => setAccountPanel(null)} />
          </div>
        ) : null}
        {accountPanel === "mfa" ? (
          <div className={styles.loginCard}>
            <h1>인증 앱 다시 등록</h1>
            <MfaDisableForm onCancel={() => setAccountPanel(null)} />
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

/**
 * ADM-007: self-service password change for the logged-in admin. Used both in
 * the account area (AdminShell header) and on the MFA enrollment screen, so a
 * freshly created admin can rotate the one-time temp password from ADM-006
 * immediately — the API route is MFA-exempt for exactly that reason. On
 * success the API revokes every other session; this one stays signed in.
 */
function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      setFormError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPassword.length < 10) {
      setFormError("새 비밀번호는 10자 이상이어야 해요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("새 비밀번호 확인이 일치하지 않아요.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await adminChangePassword(currentPassword, newPassword);
      setSucceeded(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setFormError(error instanceof AdminApiError ? error.message : "비밀번호를 변경하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (succeeded) {
    return (
      <>
        <p className={styles.hint}>비밀번호를 변경했어요. 이 세션은 유지되고, 다른 곳의 로그인은 모두 해제되었어요.</p>
        {onDone ? (
          <button type="button" className={styles.primaryButton} onClick={onDone}>
            확인
          </button>
        ) : null}
      </>
    );
  }

  return (
    <form className={styles.loginForm} onSubmit={handleSubmit}>
      <input
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        placeholder="현재 비밀번호"
        className={styles.tokenInput}
      />
      <input
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        placeholder="새 비밀번호 (10자 이상)"
        className={styles.tokenInput}
      />
      <input
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        placeholder="새 비밀번호 확인"
        className={styles.tokenInput}
      />
      {formError ? <p className={styles.errorText}>{formError}</p> : null}
      <button type="submit" className={styles.primaryButton} disabled={submitting}>
        {submitting ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}

/**
 * GAP-063 #3: 인증 앱을 잃은 관리자의 재등록 입구. 서버(POST /admin/auth/mfa/disable,
 * admin-auth.service.ts의 `disableMfa`)와 클라이언트 래퍼(`adminMfaDisable`)는 이미
 * 완성돼 있었는데 화면에 부르는 자리가 없어서, 폰을 바꾼 관리자는 복구 코드를 한 장씩
 * 태우며 로그인하다가 다 쓰면 어드민에서 영구히 잠겼다(남은 복구책은 DB 직접 수정뿐).
 *
 * SEC-101 계약은 한 글자도 바뀌지 않는다: 해제는 **세션의 `mfaEnabled`를 false로 내리는
 * 것까지**이고, 그 순간 AdminShell이 강제 등록 화면(MfaSetupScreen)을 그대로 이어받는다 —
 * 새 라우트도, 등록을 건너뛰는 길도 만들지 않는다. 서버가 코드 확인을 요구하는 순서(확인 →
 * 해제 → 재등록 강제)를 화면이 흐리지 않는 유일한 모양이다.
 *
 * 실패는 서버 문구를 그대로 보여준다(코드 오류·MFA 잠금·미등록 상태가 서로 다른 사실이라
 * 한 문장으로 뭉뚱그리지 않는다).
 */
function MfaDisableForm({ onCancel }: { onCancel?: () => void }) {
  const { session, setSession } = useAdminSession();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) {
      setFormError("인증 코드 또는 복구 코드를 입력해 주세요.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await adminMfaDisable(code.trim());
      // 성공 화면을 따로 두지 않는다 — mfaEnabled가 false가 되는 순간 셸이 등록 화면으로
      // 넘어가고(위 SEC-101 문단), 새 복구 코드는 그 화면이 발급해 보여준다.
      if (session) setSession({ admin: session.admin, mfaEnabled: false });
    } catch (error) {
      setFormError(
        error instanceof AdminApiError ? error.message : "2단계 인증을 해제하지 못했어요. 다시 시도해 주세요."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p>인증 앱을 새 기기로 옮기려면 지금 등록을 해제하고 바로 다시 등록해요.</p>
      <p className={styles.hint}>
        인증 앱을 쓸 수 없다면 <strong>복구 코드를 입력해도 돼요</strong>. 복구 코드는 한 번만 쓸 수 있어요.
      </p>
      <p className={styles.hint}>
        해제하면 곧바로 등록 화면이 떠요 — 등록을 마치기 전에는 다른 화면을 쓸 수 없고, 지금 가진 복구 코드는 모두
        무효가 되며 등록을 마칠 때 새 복구 코드를 드려요. 다른 곳의 로그인은 모두 해제되고, 이 세션은 유지돼요.
      </p>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <input
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="인증 코드 또는 복구 코드"
          className={styles.tokenInput}
        />
        {formError ? <p className={styles.errorText}>{formError}</p> : null}
        <button type="submit" className={styles.primaryButton} disabled={submitting}>
          {submitting ? "해제 중..." : "해제하고 다시 등록하기"}
        </button>
      </form>
      {onCancel ? (
        <button type="button" className={styles.legacyToggle} onClick={onCancel}>
          그만두기
        </button>
      ) : null}
    </>
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
  // ADM-007: 갓 발급받은 임시 비밀번호는 MFA 등록 전에 바로 바꿀 수 있어야
  // 한다 — change-password API가 MFA 게이트 예외인 이유와 동일.
  const [showPasswordForm, setShowPasswordForm] = useState(false);

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
        <button type="button" className={styles.legacyToggle} onClick={() => setShowPasswordForm((open) => !open)}>
          임시 비밀번호를 먼저 변경할래요
        </button>
        {showPasswordForm ? (
          <div className={styles.legacySection}>
            <ChangePasswordForm onDone={() => setShowPasswordForm(false)} />
          </div>
        ) : null}
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
