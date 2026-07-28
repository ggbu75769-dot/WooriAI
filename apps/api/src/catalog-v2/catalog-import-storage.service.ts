import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

type StoredObject = {
  bytes: Buffer;
  contentType: string;
  metadata: Record<string, string>;
  etag: string;
  lastModified: Date;
};

export type CatalogImportObjectInfo = {
  key: string;
  size: number;
  etag: string | null;
  lastModified: Date | null;
  metadata: Record<string, string>;
};

export class CatalogImportStorageError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
  }
}

const memoryObjects = new Map<string, StoredObject>();

function storageError(error: unknown, fallback: string) {
  const name = error && typeof error === "object" ? String((error as { name?: string }).name ?? "") : "";
  const status = error && typeof error === "object" ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode) : 0;
  if (["NoSuchKey", "NotFound"].includes(name) || status === 404) return new CatalogImportStorageError("CATALOG_IMPORT_OBJECT_NOT_FOUND", false);
  return new CatalogImportStorageError(fallback, status === 0 || status >= 500 || status === 429);
}

@Injectable()
export class CatalogImportStorageService {
  private readonly mode = process.env.OBJECT_STORAGE_ADAPTER === "s3" ? "s3" : "memory";
  private readonly bucket = process.env.S3_BUCKET ?? "wooriai-local";
  private readonly client = this.mode === "s3" ? new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "ap-northeast-2",
    forcePathStyle: true,
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined
  }) : null;
  private bucketReady = false;

  adapterMode() {
    return this.mode;
  }

  async health() {
    if (this.mode === "memory") return { state: process.env.NODE_ENV === "production" ? "misconfigured" : "healthy", adapter: this.mode };
    try {
      await this.client!.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { state: "healthy", adapter: this.mode };
    } catch {
      return { state: "degraded", adapter: this.mode };
    }
  }

  async put(key: string, bytes: Buffer, contentType: string, metadata: Record<string, string>) {
    this.assertKey(key);
    if (this.mode === "memory") {
      if (process.env.NODE_ENV === "production") throw new CatalogImportStorageError("OBJECT_STORAGE_S3_REQUIRED", false);
      const etag = `memory-${metadata.sha256 ?? bytes.length}`;
      memoryObjects.set(key, { bytes: Buffer.from(bytes), contentType, metadata: { ...metadata }, etag, lastModified: new Date() });
      return { etag };
    }
    await this.ensureBucket();
    try {
      const result = await this.client!.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType, Metadata: metadata }));
      return { etag: result.ETag?.replaceAll('"', "") ?? null };
    } catch (error) {
      throw storageError(error, "CATALOG_IMPORT_UPLOAD_FAILED");
    }
  }

  async get(key: string) {
    this.assertKey(key);
    if (this.mode === "memory") {
      const object = memoryObjects.get(key);
      if (!object) throw new CatalogImportStorageError("CATALOG_IMPORT_OBJECT_NOT_FOUND", false);
      return Buffer.from(object.bytes);
    }
    try {
      const result = await this.client!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) throw new CatalogImportStorageError("CATALOG_IMPORT_OBJECT_NOT_FOUND", false);
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof CatalogImportStorageError) throw error;
      throw storageError(error, "CATALOG_IMPORT_DOWNLOAD_FAILED");
    }
  }

  async head(key: string): Promise<CatalogImportObjectInfo | null> {
    this.assertKey(key);
    if (this.mode === "memory") {
      const object = memoryObjects.get(key);
      return object ? { key, size: object.bytes.length, etag: object.etag, lastModified: object.lastModified, metadata: { ...object.metadata } } : null;
    }
    try {
      const result = await this.client!.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        key,
        size: Number(result.ContentLength ?? 0),
        etag: result.ETag?.replaceAll('"', "") ?? null,
        lastModified: result.LastModified ?? null,
        metadata: result.Metadata ?? {}
      };
    } catch (error) {
      const mapped = storageError(error, "CATALOG_IMPORT_HEAD_FAILED");
      if (mapped.code === "CATALOG_IMPORT_OBJECT_NOT_FOUND") return null;
      throw mapped;
    }
  }

  async list(prefix = "catalog-imports/sha256/"): Promise<CatalogImportObjectInfo[]> {
    this.assertKey(prefix);
    if (this.mode === "memory") {
      return [...memoryObjects.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, object]) => ({ key, size: object.bytes.length, etag: object.etag, lastModified: object.lastModified, metadata: { ...object.metadata } }));
    }
    const objects: CatalogImportObjectInfo[] = [];
    let continuationToken: string | undefined;
    try {
      do {
        const page = await this.client!.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }));
        for (const object of page.Contents ?? []) {
          if (object.Key) objects.push({ key: object.Key, size: Number(object.Size ?? 0), etag: object.ETag?.replaceAll('"', "") ?? null, lastModified: object.LastModified ?? null, metadata: {} });
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
      return objects;
    } catch (error) {
      throw storageError(error, "CATALOG_IMPORT_LIST_FAILED");
    }
  }

  async delete(key: string) {
    this.assertKey(key);
    if (this.mode === "memory") {
      memoryObjects.delete(key);
      return;
    }
    try {
      await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw storageError(error, "CATALOG_IMPORT_DELETE_FAILED");
    }
  }

  private assertKey(key: string) {
    if (!key.startsWith("catalog-imports/sha256/") || key.includes("..") || key.includes("\\") || key.length > 500) {
      throw new CatalogImportStorageError("CATALOG_IMPORT_OBJECT_KEY_INVALID", false);
    }
  }

  private async ensureBucket() {
    if (this.bucketReady || !this.client) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw storageError(error, "CATALOG_IMPORT_BUCKET_UNAVAILABLE");
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (createError) {
        throw storageError(createError, "CATALOG_IMPORT_BUCKET_CREATE_FAILED");
      }
    }
    this.bucketReady = true;
  }
}
