import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { AUTH_PROVIDERS, type AuthProvider } from "@wooriai/domain";

export class OAuthLoginDto {
  @IsIn([...AUTH_PROVIDERS])
  provider!: AuthProvider;

  @IsString()
  @IsNotEmpty()
  providerToken!: string;

  @IsObject()
  @IsOptional()
  device?: Record<string, unknown>;
}
