import { z } from "zod";
import { planProfile } from "./planProfile";

export const VestingRowSchema = z.object({
  yearLabel: z.string(),
  pct: z.coerce.number().min(0).max(100),
});

export const VESTING_SCHEDULE_TYPES = ["imm", "3cliff", "6graded", "2cliff", "custom"] as const;
export type VestingScheduleType = (typeof VESTING_SCHEDULE_TYPES)[number];

const VestingBase = z.object({
  /**
   * The plan's primary employer-money schedule. Kept as the headline field for
   * continuity, and used as the default for any source left unset.
   */
  scheduleType: z.enum(VESTING_SCHEDULE_TYPES),
  customSchedule: z.array(VestingRowSchema).optional(),

  /**
   * Vesting is a property of each MONEY SOURCE, not of the plan. Several
   * sources can never carry a schedule at all: elective deferrals Section 411(a)(1),
   * safe harbor non-elective and basic/enhanced match Section 401(k)(12), QNECs,
   * QMACs and rollovers. QACA safe harbor money may use a two-year cliff at
   * most, Section 401(k)(13)(D)(iii). Modelling one schedule for the whole plan let a
   * user elect safe harbor non-elective and a six-year graded schedule
   * together — accepted by the wizard, disqualifying in practice.
   */
  matchVesting: z.enum(VESTING_SCHEDULE_TYPES).optional(),
  nonelectiveVesting: z.enum(VESTING_SCHEDULE_TYPES).optional(),
  safeHarborVesting: z.enum(VESTING_SCHEDULE_TYPES).optional(),

  // "60" matches the prototype's third NRA option; "sscra" (Social Security
  // retirement age) is retained from the original schema. Cannot exceed 65.
  normalRetirementAge: z.enum(["60", "62", "65", "sscra"]),
  vestingOnDeathDisability: z.enum(["none", "death", "disability", "both"]),

  /**
   * Non-governmental 457(b) money is subject to a substantial risk of
   * forfeiture rather than an ERISA vesting schedule — a different concept
   * with different consequences, so it gets its own field.
   */
  substantialRiskOfForfeiture: z.enum(["none", "service", "performance"]).optional(),
});

export type VestingStepInput = z.infer<typeof VestingBase>;

export function buildVestingSchema(planType?: string) {
  const p = planProfile(planType);

  return VestingBase.superRefine((val, ctx) => {
    const require = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (val.scheduleType === "custom") {
      if (!val.customSchedule || val.customSchedule.length === 0) {
        require("customSchedule", "Custom vesting schedule requires at least one row");
      } else {
        const last = val.customSchedule[val.customSchedule.length - 1];
        if (last.pct !== 100) {
          require("customSchedule", "Custom vesting schedule must reach 100% by the final year");
        }
        // The IRC Section 411(a)(2)(B) minimum check (3-year cliff / 6-year graded
        // floor) runs at the service layer in irsVestingFloor.ts, which also
        // knows the plan type and the contribution elections.
      }
    }

    // A two-year cliff is lawful ONLY for QACA safe harbor money. Offering it
    // as the plan-wide schedule would fail Section 411 for ordinary employer money.
    if (val.scheduleType === "2cliff") {
      require(
        "scheduleType",
        "A two-year cliff is only available to QACA safe harbor contributions — set it on the safe harbor source instead",
      );
    }

    if (!p.erisaVestingFloors) {
      // Section 411 does not reach governmental or non-governmental 457(b) plans.
      if (p.topHatOnly && !val.substantialRiskOfForfeiture) {
        require(
          "substantialRiskOfForfeiture",
          "State the substantial risk of forfeiture, if any, that applies to deferred amounts",
        );
      }
    }
  });
}

export const VestingStepSchema = buildVestingSchema("401k");
