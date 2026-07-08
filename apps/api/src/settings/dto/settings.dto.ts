import { IsString } from "class-validator";

export class SettingsConfirmationDto {
  @IsString()
  confirmationText!: string;
}
