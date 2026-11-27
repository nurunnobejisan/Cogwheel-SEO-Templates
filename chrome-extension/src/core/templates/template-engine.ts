/**
 * Extension-side entry for the shared template renderer (Phase E).
 *
 * The implementation moved to `shared/ts/template-render.ts` — the single
 * renderer for both trees. This wrapper keeps every existing import path and
 * export name working; `tests/template-render.test.ts` asserts function
 * identity with the shared module (not just behavioural equality).
 */
export type { TemplateVariables, ParsedTemplateResult } from "../../../../shared/ts/template-render";
export {
  resolveVariableValue,
  parseTemplateWithFallbacks,
  renderTemplateString,
} from "../../../../shared/ts/template-render";
