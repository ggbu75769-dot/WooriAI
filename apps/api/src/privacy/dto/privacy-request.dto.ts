import { IsIn, IsString } from "class-validator";

export class CreatePrivacyRequestDto {
  @IsString()
  @IsIn(["DELETE ACCOUNT", "EXPORT DATA"])
  confirmationText!: "DELETE ACCOUNT" | "EXPORT DATA";
}
