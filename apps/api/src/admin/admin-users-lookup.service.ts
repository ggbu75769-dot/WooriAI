import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { AuthProvider, ChildStageMode, MemberRole, MemberStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  USERS_LOOKUP_DEFAULT_LIMIT,
  USERS_LOOKUP_MIN_QUERY_LENGTH,
  type AdminUsersLookupQueryDto
} from "./dto/admin-users-lookup.dto";

/** 아이 요약. 닉네임과 단계 모드만 — 출산예정일/생년월일은 싣지 않는다. */
export type AdminUserLookupChild = {
  id: string;
  nickname: string;
  stageMode: ChildStageMode;
};

export type AdminUserLookupHousehold = {
  id: string;
  name: string;
  /** 이 사용자가 그 가구에서 갖는 역할/멤버 상태 (RBAC 문의 대응용). */
  role: MemberRole;
  memberStatus: MemberStatus;
  isOwner: boolean;
  children: AdminUserLookupChild[];
};

export type AdminUserLookupResult = {
  id: string;
  email: string | null;
  displayName: string | null;
  authProvider: AuthProvider;
  status: UserStatus;
  createdAt: Date;
  /** 마지막 활동 — 기존 컬럼 users.last_login_at 그대로 (새 컬럼을 만들지 않는다). */
  lastLoginAt: Date | null;
  /** 탈퇴(soft delete) 시각. null이면 살아 있는 계정. */
  deletedAt: Date | null;
  households: AdminUserLookupHousehold[];
  /**
   * 이 사용자가 기록한 살아 있는 지출 **건수**. 금액·품목·가맹점은 어떤 경우에도
   * 싣지 않는다 — "이 사람이 앱을 실제로 쓰고 있는가"를 판단할 최소치만 남긴다.
   */
  expenseCount: number;
};

/**
 * LIKE 와일드카드(`%`, `_`)를 뺀 실질 검색어 길이. Prisma `contains`는 값 안의
 * 와일드카드를 이스케이프하지 않으므로, `%%` 같은 입력이 최소 길이 검사를 통과해
 * 사실상 "전체 사용자 명단 덤프"가 되는 길을 막는다. 정상 입력(이메일에 섞인 `_`
 * 등)은 그대로 통과하므로 검색 동작 자체는 달라지지 않는다.
 */
export function effectiveQueryLength(query: string): number {
  return query.trim().replaceAll("%", "").replaceAll("_", "").length;
}

/**
 * ADM-127: 최종 사용자(=`users` 테이블) 조회. **읽기 전용**이다 — 이 서비스에는
 * 사용자 데이터를 바꾸는 경로가 없다.
 *
 * 왜 필요한가: CS 문의("가입은 됐는데 가구가 안 보여요", "아이가 두 명인데 하나만
 * 떠요")를 확인하려면 지금까지 운영 DB에 직접 붙어야 했다. 이 조회는 그 확인에
 * 필요한 최소 정보만 돌려준다.
 *
 * 노출 범위(의도적으로 좁힘):
 *   * 싣는다 — 이메일(검색 키이자 CS 식별자), 표시 이름, 로그인 제공자, 계정 상태,
 *     가입일, 마지막 로그인, 가구/역할/아이 닉네임·단계, 지출 **건수**.
 *   * 싣지 않는다 — 전화번호, 프로필 이미지 URL, provider_user_id(소셜 고유키),
 *     아이 생년월일·출산예정일·성별, 그리고 지출 금액/품목/가맹점/메모 일체.
 *
 * 스태프 계정은 애초에 다른 테이블(`admin_users`)이라 이 결과에 섞이지 않는다.
 * 탈퇴(soft delete) 계정은 결과에 포함하되 `deletedAt`으로 표시한다 — 탈퇴 직후
 * 문의가 CS의 실제 사례라, 숨기면 "찾을 수 없음"과 구분이 되지 않는다.
 */
@Injectable()
export class AdminUsersLookupService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(query: AdminUsersLookupQueryDto): Promise<{ users: AdminUserLookupResult[]; limit: number }> {
    const term = query.query.trim();
    const limit = query.limit ?? USERS_LOOKUP_DEFAULT_LIMIT;

    if (effectiveQueryLength(term) < USERS_LOOKUP_MIN_QUERY_LENGTH) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "요청 값을 다시 확인해주세요.",
        details: {
          fields: [
            {
              field: "query",
              constraints: { minLength: `검색어는 ${USERS_LOOKUP_MIN_QUERY_LENGTH}자 이상이어야 해요.` }
            }
          ]
        }
      });
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { displayName: { contains: term, mode: "insensitive" } }
        ]
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limit,
      // select 화이트리스트로 phone / providerUserId / profileImageUrl이 응답
      // 조립 과정에도 아예 올라오지 않게 한다.
      select: {
        id: true,
        email: true,
        displayName: true,
        authProvider: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true
      }
    });

    if (users.length === 0) {
      return { users: [], limit };
    }

    const userIds = users.map((user) => user.id);

    // 가구/아이/지출건수는 사용자 수만큼 쿼리를 쏘지 않고 한 번씩 배치로 모은다(N+1 회피).
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, householdId: true, role: true, status: true }
    });

    const householdIds = [...new Set(memberships.map((member) => member.householdId))];
    const [households, children, expenseCounts] = await Promise.all([
      householdIds.length
        ? this.prisma.household.findMany({
            where: { id: { in: householdIds } },
            select: { id: true, name: true, ownerUserId: true }
          })
        : Promise.resolve([]),
      householdIds.length
        ? this.prisma.child.findMany({
            where: { householdId: { in: householdIds }, deletedAt: null },
            orderBy: [{ createdAt: "asc" }],
            select: { id: true, householdId: true, nickname: true, stageMode: true }
          })
        : Promise.resolve([]),
      // 살아 있는 지출만 센다(soft delete 제외, DNC-014). 금액은 집계하지 않는다.
      this.prisma.expense.groupBy({
        by: ["createdByUserId"],
        where: { createdByUserId: { in: userIds }, deletedAt: null },
        _count: { _all: true }
      })
    ]);

    const householdById = new Map(households.map((household) => [household.id, household]));
    const childrenByHousehold = new Map<string, AdminUserLookupChild[]>();
    for (const child of children) {
      const bucket = childrenByHousehold.get(child.householdId) ?? [];
      bucket.push({ id: child.id, nickname: child.nickname, stageMode: child.stageMode });
      childrenByHousehold.set(child.householdId, bucket);
    }

    const membershipsByUser = new Map<string, typeof memberships>();
    for (const member of memberships) {
      const bucket = membershipsByUser.get(member.userId) ?? [];
      bucket.push(member);
      membershipsByUser.set(member.userId, bucket);
    }

    const expenseCountByUser = new Map(
      expenseCounts.map((row) => [row.createdByUserId, row._count._all] as const)
    );

    return {
      users: users.map((user) => ({
        ...user,
        households: (membershipsByUser.get(user.id) ?? [])
          .map((member) => {
            const household = householdById.get(member.householdId);
            return {
              id: member.householdId,
              name: household?.name ?? "(삭제된 가구)",
              role: member.role,
              memberStatus: member.status,
              isOwner: household?.ownerUserId === user.id,
              children: childrenByHousehold.get(member.householdId) ?? []
            };
          })
          .sort((left, right) => Number(right.isOwner) - Number(left.isOwner)),
        expenseCount: expenseCountByUser.get(user.id) ?? 0
      })),
      limit
    };
  }
}
