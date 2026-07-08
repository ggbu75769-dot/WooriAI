import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ITEM_STATUSES, type ItemStatus } from "@wooriai/domain";

export class ListItemsQueryDto {
  @IsOptional()
  @IsIn(["now", "soon", "prepared", "not_needed"])
  tab?: "now" | "soon" | "prepared" | "not_needed";
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
