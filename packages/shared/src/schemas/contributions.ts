import { z } from "zod";
import { planProfile } from "./planProfile";

const ContributionsBase = z.object({
  // Optional in the SHAPE because a 401(a) has no deferral feature at all.
  // Required-ness is decided per plan type in the refinement below.
  pretaxDeferrals: z.boolean().optional(),
  rothDeferrals: z.boolean().optional(),
  catchupPermitted: z.enum(["yes", "no"]).default("yes"),
  catchupMatched: z.enum(["yes", "no"]).default("no"),
  /** SECURE 2.0 Section 109, ages 60–63. */
  superCatchupPermitted: z.enum(["yes", "no"]).optional(),
  /** Section 402(g)(7) — 403(b) plans of qualifying organizations only. */
  service15CatchupPermitted: z.enum(["yes", "no"]).optional(),
  /** Section 457(b)(3) — final three years before normal retirement age. */
  final3CatchupPermitted: z.enum(["yes", "no"]).optional(),

  safeHarborElected: z.boolean().default(false),
  safeHarborType: z.enum(["basic", "enhanced", "ne", "qaca"]).optional(),
  safeHarborPeriod: z.enum(["payroll", "monthly", "annual"]).optional(),
  safeHarborAppliesTo: z.string().optional(),
  /**
   * The formula itself. Capturing only the safe harbor TYPE meant the plan's
   * actual match rates were never recorded and the document could not be
   * drafted from the wizard's output.
   */
  safeHarborMatchTier1Pct: z.coerce.number().min(0).max(100).optional(),
  safeHarborMatchTier1UpToPct: z.coerce.number().min(0).max(25).optional(),
  safeHarborMatchTier2Pct: z.coerce.number().min(0).max(100).optional(),
  safeHarborMatchTier2UpToPct: z.coerce.number().min(0).max(25).optional(),
  safeHarborNonelectivePct: z.coerce.number().min(0).max(25).optional(),

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

  // ---- definition of compensation (Section 415(c)(3) / Section 414(s)) ----
  /**
   * Using the wrong definition of compensation is the most common operational
   * failure corrected under EPCRS. Every contribution the plan calculates
   * depends on these three answers.
   */
  compensationDefinition: z.enum(["w2", "3401a", "415_safe_harbor"]).optional(),
  compensationExclusions: z
    .array(z.enum(["bonus", "overtime", "commissions", "fringe", "severance"]))
    .optional(),
  compensationPostSeverance: z.enum(["include", "exclude"]).optional(),

  // ---- testing (non-safe-harbor 401(k) only) ----
  adpTestMethod: z.enum(["current", "prior"]).optional(),
  topHeavyMinimumBy: z.enum(["employer", "not_applicable"]).optional(),
});

export type ContributionsStepInput = z.infer<typeof ContributionsBase>;

export function buildContributionsSchema(planType?: string) {
  const p = planProfile(planType);

  return ContributionsBase.superRefine((val, ctx) => {
    const require = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (p.electiveDeferrals) {
      if (!val.pretaxDeferrals && !val.rothDeferrals) {
        require(
          "pretaxDeferrals",
          "At least one elective deferral type (pre-tax or Roth) must be selected",
        );
      }
      // Section 402A designated Roth accounts are available to 401(k), 403(b) and
      // GOVERNMENTAL 457(b) plans only.
      if (val.rothDeferrals && !p.rothAvailable) {
        require("rothDeferrals", `A ${p.label} plan cannot offer a designated Roth account`);
      }
    } else {
      // 401(a): employer money is the only money. Without this the step would
      // be submittable while electing nothing at all.
      if (!val.matchElected && !val.nonelectiveElected) {
        require(
          "nonelectiveElected",
          `A ${p.label} plan is employer-funded — elect a match or a non-elective contribution`,
        );
      }
      if (val.pretaxDeferrals || val.rothDeferrals) {
        require("pretaxDeferrals", `A ${p.label} plan has no elective deferral feature`);
      }
    }

    // ---- catch-ups, per what this plan type actually offers ----
    const has = (k: Parameters<typeof p.availableCatchUps.includes>[0]) =>
      p.availableCatchUps.includes(k);

    if (val.catchupPermitted === "yes" && !has("age50")) {
      require(
        "catchupPermitted",
        `The age-50 catch-up under Section 414(v) is not available to a ${p.label} plan`,
      );
    }
    if (val.superCatchupPermitted === "yes" && !has("super60to63")) {
      require("superCatchupPermitted", `The age 60–63 catch-up is not available to a ${p.label} plan`);
    }
    if (val.service15CatchupPermitted === "yes" && !has("service15")) {
      require(
        "service15CatchupPermitted",
        "The 15-year service catch-up is available only to qualifying 403(b) organizations",
      );
    }
    if (val.final3CatchupPermitted === "yes" && !has("final3")) {
      require("final3CatchupPermitted", "The final-three-years catch-up applies only to 457(b) plans");
    }

    // SECURE 2.0 Section 603: catch-up for participants over the indexed wage
    // threshold must be Roth. A plan permitting catch-up without a Roth source
    // cannot administer them.
    if (val.catchupPermitted === "yes" && p.rothAvailable && !val.rothDeferrals) {
      require(
        "rothDeferrals",
        "SECURE 2.0 Section 603 requires catch-up contributions to be Roth for higher-paid participants — " +
          "a plan permitting catch-up needs a designated Roth source",
      );
    }

    // ---- safe harbor ----
    if (val.safeHarborElected && !p.safeHarborAvailable) {
      require(
        "safeHarborElected",
        `The ADP/ACP safe harbor is a Section 401(k) design and does not apply to a ${p.label} plan`,
      );
    }
    if (val.safeHarborElected && p.safeHarborAvailable) {
      if (!val.safeHarborType) require("safeHarborType", "Select a safe harbor formula");
      if (val.safeHarborType === "ne" || val.safeHarborType === "qaca") {
        if (val.safeHarborNonelectivePct === undefined) {
          require("safeHarborNonelectivePct", "Enter the safe harbor non-elective percentage");
        } else if (val.safeHarborNonelectivePct < 3) {
          require(
            "safeHarborNonelectivePct",
            "A safe harbor non-elective contribution must be at least 3% of compensation",
          );
        }
      }
      if (val.safeHarborType === "basic" || val.safeHarborType === "enhanced") {
        if (val.safeHarborMatchTier1Pct === undefined) {
          require("safeHarborMatchTier1Pct", "Enter the safe harbor match rate");
        }
      }
    }

    // ---- testing method, where testing applies ----
    if (p.adpAcpTesting && !val.safeHarborElected && !val.adpTestMethod) {
      require("adpTestMethod", "Select current-year or prior-year ADP/ACP testing");
    }

    // ---- compensation ----
    if (!val.compensationDefinition) {
      require("compensationDefinition", "Select the plan's definition of compensation");
    }

    // ---- existing formula completeness ----
    if (val.matchElected && val.matchType === "fixed" && val.matchPct === undefined) {
      require("matchPct", "Enter the fixed match percentage");
    }
    if (val.nonelectiveElected && val.nonelectiveType === "fixed" && val.nonelectivePct === undefined) {
      require("nonelectivePct", "Enter the fixed non-elective percentage");
    }
  });
}

export const ContributionsStepSchema = buildContributionsSchema("401k");
