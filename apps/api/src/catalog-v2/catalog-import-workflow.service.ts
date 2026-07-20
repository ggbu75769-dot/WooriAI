import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { parseCatalogImportFile } from "./catalog-import-file-parser";
import { CatalogImportStorageError, CatalogImportStorageService } from "./catalog-import-storage.service";
import { CatalogV2Service } from "./catalog-v2.service";
import type { ApplyCatalogImportDto } from "./dto/catalog-v2.dto";

const PREFIX = "catalog-imports/sha256/";
const ACTIVE_STATES = ["uploading", "uploaded", "previewing", "validating", "ready", "applying"] as const;

function safeSourceName(value: string) {
  return basename(value.replaceAll("\\", "/")).slice(0, 200);
}

function fileIdentity(bytes: Buffer, originalName: string) {
  const extension = extname(originalName).toLowerCase();
  if (![".csv", ".xlsx"].includes(extension)) {
    throw new BadRequestException({ code: "CATALOG_IMPORT_FILE_TYPE_UNSUPPORTED", message: "CSV 또는 XLSX 파일만 사용할 수 있어요." });
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    sha256,
    objectKey: `${PREFIX}${sha256}${extension}`,
    contentType: extension === ".csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };
}

@Injectable()
export class CatalogImportWorkflowService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogImportStorageService) private readonly storage: CatalogImportStorageService,
    @Inject(CatalogV2Service) private readonly catalog: CatalogV2Service
  ) {}

  async previewFile(adminId: string, file: { originalname: string; buffer: Buffer }) {
    const sourceName = safeSourceName(file.originalname);
    const identity = fileIdentity(file.buffer, sourceName);
    let catalogImport = await this.prisma.catalogImport.findUnique({ where: { sourceHash: identity.sha256 } });
    if (catalogImport?.state === "applied") {
      return { import: catalogImport, preview: catalogImport.validationJson, idempotent: true };
    }
    if (catalogImport && ["ready", "rejected"].includes(catalogImport.state) && catalogImport.objectKey === identity.objectKey && catalogImport.validationJson) {
      const stored = await this.storage.head(identity.objectKey);
      if (stored?.size === file.buffer.length && stored.metadata.sha256 === identity.sha256) {
        return { import: catalogImport, preview: catalogImport.validationJson, idempotent: true };
      }
    }
    if (!catalogImport) {
      catalogImport = await this.prisma.catalogImport.create({
        data: {
          requestedByAdminId: adminId,
          sourceName,
          sourceHash: identity.sha256,
          objectKey: identity.objectKey,
          objectSha256: identity.sha256,
          objectSizeBytes: BigInt(file.buffer.length),
          state: "uploading"
        }
      });
    }

    try {
      const upload = await this.storage.put(identity.objectKey, file.buffer, identity.contentType, {
        importid: catalogImport.id,
        sha256: identity.sha256
      });
      const stored = await this.storage.head(identity.objectKey);
      if (!stored || stored.size !== file.buffer.length || stored.metadata.sha256 !== identity.sha256) {
        throw new CatalogImportStorageError("CATALOG_IMPORT_OBJECT_VERIFICATION_FAILED", true);
      }
      catalogImport = await this.prisma.catalogImport.update({
        where: { id: catalogImport.id },
        data: {
          state: "previewing",
          objectKey: identity.objectKey,
          objectSha256: identity.sha256,
          objectSizeBytes: BigInt(file.buffer.length),
          objectEtag: upload.etag,
          version: { increment: 1 },
          lastErrorCode: null
        }
      });
      const storedBytes = await this.storage.get(identity.objectKey);
      if (createHash("sha256").update(storedBytes).digest("hex") !== identity.sha256) {
        throw new CatalogImportStorageError("CATALOG_IMPORT_OBJECT_HASH_MISMATCH", false);
      }
      const parsed = await parseCatalogImportFile(storedBytes, sourceName);
      return await this.catalog.previewDraftImport(adminId, parsed);
    } catch (error) {
      const storageError = error instanceof CatalogImportStorageError ? error : null;
      await this.prisma.catalogImport.updateMany({
        where: { id: catalogImport.id, state: { not: "applied" } },
        data: {
          state: storageError?.retryable ? "retryable_failure" : "permanent_failure",
          lastErrorCode: storageError?.code ?? "CATALOG_IMPORT_PREVIEW_FAILED",
          version: { increment: 1 }
        }
      });
      throw error;
    }
  }

  async apply(adminId: string, importId: string, input: ApplyCatalogImportDto) {
    const catalogImport = await this.prisma.catalogImport.findUnique({ where: { id: importId } });
    if (!catalogImport) throw new NotFoundException({ code: "CATALOG_IMPORT_NOT_FOUND", message: "가져오기 작업을 찾을 수 없어요." });
    if (catalogImport.objectKey) {
      const object = await this.storage.head(catalogImport.objectKey);
      if (!object) {
        await this.prisma.catalogImport.updateMany({
          where: { id: importId, version: catalogImport.version },
          data: { state: "missing_object", lastErrorCode: "CATALOG_IMPORT_OBJECT_NOT_FOUND", version: { increment: 1 } }
        });
        throw new ConflictException({ code: "CATALOG_IMPORT_OBJECT_NOT_FOUND", message: "원본 파일이 없어 적용할 수 없어요. 파일을 다시 올려 주세요." });
      }
      if (object.size !== Number(catalogImport.objectSizeBytes) || object.metadata.sha256 !== catalogImport.objectSha256) {
        throw new ConflictException({ code: "CATALOG_IMPORT_OBJECT_MISMATCH", message: "원본 파일 검증에 실패했어요." });
      }
    }
    return await this.catalog.applyDraftImport(adminId, importId, input);
  }

  async reconcile(dryRun = true) {
    const [objects, imports] = await Promise.all([
      this.storage.list(PREFIX),
      this.prisma.catalogImport.findMany({
        where: { OR: [{ objectKey: { not: null } }, { state: { in: [...ACTIVE_STATES, "retryable_failure", "missing_object", "orphaned"] } }] },
        orderBy: { createdAt: "asc" }
      })
    ]);
    const importByKey = new Map(imports.filter((item) => item.objectKey).map((item) => [item.objectKey!, item]));
    const objectKeys = new Set(objects.map((object) => object.key));
    const configuredAge = Number(process.env.CATALOG_IMPORT_RECONCILIATION_STALE_MS ?? 15 * 60_000);
    const minimumAge = process.env.NODE_ENV === "test" ? 0 : 60_000;
    const cutoff = Date.now() - Math.max(minimumAge, configuredAge);
    const orphanObjects = objects.filter((object) => !importByKey.has(object.key) && (object.lastModified?.getTime() ?? 0) < cutoff);
    const missingObjectJobs = imports.filter((item) => item.objectKey && !objectKeys.has(item.objectKey));
    const staleJobs = imports.filter((item) => ACTIVE_STATES.includes(item.state as (typeof ACTIVE_STATES)[number]) && item.updatedAt.getTime() < cutoff);
    return {
      dryRun,
      adapter: this.storage.adapterMode(),
      scanned: { objects: objects.length, jobs: imports.length },
      orphanObjects: orphanObjects.map((object) => ({ objectKey: object.key, size: object.size, lastModified: object.lastModified })),
      missingObjectJobs: missingObjectJobs.map((item) => ({ id: item.id, state: item.state, version: item.version, objectKey: item.objectKey })),
      staleJobs: staleJobs.map((item) => ({ id: item.id, state: item.state, version: item.version, objectKey: item.objectKey }))
    };
  }

  async repairImport(importId: string, expectedVersion: number) {
    const catalogImport = await this.prisma.catalogImport.findUnique({ where: { id: importId } });
    if (!catalogImport) throw new NotFoundException({ code: "CATALOG_IMPORT_NOT_FOUND", message: "가져오기 작업을 찾을 수 없어요." });
    if (catalogImport.version !== expectedVersion) throw new ConflictException({ code: "CATALOG_IMPORT_VERSION_CONFLICT", message: "가져오기 상태가 변경됐어요." });
    const object = catalogImport.objectKey ? await this.storage.head(catalogImport.objectKey) : null;
    const nextState = object ? "uploaded" : "missing_object";
    const changed = await this.prisma.catalogImport.updateMany({
      where: { id: importId, version: expectedVersion, state: { notIn: ["applied", "applying"] } },
      data: {
        state: nextState,
        lastErrorCode: object ? null : "CATALOG_IMPORT_OBJECT_NOT_FOUND",
        reconciledAt: new Date(),
        reconciliationJson: { action: "repair", objectPresent: Boolean(object) } as Prisma.InputJsonValue,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw new ConflictException({ code: "CATALOG_IMPORT_REPAIR_CONFLICT", message: "진행 중인 작업은 변경할 수 없어요." });
    return await this.prisma.catalogImport.findUniqueOrThrow({ where: { id: importId } });
  }

  async cleanupOrphan(objectKey: string) {
    const scan = await this.reconcile(true);
    if (!scan.orphanObjects.some((object) => object.objectKey === objectKey)) {
      throw new ConflictException({ code: "CATALOG_IMPORT_ORPHAN_CHANGED", message: "이 객체는 더 이상 정리 대상이 아니에요." });
    }
    await this.storage.delete(objectKey);
    return { success: true, objectKey };
  }
}
