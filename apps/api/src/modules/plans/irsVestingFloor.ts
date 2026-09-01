import { ApiError } from "../../middleware/error.middleware";
import type { VestingStepInput } from "@vestara/shared";

/**
 * Enforces the IRC §411(a)(2)(B) minimum vesting floor for a *custom* schedule.
 *
 * VestingStepSchema deliberately stops at "must reach 100% by the final year"
 * and defers this check here (see the comment in schemas/vesting.ts), because
 * satisfying §411 means being at least as generous as *one of two* statutory
 * tables — which table applies is a plan-design question, not a shape question,
 * and a pure Zod schema is the wrong place to branch on it.
 *
 * A custom schedule is acceptable if it satisfies EITHER:
 *   - the 6-year graded floor (20% per year from year 2), or
 *   - the 3-year cliff alternative (100% from year 3).
 * It must also never decrease — vesting cannot be clawed back by staying longer.
 */

/** Minimum vested % by completed years of service under the 6-year graded table. */
const GRADED_FLOOR = [0, 0, 20, 40, 60, 80, 100];

const floorForYear = (year: number) => GRADED_FLOOR[Math.min(year, GRADED_FLOOR.length - 1)];

export function validateCustomVestingSchedule(data: VestingStepInput): void {
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
      `Vesting schedule does not satisfy IRC §411(a)(2)(B). At year ${firstShortfall} it vests ` +
        `${pcts[firstShortfall]}%, below the ${floorForYear(firstShortfall)}% six-year graded minimum, ` +
        "and it does not fully vest by year 3 under the cliff alternative either.",
    );
  }
}
