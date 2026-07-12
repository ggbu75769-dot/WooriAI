import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  refreshToken?: string;
}
