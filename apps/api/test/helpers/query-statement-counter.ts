import type { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../src/prisma/prisma.service";

/**
 * 라운드 82 C — **왕복을 세는 그물의 공유 하네스.**
 *
 * 라운드 81 E가 가져오기 스위트 안에서 이 계측을 처음 만들었고, 그때 스스로 적어 둔 다음
 * 질문이 *"이 그물의 모집단은 오늘 가져오기 한 경로뿐이다"* 였다. 이 파일은 그 하네스를
 * 테스트 파일 밖으로 올려, 문장 수를 세는 스위트가 **같은 한 벌**을 쓰게 한다.
 * ⚠️ 두 벌을 만들면 그물이 두 모집단을 갖게 되고, 그러면 "몇 문장인가"를 두 곳이 서로 다른
 * 방법으로 답하게 된다 — 라운드 80이 대장에 대해 물은 그 질문이 그대로 여기에 온다.
 *
 * ## 세는 방법
 * `PrismaService`를 **query 이벤트를 내보내는 인스턴스로 갈아 끼우고**(아래 서브클래스 —
 * Prisma 6에는 `$use` 미들웨어가 없다) 요청 하나가 내보낸 **SQL 문장 수를 실측**한다.
 * BEGIN/COMMIT과 인증·권한 조회까지 전부 세지만, 그 몫은 **입력 크기와 무관한 상수**라
 * 비교하는 두 측정에서 서로 상쇄된다.
 *
 * ⚠️ 이 하네스를 쓰는 단언은 **손으로 적은 문장 수를 쓰지 않는다**. 상수를 박으면 다음
 * 라운드에 낡고, 낡은 줄은 계약이 아니라 유지비다 — 두 측정의 **차이**를 입력 크기 자신으로
 * 표현하는 것이 이 그물의 규율이다(라운드 81 E가 세운 규율 그대로).
 */
export class QueryCountingPrismaService extends PrismaService {
  constructor() {
    // 기본 PrismaService는 로그 설정이 없어 query 이벤트를 내보내지 않는다. 서브클래스가
    // 생성 인자만 바꾼다(동작·연결 방식은 그대로 상속한다).
    super({ log: [{ level: "query", emit: "event" }] });
  }
}

/** `$on("query")`는 로그를 이벤트로 설정한 클라이언트에서만 타입이 열린다(생성 옵션이 타입에
 *  실리지 않는 서브클래스라 이 좁은 모양으로 받는다). */
type QueryLogEmitter = { $on(eventType: "query", callback: (event: { query: string }) => void): unknown };

export type QueryStatementCounter = {
  /** 지금까지 모인 문장(측정 창 밖에서도 계속 쌓인다 — 창은 `count`가 잡는다). */
  readonly statements: string[];
  /** 다음 측정 전에 남은 이벤트를 비운다(창 경계 맞추기). */
  settle(): Promise<void>;
  /** `run` 하나가 내보낸 문장 수를 실측한다. */
  count(run: () => Promise<void>): Promise<number>;
  /** 모아 둔 문장을 버린다(스위트 사이 정리). */
  reset(): void;
};

/**
 * 앱에 붙은 `PrismaService`(= `QueryCountingPrismaService`로 갈아 끼운 그것)의 query
 * 이벤트를 구독한다. 테스트 모듈을 만들 때
 * `.overrideProvider(PrismaService).useClass(QueryCountingPrismaService)`가 선행해야 한다.
 */
export function attachQueryStatementCounter(app: INestApplication): QueryStatementCounter {
  const statements: string[] = [];
  (app.get(PrismaService) as unknown as QueryLogEmitter).$on("query", (event) => {
    statements.push(event.query);
  });

  /**
   * query 이벤트는 엔진에서 올라오므로 HTTP 응답보다 조금 늦게 도착할 수 있다. 측정 앞뒤로
   * 같은 시간을 기다려 창의 경계를 맞춘다(앞의 대기는 직전 요청의 잔여 이벤트를 비우는 몫).
   */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return {
    statements,
    settle,
    reset() {
      statements.length = 0;
    },
    async count(run: () => Promise<void>): Promise<number> {
      await settle();
      statements.length = 0;
      await run();
      await settle();
      // 다음 라운드가 실측값을 다시 보고 싶을 때 쓰는 창(단언은 이 값을 쓰지 않는다):
      // `WOORIAI_LOG_STATEMENT_COUNTS=1 npx vitest run test/import-excel.e2e.test.ts`.
      if (process.env.WOORIAI_LOG_STATEMENT_COUNTS) console.log(`[statements] ${statements.length}`);
      return statements.length;
    }
  };
}
