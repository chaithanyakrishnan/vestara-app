import { z } from "zod";

/**
 * Replaces Zod's default messages, which are written for developers.
 *
 * Left alone, a plan sponsor who skips a select is told
 * `Invalid enum value. Expected 'w2' | '3401a' | '415_safe_harbor', received ''`
 * — the schema's internal enum values, verbatim. A missing required field
 * reads `Required`, with no indication of what to do.
 *
 * This is installed once, at module load, so it applies to BOTH the API's
 * validation and the browser's — the two cannot drift apart. Any message a
 * schema sets explicitly still wins; this only fills in the defaults.
 */
const friendlyErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_enum_value:
    case z.ZodIssueCode.invalid_union:
      return { message: "Choose one of the available options" };

    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "This is required" };
      }
      if (issue.expected === "number") return { message: "Enter a number" };
      if (issue.expected === "boolean") return { message: "Choose yes or no" };
      return { message: "Check the value entered here" };

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return issue.minimum === 1
          ? { message: "This is required" }
          : { message: `Enter at least ${issue.minimum} characters` };
      }
      if (issue.type === "array") {
        return issue.minimum === 1
          ? { message: "Add at least one" }
          : { message: `Add at least ${issue.minimum}` };
      }
      return { message: `Enter ${issue.minimum} or more` };

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Use ${issue.maximum} characters or fewer` };
      if (issue.type === "array") return { message: `Add no more than ${issue.maximum}` };
      return { message: `Enter ${issue.maximum} or less` };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Enter a valid email address" };
      if (issue.validation === "url") return { message: "Enter a valid web address" };
      return { message: "Check the format of this entry" };

    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(friendlyErrorMap);

export { friendlyErrorMap };
