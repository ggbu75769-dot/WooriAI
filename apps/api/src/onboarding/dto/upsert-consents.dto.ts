import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class ConsentInputDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

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
