import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredKeys = [
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "OAUTH_KAKAO_CLIENT_ID",
  "OAUTH_APPLE_CLIENT_ID",
  "OAUTH_GOOGLE_CLIENT_ID",
  "OAUTH_KAKAO_REDIRECT_URIS",
  "AFFILIATE_DISCLOSURE_TEXT",
  "AFFILIATE_ALLOWED_DOMAINS",
  "AFFILIATE_CLICK_IP_SALT",
  "ANALYTICS_ANON_SALT"
] as const;

type EnvSource = Record<string, string | undefined>;

function parseEnvFile(path: string): EnvSource {
  const resolved = resolve(path);

  if (!existsSync(resolved)) {
    console.error(`[env] File not found: ${resolved}`);
    process.exit(1);
  }

  return readFileSync(resolved, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce<EnvSource>((acc, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

const args = process.argv.slice(2);
const fileFlagIndex = args.indexOf("--file");
const envSource =
  fileFlagIndex === -1 ? process.env : parseEnvFile(args[fileFlagIndex + 1] ?? "");
const allowPlaceholders = args.includes("--allow-placeholders");

const missing = requiredKeys.filter((key) => !envSource[key]?.trim());
const placeholderKeys = allowPlaceholders
  ? []
  : requiredKeys.filter((key) => /change-me|dev-.*client-id/.test(envSource[key] ?? ""));

if (missing.length > 0 || placeholderKeys.length > 0) {
  if (missing.length > 0) {
    console.error(`[env] Missing required environment variables: ${missing.join(", ")}`);
  }

  if (placeholderKeys.length > 0) {
    console.error(`[env] Replace placeholder values for: ${placeholderKeys.join(", ")}`);
  }

  process.exit(1);
}

const sourceName = fileFlagIndex === -1 ? "process.env" : args[fileFlagIndex + 1];
console.log(`[env] ${requiredKeys.length} required variables present in ${sourceName}.`);
