import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class PrepareKakaoOAuthDto {
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;

  // Optional PKCE code_challenge (S256), stored on the transaction if the
  // client already generated its own verifier/challenge pair before calling
  // prepare. round5a-sprint2-plan.md §1's oauth_transactions.code_challenge
  // column is nullable — Kakao's token endpoint is the actual PKCE verifier,
  // this server doesn't re-derive/validate the challenge itself.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @IsOptional()
  codeChallenge?: string;
}
