import { IsIn, IsUUID } from "class-validator";

export class CreateInviteDto {
  @IsIn(["co_parent", "viewer", "gift_participant"])
  role!: "co_parent" | "viewer" | "gift_participant";

  @IsIn(["kakao", "sms", "link"])
  channel!: "kakao" | "sms" | "link";
}

export class TransferOwnershipDto {
  @IsUUID()
  targetUserId!: string;
}
