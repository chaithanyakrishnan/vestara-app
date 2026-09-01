import { z } from "zod";
import { planProfile } from "./planProfile";

const AdministrationBase = z.object({
  loansPermitted: z.boolean().default(false),
  loanMinAmount: z.coerce.number().min(0).optional(),
  loanMaxOutstanding: z.enum(["1", "2", "unlimited"]).optional(),
  /**
   * Section 72(p)(2)(A): the lesser of $50,000 or half the vested balance. The plan
   * may adopt a lower ceiling but not a higher one.
   */
  loanMaxBasis: z.enum(["statutory", "lesser_of_50pct", "custom"]).optional(),
  /** Section 72(p)(2)(B): five years, except a principal residence loan. */
  loanGeneralMaxTermYears: z.coerce.number().min(1).max(5).optional(),
  loanInterestRate: z.enum(["prime", "prime1", "prime2"]).optional(),
  /** The real election is any-purpose vs. principal residence only. */
  loanPurpose: z.enum(["any", "principal_residence_only"]).optional(),
  loanHomeMaxTermYears: z.coerce.number().min(1).max(30).optional(),
  loanRefinancing: z.enum(["allowed", "not_allowed"]).optional(),
  loanAcceleration: z.enum(["on_termination", "never"]).optional(),
  loanPaymentsOnLeave: z.enum(["suspend", "continue"]).optional(),

  inServiceAt59_5: z.boolean().default(false),
  inServiceFromRollover: z.boolean().optional(),
  hardshipElected: z.boolean().default(false),
  hardshipType: z.enum(["safe", "non"]).optional(),
  /** SECURE 2.0 Section 312 permits the participant to self-certify the need. */
  hardshipSelfCertification: z.boolean().optional(),

  /** Section 457(b) equivalent of hardship — a stricter, distinct standard. */
  unforeseeableEmergencyElected: z.boolean().optional(),

  // ---- SECURE 2.0 distribution events ----
  emergencyExpenseWithdrawal: z.boolean().optional(), // Section 115, $1,000/yr
  domesticAbuseWithdrawal: z.boolean().optional(), // Section 314
  birthAdoptionWithdrawal: z.boolean().optional(), // Section 113
  qualifiedDisasterWithdrawal: z.boolean().optional(),
  inPlanRothConversion: z.boolean().optional(),

  /** SECURE 2.0 Section 107: 73 today, 75 from 2033. */
  requiredBeginningAge: z.enum(["73", "75"]).optional(),

  rolloversAccepted: z.boolean().default(true),
  rolloverSources: z.enum(["all", "qualified_only", "none"]).optional(),

  planExpensePayer: z.enum(["plan", "employer"]),
  employerPaymentMethod: z.enum(["ach", "check", "wire"]).optional(),
  employerPaymentBankName: z.string().optional().or(z.literal("")),
  employerPaymentAccountType: z.enum(["checking", "savings"]).optional(),
  // NOTE: these two carry real bank credentials. They are stored in the
  // PlanStepData JSON blob like every other step field, and plan routes do NOT
  // yet verify that the caller owns the plan (see requireAuth vs. the unused
  // requireRole in plans.routes.ts). The ownership check should land before any
  // real deployment.
  employerPaymentRoutingNumber: z
    .string()
    .regex(/^\d{9}$/, "Routing number must be exactly 9 digits")
    .optional()
    .or(z.literal("")),
  employerPaymentAccountNumber: z
    .string()
    .regex(/^\d{4,17}$/, "Account number must be 4–17 digits")
    .optional()
    .or(z.literal("")),
});

export type AdministrationStepInput = z.infer<typeof AdministrationBase>;

export function buildAdministrationSchema(planType?: string) {
  const p = planProfile(planType);

  return AdministrationBase.superRefine((val, ctx) => {
    const require = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    // ---- loans ----
    if (val.loansPermitted && !p.loansAvailable) {
      require(
        "loansPermitted",
        `A ${p.label} plan cannot offer participant loans — deferred amounts remain the employer's general assets`,
      );
    }
    if (val.loansPermitted && p.loansAvailable) {
      if (val.loanMinAmount === undefined) {
        require("loanMinAmount", "Minimum loan amount is required when loans are permitted");
      }
      if (!val.loanMaxBasis) {
        require("loanMaxBasis", "State the maximum loan basis under Section 72(p)");
      }
      if (val.loanGeneralMaxTermYears === undefined) {
        require(
          "loanGeneralMaxTermYears",
          "State the maximum term for a general-purpose loan (five years under Section 72(p)(2)(B))",
        );
      }
    }

    // ---- hardship vs. unforeseeable emergency ----
    if (val.hardshipElected && !p.hardshipAvailable) {
      require(
        "hardshipElected",
        p.unforeseeableEmergency
          ? `A ${p.label} plan uses the unforeseeable emergency standard, not hardship`
          : `Hardship distributions are not available to a ${p.label} plan`,
      );
    }
    if (val.unforeseeableEmergencyElected && !p.unforeseeableEmergency) {
      require(
        "unforeseeableEmergencyElected",
        "The unforeseeable emergency standard applies only to 457(b) plans",
      );
    }

    // ---- in-service at 59½ ----
    // A non-governmental 457(b) has no age-59½ in-service event at all;
    // distributions are restricted to separation, age 70½, unforeseeable
    // emergency, or death/disability.
    if (val.inServiceAt59_5 && !p.inServiceAt59_5) {
      require(
        "inServiceAt59_5",
        `A ${p.label} plan has no in-service distribution at age 59½`,
      );
    }

    // ---- SECURE 2.0 events that presuppose a qualified plan ----
    if (val.emergencyExpenseWithdrawal && p.key.startsWith("457b")) {
      require(
        "emergencyExpenseWithdrawal",
        "The Section 115 emergency personal expense withdrawal does not apply to 457(b) plans",
      );
    }
    if (val.inPlanRothConversion && !p.rothAvailable) {
      require("inPlanRothConversion", `A ${p.label} plan has no designated Roth account to convert into`);
    }

    if (!val.requiredBeginningAge) {
      require("requiredBeginningAge", "Select the required beginning age for minimum distributions");
    }

    // ---- plan expenses ----
    if (val.planExpensePayer === "employer" && !val.employerPaymentMethod) {
      require("employerPaymentMethod", "Select how the employer will pay plan expenses");
    }
    // Bank details are only meaningful for an automatic draft — a check or wire
    // is arranged out of band, so requiring them there would be noise.
    if (val.planExpensePayer === "employer" && val.employerPaymentMethod === "ach") {
      if (!val.employerPaymentBankName) require("employerPaymentBankName", "Bank name is required for ACH");
      if (!val.employerPaymentRoutingNumber) {
        require("employerPaymentRoutingNumber", "Routing number is required for ACH");
      }
      if (!val.employerPaymentAccountNumber) {
        require("employerPaymentAccountNumber", "Account number is required for ACH");
      }
    }
  });
}

export const AdministrationStepSchema = buildAdministrationSchema("401k");
