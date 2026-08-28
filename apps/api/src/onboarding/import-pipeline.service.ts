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
  assertNotFutureDate,
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

      for (const row of rows) {
        await tx.importRow.create({
          data: {
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
          }
        });
      }

      const candidateCount = rows.filter((row) => Number(row.confidence) >= 0.7).length;
      return tx.importJob.update({
        where: { id: created.id },
        data: { rowCount: rows.length, candidateCount }
      });
    });

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
   * ⚠️ 여기까지다. 되돌리기(일괄 soft delete)는 이번 범위가 아니다 — DNC-014(soft delete +
   * 감사 로그)를 건당으로 지킬지 묶음으로 지킬지가 선행 판단이고, 홈·리포트·예산 캐시
   * 무효화 경로를 한 번에 태우는 배치가 새로 생긴다. 응답 DTO에도 싣지 않는다
   * (`store-shared.ts`의 `toExpenseDto`는 이 값을 모른다) — 화면이 출처를 어떻게 말할지는
   * 되돌리기 설계와 함께 서야 한다. `approved_at`이 밟은 순서 그대로다.
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

      for (const row of importableRows) {
        await this.expensesStore.insertExpense(tx, job.householdId, job.childId, user, {
          categoryId: row.categoryId!,
          amountKrw: row.parsedAmountKrw!,
          spentOn: fromDateOnly(row.parsedDate!),
          itemName: row.parsedItemName!,
          paymentMethod: "unknown",
          source: "excel_import",
          // GAP-066 #5: 이 행의 **출처 파일**을 남긴다. 같은 트랜잭션 안이라 확정이
          // 롤백되면 지출도 이 값도 없다. 판정 규칙(`validationStatusForImportRow`)·
          // 선택 규칙은 손대지 않았다 — 채우는 것은 이 한 칸뿐이다.
          importJobId
        });
      }

      await tx.importJob.update({
        where: { id: importJobId },
        data: { importedCount: importableRows.length }
      });

      return importableRows.length;
    });

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

  // ---------------------------------------------------------------------------
  // internal helpers
  // ---------------------------------------------------------------------------

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
      assertNotFutureDate(fromDateOnly(row.parsedDate));
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
