import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class ExchangeKakaoOAuthDto {
  @IsUUID()
  transactionId!: string;

  // Round-tripped from POST /auth/kakao/prepare's response — must match the
  // transaction's stored state (round5a-sprint2-plan.md §2's "state 일치"
  // check), otherwise the transaction row is write-only and never actually
  // verified against what the client was given.
  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  codeVerifier?: string;
}
