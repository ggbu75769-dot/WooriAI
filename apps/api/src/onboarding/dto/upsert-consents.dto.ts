import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator";

export class ConsentInputDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/)
  contentHash?: string;

  @IsBoolean()
  accepted!: boolean;
}

export class UpsertConsentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsentInputDto)
  consents!: ConsentInputDto[];

  @IsIn(["mobile", "web", "admin"])
  @IsOptional()
  source?: "mobile" | "web" | "admin";

  @IsString()
  @MaxLength(32)
  @IsOptional()
  appVersion?: string;
}
