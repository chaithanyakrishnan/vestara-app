import { z } from "zod";

export const ContributionsStepSchema = z.object({
  pretaxDeferrals: z.boolean(),
  rothDeferrals: z.boolean(),
  catchupPermitted: z.enum(["yes", "no"]).default("yes"),
  catchupMatched: z.enum(["yes", "no"]).default("no"),

  safeHarborElected: z.boolean().default(false),
  safeHarborType: z.enum(["basic", "enhanced", "ne", "qaca"]).optional(),
  safeHarborPeriod: z.enum(["payroll", "monthly", "annual"]).optional(),
  safeHarborAppliesTo: z.string().optional(),

  // Employer match. NOTE: the v4 prototype had no standalone match section —
  // it only modelled the safe-harbor match. This group is net-new product
  // surface, added at the product owner's direction, and is optional
  // throughout so existing drafts keep validating.
  matchElected: z.boolean().default(false),
  matchType: z.enum(["disc", "fixed"]).optional(),
  matchPct: z.coerce.number().min(0).max(100).optional(),
  matchCapPct: z.coerce.number().min(0).max(25).optional(),

  nonelectiveElected: z.boolean().default(false),
  nonelectiveType: z.enum(["disc", "fixed"]).optional(),
  nonelectivePct: z.coerce.number().min(0).max(25).optional(),
  nonelectiveAllocation: z.enum(["prorata", "integrated", "grouped"]).optional(),
  nonelectiveCondition: z.enum(["lastday", "1000hrs", "none"]).optional(),

  forfeitureUse: z.enum(["reduce_ne", "reduce_match", "pay_expenses", "reallocate"]),
}).superRefine((val, ctx) => {
  if (!val.pretaxDeferrals && !val.rothDeferrals) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pretaxDeferrals"],
      message: "At least one elective deferral type (pre-tax or Roth) must be selected",
    });
  }
  if (val.safeHarborElected && !val.safeHarborType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["safeHarborType"],
      message: "Select a safe harbor formula",
    });
  }
  if (val.matchElected && val.matchType === "fixed" && val.matchPct === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matchPct"],
      message: "Enter the fixed match percentage",
    });
  }
  if (val.nonelectiveElected && val.nonelectiveType === "fixed" && val.nonelectivePct === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nonelectivePct"],
      message: "Enter the fixed nonelective percentage",
    });
  }
});
export type ContributionsStepInput = z.infer<typeof ContributionsStepSchema>;
