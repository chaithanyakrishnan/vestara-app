import { ApiError } from "../../middleware/error.middleware";
import { planProfile, type VestingStepInput } from "@vestara/shared";

/**
 * Vesting rules that a pure Zod schema is the wrong place for.
 *
 * Two reasons they live beside the write path instead:
 *
 *  1. The Section 411(a)(2)(B) floor means being at least as generous as ONE OF TWO
 *     statutory tables. Which table applies is a plan-design question, not a
 *     shape question.
 *  2. The safe harbor vesting rules depend on the CONTRIBUTIONS step, which the
 *     vesting schema cannot see. `updateStep` reads that step and passes it in.
 *
 * A custom schedule is acceptable if it satisfies EITHER:
 *   - the 6-year graded floor (20% per year from year 2), or
 *   - the 3-year cliff alternative (100% from year 3).
 * It must also never decrease — vesting cannot be clawed back by staying longer.
 */

/** Minimum vested % by completed years of service under the 6-year graded table. */
const GRADED_FLOOR = [0, 0, 20, 40, 60, 80, 100];

const floorForYear = (year: number) => GRADED_FLOOR[Math.min(year, GRADED_FLOOR.length - 1)];

type ContributionsLike = {
  safeHarborElected?: boolean;
  safeHarborType?: "basic" | "enhanced" | "ne" | "qaca";
} | null | undefined;

function checkCustomSchedule(data: VestingStepInput): void {
  if (data.scheduleType !== "custom") return;
  const rows = data.customSchedule;
  // Absent/short/does-not-reach-100 cases are already rejected by the schema.
  if (!rows || rows.length === 0) return;

  // Row index doubles as completed years of service: row 0 is "less than 1 year".
  const pcts = rows.map((r) => r.pct);

  for (let i = 1; i < pcts.length; i++) {
    if (pcts[i] < pcts[i - 1]) {
      throw new ApiError(
        422,
        `Vesting schedule decreases at year ${i} (${pcts[i - 1]}% → ${pcts[i]}%). ` +
          "A vesting percentage can never go down as service increases.",
      );
    }
  }

  const satisfiesGraded = pcts.every((pct, year) => pct >= floorForYear(year));
  const satisfiesCliff = pcts.every((pct, year) => (year >= 3 ? pct === 100 : true));

  if (!satisfiesGraded && !satisfiesCliff) {
    const firstShortfall = pcts.findIndex((pct, year) => pct < floorForYear(year));
    throw new ApiError(
      422,
      `Vesting schedule does not satisfy IRC Section 411(a)(2)(B). At year ${firstShortfall} it vests ` +
        `${pcts[firstShortfall]}%, below the ${floorForYear(firstShortfall)}% six-year graded minimum, ` +
        "and it does not fully vest by year 3 under the cliff alternative either.",
    );
  }
}

/**
 * Safe harbor money is vested on its own terms, regardless of the plan's
 * headline schedule. Before this check a user could elect safe harbor
 * non-elective in step 2 and a six-year graded schedule in step 4; the wizard
 * accepted it and the IRS would not.
 */
function checkSafeHarborVesting(data: VestingStepInput, contributions: ContributionsLike): void {
  if (!contributions?.safeHarborElected) return;
  const type = contributions.safeHarborType;
  // The source-specific schedule if one was set, otherwise the plan default.
  const applied = data.safeHarborVesting ?? data.scheduleType;

  if (type === "qaca") {
    // Section 401(k)(13)(D)(iii): a QACA may impose up to a two-year cliff.
    if (applied !== "imm" && applied !== "2cliff") {
      throw new ApiError(
        422,
        "QACA safe harbor contributions may use immediate vesting or a two-year cliff at most " +
          "(Section 401(k)(13)(D)(iii)). Set the safe harbor source accordingly.",
      );
    }
    return;
  }

  if (type === "basic" || type === "enhanced" || type === "ne") {
    if (applied !== "imm") {
      throw new ApiError(
        422,
        `Safe harbor ${type === "ne" ? "non-elective" : "matching"} contributions must be 100% vested ` +
          "immediately (Section 401(k)(12)). Set the safe harbor source to immediate vesting.",
      );
    }
  }
}

/**
 * Per-source schedules are subject to the same Section 411 floor as the headline one.
 * A two-year cliff is the single exception and only for QACA money, which
 * `checkSafeHarborVesting` handles.
 */
function checkSourceSchedules(data: VestingStepInput): void {
  for (const [label, value] of [
    ["Match", data.matchVesting],
    ["Non-elective", data.nonelectiveVesting],
  ] as const) {
    if (value === "2cliff") {
      throw new ApiError(
        422,
        `${label} contributions cannot use a two-year cliff — that schedule is available only to ` +
          "QACA safe harbor money. Use immediate, three-year cliff, or six-year graded.",
      );
    }
  }
}

/**
 * The entry point `updateStep` calls. `planType` and `contributions` come from
 * the draft, so this sees the whole plan rather than one step in isolation.
 */
export function validateVestingAgainstPlan(
  data: VestingStepInput,
  planType: string | undefined,
  contributions: ContributionsLike,
): void {
  const p = planProfile(planType);

  // Section 411 does not reach governmental plans or non-governmental 457(b) top-hat
  // plans. Applying the graded/cliff floors there would reject lawful designs.
  if (!p.erisaVestingFloors) return;

  checkCustomSchedule(data);
  checkSourceSchedules(data);
  checkSafeHarborVesting(data, contributions);
}

/** @deprecated Use validateVestingAgainstPlan — kept for callers that only have the step. */
export function validateCustomVestingSchedule(data: VestingStepInput): void {
  checkCustomSchedule(data);
}
