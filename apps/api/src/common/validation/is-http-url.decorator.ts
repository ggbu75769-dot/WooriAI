import { buildMessage, ValidateBy, type ValidationOptions } from "class-validator";
import { isHttpOrHttpsUrl } from "./url-scheme";

const IS_HTTP_URL = "isHttpUrl";

/**
 * Custom class-validator constraint that whitelists the http: and https: URL schemes.
 * Intended to be combined with @IsUrl (which is kept for its general URL-shape checks)
 * so that dangerous schemes such as javascript:, data:, and file: are always rejected
 * regardless of how @IsUrl's own protocol options are configured.
 */
export function IsHttpUrl(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: IS_HTTP_URL,
      validator: {
        validate: (value: unknown): boolean => isHttpOrHttpsUrl(value),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be an http:// or https:// URL`,
          validationOptions
        )
      }
    },
    validationOptions
  );
}
