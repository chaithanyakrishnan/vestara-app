import { z } from "zod";

export const EligibilityStepSchema = z.object({
  minimumAge: z.enum(["none", "18", "20.5", "21"]),
  serviceRequirement: z.enum(["none", "3mo", "6mo", "1yr", "2yr"]),
  entryDates: z.enum(["immediate", "monthly", "quarterly", "semi", "annual"]),
  hoursOfServiceMethod: z.enum(["actual", "elapsed", "split"]),

  excludeUnion: z.boolean().default(false),
  excludeNonResidentAliens: z.boolean().default(false),
  excludePartTime: z.boolean().default(false),
  excludeHce: z.boolean().default(false),

  autoEnrollElected: z.boolean().default(false),
  autoEnrollType: z.enum(["eaca", "qaca", "basic"]).optional(),
  autoEnrollDefaultPct: z.coerce.number().min(1).max(15).optional(),
  autoEnrollEscalation: z.enum(["none", "1pct_yr", "2pct_yr"]).optional(),
  autoEnrollEscalationCap: z.coerce.number().min(1).max(15).optional(),
}).superRefine((val, ctx) => {
  if (val.autoEnrollElected && val.autoEnrollDefaultPct === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["autoEnrollDefaultPct"],
      message: "Default deferral percentage is required when auto-enrollment is elected",
    });
  }
});
export type EligibilityStepInput = z.infer<typeof EligibilityStepSchema>;
