import { randomUUID } from "node:crypto";
import { BadRequestException, HttpException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { EXPENSE_ITEM_NAME_MAX_LENGTH } from "@wooriai/contracts";
import { isMoneyKrw, type ImportStatus } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import {
  IMPORT_FILE_TOO_LARGE_CODE,
  IMPORT_FILE_TOO_LARGE_MESSAGE
} from "../common/filters/global-exception.filter";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { assertImportFileMatchesExtension, parseImportFile, type ParsedImportRow } from "../imports/import-parser";
import { PushDispatchService } from "../push/push-dispatch.service";
import { ChildAccessService } from "./child-access.service";
import { ExpensesStoreService } from "./expenses-store.service";
import {
  assertExpenseDateWithinRange,
  cleanOptionalText,
  currentYearMonth,
  fromDateOnly,
  requireMoneyKrw,
  toDateOnly
} from "./store-shared";

/**
 * 라운드 57 QA(P2-13) — `import_rows`의 텍스트 컬럼 폭(`@db.VarChar(120)`).
 *
 * **물리적 한계 하나만** 뜻한다(계약이 아니다). 엑셀 가져오기는 사용자가 만든 파일을 그대로
 * 읽으므로 계약보다 넓은 값이 들어올 수 있고, 이 숫자를 넘는 순간 `import_rows` insert가 DB에서
 * 터진다 — 그래서 이 숫자를 넘는 값은 **저장 자체를 포기**하고 비운다(아래 buildImportRowsFromParsed).
 * "무엇이 유효한 품목명인가"를 정하는 숫자는 이것이 아니라 바로 아래
 * `IMPORT_ITEM_NAME_MAX_LENGTH`다. 두 숫자의 관계는 모바일 text-limits.ts 머리말의 "컬럼은
 * 120인데 상한이 100인 이유"와 같다.
 */
const IMPORT_TEXT_COLUMN_MAX_LENGTH = 120;

/**
 * GAP-058 #8 — 가져오기 행이 만들어 낼 수 있는 품목명의 **계약 상한**(= 지출 계약의 상한).
 *
 * 무엇이 남아 있었나: 라운드 57은 컬럼 폭(120)만 봤다. 그런데 확정(`confirmImport`)은 DTO를
 * 지나지 않고 `insertExpense`를 직접 호출하므로, 101~120자짜리 품목명이 그대로 **지출로**
 * 생성됐다. 그렇게 생긴 지출은 지출 상세에서 열어 저장하는 순간 `UpdateExpenseDto.itemName`의
 * `@MaxLength(100)`에 걸려 400이 된다 — 앱이 만들어 놓고 앱이 고칠 수 없는 기록이다(모바일
 * text-limits.ts 머리말이 말하는 "이미 들어 있는 값" 문제의 발생원이 바로 이 경로였다).
 *
 * 그래서 강등 임계를 **계약값(contracts `EXPENSE_ITEM_NAME_MAX_LENGTH` = 100)** 으로 맞춘다.
 * 121자 이상과 **같은 경로**다: 같은 `item_name_too_long` 상태, 같은 "행 미선택". 다른 점은
 * 값을 지우느냐뿐이고, 그 판단의 근거는 순전히 물리적이다(121자 이상은 담을 칸이 없어서 비운다).
 *
 * 판매처(`import_rows.merchant`)에는 지금 해당 사항이 없다 — 파서가 `merchant`를 만들지 않고
 * (`ParsedImportRow`에 그 필드가 없다) 이 insert도 그 컬럼을 쓰지 않는다. 파서가 판매처를
 * 만들게 되는 날 **같은 자리에서 같은 규칙으로**(계약값 `EXPENSE_MERCHANT_MAX_LENGTH` = 100로
 * 강등, 컬럼 폭 120 초과는 비움) 막으면 된다. 없는 경로를 위한 코드를 미리 적어 두면 다음
 * 사람이 그것을 "이미 쓰이는 값"으로 읽는다.
 */
const IMPORT_ITEM_NAME_MAX_LENGTH = EXPENSE_ITEM_NAME_MAX_LENGTH;

/** 이 행의 `validationStatus` — 품목명이 상한을 넘어 이 행만 가져올 수 없다. */
const IMPORT_ROW_ITEM_NAME_TOO_LONG_STATUS = "item_name_too_long";

/** 컬럼에 **담을 수조차** 없는 길이인가. 값이 없으면(선택 입력·빈 셀) 길이 문제는 아니다. */
function isOverImportTextColumn(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > IMPORT_TEXT_COLUMN_MAX_LENGTH;
}

/**
 * 지출로 만들 수 없는 길이인가(계약 상한 초과).
 *
 * `trim()`한 길이로 본다 — 확정이 지출에 넣는 값이 `insertExpense`의 `input.itemName.trim()`이고
 * (expenses-store.service.ts), 검수 화면이 PATCH로 보내는 값도 서버가 `cleanOptionalText`로 다듬은
 * 값이다. 같은 값으로 재지 않으면 "여기서는 통과했는데 저장하면 400"이 다시 생긴다.
 */
function isOverImportItemNameLimit(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > IMPORT_ITEM_NAME_MAX_LENGTH;
}

type ImportRowRow = {
  id: string;
  importJobId: string;
  rowIndex: number;
  parsedDate: Date | null;
  parsedItemName: string | null;
  parsedAmountKrw: number | null;
  categoryId: string | null;
  confidence: Prisma.Decimal | number;
  selected: boolean;
  userReviewed: boolean;
  validationStatus: string;
  duplicateCandidateExpenseId?: string | null;
};

export type CreateImportJobInput = {
  fileName?: string;
  fileSizeBytes?: number;
  estimatedRowCount?: number;
  fileBuffer?: Buffer;
};

export type UpdateImportRowInput = {
  selected?: boolean;
  categoryId?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
};

export type ConfirmImportInput = {
  selectedRowIds?: string[];
};

const defaultImportCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
/**
 * 업로드 크기 상한. 여기서는 클라이언트가 알려준 fileSizeBytes를 사전 검증하고,
 * 실제 스트림 크기는 ImportsController의 multer `limits.fileSize`가 같은 값으로
 * 끊는다(API-130) — 그래서 컨트롤러가 이 상수를 가져다 쓴다.
 */
export const IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const importMaxRows = 2000;

/**
 * 라운드 81 E — **두 가져오기 트랜잭션의 상한을 명시한다.**
 *
 * 무엇이 문제였나: 미리보기 생성(`createImportJob`)과 확정(`confirmImport`)의 `$transaction`
 * 둘 다 옵션 인자가 없었고 `PrismaService`에도 `transactionOptions`가 없었다 — 즉 인터랙티브
 * 트랜잭션의 상한이 Prisma 기본값(5초)이었다. 그런데 이 파이프라인이 **지원한다고 약속한**
 * 입력의 끝값은 `importMaxRows` = 2,000행이다(AC-IMP-001). 상한이 계약인데 그 상한을 다 채운
 * 파일이 기본 5초 안에 끝난다는 근거는 어디에도 없었고, 넘기면 P2028로 롤백돼 사용자는
 * "업로드 실패" 한 문장만 본다(확정에서 터지면 검수에 쓴 시간까지 함께 사라진다).
 *
 * 그래서 값이 아니라 **근거**를 함께 둔다: 이 트랜잭션들의 일감은 이제 행 수에 비례하지
 * **않고**(아래 두 `createMany`), 남는 것은 배치 INSERT 두어 문장 + 잡 UPDATE 몇 개다.
 * 30초는 그 일감이 느린 디스크·경합 중인 DB에서도 끝나기에 충분하면서, 무언가 정말 잘못됐을
 * 때(락 대기 등) 연결을 무한정 붙잡지는 않는 값이다. 파기 잡이 같은 이유로 고른 값과 같다
 * (`data-retention-purge.job.ts`의 `PURGE_TX_OPTIONS` — 그 주석이 근거의 원본이다).
 * `maxWait`(풀에서 연결을 얻기까지 기다리는 시간)는 기본 2초보다 넉넉한 10초로 둔다 —
 * 가져오기는 사용자가 버튼을 누르고 기다리는 단발 요청이라, 붐빌 때 즉시 실패하는 것보다
 * 잠깐 기다리는 편이 낫다.
 */
const IMPORT_TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

/**
 * REF-118: Excel/CSV import pipeline (job creation -> preview rows -> confirm)
 * split out of the former onboarding-store.service.ts god service. Public HTTP
 * contract, error codes and response shapes are unchanged. Row-to-expense
 * insertion inside the confirm transaction is delegated to
 * ExpensesStoreService.insertExpense, same code path as before the split.
 */
@Injectable()
export class ImportPipelineService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService,
    @Inject(ExpensesStoreService) private readonly expensesStore: ExpensesStoreService,
    // PUSH-113 후속(리뷰 m-2): 전역 PushModule(@Global())이 제공하는 발송 훅.
    // @Optional() — 이 서비스만 따로 조립하는 단위 테스트/부분 모듈에서는 없어도
    // 되고, 그 경우 훅은 그냥 건너뛴다 (finance/expenses.service.ts와 같은 선례).
    @Optional() @Inject(PushDispatchService) private readonly pushDispatch?: PushDispatchService
  ) {}

  async createImportJob(user: AuthenticatedUser, childId: string, input: CreateImportJobInput = {}) {
    const child = await this.childAccess.requireChildAccess(user, childId, true);
    const fileName = this.requireAcceptedImportFile(input);

    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new BadRequestException({ code: "IMPORT_FILE_REQUIRED", message: "Import file is required." });
    }

    // API-130: 형식 판정의 본검사 — 확장자/클라이언트 mimetype이 아니라 실제
    // 바이트로 확인한다(컨트롤러의 mimetype fileFilter는 명백한 불일치만 거르는
    // 1차 관문일 뿐이다).
    assertImportFileMatchesExtension(input.fileBuffer, fileName);

    const referenceYear = Number(currentYearMonth().slice(0, 4));
    let parsed: Awaited<ReturnType<typeof parseImportFile>>;
    try {
      parsed = await parseImportFile(input.fileBuffer, fileName, { referenceYear, maxRows: importMaxRows });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "가져오기 파일을 읽을 수 없어요." });
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "가져올 데이터를 찾을 수 없어요." });
    }

    const rows = await this.buildImportRowsFromParsed(childId, parsed.rows);

    const job = await this.prisma.$transaction(async (tx) => {
      /**
       * 라운드 60 리뷰(P2-3) — **아이당 검수 중인 잡은 하나까지.**
       *
       * 무엇이 문제였나: `preview_ready` 잡은 어떤 경로로도 끝나지 않는다. 확정하면 `confirmed`가
       * 되지만, 검수 화면을 그냥 떠나면 그 잡과 행(파일 한 줄마다 날짜·품목명·금액)이 **영원히**
       * 남는다 — 파기 잡의 phase 9는 `preview_ready`를 일부러 건드리지 않기 때문이다(이용자가
       * 진행 중인 작업이라서). 그래서 같은 아이에게 가져오기를 열 번 시도하고 열 번 다 검수를
       * 마치지 않으면 승인한 적 없는 금융 내역 사본이 열 벌 쌓였다. 파기 잡 주석이 그 상황을
       * "미확정 잡 하나"라고 적어 둔 것은 사실이 아니었다(복수로 쌓인다).
       *
       * 고치는 자리는 여기다: **새 미리보기를 만드는 순간 같은 아이의 이전 미리보기는 끝난
       * 것이다.** 사용자가 지금 검수하는 것은 방금 올린 파일이고, 검수 화면·재진입 카드도 그
       * 잡 하나만 가리킨다(모바일 import-resume은 `cancelled`를 이미 "끝난 잡"으로 읽어 저장본을
       * 지운다).
       *
       * 파기가 아니라 **상태 전이**다: 행을 여기서 지우지 않으므로 "가져왔는데 몇 건이 빠졌어요"
       * 류 문의는 종전대로 답할 수 있고, 그 행들은 이제 phase 9의 90일 창에 들어온다
       * (data-retention-purge.job.ts의 IMPORT_ROWS_PURGEABLE_JOB_STATUSES). DNC-012와도 무관하다 —
       * 취소된 잡은 확정된 적이 없으므로 지출이 단 한 건도 만들어지지 않았다.
       *
       * 같은 트랜잭션 안에서 하는 이유: 새 잡 생성이 실패하면 이전 미리보기도 그대로 살아 있어야
       * 한다(취소만 남고 새 잡이 없으면 사용자는 검수하던 화면을 이유 없이 잃는다).
       */
      await tx.importJob.updateMany({
        where: { childId, status: "preview_ready" },
        data: { status: "cancelled" }
      });

      const created = await tx.importJob.create({
        data: {
          childId,
          householdId: child.householdId,
          userId: user.id,
          status: "preview_ready",
          fileName,
          fileType: parsed.fileType,
          fileSizeBytes: BigInt(Math.max(1, input.fileSizeBytes ?? input.fileBuffer?.length ?? 0)),
          rowCount: 0,
          candidateCount: 0,
          importedCount: 0
        }
      });

      /**
       * 라운드 81 E — **행마다 한 문장이 아니라 배치 한 문장.**
       *
       * 종전에는 `for (const row of rows) await tx.importRow.create(...)` 였다. 파일이 2,000행이면
       * 이 트랜잭션 하나가 2,000번 왕복했고(문장 수 = N + 3), 그 전부가 **한 트랜잭션 예산**
       * 안에서 직렬로 돌았다 — 상한이 계약인 입력(`importMaxRows`)이 그 상한 때문에 실패할 수
       * 있는 모양이다. 행 값은 이미 `buildImportRowsFromParsed`가 전부 만들어 두었고(id도 그쪽에서
       * 부여한다) 행끼리 의존이 없으므로 한 문장으로 모을 수 있다. **문장 수 = 4.**
       *
       * 저장소 관례가 이미 있다: `analytics/analytics.service.ts`가 같은 이유로 `createMany`를 쓴다.
       * 관측되는 결과는 바이트 불변이다 — 같은 행·같은 id·같은 컬럼값이 같은 트랜잭션 안에서
       * 들어가고, 실패하면 종전처럼 파일 전체가 롤백된다(길이·금액 초과 행을 미리 떨궈 두는
       * 규율은 `buildImportRowsFromParsed`가 그대로 들고 있다 — 라운드 54 P1-1 · 57 P2-13).
       * `skipDuplicates`는 쓰지 않는다: 여기서 중복 id가 나온다면 그것은 사실이 아니라 버그이고,
       * 조용히 건너뛰면 "몇 건이 사라졌다"가 된다.
       */
      await tx.importRow.createMany({
        data: rows.map((row) => ({
          id: row.id,
          importJobId: created.id,
          rowIndex: row.rowIndex,
          rawJson: {},
          parsedDate: row.parsedDate,
          parsedItemName: row.parsedItemName,
          parsedAmountKrw: row.parsedAmountKrw,
          categoryId: row.categoryId,
          confidence: row.confidence,
          duplicateCandidateExpenseId: row.duplicateCandidateExpenseId ?? null,
          selected: row.selected,
          userReviewed: row.userReviewed,
          validationStatus: row.validationStatus
        }))
      });

      const candidateCount = rows.filter((row) => Number(row.confidence) >= 0.7).length;
      return tx.importJob.update({
        where: { id: created.id },
        data: { rowCount: rows.length, candidateCount }
      });
    }, IMPORT_TX_OPTIONS);

    return this.toImportJobDto(job);
  }

  async getImportJob(user: AuthenticatedUser, importJobId: string) {
    return this.toImportJobDto(await this.requireImportJobAccess(user, importJobId));
  }

  async listImportRows(user: AuthenticatedUser, importJobId: string) {
    await this.requireImportJobAccess(user, importJobId);
    const rows = await this.prisma.importRow.findMany({ where: { importJobId }, orderBy: { rowIndex: "asc" } });
    return { rows: rows.map((row) => this.toImportRowDto(row)) };
  }

  async updateImportRow(user: AuthenticatedUser, importJobId: string, rowId: string, input: UpdateImportRowInput) {
    const job = await this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "preview_ready") {
      throw new BadRequestException({ code: "IMPORT_NOT_EDITABLE", message: "Import preview can no longer be edited." });
    }

    const current = await this.prisma.importRow.findFirst({ where: { id: rowId, importJobId } });
    if (!current) {
      throw new NotFoundException({ code: "IMPORT_ROW_NOT_FOUND", message: "Import preview row was not found." });
    }

    const merged: ImportRowRow = {
      ...current,
      categoryId: input.categoryId ?? current.categoryId,
      parsedItemName:
        input.parsedItemName === undefined ? current.parsedItemName : cleanOptionalText(input.parsedItemName) ?? null,
      parsedAmountKrw: input.parsedAmountKrw ?? current.parsedAmountKrw,
      selected: input.selected ?? current.selected,
      userReviewed: true
    };
    const validationStatus = this.validationStatusForImportRow(merged);
    const selected = validationStatus === "valid" ? merged.selected : false;

    const updated = await this.prisma.importRow.update({
      where: { id: rowId },
      data: {
        categoryId: merged.categoryId,
        parsedItemName: merged.parsedItemName,
        parsedAmountKrw: merged.parsedAmountKrw,
        selected,
        userReviewed: true,
        validationStatus
      }
    });
    return this.toImportRowDto(updated);
  }

  /**
   * Transactional: creates every importable selected row as an expense and marks
   * the import job confirmed in one Prisma transaction, so a failure partway
   * through (e.g. an invalid categoryId on one row) rolls back every expense this
   * confirm would otherwise have created, rather than leaving a partial import.
   *
   * The first statement inside the transaction is a compare-and-swap
   * (`preview_ready` -> `confirmed`) `updateMany`. This closes a race where two
   * concurrent confirm requests for the same import job both pass the
   * pre-transaction `job.status !== "preview_ready"` check (both read the row
   * before either has written to it) and would otherwise both insert the same
   * expenses. With the CAS, only the request that wins the `updateMany` proceeds to
   * insert; the loser gets the exact same `IMPORT_NOT_CONFIRMABLE` error a
   * sequential double-confirm already produced before this fix.
   *
   * ## GAP-064 #9 — 승인 순간을 서버에 남긴다 (`approved_at` + 감사 봉투)
   *
   * 종전에는 이 경로가 **상태와 건수만** 남겼다. DNC-012("미리보기와 승인 전 `expenses`에
   * 저장하지 않는다")의 핵심 사건인 **승인**이 서버에 사건으로 남지 않았다는 뜻이다:
   * `import_jobs.approved_at`은 스키마에만 있고 읽지도 쓰지도 않는 죽은 컬럼이었고,
   * 이 컨트롤러에는 감사 로그가 한 건도 없었다(지출 수정·삭제, 아이 삭제, 가구 탈퇴,
   * 계정 삭제, 예산 덮어쓰기는 전부 `auditLogger.record`를 지난다). 확정은 쓰기 권한이 있는
   * **아무 구성원이나** 할 수 있는데(`requireImportJobAccess(user, id, true)`) 잡 행이 아는
   * 사람은 업로드한 사람(`user_id`)뿐이라, 대개는 만들어진 지출의 `created_by_user_id`로
   * 승인자를 역추적할 수 있지만 **유효 행이 0건이면 그마저 없다** — 잡은 영구히 `confirmed`가
   * 되어 다시 확정할 수 없는데(위 CAS) 누가·언제 그렇게 만들었는지 답할 근거가 0이었다.
   *
   * 그래서 두 가지를 같이 한다.
   *  1. **`approved_at`을 확정 CAS와 같은 statement에 적는다**(마이그레이션 0건 — 컬럼은 이미
   *     있다). CAS는 이 잡을 `confirmed`로 만드는 **유일한** 쓰기이므로, "status=confirmed면
   *     approved_at이 있다"가 한 statement로 보장된다. 트랜잭션이 롤백되면 둘 다 없다.
   *  2. 컨트롤러가 감사 로그 한 건(`import.confirm`)을 남긴다 — 봉투 구성은 그쪽 주석 참조.
   *     여기서는 그 봉투에 실을 **비식별 값만** 골라 `audit`로 돌려준다(HTTP 응답에는 나가지
   *     않는다 — 컨트롤러가 벗겨 낸다).
   *
   * `approved_at`의 뜻은 **"이 가져오기가 승인된 시각"의 단일 소스**다(감사 로그를 조인하지
   * 않고 잡 행만으로 읽을 수 있는 값이 하나는 있어야 한다 — 어드민이 잡을 조회하게 될 때).
   *
   * ⚠️ 파기 판정과는 무관하다: 파기 잡의 phase 9(미리보기 행 삭제)와 phase 11(잡 헤더 마스킹)은
   * 둘 다 `updated_at`을 정렬·컷오프 컬럼으로 쓴다(data-retention-purge.job.ts). `approved_at`은
   * 그 판정에 쓰이지 않으며, 이 쓰기가 창을 앞당기거나 늦추지도 않는다 — 확정 CAS는 이 변경
   * 이전에도 `updated_at`을 갱신했고(`@updatedAt`), 여기서 컬럼 하나가 더 실릴 뿐이다.
   *
   * ## GAP-066 #5 — 어느 파일에서 온 행인지를 지출에 남긴다 (`expenses.import_job_id`)
   *
   * 라운드 64가 잡 쪽에 "승인됐다"를 남겼다면, 이번에는 **지출 쪽에 출처**를 남긴다.
   * `expenses.import_job_id`는 컬럼도 FK(`fk_expenses_import_job`)도 000001부터 있었는데
   * 채우는 곳이 0건이라 언제나 NULL이었다 — 즉 잘못 확정한 200행을 **특정할 방법이 없었다**.
   * 지출이 아는 출처는 `source: "excel_import"` 한 단어뿐이라 지난달 파일에서 온 행과 오늘
   * 파일에서 온 행이 구별되지 않았고, 감사 로그(`import.confirm`)도 "몇 건"까지만 답했다.
   * 이제 확정이 자기 잡 id를 넘기므로(`insertExpense`의 `importJobId`), CS·운영이
   * "이 파일에서 온 행"을 잡 id 하나로 셀 수 있다. **마이그레이션 0건.**
   *
   * ⚠️ 라운드 67 #3에서 그 나머지 절반이 섰다: **되돌리기**(`undoImport` — 이 잡 id의 지출을
   * 묶음 soft delete + 감사 로그 1행)가 바로 이 컬럼 위에서 돈다. DNC-014를 묶음으로 지킬지
   * 건당으로 지킬지의 판단은 그 메서드 주석에 있다.
   *
   * ⚠️ **응답 DTO에는 여전히 싣지 않는다**(`store-shared.ts`의 `toExpenseDto`는 이 값을 모른다).
   * 되돌리기는 잡 id 하나로 도는 서버 경로라 이 값을 노출할 필요가 없었고, 화면이 지출마다
   * 출처 파일을 어떻게 말할지는 아직 정해진 적이 없다. `approved_at`이 밟은 순서 그대로다.
   *
   * ⚠️ 파기 판정에는 쓰이지 않는다(위 `approved_at` 문단과 같은 이유): phase 9(미리보기 행
   * 삭제)·phase 11(잡 헤더 마스킹)은 둘 다 `import_jobs.updated_at`을 정렬·컷오프 컬럼으로
   * 쓰고, 이 컬럼은 그 창 계산에 들어가지 않는다. 다만 **파기의 삭제 순서에는 실체가 생겼다**:
   * `purgeChildRows`가 잡을 지우기 전에 지출을 먼저 지우는 것("After the expenses:
   * Expense.importJobId FKs import_jobs")은 종전에는 언제나 NULL인 컬럼을 위한 방어였지만,
   * 이제는 실제로 걸리는 FK다 — 그 순서를 바꾸면 파기가 FK 위반으로 실패한다.
   * phase 11의 마스킹은 잡 **행을 남기므로** 이 FK와 무관하다(파일명만 자리표시자가 되고,
   * 그때도 "어느 잡에서 왔나"는 지출 쪽에 그대로 남는다).
   */
  async confirmImport(user: AuthenticatedUser, importJobId: string, input: ConfirmImportInput = {}) {
    const job = await this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "preview_ready") {
      throw new BadRequestException({ code: "IMPORT_NOT_CONFIRMABLE", message: "Import job is not ready to confirm." });
    }

    const selectedRowIds = new Set(input.selectedRowIds ?? []);
    const hasExplicitSelection = selectedRowIds.size > 0;
    const rows = await this.prisma.importRow.findMany({ where: { importJobId } });
    const selectedRows = rows.filter((row) => (hasExplicitSelection ? selectedRowIds.has(row.id) : row.selected));
    const importableRows = selectedRows.filter((row) => this.validationStatusForImportRow(row) === "valid");

    // 승인 시각은 트랜잭션 밖에서 한 번 만든다 — 아래 CAS에 적는 값과 감사 봉투에 싣는 값이
    // **같은 순간**이어야 한다(둘이 다르면 "언제 승인됐나"에 답이 둘이 된다).
    const approvedAt = new Date();

    const importedCount = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.importJob.updateMany({
        where: { id: importJobId, status: "preview_ready" },
        data: { status: "confirmed", approvedAt }
      });
      if (claimed.count === 0) {
        throw new BadRequestException({ code: "IMPORT_NOT_CONFIRMABLE", message: "Import job is not ready to confirm." });
      }

      await this.insertImportedExpenses(tx, job, user, importableRows, importJobId);

      await tx.importJob.update({
        where: { id: importJobId },
        data: { importedCount: importableRows.length }
      });

      return importableRows.length;
    }, IMPORT_TX_OPTIONS);

    // PUSH-113 후속(리뷰 m-2): 가져오기 커밋은 insertExpense를 직접 호출해
    // ExpensesVersionService의 지출 생성 훅을 타지 않으므로, 배치 커밋 완료 후
    // 아이별로 1회 예산 경계 평가를 fire-and-forget으로 건다. 클레임 방식은
    // usedAfter(월 합계)만 필요해 "어느 행이 경계를 넘겼는지"는 몰라도 된다.
    // 실패해도 가져오기 흐름에는 영향이 없다 (onBudgetRelevantChange는 예외를
    // 절대 던지지 않는 계약).
    if (importedCount > 0) {
      const yearMonths = [...new Set(importableRows.map((row) => fromDateOnly(row.parsedDate!).slice(0, 7)))];
      void this.pushDispatch?.onBudgetRelevantChange(job.childId, yearMonths);
    }

    const skippedCount = selectedRows.length - importedCount;

    return {
      importedCount,
      skippedCount,
      /**
       * GAP-064 #9: 감사 봉투에 실을 값(HTTP 응답 아님 — ImportsController가 벗겨 낸다).
       *
       * **파일명·행 원문은 싣지 않는다.** `import_jobs.file_name`은 사용자가 붙인 이름이라
       * 사실상 식별정보이고(GAP-063 #6), 파기 잡 phase 11이 90일 뒤 마스킹하는 값이 바로
       * 그것이다 — 감사 로그(기본 730일 보존)에 복사하면 라운드 63이 닫은 구멍이 더 긴
       * 창으로 되살아난다. 여기 있는 것은 상태·건수·시각뿐이다.
       */
      audit: {
        householdId: job.householdId,
        before: {
          status: job.status,
          rowCount: job.rowCount ?? 0,
          candidateCount: job.candidateCount ?? 0
        },
        after: {
          status: "confirmed",
          importedCount,
          skippedCount,
          approvedAt: approvedAt.toISOString()
        }
      }
    };
  }

  /**
   * GAP-067 #3 — **확정한 가져오기를 한 번에 되돌린다.**
   *
   * ## 무엇이 없었나
   * 라운드 66 #5가 `expenses.import_job_id`를 채우기 시작하면서 "이 파일에서 온 행"이 서버에서
   * 특정 가능해졌지만, 그 사실을 쓰는 곳이 0건이었다. 그래서 카드 내역 200행을 엉뚱한 아이로
   * 확정했거나 지난달 파일을 두 번 올린 사람에게 앱이 준 수단은 기록 탭에서 **한 건씩
   * 롱프레스해 지우는 것**뿐이었다(200번). 어느 200건인지 화면에서 가릴 방법도 없었다 —
   * 지출이 아는 출처는 `source: "excel_import"` 한 단어뿐이라 지난달 파일에서 온 행과 오늘
   * 파일에서 온 행이 구별되지 않는다.
   *
   * ## 이 경로가 지키는 것
   * - **soft delete + 감사 로그**(DNC-014). 지우는 방식은 개별 삭제와 **같다**
   *   (`deletedAt`·`deletedByUserId` + `version` 증가 — expenses-store.service.ts의
   *   `deleteExpense`와 finance/expenses.service.ts의 버전 증가를 한 UPDATE로 합친 것이다).
   *   버전을 올리는 이유: 오프라인 아웃박스가 들고 있던 `expectedVersion`이 그대로 통과하면
   *   되돌린 지출이 조용히 되살아난다. 그리고 `updated_at`이 갱신되므로 델타 동기화
   *   (`GET /sync/changes`)가 이 행들을 **삭제 툼스톤**으로 실어 나른다 — 오프라인 클라이언트도
   *   같은 결론에 수렴한다.
   * - **감사는 묶음 1행**(`import.undo`). 200행이면 감사 로그 200줄이 CS 화면을 덮고, 그 200줄이
   *   답하는 "어느 행이 지워졌나"는 이미 `import_job_id`가 답한다(라운드 66이 그 칸을 채운
   *   이유가 그것이다). 봉투는 `import.confirm`과 같은 규율이다 — **파일명·행 원문 금지**,
   *   상태·건수·시각만.
   * - **멱등**. 되돌리기는 살아 있는 행만 지운다(`deletedAt: null`). 두 번 누르면 두 번째는
   *   0건이고 잡 상태도 그대로다. 그래서 재전송·중복 탭이 데이터를 더 망가뜨리지 않는다.
   *
   * ## 정의: "그 파일에서 온 행 **전부**"
   * 확정 뒤에 사용자가 금액이나 분류를 고친 행도 함께 사라진다. 되돌리기를 그 파일 단위로 두는
   * 이상 피할 수 없고(고친 행만 남기면 "일부만 남은 가져오기"라는 더 설명하기 어려운 상태가
   * 된다), 그렇다면 **확인 문구가 그 사실을 말해야 한다** — 그 몫은 앱에 있다
   * (src/import/import-resume.ts의 `importUndoConfirmMessage`).
   *
   * ## 하지 않는 것
   * - **되돌리기의 되돌리기를 만들지 않는다.** soft delete라 행은 DB에 남지만, 복구 버튼을
   *   세우면 그 자체가 또 하나의 일괄 경로이고 "지웠다"는 화면의 말이 흔들린다.
   * - **잡 상태를 바꾸지 않는다.** `confirmed`는 "이 파일이 승인됐다"는 사실이고 그것은 되돌린
   *   뒤에도 참이다(그래서 감사 로그 두 줄이 순서대로 남는다). 상태를 되돌리면 CAS가 다시
   *   열려 같은 파일을 두 번 확정할 수 있게 된다.
   * - **준비템 상태(`prepared`)를 되돌리지 않는다** — 개별 삭제와 같은 판단이다(R19-B,
   *   expenses-store.service.ts `deleteExpense` 주석).
   *
   * 마이그레이션 0건 · 새 컬럼 0건.
   */
  async undoImport(user: AuthenticatedUser, importJobId: string) {
    const job = await this.requireImportJobAccess(user, importJobId, true);
    if (job.status !== "confirmed") {
      // 확정되지 않은 잡에는 되돌릴 지출이 애초에 없다(DNC-012 — 승인 전에는 expenses에 넣지
      // 않는다). 0건을 조용히 돌려주는 대신 거절하는 이유: 앱의 되돌리기 입구는 **확정된 잡
      // 하나**에만 서므로, 그 밖의 상태가 오는 것은 사용자가 아니라 호출부가 틀린 것이다.
      throw new BadRequestException({ code: "IMPORT_NOT_UNDOABLE", message: "되돌릴 수 있는 가져오기가 아니에요." });
    }

    // 아직 살아 있는 행만 본다. 사용자가 그 사이 손으로 지운 행은 이미 지워졌고, 다시 세면
    // 화면이 "200건을 되돌렸어요"라고 거짓을 말한다.
    const alive = await this.prisma.expense.findMany({
      where: { importJobId, householdId: job.householdId, deletedAt: null },
      select: { id: true, spentOn: true }
    });

    const undoneAt = new Date();
    const deletedCount =
      alive.length === 0
        ? 0
        : (
            await this.prisma.expense.updateMany({
              // `deletedAt: null`을 다시 거는 것은 위 조회와 이 UPDATE 사이의 경합 때문이다
              // (같은 순간 누군가 한 건을 지웠다면 그 행은 여기서 빠진다 — 삭제 시각이 덮이지
              // 않는다).
              where: { id: { in: alive.map((expense) => expense.id) }, deletedAt: null },
              data: { deletedAt: undoneAt, deletedByUserId: user.id, version: { increment: 1 } }
            })
          ).count;

    // 확정이 태우는 그 경로와 **같은 자리**다(PUSH-113 후속): 합계가 내려갔으므로 예산 경계
    // 판정을 아이별로 한 번 다시 건다. fire-and-forget이고 실패는 흐름에 영향이 없다.
    if (deletedCount > 0) {
      const yearMonths = [...new Set(alive.map((expense) => fromDateOnly(expense.spentOn).slice(0, 7)))];
      void this.pushDispatch?.onBudgetRelevantChange(job.childId, yearMonths);
    }

    return {
      deletedCount,
      /**
       * 감사 봉투(HTTP 응답 아님 — ImportsController가 벗겨 낸다). `import.confirm`과 **같은
       * 규율**: 파일명·행 원문은 싣지 않는다(파기 잡 phase 11이 90일 뒤 마스킹하는 값을 730일
       * 보존되는 감사 로그에 복사하지 않는다). 여기 있는 것은 상태·건수·시각뿐이다.
       */
      audit: {
        householdId: job.householdId,
        before: {
          status: job.status,
          importedCount: job.importedCount ?? 0
        },
        after: {
          status: job.status,
          deletedCount,
          undoneAt: undoneAt.toISOString()
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------------

  /**
   * 라운드 81 E — **확정의 지출 삽입을 행 수와 무관한 문장 수로 만든다.**
   *
   * ## 종전 모양과 그 비용
   * 확정 트랜잭션 안이 `for (const row of importableRows) await insertExpense(tx, …)` 였다.
   * 그런데 `insertExpense`는 **행마다 조회를 하나 먼저 한다** — `requireExistingCategory` →
   * `category.findUnique`(expenses-store.service.ts). 그래서 확정 한 번의 문장 수가
   * **2N + 2**였고, 상한을 다 채운 파일(2,000행)이면 한 트랜잭션이 4,002번 왕복했다.
   * 그 조회의 인자는 같은 값이 계속 반복된다(분류 표는 잠긴 시드 열둘을 중심으로 한 작은
   * 표이고, 한 파일의 행은 그중 소수를 반복해 가리킨다) — 교과서적인 N+1이다.
   *
   * ## 지금 모양
   * ① **분류 존재 확인을 루프 밖으로** 올린다 — 이 배치의 **고유 분류 id 집합**을 한 번 묻는다.
   * ② **삽입을 배치 한 문장**으로 모은다(`createMany`). **문장 수 = 2**(실패 경로에서만 +1).
   *
   * ## 왜 관측 결과가 바이트 불변인가
   * - **오류 계약**: 없는 분류가 하나라도 있으면 오늘과 **같은 코드·같은 문장·같은 400**이
   *   나간다(`EXPENSE_CATEGORY_INVALID`). 그 문장을 여기서 베끼지 않고 지출 생성의 단일
   *   소스에게 그대로 묻는다(`expensesStore.requireExistingCategory`) — 실패 경로에서만 도는
   *   왕복 하나다. 던지는 **시점**만 앞당겨지고 결과는 같다: 실패는 같은 트랜잭션의
   *   롤백이라 종전에도 지출은 0건 생겼고 잡도 `preview_ready`로 남았다.
   * - **CAS 우선순위 보존**: 이 호출은 확정 CAS(`updateMany`) **뒤**에 있다. 확정할 수 없는
   *   잡이면 종전처럼 `IMPORT_NOT_CONFIRMABLE`이 먼저 나간다.
   * - **행별 판정 규칙 무변경**: 어떤 행이 지출이 되는가는 여전히
   *   `validationStatusForImportRow` 하나가 정한다. 여기서 도는 것은 그 판정을 이미 통과한
   *   행들(`importableRows`)뿐이고, 이 메서드는 행을 더 넣지도 빼지도 않는다.
   *
   * ## `insertExpense`를 지나지 않는 것에 대하여
   * 그 함수는 지출 생성의 단일 소스다(수동 기록·아웃박스·"샀어요"·가져오기). 그래서 여기서
   * 우회하는 것은 **왕복 두 갈래뿐**이고, 그 함수가 하던 **순수 판정은 같은 술어로 같은 순서로**
   * 여기서 다시 지난다(품목명 trim·빈 값 → `EXPENSE_ITEM_NAME_REQUIRED`,
   * `assertExpenseDateWithinRange`, `requireMoneyKrw`). 우회되는 나머지 둘은 이 경로에서
   * **도달할 수 없는 갈래**다:
   * - `requireExistingItemTemplateAnyStatus`·`markLinkedItemPrepared` — 가져오기 행에는
   *   `linkedItemTemplateId`가 없다(확정은 그 값을 넘긴 적이 없다).
   * - `createExpenseRowOrTranslateFk`의 `LINKED_PRODUCT_LINK_NOT_FOUND` 번역 —
   *   `linkedProductLinkId`가 언제나 null이라 그 FK가 걸릴 수 없다.
   *
   * ⚠️ **`expenses` 행의 모양이 이 파일에도 적히게 된 것이 이 변경의 값 비싼 절반이다.**
   * 지출에 새 칸이 생기고 그 기본값을 `insertExpense`가 계산하게 되는 날, **여기도 함께**
   * 고쳐야 한다(가져오기로 들어온 행만 조용히 그 칸을 비운 채로 남는다). 그 사실을 아래
   * `data` 리터럴 바로 위에 한 번 더 적어 둔다.
   */
  private async insertImportedExpenses(
    tx: Prisma.TransactionClient,
    job: { householdId: string; childId: string },
    user: AuthenticatedUser,
    rows: ImportRowRow[],
    importJobId: string
  ): Promise<void> {
    if (rows.length === 0) return;

    // ① 고유 분류 id 집합 한 번. 이 집합의 크기는 **행 수가 아니라 분류 표의 크기**로 막힌다
    //    (2,000행이라도 서로 다른 분류가 그보다 많을 수는 없다) — 조회는 한 문장이고 그 인자
    //    개수도 행 수에 비례하지 않는다.
    const categoryIds = [...new Set(rows.map((row) => row.categoryId!))];
    const existingCategories = await tx.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } });
    if (existingCategories.length !== categoryIds.length) {
      const found = new Set(existingCategories.map((category) => category.id));
      const missing = categoryIds.find((categoryId) => !found.has(categoryId))!;
      // 코드·문장의 단일 소스는 여전히 expenses-store다 — 여기서 베끼면 두 문장이 갈라진다.
      await this.expensesStore.requireExistingCategory(missing, tx);
    }

    // ② 배치 한 문장. ⚠️ 아래 리터럴은 `ExpensesStoreService.insertExpense`가 만드는 지출 행과
    //    **같은 모양이어야 한다** — 그쪽에 칸이 생기면 여기도 같이 고친다(위 주석 마지막 문단).
    await tx.expense.createMany({
      data: rows.map((row) => {
        // insertExpense와 같은 술어·같은 순서의 순수 판정. `importableRows`는 이미
        // validationStatusForImportRow를 통과한 행이라 여기서 던지는 일은 실제로는 없지만,
        // "지출이 되는 값의 조건"을 이 경로만 느슨하게 두지 않기 위해 그대로 지난다.
        const itemName = row.parsedItemName!.trim();
        if (!itemName) {
          throw new BadRequestException({ code: "EXPENSE_ITEM_NAME_REQUIRED", message: "품목명을 입력해 주세요." });
        }
        const spentOn = fromDateOnly(row.parsedDate!);
        assertExpenseDateWithinRange(spentOn);

        return {
          householdId: job.householdId,
          childId: job.childId,
          createdByUserId: user.id,
          categoryId: row.categoryId!,
          amountKrw: requireMoneyKrw(row.parsedAmountKrw ?? undefined),
          spentOn: toDateOnly(spentOn),
          itemName,
          // 가져오기 행에는 판매처·메모가 없다(파서가 `merchant`를 만들지 않는다 —
          // IMPORT_ITEM_NAME_MAX_LENGTH 주석). insertExpense도 이 경로에서는 같은 값을 썼다.
          merchant: null,
          memo: null,
          paymentMethod: "unknown" as const,
          linkedItemTemplateId: null,
          linkedProductLinkId: null,
          expenseType: "expense" as const,
          source: "excel_import" as const,
          // GAP-066 #5: 이 행의 **출처 파일**을 남긴다. 같은 트랜잭션 안이라 확정이
          // 롤백되면 지출도 이 값도 없다.
          importJobId
        };
      })
    });
  }

  private async requireImportJobAccess(user: AuthenticatedUser, importJobId: string, edit = false) {
    const job = await this.prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) {
      throw new NotFoundException({ code: "IMPORT_JOB_NOT_FOUND", message: "Import job was not found." });
    }
    await this.childAccess.requireChildAccess(user, job.childId, edit);
    return job;
  }

  /**
   * 라운드 41 K-2: `childId`를 응답에 싣는다.
   *
   * 가져오기 잡은 생성 시점에 아이 하나에 박히고(`POST /children/:childId/imports/excel`),
   * `confirmImport`는 그 `job.childId`의 가계부에 지출을 넣는다(insertExpense 인자). 그런데
   * 응답에는 그 아이가 없어서, 검수 화면은 "대상 아이"를 클라이언트의 선택 아이 스토어 값으로
   * 추측할 수밖에 없었다 -- 다자녀 가구에서 아이를 바꾼 뒤 예전 검수 링크로 돌아오면 화면이
   * 틀린 이름을 단언했다.
   *
   * 개인정보 노출이 아니다: 이 엔드포인트들은 이미 `requireImportJobAccess` →
   * `requireChildAccess`를 지나므로, 응답을 받는 사용자는 그 아이에 접근 권한이 있는 사용자뿐이고
   * 아이 id 자체도 이미 그 사용자가 알고 있는 값이다(children 목록에 들어 있다).
   */
  private toImportJobDto(job: {
    id: string;
    childId: string;
    status: ImportStatus;
    rowCount: number | null;
    candidateCount: number | null;
    importedCount: number | null;
  }) {
    return {
      id: job.id,
      childId: job.childId,
      status: job.status,
      rowCount: job.rowCount ?? 0,
      candidateCount: job.candidateCount ?? 0,
      importedCount: job.importedCount ?? 0
    };
  }

  private toImportRowDto(row: ImportRowRow) {
    return {
      id: row.id,
      rowIndex: row.rowIndex,
      parsedDate: row.parsedDate ? fromDateOnly(row.parsedDate) : undefined,
      parsedItemName: row.parsedItemName ?? undefined,
      parsedAmountKrw: row.parsedAmountKrw ?? undefined,
      categoryId: row.categoryId ?? undefined,
      confidence: Number(row.confidence),
      selected: row.selected,
      validationStatus: this.displayValidationStatusForImportRow(row)
    };
  }

  /**
   * 라운드 58 통합리뷰 P2-4 — 검수 화면에 내보내는 상태는 **저장된 값이 아니라 지금 판정한 값**이다.
   *
   * 무엇이 어긋나 있었나: 이 파이프라인에는 상태를 묻는 자리가 셋이다 — 미리보기 생성
   * (`buildImportRowsFromParsed`) · 검수 PATCH(`updateImportRow`) · 확정(`confirmImport`).
   * 뒤의 둘은 언제나 `validationStatusForImportRow`를 지나는데, **읽기 경로**(listImportRows →
   * toImportRowDto)만 미리보기 생성 시점에 저장된 문자열을 그대로 돌려주고 있었다. 그래서 그
   * 판정이 바뀐 배포(GAP-058 #8: 101~120자 품목명 강등) 이전에 만들어진 잡의 110자 행은
   * 검수 화면에 여전히 `valid`로, 체크된 채로, "가져올 수 있어요"라는 얼굴로 서 있었다 —
   * 그리고 확정을 누르면 그 행만 조용히 빠졌다(확정은 다시 판정하므로). 화면이 사용자에게
   * 참이 아닌 것을 보여 준 뒤 말없이 다르게 행동하는 자리다.
   *
   * 세 경로가 같은 자를 쓰면 그 어긋남이 구조적으로 사라진다. 저장된 컬럼은 건드리지 않는다
   * (읽기 요청이 쓰기를 하지 않는다 — 다음 PATCH가 그 행을 지날 때 자연히 맞춰진다).
   *
   * 예외 하나: **121자 이상이라 값을 비운 행**(`item_name_too_long`). 저장된 행만 보면 품목명이
   * 빈 행과 구별되지 않아 다시 판정하면 `missing_item_name`이 되는데, 그건 사실보다 덜 정확한
   * 사유다(원본은 비어 있던 것이 아니라 너무 길었다 — buildImportRowsFromParsed 주석). 그 행은
   * 저장된 상태가 더 정확하므로 그대로 둔다.
   */
  private displayValidationStatusForImportRow(row: ImportRowRow) {
    if (row.validationStatus === IMPORT_ROW_ITEM_NAME_TOO_LONG_STATUS) return row.validationStatus;
    return this.validationStatusForImportRow(row);
  }

  private requireAcceptedImportFile(input: CreateImportJobInput) {
    const fileName = input.fileName?.trim();
    if (!fileName) {
      throw new BadRequestException({ code: "IMPORT_FILE_REQUIRED", message: "Import file is required." });
    }

    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx") {
      throw new BadRequestException({ code: "IMPORT_FILE_TYPE_INVALID", message: "Only csv or xlsx files are allowed." });
    }

    if (input.fileSizeBytes !== undefined && input.fileSizeBytes > IMPORT_MAX_FILE_SIZE_BYTES) {
      // API-130: 실제 스트림이 상한을 넘어 multer가 끊는 경우(413)와 같은
      // 코드/문구를 쓴다 — 상수는 GlobalExceptionFilter가 단일 소스.
      throw new BadRequestException({ code: IMPORT_FILE_TOO_LARGE_CODE, message: IMPORT_FILE_TOO_LARGE_MESSAGE });
    }

    if (input.estimatedRowCount !== undefined && input.estimatedRowCount > importMaxRows) {
      throw new BadRequestException({ code: "IMPORT_TOO_MANY_ROWS", message: "Import files can include up to 2,000 rows." });
    }

    return fileName;
  }

  /**
   * Resolves each parser-produced row (pure text/number data, no DB access) into
   * a persistable ImportRowRow: maps `categoryCode` -> a real seeded
   * `categories.id` (falling back to `defaultImportCategoryId` when there's no
   * keyword match or the code doesn't resolve), flags duplicate candidates
   * against the child's existing non-deleted expenses (same date + amount), and
   * computes each row's validationStatus/selected default from that.
   */
  private async buildImportRowsFromParsed(childId: string, parsedRows: ParsedImportRow[]): Promise<ImportRowRow[]> {
    const categoryCodes = [...new Set(parsedRows.map((row) => row.categoryCode).filter((code): code is string => Boolean(code)))];
    const categories = categoryCodes.length
      ? await this.prisma.category.findMany({ where: { code: { in: categoryCodes } }, select: { id: true, code: true } })
      : [];
    const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

    /**
     * GAP-054 라운드 54 P1-1: 중복 후보 조회의 모집단에는 **저장 가능한 금액만** 넣는다.
     *
     * `expenses.amount_krw`는 int4다. 파일에 그 범위를 넘는 값이 한 줄이라도 있으면 아래
     * `amountKrw: { in: [...] }`가 int4로 바인딩되지 못해 **미리보기 생성 자체가 500**으로
     *끝났다 — 검증 상태를 붙일 기회도 없이 파일 전체가 거절된다. 어차피 상한 밖 금액과
     * 같은 지출은 DB에 존재할 수 없으므로(그 값은 애초에 저장될 수 없다) 이 행들은 중복
     * 후보가 없는 것이 사실이고, 뒤이어 `validationStatusForImportRow`가 그 행만
     * `invalid_amount`로 떨군다.
     */
    const duplicateLookupRows = parsedRows.filter((row) => row.dateIso && isMoneyKrw(row.amountKrw));
    const candidateDates = [...new Set(duplicateLookupRows.map((row) => row.dateIso!))];
    const candidateAmounts = [...new Set(duplicateLookupRows.map((row) => row.amountKrw!))];
    const existingExpenses =
      candidateDates.length && candidateAmounts.length
        ? await this.prisma.expense.findMany({
            where: {
              childId,
              deletedAt: null,
              spentOn: { in: candidateDates.map((iso) => toDateOnly(iso)) },
              amountKrw: { in: candidateAmounts }
            },
            select: { id: true, spentOn: true, amountKrw: true }
          })
        : [];
    const existingExpenseIdByKey = new Map(
      existingExpenses.map((expense) => [`${fromDateOnly(expense.spentOn)}|${expense.amountKrw}`, expense.id])
    );

    return parsedRows.map((row) => {
      const categoryId = (row.categoryCode ? categoryIdByCode.get(row.categoryCode) : undefined) ?? defaultImportCategoryId;
      const duplicateCandidateExpenseId =
        row.dateIso && row.amountKrw != null ? existingExpenseIdByKey.get(`${row.dateIso}|${row.amountKrw}`) ?? null : null;

      /**
       * 라운드 57 QA(P2-13) — **너무 긴 품목명이 파일 전체를 500으로 만들지 않게.**
       *
       * `import_rows.parsed_item_name`은 `varchar(120)`이다(prisma/schema.prisma). 파일에 121자
       * 이상인 셀이 한 줄이라도 있으면 아래 `importRow.create`가 DB에서 터지고, 그 insert는
       * 미리보기 생성 트랜잭션 안이라 **파일 전체가 거절**된다 — 검증 상태를 붙일 기회조차 없다.
       * 금액(int4)에서 라운드 54 P1-1이 고친 것과 **정확히 같은 형태의 결함**이고, 텍스트 쪽만
       * 남아 있었다.
       *
       * 자르지 않는다. 사용자가 적은 값을 앱이 조용히 짧게 만들면 그 뒤로는 원본을 되찾을 방법이
       * 없고, 그건 이 저장소의 계약 위반이다(모바일 text-limits.ts 머리말: "조용히 잘라 버리지
       * 않는다"). 121자 이상은 검수 화면에 **원본을 보존한 채로 보여줄 자리도 없다** — 보여줄
       * 값이 곧 저장된 값이고, 컬럼이 그 길이를 담지 못한다. 그래서 금액과 같은 선택을 한다:
       * 값을 비우고 그 행만 별도 상태로 떨군다. 사용자에게는 "이 행은 가져올 수 없어요 · 원본
       * 파일에서 고친 뒤 다시 올려 주세요"로 보이고(모바일 preview-rows.ts는 모르는 상태를
       * 보수적으로 `locked`로 떨어뜨린다), 같은 파일의 나머지 행은 평소대로 살아난다.
       *
       * GAP-058 #8 — 101~120자는 **담을 수는 있지만 지출이 될 수는 없는** 구간이다(계약 상한은
       * 100 — IMPORT_ITEM_NAME_MAX_LENGTH 주석). 121자 이상과 같은 상태·같은 미선택으로 떨구되
       * **값은 지우지 않는다**: 컬럼이 담을 수 있는 값을 굳이 비우면 사용자가 어느 행인지조차
       * 알 수 없고, 원본을 보존하는 편이 이 저장소의 기본값이다. 길이 판정 자체는
       * `validationStatusForImportRow`가 들고 있으므로(그래야 검수 화면의 PATCH·확정도 같은
       * 자를 쓴다) 여기서는 값을 비울지만 정한다.
       */
      const itemNameOverColumn = isOverImportTextColumn(row.itemName);

      const base = {
        id: randomUUID(),
        importJobId: "",
        rowIndex: row.rowIndex,
        parsedDate: row.dateIso ? toDateOnly(row.dateIso) : null,
        parsedItemName: itemNameOverColumn ? null : row.itemName,
        /**
         * GAP-054 라운드 54 P1-1: `import_rows.parsed_amount_krw`도 int4다. 파일이 그 범위를
         * 넘는 값을 들고 오면 **미리보기 행 생성 자체가 500**이라, 검증 상태를 붙이기는커녕
         * 파일 전체가 거절됐다(마이그레이션 없이 고칠 수 있는 유일한 지점이 여기다).
         *
         * 저장할 수 없는 값을 잘라 넣지 않는다(허위 표시 금지) — 금액을 비우고, 아래
         * `validationStatusForImportRow`가 그 행을 `invalid_amount`로 판정한다. 사용자에게는
         * "이 행의 금액을 읽지 못했다"로 보이고, 같은 파일의 나머지 행은 평소대로 살아난다.
         */
        parsedAmountKrw: isMoneyKrw(row.amountKrw) ? row.amountKrw : null,
        categoryId,
        confidence: row.confidence,
        userReviewed: false,
        duplicateCandidateExpenseId
      };

      // 121자 이상은 저장된 행만 봐서는 알 수 없다(값을 비웠으므로 "빈 품목명"과 구별되지 않는다).
      // 그래서 원본을 아는 이 자리에서 상태를 정한다 -- 그래야 화면이 "비어 있다"가 아니라
      // "너무 길다"라는 **실제 사유**를 말할 수 있다. 101~120자는 값이 그대로 남아 있으므로
      // validationStatusForImportRow가 같은 상태를 스스로 판정한다(같은 임계·같은 상태).
      const validationStatus = itemNameOverColumn
        ? IMPORT_ROW_ITEM_NAME_TOO_LONG_STATUS
        : this.validationStatusForImportRow(base);
      return { ...base, validationStatus, selected: validationStatus === "valid" };
    });
  }

  private validationStatusForImportRow(row: {
    parsedDate: Date | null;
    parsedItemName: string | null;
    parsedAmountKrw: number | null;
    categoryId: string | null;
    confidence: Prisma.Decimal | number;
    userReviewed: boolean;
    duplicateCandidateExpenseId?: string | null;
  }) {
    if (!row.parsedDate) return "missing_date";
    try {
      assertExpenseDateWithinRange(fromDateOnly(row.parsedDate));
    } catch {
      return "invalid_date";
    }

    if (!row.parsedItemName?.trim()) return "missing_item_name";

    /**
     * GAP-058 #8: 확정은 DTO를 지나지 않는다(`confirmImport` -> `insertExpense`). 그러니 "지출
     * 계약에 맞는 길이인가"는 **여기서** 한 번 물어야 한다 — 여기가 미리보기 생성·검수 PATCH·
     * 확정이 모두 지나는 유일한 자리다. 금액이 `requireMoneyKrw`로 int4 상한을 함께 보는 것과
     * 같은 구조다(라운드 54 P1-1). 통과하지 못한 행은 `selected`에서 빠지고(update 경로) 확정의
     * `importableRows`에서도 빠지므로, 상한을 넘긴 품목명이 지출이 되는 경로가 없어진다.
     */
    if (isOverImportItemNameLimit(row.parsedItemName)) return IMPORT_ROW_ITEM_NAME_TOO_LONG_STATUS;

    // GAP-054 라운드 54 P1-1: 이 판정은 도메인 술어(`assertMoneyKrw`)를 그대로 지나므로
    // **int4 상한**까지 함께 본다. 상한이 없던 동안 초과 금액 행이 `valid`로 판정돼 기본
    // 선택까지 되고, 확정 트랜잭션의 insert에서 DB가 터져 **파일 전체가 롤백**됐다(확정은
    // 한 트랜잭션이다 — confirmImport 주석). 이제 그 행만 `invalid_amount`가 되어 선택에서
    // 빠지고, 같은 파일의 나머지 행은 평소대로 들어온다.
    try {
      requireMoneyKrw(row.parsedAmountKrw ?? undefined);
    } catch {
      return "invalid_amount";
    }

    if (!row.categoryId) return "missing_category";
    if (!row.userReviewed && row.duplicateCandidateExpenseId) return "duplicate_candidate";
    if (!row.userReviewed && Number(row.confidence) < 0.7) return "low_confidence_duplicate_candidate";
    return "valid";
  }
}
