"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  AdminApiError,
  createAdminUser,
  createIdempotencyKeyHolder,
  isAuthError,
  isIdempotentTimeoutError,
  isSelfUpdateForbiddenError,
  listAdminUsers,
  updateAdminUser,
  type AdminRole,
  type AdminUserAccount
} from "../../src/lib/admin-api";
import { loadErrorCopy, type LoadErrorCopy } from "../../src/lib/load-error-copy";
import { writeErrorMessage } from "../../src/lib/write-error-copy";
import { isBlank, isEmailLike } from "../../src/lib/validation";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

type CreateFormState = {
  email: string;
  role: AdminRole;
  displayName: string;
};

function emptyCreateForm(): CreateFormState {
  return { email: "", role: "editor", displayName: "" };
}

function validateCreateForm(form: CreateFormState): string | null {
  if (isBlank(form.email)) return "이메일을 입력해 주세요.";
  if (!isEmailLike(form.email)) return "올바른 이메일 형식이 아니에요.";
  return null;
}

const SELF_UPDATE_MESSAGE = "본인 계정의 권한을 낮추거나 비활성화할 수 없어요. 다른 관리자에게 요청해 주세요.";

/**
 * 라운드 76 트랙 B(GAP-076 #2ⓓ): 코드 둘의 매핑은 **이 화면의 판정으로 남는다**
 * (`ADMIN_SELF_UPDATE_FORBIDDEN`은 다음 걸음까지 말하고, `ADMIN_EMAIL_EXISTS`는 서버 문장보다
 * 짧다 — 문장 셋 바이트 불변). 그 아래 폴백만 공용 한 벌을 지나, 서버가 다른 이유를 줬을 때
 * (400 검증·403·5xx·쓰기 타임아웃 60초) 그 문장이 그대로 서게 한다.
 */
function mutationErrorMessage(error: unknown, fallback: string): string {
  if (isSelfUpdateForbiddenError(error)) return SELF_UPDATE_MESSAGE;
  if (error instanceof AdminApiError && error.code === "ADMIN_EMAIL_EXISTS") {
    return "이미 등록된 관리자 이메일이에요.";
  }
  return writeErrorMessage(error, fallback);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

/** ADM-006: shown exactly once right after creation; kept only in component
 * state (never persisted anywhere) and gone for good once dismissed. */
type TempPasswordNotice = { email: string; tempPassword: string };

function TempPasswordCallout({ notice, onDismiss }: { notice: TempPasswordNotice; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notice.tempPassword);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (permissions/insecure context); the code
      // below stays selectable-by-click (user-select: all) as a fallback.
      setCopied(false);
    }
  };

  return (
    <div className={styles.calloutWarning}>
      <strong>
        {notice.email} 계정의 임시 비밀번호예요. 이 비밀번호는 다시 표시되지 않습니다 — 지금 안전한 경로로 전달해 주세요.
      </strong>
      <code className={styles.calloutCode}>{notice.tempPassword}</code>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} onClick={handleCopy}>
          {copied ? "복사됨" : "복사"}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onDismiss}>
          확인했어요, 닫기
        </button>
      </div>
      <span className={styles.hint}>새 관리자는 첫 로그인 후 2단계 인증(MFA)을 등록하게 돼요.</span>
    </div>
  );
}

