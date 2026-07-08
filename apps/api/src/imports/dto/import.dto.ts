import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class UpdateImportRowDto {
  @IsOptional()
  @IsBoolean()
  selected?: boolean;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  parsedItemName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parsedAmountKrw?: number;
}

export class ConfirmImportDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  selectedRowIds!: string[];
}
