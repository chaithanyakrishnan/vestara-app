import { z } from "zod";

export const VestingRowSchema = z.object({
  yearLabel: z.string(),
  pct: z.coerce.number().min(0).max(100),
});

export const VestingStepSchema = z.object({
  scheduleType: z.enum(["imm", "3cliff", "6graded", "custom"]),
  customSchedule: z.array(VestingRowSchema).optional(),
  // "60" matches the prototype's third NRA option; "sscra" (Social Security
  // retirement age) is retained from the original schema. Cannot exceed 65.
  normalRetirementAge: z.enum(["60", "62", "65", "sscra"]),
  vestingOnDeathDisability: z.enum(["none", "death", "disability", "both"]),
}).superRefine((val, ctx) => {
  if (val.scheduleType === "custom") {
    if (!val.customSchedule || val.customSchedule.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customSchedule"],
        message: "Custom vesting schedule requires at least one row",
      });
    } else {
      const last = val.customSchedule[val.customSchedule.length - 1];
      if (last.pct !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customSchedule"],
          message: "Custom vesting schedule must reach 100% by the final year",
        });
      }
      // IRS minimum vesting check (3-yr cliff / 6-yr graded floor) is enforced
      // at the service layer (irsVestingFloor.ts) since it depends on which
      // minimum table applies; kept out of the pure schema on purpose.
    }
  }
});
export type VestingStepInput = z.infer<typeof VestingStepSchema>;
