import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { CHILD_SEX_VALUES, CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildSex, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateChildDto {
  @IsUUID()
  householdId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nickname!: string;

  @IsIn([...CHILD_STAGE_MODES])
  stageMode!: ChildStageMode;

  @IsOptional()
  @Matches(datePattern)
  dueDate?: string;

  @IsOptional()
  @Matches(datePattern)
  birthDate?: string;

  @IsOptional()
  @IsIn([...CHILD_STAGE_CODES])
  manualStage?: ChildStageCode;

  @IsOptional()
  @IsIn([...CHILD_SEX_VALUES])
  gender?: ChildSex;
}

export class UpdateChildDto {
  @IsOptional()
  @IsIn([...CHILD_STAGE_MODES])
  stageMode?: ChildStageMode;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nickname?: string;

  @IsOptional()
  @Matches(datePattern)
  dueDate?: string;

  @IsOptional()
  @Matches(datePattern)
  birthDate?: string;

  @IsOptional()
  @IsIn([...CHILD_STAGE_CODES])
  manualStage?: ChildStageCode;

  @IsOptional()
  @IsIn([...CHILD_SEX_VALUES])
  gender?: ChildSex;
}
