import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { ITEM_STATUSES, type ItemStatus } from "@wooriai/domain";
import { STAGE_BAND_LABELS, type StageBandLabel } from "../stage-bands";

export class ListItemsQueryDto {
  // ITEM-123 (B5): `all`은 상태 필터 없는 전체 스냅샷(gifted 포함). 기존 네 값은 의미가
  // 그대로라 추가만 된 하위호환 확장이다 — 준비율 계산처럼 전 상태가 필요한 화면이
  // 탭 4개를 각각 부르는 대신 1요청으로 끝낸다.
  @IsOptional()
  @IsIn(["now", "soon", "prepared", "not_needed", "all"])
  tab?: "now" | "soon" | "prepared" | "not_needed" | "all";

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
