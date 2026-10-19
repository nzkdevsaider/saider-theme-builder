import type { Fix, Issue } from "../core/doctor";
import type { AppError } from "../core/errors";
import type { ImportPlan } from "../core/parser";
import type { ThemeInfo } from "../core/themes";
import type { Locale } from "../i18n/locale";

export type Command =
  | { type: "refresh" }
  | { type: "install-system"; system: string }
  | { type: "create-theme"; plan: ImportPlan }
  | { type: "update-theme"; id: string; values: Record<string, string> }
  | { type: "rename-theme"; id: string; name: string }
  | { type: "set-default"; id: string }
  | { type: "delete-theme"; id: string }
  | { type: "apply-fixes"; fixes: Fix[] }
  | { type: "set-locale"; locale: Locale }
  | { type: "notify"; message: string; error?: boolean };

export type ToUi =
  | { type: "state"; state: PluginState }
  | { type: "fatal"; error: AppError }
  | { type: "result"; requestId: number; ok: boolean; error?: AppError; data?: unknown };

export interface FixReport {
  done: number;
  failed: AppError[];
}

export interface PluginState {
  systemId: string | null;
  schemaVersion: number;
  locale: Locale | null;
  themes: ThemeInfo[];
  issues: Issue[];
  foreignCollections: number;
}

export interface Envelope {
  requestId: number;
  command: Command;
}
