import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class PrepareKakaoOAuthDto {
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;

  // Optional PKCE code_challenge (S256), stored on the transaction if the
  // client already generated its own verifier/challenge pair before calling
  // prepare. round5a-sprint2-plan.md §1's oauth_transactions.code_challenge
  // column is nullable. When supplied, exchange verifies the S256 binding
  // locally before forwarding the verifier to Kakao's token endpoint.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @IsOptional()
  codeChallenge?: string;
}
