export interface ErrorParams {
  "invalid-json": Record<string, never>;
  "missing-name": Record<string, never>;
  "system-unavailable": { system: string };
  "schema-newer": { version: number; supported: number };
  "broken-migration": { version: number };
  "no-system": Record<string, never>;
  "unknown-system": { system: string };
  "system-exists": { system: string };
  "unknown-ref": { ref: string; system: string };
  "missing-primitive": { name: string };
  "collection-gone": Record<string, never>;
  "variable-gone": Record<string, never>;
  "theme-exists": { name: string };
  "plan-invalid": Record<string, never>;
  "plan-system-mismatch": { plan: string; project: string };
  "not-managed": Record<string, never>;
  "theme-newer": Record<string, never>;
  "unknown-token": { key: string };
  "empty-name": Record<string, never>;
  unexpected: { message: string };
}

export type ErrorCode = keyof ErrorParams;
export type AppError = { [C in ErrorCode]: { code: C; params: ErrorParams[C] } }[ErrorCode];

export class SaiderError extends Error {
  constructor(readonly detail: AppError) {
    super(detail.code);
  }
}

export function appError<C extends ErrorCode>(code: C, params: ErrorParams[C]): AppError {
  return { code, params } as AppError;
}

export function fail<C extends ErrorCode>(code: C, params: ErrorParams[C]): never {
  throw new SaiderError(appError(code, params));
}

export function toAppError(e: unknown): AppError {
  if (e instanceof SaiderError) return e.detail;
  return appError("unexpected", { message: e instanceof Error ? e.message : String(e) });
}
