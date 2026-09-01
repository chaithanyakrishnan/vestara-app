import { z } from "zod";
import { planProfile } from "./planProfile";

const EligibilityBase = z.object({
  minimumAge: z.enum(["none", "18", "20.5", "21"]),
  /**
   * Applies to EMPLOYER money. The deferral source has its own field below,
   * because Section 401(k)(2)(D) forbids a two-year condition on elective deferrals
   * while Section 410(a)(1)(B)(i) permits one on employer money that vests immediately.
   */
  serviceRequirement: z.enum(["none", "3mo", "6mo", "1yr", "2yr"]),
  deferralServiceRequirement: z.enum(["none", "3mo", "6mo", "1yr"]).optional(),
  entryDates: z.enum(["immediate", "monthly", "quarterly", "semi", "annual"]),
  hoursOfServiceMethod: z.enum(["actual", "elapsed", "split"]),

  excludeUnion: z.boolean().default(false),
  excludeNonResidentAliens: z.boolean().default(false),
  excludePartTime: z.boolean().default(false),
  excludeHce: z.boolean().default(false),

  /**
   * SECURE 2.0 Section 125: two consecutive years of 500+ hours earns a deferral
   * right from 2025 (three years under SECURE 1.0, from 2024). A blunt
   * "exclude part-time" is no longer a lawful exclusion for the deferral
   * source, so electing it now requires acknowledging the LTPT track.
   */
  ltptTrackingAcknowledged: z.boolean().optional(),

  // ---- 403(b) universal availability ----
  /**
   * The only exclusions Section 403(b)(12)(A)(ii) permits. Anything else defeats
   * universal availability for the whole plan.
   */
  uaExclusions: z
    .array(z.enum(["under_20_hours", "students", "other_plan_eligible", "nonresident_aliens"]))
    .optional(),

  // ---- 457(b) non-governmental top-hat ----
  eligibleClassDescription: z.string().optional().or(z.literal("")),

  autoEnrollElected: z.boolean().default(false),
  autoEnrollType: z.enum(["eaca", "qaca", "basic"]).optional(),
  autoEnrollDefaultPct: z.coerce.number().min(1).max(15).optional(),
  autoEnrollEscalation: z.enum(["none", "1pct_yr", "2pct_yr"]).optional(),
  autoEnrollEscalationCap: z.coerce.number().min(1).max(15).optional(),
  /** EACA 90-day permissible withdrawal — a required election for an EACA. */
  eacaPermissibleWithdrawal: z.boolean().optional(),
});

export type EligibilityStepInput = z.infer<typeof EligibilityBase>;

export function buildEligibilitySchema(planType?: string) {
  const p = planProfile(planType);

  return EligibilityBase.superRefine((val, ctx) => {
    const require = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    // ---- 403(b) universal availability ----
    if (p.universalAvailability) {
      if (val.minimumAge !== "none" || (val.deferralServiceRequirement ?? "none") !== "none") {
        require(
          "minimumAge",
          "Universal availability: a 403(b) cannot impose an age or service condition on elective deferrals",
        );
      }
      if (val.excludeUnion || val.excludeHce || val.excludePartTime) {
        require(
          "excludeUnion",
          "Universal availability permits only the narrow statutory exclusions — use the list below",
        );
      }
    }

    // ---- 457(b) non-governmental: top hat ----
    if (p.topHatOnly && !val.eligibleClassDescription) {
      require(
        "eligibleClassDescription",
        "Describe the select group of management or highly compensated employees who may participate",
      );
    }

    // ---- two-year service condition ----
    // Only lawful for employer money, and only with immediate vesting. The
    // vesting half of that pair is enforced in irsVestingFloor.ts, which sees
    // both steps.
    if (val.deferralServiceRequirement === undefined && val.serviceRequirement === "2yr") {
      require(
        "serviceRequirement",
        "A two-year service condition cannot apply to elective deferrals — set a separate deferral requirement of one year or less",
      );
    }
    if (p.electiveDeferrals && (val.deferralServiceRequirement ?? "none") === "none") {
      // fine — no condition at all is always permitted
    }

    // ---- Section 410(a)(4) maximum entry delay ----
    // Entry must be no later than the EARLIER of the first day of the plan year
    // after the conditions are met, or six months after. One year of service
    // plus annual entry can push actual entry out to 24 months.
    const longService = val.serviceRequirement === "1yr" || val.serviceRequirement === "2yr";
    if (longService && val.entryDates === "annual") {
      require(
        "entryDates",
        "Annual entry with a one-year service condition can delay entry beyond the Section 410(a)(4) maximum — use semi-annual or more frequent entry",
      );
    }

    // ---- long-term part-time ----
    if (val.excludePartTime && p.electiveDeferrals && !val.ltptTrackingAcknowledged) {
      require(
        "ltptTrackingAcknowledged",
        "Part-time employees with two consecutive years of 500+ hours must still be allowed to defer (SECURE 2.0 Section 125) — confirm the plan will track them",
      );
    }

    // ---- auto-enrollment ----
    if (val.autoEnrollElected && !p.autoEnrollmentAvailable) {
      require("autoEnrollElected", `Automatic enrollment does not apply to a ${p.label} plan`);
    }
    if (val.autoEnrollElected && p.autoEnrollmentAvailable) {
      if (val.autoEnrollDefaultPct === undefined) {
        require("autoEnrollDefaultPct", "Default deferral percentage is required when auto-enrollment is elected");
      }
      if (!val.autoEnrollType) {
        require("autoEnrollType", "Select the automatic enrollment arrangement");
      }

      // QACA minimums, Section 401(k)(13): at least 3% initially, escalating to at
      // least 6%. Electing "QACA at 1%, no escalation" forfeits the safe
      // harbor the arrangement was chosen for.
      if (val.autoEnrollType === "qaca") {
        if (val.autoEnrollDefaultPct !== undefined && val.autoEnrollDefaultPct < 3) {
          require("autoEnrollDefaultPct", "A QACA requires a default deferral of at least 3%");
        }
        if (!val.autoEnrollEscalation || val.autoEnrollEscalation === "none") {
          require("autoEnrollEscalation", "A QACA must escalate the default deferral automatically");
        }
        if (val.autoEnrollEscalationCap !== undefined && val.autoEnrollEscalationCap < 6) {
          require("autoEnrollEscalationCap", "A QACA must escalate to at least 6% of compensation");
        }
      }

      if (val.autoEnrollType === "eaca" && val.eacaPermissibleWithdrawal === undefined) {
        require(
          "eacaPermissibleWithdrawal",
          "An EACA must state whether it permits the 90-day withdrawal election",
        );
      }
    }
  });
}

export const EligibilityStepSchema = buildEligibilitySchema("401k");
