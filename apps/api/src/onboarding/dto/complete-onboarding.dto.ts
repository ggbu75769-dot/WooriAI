import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { CHILD_SEX_VALUES, CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildSex, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const yearMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CompleteOnboardingChildDto {
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

  @IsBoolean()
  stageOverride!: boolean;

  @IsIn([...CHILD_SEX_VALUES])
  gender!: ChildSex;
}

export class CompleteOnboardingPreparedDto {
  @IsIn(["selected", "skipped", "completed_none"])
  state!: "selected" | "skipped" | "completed_none";

  @IsArray()
  @ArrayMaxSize(12)
  @IsUUID(undefined, { each: true })
  itemDefinitionIds!: string[];
}

export class CompleteOnboardingBudgetDto {
  @Matches(yearMonthPattern)
  yearMonth!: string;

  @IsInt()
  @Min(1)
  amountKrw!: number;
}

export class CompleteOnboardingDto {
  @IsUUID()
  householdId!: string;

  @IsInt()
  @Min(1)
  draftVersion!: number;

  @ValidateNested()
  @Type(() => CompleteOnboardingChildDto)
  child!: CompleteOnboardingChildDto;

  @ValidateNested()
  @Type(() => CompleteOnboardingPreparedDto)
  prepared!: CompleteOnboardingPreparedDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CompleteOnboardingBudgetDto)
  budget?: CompleteOnboardingBudgetDto | null;
}

export class StarterItemsPreviewDto {
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
