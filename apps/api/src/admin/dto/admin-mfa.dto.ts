import { IsString, MinLength } from "class-validator";

export class AdminMfaVerifyLoginDto {
  @IsString()
  @MinLength(1)
  mfaToken!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class AdminMfaSetupVerifyDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class AdminMfaDisableDto {
  @IsString()
  @MinLength(6)
  code!: string;
}
