import { z } from "zod";

export const AdministrationStepSchema = z.object({
  loansPermitted: z.boolean().default(false),
  loanMinAmount: z.coerce.number().min(0).optional(),
  loanMaxOutstanding: z.enum(["1", "2", "unlimited"]).optional(),
  loanInterestRate: z.enum(["prime", "prime1", "prime2"]).optional(),
  loanPurpose: z.enum(["any", "hardship_only"]).optional(),
  loanHomeMaxTermYears: z.coerce.number().min(1).max(30).optional(),
  loanRefinancing: z.enum(["allowed", "not_allowed"]).optional(),
  loanAcceleration: z.enum(["on_termination", "never"]).optional(),
  loanPaymentsOnLeave: z.enum(["suspend", "continue"]).optional(),

  inServiceAt59_5: z.boolean().default(false),
  hardshipElected: z.boolean().default(false),
  hardshipType: z.enum(["safe", "non"]).optional(),

  rolloversAccepted: z.boolean().default(true),
  rolloverSources: z.enum(["all", "qualified_only", "none"]).optional(),

  planExpensePayer: z.enum(["plan", "employer"]),
  employerPaymentMethod: z.enum(["ach", "check", "wire"]).optional(),
  employerPaymentBankName: z.string().optional().or(z.literal("")),
  employerPaymentAccountType: z.enum(["checking", "savings"]).optional(),
  // NOTE: these two carry real bank credentials. They are stored in the
  // PlanStepData JSON blob like every other step field, and plan routes do NOT
  // yet verify that the caller owns the plan (see requireAuth vs. the unused
  // requireRole in plans.routes.ts). Added at the product owner's explicit
  // direction; the ownership check should land before any real deployment.
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
}).superRefine((val, ctx) => {
  if (val.loansPermitted && val.loanMinAmount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["loanMinAmount"],
      message: "Minimum loan amount is required when loans are permitted",
    });
  }
  if (val.planExpensePayer === "employer" && !val.employerPaymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["employerPaymentMethod"],
      message: "Select how the employer will pay plan expenses",
    });
  }
  // Bank details are only meaningful for an automatic draft — a check or wire
  // is arranged out of band, so requiring them there would be noise.
  if (val.planExpensePayer === "employer" && val.employerPaymentMethod === "ach") {
    if (!val.employerPaymentBankName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employerPaymentBankName"],
        message: "Bank name is required for ACH",
      });
    }
    if (!val.employerPaymentRoutingNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employerPaymentRoutingNumber"],
        message: "Routing number is required for ACH",
      });
    }
    if (!val.employerPaymentAccountNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employerPaymentAccountNumber"],
        message: "Account number is required for ACH",
      });
    }
  }
});
export type AdministrationStepInput = z.infer<typeof AdministrationStepSchema>;
