import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsString, ValidateNested } from "class-validator";

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
}
