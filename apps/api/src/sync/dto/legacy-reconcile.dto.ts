import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateNested
} from "class-validator";

export class LegacyOfflineMutationDto {
  @IsString()
  @MaxLength(160)
  sourceLocalId!: string;

  @IsString()
  @MaxLength(160)
  sourceMutationId!: string;

  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @IsIn(["POST", "PATCH", "DELETE"] as const)
  method!: "POST" | "PATCH" | "DELETE";

  @IsString()
  @Matches(/^\/(?:children\/[0-9a-f-]+\/expenses|expenses\/[0-9a-f-]+)$/i)
  path!: string;

  @IsObject()
  body!: Record<string, unknown>;
}

export class LegacyOfflineReconcileDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LegacyOfflineMutationDto)
  mutations!: LegacyOfflineMutationDto[];
}
