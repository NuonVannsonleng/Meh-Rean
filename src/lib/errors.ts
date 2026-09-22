import { t } from "../i18n/en";
import { ApiError, type ApiErrorCode } from "../types";

export function errorCode(error: unknown): ApiErrorCode {
  return error instanceof ApiError ? error.code : "UNKNOWN";
}

/** Friendly copy for any thrown value; never exposes technical details. */
export function errorMessage(error: unknown): string {
  return t.apiErrors[errorCode(error)];
}
