import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ITEM_STATUSES, type ItemStatus } from "@wooriai/domain";
import { STAGE_BAND_LABELS, type StageBandLabel } from "../stage-bands";

export class ListItemsQueryDto {
  @IsOptional()
  @IsIn(["now", "soon", "prepared", "not_needed"])
  tab?: "now" | "soon" | "prepared" | "not_needed";

  // ITEM-121: 선택적 시기 밴드 필터. 생략하면 종전과 동일하게 아이의 현재 단계를
  // 기준으로 목록을 만든다(하위호환). 값이 있으면 그 밴드가 기준이 되어, 현재 단계와
  // 다른 시기의 준비물도 미리 볼 수 있다.
  @IsOptional()
  @IsIn([...STAGE_BAND_LABELS])
  stageBand?: StageBandLabel;
}

export class UpdateItemStatusDto {
  @IsIn([...ITEM_STATUSES])
  status!: ItemStatus;

  @IsOptional()
  @IsUUID()
  expenseId?: string;
}

export class ProductLinkClickDto {
  @IsUUID()
  childId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referrerScreenId?: string;
}
