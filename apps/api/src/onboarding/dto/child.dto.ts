import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";
import { CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class CreateChildDto {
  @IsUUID()
  householdId!: string;

  @IsString()
  @IsNotEmpty()
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
}

export class UpdateChildDto {
  @IsOptional()
  @IsIn([...CHILD_STAGE_MODES])
  stageMode?: ChildStageMode;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
}
