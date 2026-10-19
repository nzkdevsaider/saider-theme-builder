import type { Issue } from "../core/doctor";
import { toAppError, type AppError } from "../core/errors";
import { en, type Messages } from "./en";
import { es } from "./es";
import { ja } from "./ja";
import type { Locale } from "./locale";

export type { Messages };
export { LOCALES, detectLocale, isLocale, type Locale } from "./locale";

export const MESSAGES: Record<Locale, Messages> = { en, es, ja };

export function issueMessage(t: Messages, issue: Issue): string {
  const format = t.issues[issue.rule] as (p: Issue["params"]) => string;
  return format(issue.params);
}

export function errorMessage(t: Messages, error: AppError | unknown): string {
  const e = isAppError(error) ? error : toAppError(error);
  const format = t.errors[e.code] as (p: AppError["params"]) => string;
  return format(e.params);
}

const isAppError = (v: unknown): v is AppError =>
  !!v && typeof v === "object" && "code" in v && "params" in v && (v as AppError).code in en.errors;
