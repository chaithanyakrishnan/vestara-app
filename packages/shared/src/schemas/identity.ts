import { z } from "zod";
import { planProfile } from "./planProfile";

const einRegex = /^\d{2}-\d{7}$/;

/**
 * Shape only. Which of these are REQUIRED depends on the plan type, and that
 * lives in the superRefine built by `buildIdentitySchema` — a 457(b)
 * non-governmental plan files no Form 5500 and so has no three-digit plan
 * number, while a 403(b) needs its ERISA status before anything else can be
 * decided about it.
 */
const IdentityBase = z.object({
  planType: z.enum(["401k", "403b", "457b_gov", "457b_nongov", "401a"]),
  employerEin: z.string().regex(einRegex, "EIN must be formatted XX-XXXXXXX"),
  employerName: z.string().min(1, "Legal employer name is required"),
  employerAddress: z.string().optional().or(z.literal("")),
  employerPhone: z.string().optional().or(z.literal("")),
  planName: z.string().min(1, "Plan name is required"),
  // Required only for Form 5500 filers — enforced in the refinement below.
  planNumber: z
    .string()
    .regex(/^\d{3}$/, "Plan number must be exactly 3 digits")
    .optional()
    .or(z.literal("")),
  planYearEnd: z.string().min(1, "Plan year end is required"),
  trustName: z.string().optional().or(z.literal("")),
  planStatus: z.enum(["new", "transfer"]).default("new"),
  originalEffectiveDate: z.string().optional().or(z.literal("")),
  // Every real adoption agreement in the sample set is an amendment and
  // restatement, and the document calls the RESTATEMENT date "the Effective
  // Date" — Election 4(d) on Relius/Avantax forms. Keeping only the initial
  // date threw away the operative one.
  restatedEffectiveDate: z.string().optional().or(z.literal("")),
  transferEffectiveDate: z.string().optional().or(z.literal("")),
  previousRecordkeeper: z.string().optional().or(z.literal("")),
  previousRecordkeeperContact: z.string().optional().or(z.literal("")),
  previousRecordkeeperPhone: z.string().optional().or(z.literal("")),
  previousRecordkeeperEmail: z.string().email().optional().or(z.literal("")),
  approxAssetsTransferring: z.coerce.number().nonnegative().optional(),
  payrollProvider: z.string().optional().or(z.literal("")),

  // ---- 403(b) only ----
  /**
   * Drives almost everything else about a 403(b): a non-ERISA plan files no
   * 5500, has no Section 404(c) relief to claim, and cannot have employer
   * contributions without losing the exemption.
   */
  erisaStatus: z.enum(["erisa", "non_erisa"]).optional(),
  organizationType: z
    .enum(["501c3", "public_school", "church", "hospital", "other"])
    .optional(),

  // ---- 457(b) governmental only ----
  governmentalEntityType: z.enum(["state", "county", "municipal", "school_district", "other"]).optional(),

  // ---- 457(b) non-governmental only ----
  /**
   * The plan is only an eligible Section 457(b) plan if participation is limited to a
   * select group of management or highly compensated employees. This is a
   * sign-off, not a preference, which is why the refinement requires `true`.
   */
  topHatCertified: z.boolean().optional(),

  // ---- 401(a) only ----
  planSubtype: z.enum(["money_purchase", "profit_sharing"]).optional(),
});

export type IdentityStepInput = z.infer<typeof IdentityBase>;

export function buildIdentitySchema(planType?: string) {
  return IdentityBase.superRefine((val, ctx) => {
    // The selected type wins over the argument: a user who changes the
    // dropdown must be validated against what they just picked.
    const p = planProfile(val.planType ?? planType);
    const require = (path: keyof IdentityStepInput, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (val.planStatus === "transfer" && !val.previousRecordkeeper) {
      require("previousRecordkeeper", "Previous recordkeeper is required for a plan transfer");
    }

    // Form 5500 identifies a plan by sponsor EIN + three-digit plan number.
    // A plan that files nothing does not have one to give.
    if (p.files5500 && !val.planNumber) {
      require("planNumber", "Plan number is required for a Form 5500 filer");
    }

    if (p.key === "403b") {
      if (!val.erisaStatus) {
        require("erisaStatus", "Select whether this 403(b) is subject to ERISA");
      }
      if (!val.organizationType) {
        require("organizationType", "Select the employer's organization type");
      }
    }

    if (p.key === "457b_gov" && !val.governmentalEntityType) {
      require("governmentalEntityType", "Select the type of governmental entity");
    }

    if (p.key === "457b_nongov" && val.topHatCertified !== true) {
      require(
        "topHatCertified",
        "A non-governmental 457(b) must be limited to a select group of management or highly compensated employees",
      );
    }

    if (p.key === "401a" && !val.planSubtype) {
      require("planSubtype", "Select money purchase or profit sharing");
    }

    // A trust name only means something where a trust exists. Requiring it of
    // an unfunded top-hat plan would be asking for a document that must not
    // exist; see planProfile.fundingVehicle.
    if (p.fundingVehicle === "unfunded" && val.trustName) {
      require(
        "trustName",
        "A non-governmental 457(b) is unfunded — naming a trust would jeopardise its treatment",
      );
    }
  });
}

/** Default export stays 401(k)-shaped so existing callers keep compiling. */
export const IdentityStepSchema = buildIdentitySchema("401k");
