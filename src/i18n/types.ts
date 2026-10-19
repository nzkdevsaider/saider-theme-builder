import type { RuleId, RuleParams, Severity } from "../core/doctor";
import type { ErrorCode, ErrorParams } from "../core/errors";
import type { RowStatus } from "../core/parser";

export type IssueMessages = { [R in RuleId]: (p: RuleParams[R]) => string };
export type ErrorMessages = { [C in ErrorCode]: (p: ErrorParams[C]) => string };
export type StatusLabels = Record<RowStatus, string>;
export type SeverityLabels = Record<Severity, string>;
