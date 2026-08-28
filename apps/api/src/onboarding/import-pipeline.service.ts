import { randomUUID } from "node:crypto";
import { BadRequestException, HttpException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
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
 * DTO의 `@MaxLength(100)`(검수 화면이 고쳐 보내는 값의 계약)이 아니라 **물리적 한계**다. 엑셀
 * 가져오기는 사용자가 만든 파일을 그대로 읽으므로 계약보다 넓은 값이 들어올 수 있고, 이 숫자를
 * 넘는 순간 insert가 DB에서 터진다. 두 숫자의 관계는 모바일 text-limits.ts 머리말의 "컬럼은
 * 120인데 상한이 100인 이유"와 같다.
 */
const IMPORT_TEXT_COLUMN_MAX_LENGTH = 120;

/** 이 행의 `validationStatus` — 품목명이 컬럼 폭을 넘어 저장할 수 없었다. */
const IMPORT_ROW_ITEM_NAME_TOO_LONG_STATUS = "item_name_too_long";

/** 저장할 수 없는 길이인가. 값이 없으면(선택 입력·빈 셀) 길이 문제는 아니다. */
function isOverImportTextColumn(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > IMPORT_TEXT_COLUMN_MAX_LENGTH;
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

    const importedCount = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.importJob.updateMany({
        where: { id: importJobId, status: "preview_ready" },
        data: { status: "confirmed" }
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
          source: "excel_import"
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

    return {
      importedCount,
      skippedCount: selectedRows.length - importedCount
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
      validationStatus: row.validationStatus
    };
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
       * 라운드 57 QA(P2-13) — **컬럼 폭을 넘는 품목명이 파일 전체를 500으로 만들지 않게.**
       *
       * `import_rows.parsed_item_name`은 `varchar(120)`이다(prisma/schema.prisma). 파일에 121자
       * 이상인 셀이 한 줄이라도 있으면 아래 `importRow.create`가 DB에서 터지고, 그 insert는
       * 미리보기 생성 트랜잭션 안이라 **파일 전체가 거절**된다 — 검증 상태를 붙일 기회조차 없다.
       * 금액(int4)에서 라운드 54 P1-1이 고친 것과 **정확히 같은 형태의 결함**이고, 텍스트 쪽만
       * 남아 있었다.
       *
       * 자르지 않는다. 사용자가 적은 값을 앱이 조용히 짧게 만들면 그 뒤로는 원본을 되찾을 방법이
       * 없고, 그건 이 저장소의 계약 위반이다(모바일 text-limits.ts 머리말: "조용히 잘라 버리지
       * 않는다"). 검수 화면에 **원본을 보존한 채로 보여줄 자리도 없다** — 보여줄 값이 곧 저장된
       * 값이고, 컬럼이 그 길이를 담지 못한다. 그래서 금액과 같은 선택을 한다: 값을 비우고 그
       * 행만 별도 상태로 떨군다. 사용자에게는 "이 행은 가져올 수 없어요 · 원본 파일에서 고친 뒤
       * 다시 올려 주세요"로 보이고(모바일 preview-rows.ts는 모르는 상태를 보수적으로 `locked`로
       * 떨어뜨린다), 같은 파일의 나머지 행은 평소대로 살아난다.
       *
       * 판매처는 여기서 방어할 것이 없다: `import_rows.merchant` 컬럼은 있지만 파서가
       * `merchant`를 만들지 않고(`ParsedImportRow`에 그 필드가 없다) 이 insert도 그 컬럼을 쓰지
       * 않는다. 없는 경로를 위한 방어를 미리 적어 두면 다음 사람이 그것을 "이미 쓰이는 값"으로
       * 읽는다 — 파서가 판매처를 만들게 되는 날 같은 자리에서 같은 규칙으로 막으면 된다.
       */
      const itemNameTooLong = isOverImportTextColumn(row.itemName);

      const base = {
        id: randomUUID(),
        importJobId: "",
        rowIndex: row.rowIndex,
        parsedDate: row.dateIso ? toDateOnly(row.dateIso) : null,
        parsedItemName: itemNameTooLong ? null : row.itemName,
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

      // 길이 초과는 저장된 행만 봐서는 알 수 없다(값을 비웠으므로 "빈 품목명"과 구별되지 않는다).
      // 그래서 원본을 아는 이 자리에서 상태를 정한다 -- 그래야 화면이 "비어 있다"가 아니라
      // "너무 길다"라는 **실제 사유**를 말할 수 있다.
      const validationStatus = itemNameTooLong
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