export default function AdminUsersPage() {
  const { session, clearSession } = useAdminSession();
  const [users, setUsers] = useState<AdminUserAccount[] | null>(null);
  const [loadError, setLoadError] = useState<LoadErrorCopy | null>(null);

  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<TempPasswordNotice | null>(null);

  const [rowSubmittingId, setRowSubmittingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowSuccess, setRowSuccess] = useState<string | null>(null);

  // R19-F: 계정 생성 시도 하나당 멱등키 하나. 생성 요청이 타임아웃돼도 같은 키로
  // 다시 보내면 서버가 첫 응답(임시 비밀번호 포함)을 그대로 재생하므로, 계정만
  // 만들어지고 임시 비밀번호는 못 받는 최악의 상태를 피할 수 있다. 키는 아래
  // current(지문)에 넘기는 요청 body가 바뀌면 자동으로 새로 발급되고, 생성에
  // 성공하면 다음 계정은 새 시도이므로 rotate()로 회전한다.
  const createKey = useRef(createIdempotencyKeyHolder()).current;

  const isAdmin = session?.admin.role === "admin";

  const loadUsers = useCallback(async () => {
    if (!session || session.admin.role !== "admin") return;
    setLoadError(null);
    try {
      const result = await listAdminUsers();
      setUsers(result.adminUsers);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setLoadError(loadErrorCopy(error, "관리자 계정 목록을 불러오지 못했어요."));
    }
  }, [session, clearSession]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  if (!session) return null;

  // ADM-006: the endpoints themselves are admin-only (the API 403s other
  // roles), so editor/analyst sessions get a notice instead of a broken page.
  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>관리자 계정</h1>
        </div>
        <section className={styles.card}>
          <p className={styles.emptyState}>관리자 계정 관리는 관리자(admin) 권한에서만 사용할 수 있어요.</p>
        </section>
      </div>
    );
  }

  const handleCreate = async () => {
    const validationMessage = validateCreateForm(createForm);
    if (validationMessage) {
      setCreateError(validationMessage);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const displayName = createForm.displayName.trim();
      const input = {
        email: createForm.email.trim(),
        role: createForm.role,
        ...(displayName ? { displayName } : {})
      };
      const result = await createAdminUser(input, createKey.current(JSON.stringify(input)));
      setTempPasswordNotice({ email: result.admin.email, tempPassword: result.tempPassword });
      // 성공 — 다음 계정 생성은 새 시도로 취급한다.
      setCreateForm(emptyCreateForm());
      createKey.rotate();
      await loadUsers();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      // R19-F: 멱등키를 실어 보낸 생성 요청의 타임아웃은 재시도가 안전하다 —
      // 키를 그대로 둔 채(회전하지 않는다) "계정 만들기"를 다시 누르면 서버가
      // 계정을 또 만들지 않고 첫 응답(임시 비밀번호 포함)을 재생한다.
      if (isIdempotentTimeoutError(error)) {
        setCreateError(
          "요청이 오래 걸려 결과를 확인하지 못했어요. 같은 요청을 다시 보내면 중복 없이 처리되니, 입력값을 바꾸지 말고 '계정 만들기'를 한 번 더 눌러 주세요."
        );
        return;
      }
      setCreateError(mutationErrorMessage(error, "계정을 만들지 못했어요. 입력값을 확인하고 다시 시도해 주세요."));
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (user: AdminUserAccount, role: AdminRole) => {
    if (role === user.role) return;
    setRowSubmittingId(user.id);
    setRowError(null);
    setRowSuccess(null);
    try {
      await updateAdminUser(user.id, { role });
      setRowSuccess(`${user.email} 계정의 역할을 ${ADMIN_ROLE_LABELS[role]}(으)로 바꿨어요.`);
      await loadUsers();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setRowError(mutationErrorMessage(error, "역할을 바꾸지 못했어요. 다시 시도해 주세요."));
    } finally {
      setRowSubmittingId(null);
    }
  };

  const handleActiveToggle = async (user: AdminUserAccount) => {
    const nextActive = !user.active;
    if (!nextActive) {
      const confirmed = window.confirm(
        `${user.email} 계정을 비활성화할까요? 비활성화하면 해당 계정의 모든 로그인 세션이 즉시 종료돼요.`
      );
      if (!confirmed) return;
    }
    setRowSubmittingId(user.id);
    setRowError(null);
    setRowSuccess(null);
    try {
      await updateAdminUser(user.id, { active: nextActive });
      setRowSuccess(`${user.email} 계정을 ${nextActive ? "활성화" : "비활성화"}했어요.`);
      await loadUsers();
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setRowError(mutationErrorMessage(error, "계정 상태를 바꾸지 못했어요. 다시 시도해 주세요."));
    } finally {
      setRowSubmittingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>관리자 계정</h1>
        <p>관리자·편집자·분석가 계정을 만들고 역할과 활성 상태를 관리해요.</p>
      </div>

      <section className={styles.card}>
        <h2>새 계정 만들기</h2>
        {tempPasswordNotice ? (
          <TempPasswordCallout notice={tempPasswordNotice} onDismiss={() => setTempPasswordNotice(null)} />
        ) : (
          <>
            <div className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="create-email">이메일</label>
                  <input
                    id="create-email"
                    type="email"
                    maxLength={320}
                    value={createForm.email}
                    onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="create-role">역할</label>
                  <select
                    id="create-role"
                    value={createForm.role}
                    onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as AdminRole })}
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ADMIN_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="create-display-name">표시 이름 (선택)</label>
                  <input
                    id="create-display-name"
                    type="text"
                    maxLength={80}
                    value={createForm.displayName}
                    onChange={(event) => setCreateForm({ ...createForm, displayName: event.target.value })}
                  />
                  <span className={styles.hint}>비워두면 이메일이 표시 이름으로 사용돼요.</span>
                </div>
              </div>
            </div>
            {createError ? <p className={styles.errorBanner}>{createError}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton} onClick={handleCreate} disabled={creating}>
                {creating ? "만드는 중..." : "계정 만들기"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>계정 목록</h2>
        {users === null && !loadError ? <p className={styles.emptyState}>불러오는 중...</p> : null}
        {loadError ? (
          <p className={styles.errorBanner}>
            {loadError.message}
            {/* 라운드 73 트랙 D: 다시 눌러도 같은 답이 오는 실패에는 이 버튼을 세우지 않는다. */}
            {loadError.canRetry ? (
              <button type="button" className={styles.retryButton} onClick={loadUsers}>
                다시 시도
              </button>
            ) : null}
          </p>
        ) : null}
        {rowError ? <p className={styles.errorBanner}>{rowError}</p> : null}
        {rowSuccess ? <p className={styles.successBanner}>{rowSuccess}</p> : null}
        {users && users.length === 0 ? <p className={styles.emptyState}>등록된 계정이 없어요.</p> : null}
        {users && users.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>표시 이름</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>마지막 로그인</th>
                  <th>생성일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === session.admin.id;
                  const isRowSubmitting = rowSubmittingId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        {user.email}
                        {isSelf ? <span className={styles.hint}> (나)</span> : null}
                      </td>
                      <td>{user.displayName}</td>
                      <td>
                        <select
                          aria-label={`${user.email} 역할`}
                          value={user.role}
                          disabled={isRowSubmitting || isSelf}
                          onChange={(event) => handleRoleChange(user, event.target.value as AdminRole)}
                        >
                          {ADMIN_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ADMIN_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          className={
                            user.active ? `${styles.badge} ${styles.badgeActive}` : `${styles.badge} ${styles.badgeInactive}`
                          }
                        >
                          {user.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td>{formatDate(user.lastLoginAt)}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={isRowSubmitting || isSelf}
                          onClick={() => handleActiveToggle(user)}
                        >
                          {isRowSubmitting ? "처리 중..." : user.active ? "비활성화" : "활성화"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
