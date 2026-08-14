import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * COM-107-prep: request body shared by POST /admin/product-links/bulk-preview
 * and /bulk-apply. Plain JSON `{ csv }` (not multipart) to match every other
 * admin CMS endpoint the apps/admin client calls through its JSON `request()`
 * wrapper — the CSV here is at most a few hundred short rows, so a string body
 * is well within limits. 200_000 chars comfortably covers BULK_CSV_MAX_ROWS
 * rows of URLs while bounding memory.
 */
export class AdminProductLinkBulkCsvDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200_000)
  csv!: string;
}
