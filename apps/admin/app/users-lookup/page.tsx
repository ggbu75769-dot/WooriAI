"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { isAuthError, isTimeoutError, lookupAdminEndUsers, type AdminLookupUser } from "../../src/lib/admin-api";
import { auditLogsHrefForActor } from "../../src/lib/audit-log-filters";
import {
  AUTH_PROVIDER_LABELS,
  accountStateLabel,
  childSummary,
  formatLookupDate,
  householdRoleSummary,
  lastActivityLabel,
  userActivitySummary,
  userDisplayLabel,
  userLookupQueryError
} from "../../src/lib/user-lookup-view";
import { useAdminSession } from "../../src/lib/admin-token-context";
import styles from "../../src/components/admin-page.module.css";

/**
 * ADM-127: 사용자 조회 (읽기 전용).
 *
 * CS 문의 대응용 화면이다 — 이메일/닉네임으로 최종 사용자를 찾아 가구·아이 구성과
 * 계정 상태를 확인한다. 이 화면에는 사용자 데이터를 바꾸는 버튼이 하나도 없다.
 *
 * 개인정보: 지출은 **건수**만 보여준다(금액·품목·가맹점은 서버가 아예 내려주지 않는다).
 * 아이는 닉네임과 단계 모드까지만이고 생년월일/출산예정일은 없다. 전화번호·소셜 고유키도
 * 응답에 없다. 조회 자체가 감사 로그(admin.user_lookup.search)에 남는다.
 *
 * 권한: API가 admin 전용(RequireAdminRoles("admin"))이라, 다른 역할에는 깨진 화면 대신
 * 안내를 띄운다(ADM-006 /users와 같은 패턴).
 */
export default function UsersLookupPage() {
  const { session, clearSession } = useAdminSession();

  const [queryInput, setQueryInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminLookupUser[] | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isAdmin = session?.admin.role === "admin";

  if (!session) return null;

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1>사용자 조회</h1>
        </div>
        <section className={styles.card}>
          <p className={styles.emptyState}>사용자 조회는 관리자(admin) 권한에서만 사용할 수 있어요.</p>
        </section>
      </div>
    );
  }

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationMessage = userLookupQueryError(queryInput);
    if (validationMessage) {
      setSearchError(validationMessage);
      return;
    }
    const term = queryInput.trim();
    setSearching(true);
    setSearchError(null);
    try {
      const result = await lookupAdminEndUsers(term);
      setUsers(result.users);
      setLimit(result.limit);
      setSubmittedQuery(term);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setSearchError(
        isTimeoutError(error)
          ? "조회에 시간이 너무 오래 걸렸어요. 검색어를 좁혀서 다시 시도해 주세요."
          : "사용자를 조회하지 못했어요. 검색어를 확인하고 다시 시도해 주세요."
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>사용자 조회</h1>
        <p>문의하신 분의 이메일이나 닉네임으로 계정과 가구 구성을 확인해요.</p>
      </div>

      <section className={styles.card}>
        <h2>검색</h2>
        <form className={styles.form} onSubmit={handleSearch}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="user-lookup-query">이메일 또는 닉네임</label>
              <input
                id="user-lookup-query"
                type="text"
                maxLength={200}
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
              />
              <span className={styles.hint}>일부만 입력해도 찾을 수 있어요 (2자 이상).</span>
            </div>
          </div>
          {searchError ? <p className={styles.errorBanner}>{searchError}</p> : null}
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryButton} disabled={searching}>
              {searching ? "조회 중..." : "조회"}
            </button>
          </div>
        </form>
        <p className={styles.hint}>
          읽기 전용 화면이에요. 지출은 건수만 보여주고 금액과 품목은 표시하지 않아요. 조회 기록은 감사 로그에 남아요.
        </p>
      </section>

      {users !== null ? (
        <section className={styles.card}>
          <h2>조회 결과</h2>
          {users.length === 0 ? (
            <p className={styles.emptyState}>
              &ldquo;{submittedQuery}&rdquo;와(과) 일치하는 사용자를 찾지 못했어요.
            </p>
          ) : (
            <>
              <p className={styles.hint}>
                {users.length}명을 찾았어요.
                {limit !== null && users.length >= limit
                  ? ` 최대 ${limit}명까지만 보여드려요 — 검색어를 더 자세히 입력해 주세요.`
                  : ""}
              </p>
              {users.map((user) => (
                <article key={user.id} className={styles.card}>
                  <h2>{userDisplayLabel(user)}</h2>
                  <p className={styles.hint}>{userActivitySummary(user)}</p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <tbody>
                        <tr>
                          <th>이메일</th>
                          <td>{user.email ?? "-"}</td>
                        </tr>
                        <tr>
                          <th>계정 상태</th>
                          <td>
                            <span
                              className={
                                user.deletedAt || user.status !== "active"
                                  ? `${styles.badge} ${styles.badgeInactive}`
                                  : `${styles.badge} ${styles.badgeActive}`
                              }
                            >
                              {accountStateLabel(user)}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <th>로그인 수단</th>
                          <td>{AUTH_PROVIDER_LABELS[user.authProvider]}</td>
                        </tr>
                        <tr>
                          <th>가입일</th>
                          <td>{formatLookupDate(user.createdAt)}</td>
                        </tr>
                        <tr>
                          <th>마지막 활동</th>
                          <td>{lastActivityLabel(user)}</td>
                        </tr>
                        <tr>
                          <th>지출 기록</th>
                          <td>{user.expenseCount}건</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* CS-101(라운드 56 트랙 C): 여기까지 오면 "이 사람이 누구인지"는 알 수 있지만
                      "무엇을 했는지"로 가는 길이 없었다 — 감사 로그는 행위자 필터를 서버·API까지
                      갖춰 두고도 화면에서 도달할 수단이 없어, 운영자가 UUID를 손으로 옮겨야 했다.
                      링크가 actorUserId를 프리필해 그 사용자 행위만 남긴 목록으로 보낸다. */}
                  <div className={styles.actions}>
                    <Link
                      href={auditLogsHrefForActor(user.id)}
                      className={styles.secondaryButton}
                      style={{ display: "inline-block", textDecoration: "none" }}
                    >
                      이 사용자 감사 로그 보기
                    </Link>
                  </div>
                  <p className={styles.hint}>
                    지출 수정·삭제, 아이 프로필 삭제, 로그인 같은 이 사용자의 행위 기록으로 넘어가요 (감사 로그는
                    관리자 권한에서만 열려요).
                  </p>

                  <h2>가구</h2>
                  {user.households.length === 0 ? (
                    <p className={styles.emptyState}>속한 가구가 없어요.</p>
                  ) : (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>가구</th>
                            <th>역할</th>
                            <th>아이</th>
                          </tr>
                        </thead>
                        <tbody>
                          {user.households.map((household) => (
                            <tr key={household.id}>
                              <td>
                                {household.name}
                                {household.isOwner ? <span className={styles.hint}> (소유자)</span> : null}
                              </td>
                              <td>{householdRoleSummary(household)}</td>
                              <td>
                                {household.children.length === 0
                                  ? "-"
                                  : household.children.map((child) => (
                                      <div key={child.id}>{childSummary(child)}</div>
                                    ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
