import { z } from "zod";

const einRegex = /^\d{2}-\d{7}$/;

export const IdentityStepSchema = z.object({
  planType: z.enum(["401k", "403b", "457b_gov", "457b_nongov", "401a"]),
  employerEin: z.string().regex(einRegex, "EIN must be formatted XX-XXXXXXX"),
  employerName: z.string().min(1, "Legal employer name is required"),
  employerAddress: z.string().optional().or(z.literal("")),
  employerPhone: z.string().optional().or(z.literal("")),
  planName: z.string().min(1, "Plan name is required"),
  planNumber: z
    .string()
    .regex(/^\d{3}$/, "Plan number must be exactly 3 digits"),
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
  previousRecordkeeperEmail: z
    .string()
    .email()
    .optional()
    .or(z.literal("")),
  approxAssetsTransferring: z.coerce.number().nonnegative().optional(),
  payrollProvider: z.string().optional().or(z.literal("")),
}).superRefine((val, ctx) => {
  if (val.planStatus === "transfer" && !val.previousRecordkeeper) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["previousRecordkeeper"],
      message: "Previous recordkeeper is required for a plan transfer",
    });
  }
});
export type IdentityStepInput = z.infer<typeof IdentityStepSchema>;
